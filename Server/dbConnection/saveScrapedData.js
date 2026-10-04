import pool from "./dbcon.js";

const TRACKING_QUERY_PARAMS = new Set([
  "from",
  "ref",
  "refid",
  "trackingid",
  "trk",
  "utm_campaign",
  "utm_content",
  "utm_medium",
  "utm_source",
  "utm_term",
]);

function normalizeLink(link) {
  const url = new URL(link);

  for (const key of url.searchParams.keys()) {
    if (TRACKING_QUERY_PARAMS.has(key.toLowerCase())) {
      url.searchParams.delete(key);
    }
  }

  return url.origin + url.pathname + url.search;
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
  try {
    await pool.query(
      `INSERT IGNORE INTO internships (title, company, position, location,       link, site, logo, date_posted)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        job.title || "",
        job.company || "",
        job.position || "",
        job.location || "",
        normalizedLink,
              job.site || "",
              job.logo_url || null,
              job.date_posted || new Date()
            ]
          );
          if (job.logo_url) {
            await pool.query(
              "UPDATE internships SET logo = ? WHERE link = ? AND (logo IS NULL OR logo = '')",
              [job.logo_url, normalizedLink]
            );
          }
  } catch (err) {
    console.error("saveJob error:", err);
    throw err;
  }
}