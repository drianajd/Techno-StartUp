import pool from "./dbcon.js";
export async function saveJob(job) {
  const normalizedLink = job.link.trim().toLowerCase().replace(/\/$/, "");

  // Insert directly; let database prevent duplicates
  await pool.query(
    `INSERT IGNORE INTO internships (company, position, link, qualifications, site)
     VALUES (?, ?, ?, ?, ?)`,
    [job.company, job.position, normalizedLink, job.skills, job.site]
  );

  console.log("Job added:", job.position);
}

