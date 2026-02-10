require("dotenv").config();
const pool = require("./db");

(async () => {
  try {
    console.log("ENV CHECK:", {
      DB_NAME: process.env.DB_NAME,
      DB_USER: process.env.DB_USER
    });

    const now = await pool.query("SELECT NOW()");
    console.log("DB OK:", now.rows[0]);

    const users = await pool.query(
      "SELECT id, name, mobile, role, approval_status, is_active FROM users"
    );

    console.log("USERS FOUND:", users.rows);
    process.exit(0);
  } catch (err) {
    console.error("DB TEST ERROR:", err);
    process.exit(1);
  }
})();
