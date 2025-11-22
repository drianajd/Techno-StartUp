import pool from "../Server/dbConnection/dbcon.js";
import nodemailer from "nodemailer";

// Email sender setup
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Fetch users & skills then compare to job qualifications
export async function findMatchingUsersAndSendEmails() {
  const [users] = await pool.query("SELECT id, email FROM users");

  const [jobs] = await pool.query("SELECT * FROM internships ORDER BY id DESC");

  for (const user of users) {
    // Fetch skills for user
    const [skillsRows] = await pool.query(
      "SELECT skill FROM user_skills WHERE user_id = ?",
      [user.id]
    );

    const userSkills = skillsRows.map(s => s.skill.toLowerCase());

    if (userSkills.length === 0) continue; // Skip users without skills

    // Find matched jobs
    const matchedJobs = jobs.filter(job =>
      userSkills.some(skill =>
        job.qualifications?.toLowerCase().includes(skill)
      )
    );

    // Filter out jobs already sent
    const [alreadySent] = await pool.query(
      "SELECT job_id FROM notifications_sent WHERE user_id = ?",
      [user.id]
    );
    const sentJobIds = new Set(alreadySent.map(row => row.job_id));

    const newJobs = matchedJobs.filter(job => !sentJobIds.has(job.id));

    if (newJobs.length > 0) {
      await sendMatchedEmail(user.email, newJobs);

      // Record sent notifications
      const values = newJobs.map(job => [user.id, job.id]);
      await pool.query(
        "INSERT IGNORE INTO notifications_sent (user_id, job_id) VALUES ?",
        [values]
      );
    }
  }
}

async function sendMatchedEmail(email, jobs) {
  const jobList = jobs
    .map(j => `• ${j.position} at ${j.company}\n${j.link}`)
    .join("\n\n");

  try {
    const info = await transporter.sendMail({
      from: `"Job Alert" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "New Job Matches for Your Skills",
      text: `We found new job openings that match your skills:\n\n${jobList}`,
    });

    console.log("Accepted:", info.accepted);
    console.log("Rejected:", info.rejected);
    console.log("Pending:", info.pending);

  } catch (err) {
    console.error("Nodemailer Error:", err);
  }
}