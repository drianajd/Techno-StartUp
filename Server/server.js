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
import { saveJob, checkDuplicate } from "./dbConnection/saveScrapedData.js";

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, "../.env") });

// --------------------- Middleware ---------------------
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5500'],
  credentials: true
}));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
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

export async function runScraper() {
  const scriptPath = path.join(__dirname, "../Route/scraper.py");
  const pythonCmd = "py -3.11";

  console.log(`Running scraper...`);

  return new Promise((resolve, reject) => {
    exec(`${pythonCmd} "${scriptPath}"`, { maxBuffer: 1024 * 1024 * 10 }, async (error, stdout, stderr) => {
      if (error) {
        console.error("Scraper error:", error);
        return reject(error);
      }

      if (stderr) console.error("Scraper stderr:", stderr);

      try {
        const jobs = JSON.parse(stdout);
        console.log(`Total jobs scraped: ${jobs.length}`);

        let inserted = 0;

        for (const job of jobs) {
          if (!job.link) continue;

          const isDuplicate = await checkDuplicate(job.link);
          if (isDuplicate) continue;

          await saveJob({
            company: job.company || "",
            position: job.title || "",
            link: job.link,
            skills: job.description || "",
            site: job.site || ""
          });

          inserted++;
        }

        console.log(`Inserted ${inserted} new jobs into the database.`);
        resolve(inserted);
      } catch (err) {
        console.error("Error parsing scraper output or saving jobs:", err);
        reject(err);
      }
    });
  });
}

