export async function saveJob(job) {
  const [existing] = await pool.query(
    "SELECT id FROM scraped_jobs WHERE link = ? LIMIT 1",
    [job.link]
  );

  if (existing.length > 0) {
    console.log("Duplicate skipped:", job.link);
    return;
  }

  await pool.query(
    `INSERT INTO scraped_jobs (company, position, link, qualifications, site)
     VALUES (?, ?, ?, ?, ?)`,
    [job.company, job.position, job.link, job.skills, job.site]
  );

  console.log("Job added:", job.position);
}
