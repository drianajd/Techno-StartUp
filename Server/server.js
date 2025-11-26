// Server/server.js
import express from "express";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import bcrypt from "bcrypt";
import session from "express-session";
import MySQLStoreFactory from "express-mysql-session";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import cron from "node-cron";
import { exec } from "child_process";
import { findMatchingUsersAndSendEmails } from "./mailer.js";

dotenv.config();
const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --------------------- Middleware ---------------------
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5500'],
  credentials: true
}));
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Debug middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// --------------------- MySQL connection ---------------------
let pool;
async function createPool() {
  try {
    pool = mysql.createPool({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASS || "",
      database: process.env.DB_NAME || "node_app",
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    await pool.getConnection();
    console.log("MySQL connection successful");
  } catch (err) {
    console.error("MySQL connection failed:", err);
    process.exit(1);
  }
}

// --------------------- Session store ---------------------
function initSession() {
  const MySQLStore = MySQLStoreFactory(session);
  const sessionStore = new MySQLStore({
    checkExpirationInterval: 900000,
    expiration: 86400000,
    createDatabaseTable: true
  }, pool);

  app.use(session({
    key: "session_cookie_name",
    secret: process.env.SESSION_SECRET || "change_this_secret",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
      maxAge: 1000 * 60 * 60 * 24,
      sameSite: 'lax'
    }
  }));
}

// --------------------- Run scraper.py ---------------------
export async function runScraper() {
  const scriptPath = path.join(__dirname, "../Route/scraper.py"); // updated path
  const pythonCmd = "py -3.11"; // adjust if needed

  console.log(`Running scraper: ${scriptPath}`);

  return new Promise((resolve, reject) => {
    exec(`${pythonCmd} "${scriptPath}"`, { maxBuffer: 1024 * 1024 * 10 }, async (error, stdout, stderr) => {
      if (error) {
        console.error("Scraper error:", error);
        return reject(error);
      }

      if (stderr) console.error("Scraper stderr:", stderr);

      let conn;
      try {
        const jobs = JSON.parse(stdout);
        console.log(`Total jobs scraped: ${jobs.length}`);

        conn = await pool.getConnection();
        let inserted = 0;

        for (const job of jobs) {
          if (!job.link) continue;

          // check for duplicate
          const [rows] = await conn.query("SELECT id FROM internships WHERE link = ?", [job.link]);
          if (rows.length > 0) continue;

          await conn.query(
            `INSERT INTO internships (company, position, link, qualifications, site)
             VALUES (?, ?, ?, ?, ?)`,
            [
              job.company || "",
              job.title || "",
              job.link,
              job.description || "", // scraper.py currently does not return description/qualifications
              job.site || ""
            ]
          );
          inserted++;
        }

        console.log(`Inserted ${inserted} new jobs into the database.`);
        resolve(inserted);
      } catch (err) {
        console.error("Error parsing scraper output or inserting jobs:", err);
        reject(err);
      } finally {
        if (conn) conn.release();
      }
    });
  });
}

// --------------------- Routes ---------------------
app.get("/api/test", (req, res) => {
  res.json({ message: 'Server is running!', timestamp: new Date().toISOString() });
});

app.get("/test-email", async (req, res) => {
  try {
    await findMatchingUsersAndSendEmails();
    res.send("Email sent! Check your inbox.");
  } catch (err) {
    console.error(err);
    res.status(500).send("Email sending failed.");
  }
});

// Trigger JobSpy scraping manually
app.get("/api/jobs", async (req, res) => {
  try {
    const inserted = await runScraper();
    res.json({ success: true, inserted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Serve static pages
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/dashboard.html", (req, res) => {
  if (!req.session.userId) return res.redirect("/");
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// --------------------- Auth: Register ---------------------
app.post("/api/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: "Missing fields" });

    const [existingRows] = await pool.query(
      "SELECT id FROM users WHERE username = ? OR email = ?", [username, email]
    );

    if (existingRows.length > 0) return res.status(409).json({ error: "Username or email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      "INSERT INTO users (username, email, password, created_at) VALUES (?, ?, ?, NOW())", 
      [username, email, hashedPassword]
    );

    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// --------------------- Auth: Login ---------------------
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Missing fields" });

    const [rows] = await pool.query(
      "SELECT id, username, email, password FROM users WHERE username = ? OR email = ?", 
      [username, username]
    );

    if (rows.length === 0) return res.status(401).json({ error: "Invalid credentials" });

    const user = rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return res.status(401).json({ error: "Invalid credentials" });

    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ error: "Server error" });
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.email = user.email;
      res.json({ success: true, message: "Logged in successfully", user: { id: user.id, username: user.username, email: user.email } });
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// --------------------- Auth: Get Current User ---------------------
app.get("/api/me", async (req, res) => {
  try {
    if (!req.session.userId) return res.json({ loggedIn: false });
    const [rows] = await pool.query("SELECT id, username, email, created_at FROM users WHERE id = ?", [req.session.userId]);
    if (rows.length === 0) {
      req.session.destroy(() => {});
      return res.json({ loggedIn: false });
    }
    res.json({ loggedIn: true, user: rows[0] });
  } catch (err) {
    console.error("Get user error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// --------------------- Auth: Logout ---------------------
app.post("/api/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: "Logout failed" });
    res.clearCookie("session_cookie_name");
    res.json({ success: true });
  });
});

// --------------------- Error & 404 ---------------------
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// --------------------- Cron Jobs ---------------------
cron.schedule("*/30 * * * *", async () => {
  console.log("Auto scraping jobs triggered...");
  try {
    const output = await runScraper();
    console.log("Auto scraping completed:\n", output);
  } catch (err) {
    console.error("Auto scraping error:", err.message);
  }
});

cron.schedule("*/30 * * * *", async () => {
  console.log("Auto-email sender triggered...");
  try {
    await findMatchingUsersAndSendEmails();
    console.log("Auto email sending completed.");
  } catch (err) {
    console.error("Auto email sending error:", err.message);
  }
});

// --------------------- Initialize ---------------------
(async () => {
  await createPool();
  initSession();

  const PORT = process.env.PORT || 5500;
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Test API: http://localhost:${PORT}/api/test`);
    console.log(`Test email: http://localhost:${PORT}/test-email`);
    console.log(`Trigger scraper manually: http://localhost:${PORT}/api/jobs`);

    runScraper().catch(err => {
    console.error("Initial scraper run failed:", err);
  });
  });
})();