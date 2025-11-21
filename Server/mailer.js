import pool from "../Server/dbConnection/db.js";
import nodemailer from "nodemailer";

//TODO: CREATE AN EMAIL FOR THE APP
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
  const users = await pool.query("SELECT id, email, skills FROM users");
  const jobs = await pool.query("SELECT * FROM scraped_jobs ORDER BY id DESC");

  for (const user of users[0]) {
    const userSkills = JSON.parse(user.skills || "[]");

    // Match: job qualifications contain at least 1 user skill
    const matchedJobs = jobs[0].filter(job =>
      userSkills.some(skill =>
        job.qualifications.toLowerCase().includes(skill.toLowerCase())
      )
    );

    if (matchedJobs.length > 0) {
      await sendMatchedEmail(user.email, matchedJobs);
    }
  }
}

async function sendMatchedEmail(email, jobs) {
  const jobList = jobs
    .map(j => `• ${j.position} at ${j.company}\n${j.link}`)
    .join("\n\n");

  await transporter.sendMail({
    from: `"Job Alert" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "New Job Matches for Your Skills",
    text: `We found new job openings that match your skills:\n\n${jobList}`,
  });

  // TODO: remove
  console.log(`Email sent to ${email}`);
}
