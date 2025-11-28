import pool from "../Server/dbConnection/dbcon.js";
import nodemailer from "nodemailer";

// --------------------- Email Transport ---------------------
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// --------------------- Helper Function ---------------------
function isMatch(preferredPosition, jobPosition) {
  if (!preferredPosition || !jobPosition) return false;
  // Case-insensitive substring match
  return jobPosition.toLowerCase().includes(preferredPosition.toLowerCase());
}

// --------------------- Email Sending ---------------------
async function sendMatchedEmail(email, jobs) {
  const jobList = jobs
    .map(j => `• ${j.position} at ${j.company}\n${j.link}`)
    .join("\n\n");

  try {
    const info = await transporter.sendMail({
      from: `"Job Alert" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "New Job Matches for Your Preferred Position",
      text: `We found new job openings that match your preferred position:\n\n${jobList}`,
    });

    console.log(`Email sent to ${email} - Accepted:`, info.accepted);
  } catch (err) {
    console.error("Nodemailer Error:", err);
  }
}

// --------------------- Main Function ---------------------
export async function findMatchingUsersAndSendEmails() {
  // Get users and their preferred positions
  const [users] = await pool.query(`
    SELECT u.id, u.email, p.preferred_position
    FROM users u
    JOIN user_preferences p ON u.id = p.user_id
  `);

  // Get newly added jobs that haven't been notified yet
  const [jobs] = await pool.query(`
    SELECT * FROM internships
    WHERE id NOT IN (
      SELECT job_id FROM notifications_sent
    )
    ORDER BY id DESC
  `);

  for (const user of users) {
    if (!user.preferred_position) continue;

    // Filter jobs that match preferred position
    const matchedJobs = jobs.filter(job =>
      isMatch(user.preferred_position, job.position)
    );

    if (matchedJobs.length === 0) continue;

    // Send email
    await sendMatchedEmail(user.email, matchedJobs);

    // Record sent notifications
    const values = matchedJobs.map(job => [user.id, job.id]);
    await pool.query(
      "INSERT IGNORE INTO notifications_sent (user_id, job_id) VALUES ?",
      [values]
    );

    console.log(`User ${user.email} notified for ${matchedJobs.length} job(s).`);
  }
}
