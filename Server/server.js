// server.js
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

dotenv.config();
const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// ---------- MySQL connection pool ----------
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME || "node_app",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// ---------- Session store ----------
const MySQLStore = MySQLStoreFactory(session);
const sessionStore = new MySQLStore({}, pool);

// session middleware
app.use(session({
  key: "session_cookie_name",
  secret: process.env.SESSION_SECRET || "change_this_secret",
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    // secure: true, // set to true when serving over HTTPS
    maxAge: 1000 * 60 * 60 * 24 // 1 day
  }
}));

// ---------- Utility: auth middleware ----------
function ensureAuthenticated(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.status(401).json({ error: "Unauthorized" });
}

// ---------- Routes ----------

// Serve main pages
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Register
app.post("/api/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: "Missing fields" });

    // check existing
    const [rows] = await pool.query("SELECT id FROM users WHERE username = ? OR email = ?", [username, email]);
    if (rows.length > 0) return res.status(409).json({ error: "Username or email already exists" });

    // hash
    const hashed = await bcrypt.hash(password, 10);
    const [result] = await pool.query("INSERT INTO users (username, email, password) VALUES (?, ?, ?)", [username, email, hashed]);
    return res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// Login
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Missing fields" });

    const [rows] = await pool.query("SELECT id, password FROM users WHERE username = ?", [username]);
    if (rows.length === 0) return res.status(401).json({ error: "Invalid credentials" });

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    // set session
    req.session.userId = user.id;
    req.session.username = username;
    return res.json({ success: true, message: "Logged in" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// Logout
app.post("/api/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Logout failed" });
    }
    res.clearCookie("session_cookie_name");
    return res.json({ success: true });
  });
});

// Read: get all users (protected)
app.get("/api/users", ensureAuthenticated, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT id, username, email, created_at FROM users");
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// Read: get current user
app.get("/api/me", async (req, res) => {
  try {
    if (!req.session.userId) return res.json({ loggedIn: false });
    const [rows] = await pool.query("SELECT id, username, email, created_at FROM users WHERE id = ?", [req.session.userId]);
    if (rows.length === 0) return res.json({ loggedIn: false });
    return res.json({ loggedIn: true, user: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// Update user (protected) - updates username or email; password change separate
app.put("/api/users/:id", ensureAuthenticated, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (req.session.userId !== id) return res.status(403).json({ error: "Forbidden" });

    const { username, email } = req.body;
    if (!username && !email) return res.status(400).json({ error: "Nothing to update" });

    // basic uniqueness check
    if (username) {
      const [check] = await pool.query("SELECT id FROM users WHERE username = ? AND id != ?", [username, id]);
      if (check.length > 0) return res.status(409).json({ error: "Username already taken" });
    }
    if (email) {
      const [check] = await pool.query("SELECT id FROM users WHERE email = ? AND id != ?", [email, id]);
      if (check.length > 0) return res.status(409).json({ error: "Email already taken" });
    }

    const fields = [];
    const values = [];
    if (username) { fields.push("username = ?"); values.push(username); }
    if (email) { fields.push("email = ?"); values.push(email); }
    values.push(id);

    const sql = `UPDATE users SET ${fields.join(", ")} WHERE id = ?`;
    await pool.query(sql, values);
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// Change password (protected)
app.put("/api/users/:id/password", ensureAuthenticated, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (req.session.userId !== id) return res.status(403).json({ error: "Forbidden" });

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: "Missing fields" });

    const [rows] = await pool.query("SELECT password FROM users WHERE id = ?", [id]);
    if (rows.length === 0) return res.status(404).json({ error: "User not found" });

    const ok = await bcrypt.compare(currentPassword, rows[0].password);
    if (!ok) return res.status(401).json({ error: "Current password incorrect" });

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query("UPDATE users SET password = ? WHERE id = ?", [hashed, id]);
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// Delete account (protected)
app.delete("/api/users/:id", ensureAuthenticated, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (req.session.userId !== id) return res.status(403).json({ error: "Forbidden" });

    await pool.query("DELETE FROM users WHERE id = ?", [id]);
    // destroy session
    req.session.destroy(() => {});
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// fallback
app.all("*", (req, res) => {
  res.status(404).json({ error: "Not found" });
});

// start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
