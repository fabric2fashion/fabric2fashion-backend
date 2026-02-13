const { Pool } = require("pg");

console.log("ENV CHECK:", {
  DATABASE_URL: process.env.DATABASE_URL ? "present" : "missing",
  NODE_ENV: process.env.NODE_ENV
});

let pool;

if (process.env.DATABASE_URL) {
  console.log("🌍 Using production database");

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

} else {
  console.log("💻 Using local database");

  pool = new Pool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: 5432
  });
}

module.exports = pool;
