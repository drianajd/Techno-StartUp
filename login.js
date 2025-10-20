// This is a Node.js backend using Express.js to handle login form submission.
// It connects to a MySQL database to verify the email and password.
// IMPORTANT NOTES:
// - This example stores passwords in plain text, which is insecure. Use hashing (e.g., bcrypt) in production.
// - Assume a 'credentials' table with 'userId', 'username', 'password', and 'email' columns.
// - Install dependencies: npm init -y && npm install express mysql2 body-parser express-session
// - Serve static files (like login.html and dashboard.html) from a 'public' folder.

const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false
}));
app.use(express.static(path.join(__dirname, 'public')));

// MySQL connection configuration – replace with your actual DB details
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'yourpassword',
  database: 'yourdbname'
});

// Connect to MySQL
db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    return;
  }
  console.log('Connected to MySQL database');
});

// Serve the login page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Handle login form submission
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).send('Email and password are required');
  }

  const query = 'SELECT userId FROM credentials WHERE email = ? AND password = ?';
  db.query(query, [email, password], (err, results) => {
    if (err) {
      console.error('Error querying database:', err);
      return res.status(500).send('Server error');
    }

    if (results.length > 0) {
      req.session.userId = results[0].userId;
      res.redirect('/dashboard');
    } else {
      res.status(401).send('Invalid email or password');
    }
  });
});

// Serve the dashboard page
app.get('/dashboard', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});