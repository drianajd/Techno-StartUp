import pool from "./dbcon.js";

function normalizeLink(link) {
  // Extract only the part before the query params
  const url = new URL(link);
  return url.origin + url.pathname; // e.g., https://ph.linkedin.com/jobs/view/.../4320250897
}

export async function checkDuplicate(link) {
  const normalizedLink = normalizeLink(link);
  try {
    const [rows] = await pool.query(
      "SELECT id FROM internships WHERE link = ? LIMIT 1",
      [normalizedLink]
    );
    return rows.length > 0;
  } catch (err) {
    console.error("checkDuplicate error:", err);
    return false;
  }
}

export async function saveJob(job) {
  const normalizedLink = normalizeLink(job.link);
  await pool.query(
    `INSERT IGNORE INTO internships (company, position, link, qualifications, site)
     VALUES (?, ?, ?, ?, ?)`,
    [job.company, job.position, normalizedLink, job.skills, job.site]
  );
  console.log("Job added:", job.position);
}