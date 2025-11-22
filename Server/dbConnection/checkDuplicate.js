import pool from "./dbcon.js"
export async function checkDuplicate(link) {
  const normalizedLink = link.trim().toLowerCase().replace(/\/$/, "");
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
