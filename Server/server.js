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
import scraperRoutes from "../Route/scraperRoutes.js"
dotenv.config();
const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Debug middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});


// CORS - More permissive for development
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5500'],
  credentials: true
}));

app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is running!', timestamp: new Date().toISOString() });
});

// ---------- MySQL connection pool ----------
async function createPool() {
  try {
    const pool = mysql.createPool({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASS || "",
      database: process.env.DB_NAME || "node_app",
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      // Debug connection
      trace: false
    });

    // Test connection
    await pool.getConnection();
    console.log('✅ MySQL connection successful');
    return pool;
  } catch (error) {
    console.error('❌ MySQL connection failed:', error);
    process.exit(1);
  }
}

// Initialize pool
let pool;
createPool().then(p => {
  pool = p;
  initializeServer();
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

function initializeServer() {
  // ---------- Session store ----------
  const MySQLStore = MySQLStoreFactory(session);
  const sessionStore = new MySQLStore({
    checkExpirationInterval: 900000,
    expiration: 86400000,
    createDatabaseTable: true
  }, pool);

  // Session middleware
  app.use(session({
    key: "session_cookie_name",
    secret: process.env.SESSION_SECRET || "change_this_secret",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // Set to true only with HTTPS
      maxAge: 1000 * 60 * 60 * 24,
      sameSite: 'lax'
    }
  }));
  // ---------- Scraper Route ----------
  app.use("/api", scraperRoutes);


  // Serve static pages
  app.get("/", (req, res) => {
    console.log('Serving index.html');
    res.sendFile(path.join(__dirname, "public", "index.html"));
  });

  app.get("/dashboard.html", (req, res) => {
    if (!req.session.userId) {
      console.log('Unauthorized access to dashboard, redirecting to login');
      return res.redirect("/");
    }
    res.sendFile(path.join(__dirname, "public", "dashboard.html"));
  });

  // ---------- Register ----------
  app.post("/api/register", async (req, res) => {
    console.log('Register attempt:', req.body);
    try {
      const { username, email, password } = req.body;
      
      if (!username || !email || !password) {
        console.log('Missing fields in register');
        return res.status(400).json({ error: "Missing fields" });
      }

      const [existingRows] = await pool.query(
        "SELECT id FROM credentials WHERE username = ? OR email = ?", 
        [username, email]
      );
      
      if (existingRows.length > 0) {
        console.log('User already exists');
        return res.status(409).json({ error: "Username or email already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const [result] = await pool.query(
        "INSERT INTO credentials (username, email, password, created_at) VALUES (?, ?, ?, NOW())", 
        [username, email, hashedPassword]
      );
      
      console.log('User registered successfully:', result.insertId);
      return res.json({ success: true, id: result.insertId });
    } catch (err) {
      console.error("Registration error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  });

  // ---------- Login ----------
  app.post("/api/login", async (req, res) => {
    console.log('Login attempt:', req.body);
    
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        console.log('Missing login fields');
        return res.status(400).json({ error: "Missing fields" });
      }

      const [rows] = await pool.query(
        "SELECT id, username, email, password FROM credentials WHERE username = ? OR email = ?", 
        [username, username]
      );
      
      console.log(`Found ${rows.length} users matching: ${username}`);
      
      if (rows.length === 0) {
        console.log('No user found');
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const user = rows[0];
      const isPasswordValid = await bcrypt.compare(password, user.password);
      
      console.log('Password valid:', isPasswordValid);
      
      if (!isPasswordValid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Regenerate session
      req.session.regenerate((err) => {
        if (err) {
          console.error("Session regeneration error:", err);
          return res.status(500).json({ error: "Server error" });
        }

        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.email = user.email;
        
        console.log('Login successful, session created for user:', user.id);
        
        return res.json({ 
          success: true, 
          message: "Logged in successfully",
          user: {
            id: user.id,
            username: user.username,
            email: user.email
          }
        });
      });
    } catch (err) {
      console.error("Login error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  });

  // ---------- Get current user ----------
  app.get("/api/me", async (req, res) => {
    console.log('Session check:', req.session.userId ? 'Authenticated' : 'Not authenticated');
    
    try {
      if (!req.session.userId) {
        return res.json({ loggedIn: false });
      }
      
      const [rows] = await pool.query(
        "SELECT id, username, email, created_at FROM credentials WHERE id = ?", 
        [req.session.userId]
      );
      
      if (rows.length === 0) {
        req.session.destroy(() => {});
        return res.json({ loggedIn: false });
      }
      
      return res.json({ loggedIn: true, user: rows[0] });
    } catch (err) {
      console.error("Get user error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  });

  // ---------- Logout ----------
  app.post("/api/logout", (req, res) => {
    console.log('Logout requested');
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ error: "Logout failed" });
      }
      res.clearCookie("session_cookie_name");
      console.log('Logout successful');
      return res.json({ success: true });
    });
  });

  // Error handling middleware
  app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  // 404 handler
  app.all("*", (req, res) => {
    console.log('404:', req.originalUrl);
    res.status(404).json({ error: "Not found" });
  });

  // Start server
  const PORT = process.env.PORT || 5500;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📁 Static files from: ${path.join(__dirname, "public")}`);
    console.log(`🧪 Test API: http://localhost:${PORT}/api/test`);
  });
}