// --------------------- Initialize ---------------------
(async () => {
  console.log('Server startup begin...');
  
  // Handle unhandled rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });

  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
  });

  console.log('Creating pool...');
  await createPool();
  console.log('Pool created');
  
  console.log('Initializing session...');
  initSession();
  console.log('Session initialized');

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
// fetch all stored jobs from db limit to 100 for now
app.get("/api/jobs/all", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, company, position AS title, link, qualifications AS description, site
       FROM internships
       ORDER BY id DESC
       LIMIT 100`
    );
    res.json({ jobs: rows });
  } catch (err) {
    console.error("Error fetching jobs:", err);
    res.status(500).json({ error: "Failed to fetch jobs" });
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

    console.log("Login successful for user:", user.username, "ID:", user.id);

    req.session.regenerate((err) => {
      if (err) {
        console.error("Session regeneration error:", err);
        return res.status(500).json({ error: "Server error" });
      }
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.email = user.email;
      console.log("Session set for user:", user.username, "Session ID:", req.session.id);
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

// --------------------- Bookmarks: Toggle Bookmark ---------------------
app.post("/api/bookmarks/toggle", async (req, res) => {
  try {
    console.log("Bookmark toggle request - Session:", req.session);
    console.log("UserId from session:", req.session.userId);
    
    // Check if user is logged in
    if (!req.session.userId) {
      console.log("User not logged in");
      return res.status(401).json({ error: "User not logged in" });
    }

    const { internship_id, title } = req.body;
    const userId = req.session.userId;

    console.log("Attempting to toggle bookmark for user:", userId, "internship:", internship_id);

    if (!internship_id) {
      return res.status(400).json({ error: "Missing internship_id" });
    }

    // Check if bookmark already exists
    const [existingBookmark] = await pool.query(
      "SELECT id FROM bookmarks WHERE user_id = ? AND internship_id = ?",
      [userId, internship_id]
    );

    console.log("Existing bookmark check result:", existingBookmark);

    if (existingBookmark.length > 0) {
      // Delete bookmark
      console.log("Deleting bookmark");
      await pool.query(
        "DELETE FROM bookmarks WHERE user_id = ? AND internship_id = ?",
        [userId, internship_id]
      );
      res.json({ success: true, bookmarked: false, message: "Bookmark removed" });
    } else {
      // Add bookmark
      console.log("Adding bookmark");
      await pool.query(
        "INSERT INTO bookmarks (user_id, internship_id) VALUES (?, ?)",
        [userId, internship_id]
      );
      res.json({ success: true, bookmarked: true, message: "Bookmark added" });
    }
  } catch (err) {
    console.error("Bookmark toggle error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// --------------------- Bookmarks: Get User Bookmarks ---------------------
app.get("/api/bookmarks", async (req, res) => {
  try {
    // Check if user is logged in
    if (!req.session.userId) {
      return res.status(401).json({ error: "User not logged in" });
    }

    const userId = req.session.userId;

    // Fetch all bookmarked internship IDs for the user
    const [bookmarks] = await pool.query(
      "SELECT internship_id FROM bookmarks WHERE user_id = ? ORDER BY saved_at DESC",
      [userId]
    );

    const bookmarkIds = bookmarks.map(b => b.internship_id);
    res.json({ success: true, bookmarks: bookmarkIds });
  } catch (err) {
    console.error("Get bookmarks error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// --------------------- Bookmarks: Get Bookmarked Jobs Details ---------------------
app.get("/api/bookmarks/jobs", async (req, res) => {
  try {
    // Check if user is logged in
    if (!req.session.userId) {
      return res.status(401).json({ error: "User not logged in" });
    }

    const userId = req.session.userId;

    // Fetch all bookmarked jobs with their details
    const [bookmarkedJobs] = await pool.query(
      `SELECT i.id, i.company, i.position AS title, i.link, i.qualifications AS description, i.site, b.saved_at
       FROM bookmarks b
       JOIN internships i ON b.internship_id = i.id
       WHERE b.user_id = ?
       ORDER BY b.saved_at DESC`,
      [userId]
    );

    res.json({ success: true, jobs: bookmarkedJobs });
  } catch (err) {
    console.error("Get bookmarked jobs error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// --------------------- Bookmarks: Clear All Bookmarks for User ---------------------
app.post("/api/bookmarks/clear", async (req, res) => {
  try {
    // Require user to be logged in
    if (!req.session.userId) {
      return res.status(401).json({ error: "User not logged in" });
    }

    const userId = req.session.userId;

    // Delete all bookmarks for this user
    await pool.query("DELETE FROM bookmarks WHERE user_id = ?", [userId]);

    console.log(`Cleared all bookmarks for user ${userId}`);
    res.json({ success: true, message: "All bookmarks cleared" });
  } catch (err) {
    console.error("Clear bookmarks error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// --------------------- User Profile: Get Profile ---------------------
app.get("/api/profile", async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: "User not logged in" });
    }

    const userId = req.session.userId;

    // Get user email from users table
    const [userRows] = await pool.query(
      "SELECT email FROM users WHERE id = ?",
      [userId]
    );

    // Get profile data
    const [profileRows] = await pool.query(
      "SELECT * FROM user_profiles WHERE user_id = ?",
      [userId]
    );

    // Get preferences data
    const [prefRows] = await pool.query(
      "SELECT * FROM user_preferences WHERE user_id = ?",
      [userId]
    );

    const profile = profileRows.length > 0 ? profileRows[0] : {};
    const preferences = prefRows.length > 0 ? prefRows[0] : {};
    const email = userRows.length > 0 ? userRows[0].email : '';

    console.log('Retrieved profile date_of_birth from DB:', profile.date_of_birth);

    // Format date as YYYY-MM-DD string to avoid timezone issues
    if (profile.date_of_birth) {
      const date = new Date(profile.date_of_birth);

      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      profile.date_of_birth = `${yyyy}-${mm}-${dd}`;
    }

    // Convert BLOB to base64 if profile picture exists (check for null/undefined)
    if (profile.profile_picture && Buffer.isBuffer(profile.profile_picture)) {
      const base64Picture = profile.profile_picture.toString('base64');
      profile.profile_picture = `data:image/jpeg;base64,${base64Picture}`;
    } else {
      // Ensure profile_picture is null if it doesn't exist
      profile.profile_picture = null;
    }

    // Add email to profile object
    profile.email = email;

    res.json({ success: true, profile, preferences });
  } catch (err) {
    console.error("Get profile error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// --------------------- User Profile: Save Profile ---------------------
app.post("/api/profile", async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: "User not logged in" });
    }

    const userId = req.session.userId;
    const {
      firstName, middleName, lastName, dateOfBirth, gender, address,
      contactNumber, courseYear, preferredIndustry, preferredRole,
      workArrangement, minStipend, profilePicture
    } = req.body;

    console.log('Profile update received:', { firstName, lastName, dateOfBirth });

    // Ensure dateOfBirth is in proper format for MySQL DATE type
    let dbDateOfBirth = dateOfBirth;
    if (dateOfBirth && !dateOfBirth.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // If date is not in YYYY-MM-DD format, try to parse it
      console.warn('Date format incorrect:', dateOfBirth);
    }
    console.log('Database will save dateOfBirth as:', dbDateOfBirth);

    // Process profile picture if provided
    let profilePictureBuffer = null;
    if (profilePicture && profilePicture !== 'null') {
      try {
        // Remove data:image/...;base64, prefix if present
        const base64String = profilePicture.includes(',') 
          ? profilePicture.split(',')[1] 
          : profilePicture;
        profilePictureBuffer = Buffer.from(base64String, 'base64');
        console.log('Profile picture processed, size:', profilePictureBuffer.length);
      } catch (err) {
        console.warn('Could not process profile picture:', err.message);
      }
    }

    // Check if profile exists
    const [existingProfile] = await pool.query(
      "SELECT id FROM user_profiles WHERE user_id = ?",
      [userId]
    );

    if (existingProfile.length > 0) {
      // Update existing profile
      if (profilePictureBuffer) {
        await pool.query(
          `UPDATE user_profiles SET first_name = ?, middle_name = ?, last_name = ?,
           date_of_birth = ?, gender = ?, address = ?, contact_number = ?,
           course_year = ?, profile_picture = ? WHERE user_id = ?`,
          [firstName, middleName, lastName, dbDateOfBirth, gender, address,
           contactNumber, courseYear, profilePictureBuffer, userId]
        );
      } else {
        await pool.query(
          `UPDATE user_profiles SET first_name = ?, middle_name = ?, last_name = ?,
           date_of_birth = ?, gender = ?, address = ?, contact_number = ?,
           course_year = ? WHERE user_id = ?`,
          [firstName, middleName, lastName, dbDateOfBirth, gender, address,
           contactNumber, courseYear, userId]
        );
      }
    } else {
      // Insert new profile
      if (profilePictureBuffer) {
        await pool.query(
          `INSERT INTO user_profiles (user_id, first_name, middle_name, last_name,
           date_of_birth, gender, address, contact_number, course_year, profile_picture)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [userId, firstName, middleName, lastName, dbDateOfBirth, gender, address,
           contactNumber, courseYear, profilePictureBuffer]
        );
      } else {
        await pool.query(
          `INSERT INTO user_profiles (user_id, first_name, middle_name, last_name,
           date_of_birth, gender, address, contact_number, course_year)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [userId, firstName, middleName, lastName, dbDateOfBirth, gender, address,
           contactNumber, courseYear]
        );
      }
    }

    // Check if preferences exist
    const [existingPref] = await pool.query(
      "SELECT id FROM user_preferences WHERE user_id = ?",
      [userId]
    );

    if (existingPref.length > 0) {
      // Update existing preferences
      await pool.query(
        `UPDATE user_preferences SET preferred_industry = ?, preferred_role = ?,
         work_arrangement = ?, min_stipend = ? WHERE user_id = ?`,
        [preferredIndustry, preferredRole, workArrangement, minStipend, userId]
      );
    } else {
      // Insert new preferences
      await pool.query(
        `INSERT INTO user_preferences (user_id, preferred_industry, preferred_role,
         work_arrangement, min_stipend) VALUES (?, ?, ?, ?, ?)`,
        [userId, preferredIndustry, preferredRole, workArrangement, minStipend]
      );
    }

    console.log(`Profile updated for user ${userId}`);
    res.json({ success: true, message: "Profile updated successfully" });
  } catch (err) {
    console.error("Save profile error:", err);
    res.status(500).json({ error: "Server error" });
  }
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

  const PORT = process.env.PORT || 5500;
  const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    // Temporarily disabled for testing
    // runScraper().catch(err => {
    //   console.error("Initial scraper run failed:", err);
    // });
  });

  server.on('error', (err) => {
    console.error('Server error:', err);
  });
})();