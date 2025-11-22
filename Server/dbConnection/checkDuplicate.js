import pool from "./dbcon.js"
export async function checkDuplicate(link) {
  try {
    const [rows] = await pool.query(
      "SELECT id FROM internships WHERE link = ? LIMIT 1",
      [link]
    );
    return rows.length > 0; // true if duplicate exists
  } catch (err) {
    console.error("checkDuplicate error:", err);
    return false; // assume not duplicate on error
  }
}