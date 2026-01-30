import pkg from "pg";
const { Pool } = pkg;

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("render.com")
    ? { rejectUnauthorized: false }
    : false
});

db.on("connect", () => {
  console.log("✅ DB connected");
});

db.on("error", (err) => {
  console.error("❌ DB error", err);
});
