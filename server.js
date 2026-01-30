import express from "express";
import pkg from "pg";

const { Pool } = pkg;
const app = express();
app.use(express.json());

// ================== CONFIG ==================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const PORT = process.env.PORT || 10000;

// ================== INIT ==================
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      ebay_order_id TEXT UNIQUE,
      item_title TEXT,
      quantity INTEGER,
      product_url TEXT,
      order_status TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  console.log("✅ orders table ready");
}
initDB();

// ================== GET ORDERS ==================
app.get("/api/orders", async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT ebay_order_id, item_title, quantity, product_url, order_status
      FROM orders
      ORDER BY created_at DESC
    `);
    res.json(r.rows);
  } catch (e) {
    console.error("GET /api/orders error:", e);
    res.status(500).json({ error: "db_error" });
  }
});

// ================== SAVE EBAY ORDER ==================
app.post("/api/save-order", async (req, res) => {
  const { ebay_order_id, item_title, quantity, product_url } = req.body;

  if (!ebay_order_id) {
    return res.status(400).json({ error: "missing ebay_order_id" });
  }

  try {
    await pool.query(`
      INSERT INTO orders (ebay_order_id, item_title, quantity, product_url, order_status)
      VALUES ($1,$2,$3,$4,'pending')
      ON CONFLICT (ebay_order_id)
      DO UPDATE SET
        item_title = EXCLUDED.item_title,
        quantity = EXCLUDED.quantity,
        product_url = EXCLUDED.product_url
    `, [ebay_order_id, item_title, quantity, product_url]);

    res.json({ ok: true });
  } catch (e) {
    console.error("SAVE error:", e);
    res.status(500).json({ error: "db_error" });
  }
});

// ================== SET ORDERED ==================
app.post("/api/set-ordered", async (req, res) => {
  const { ebay_order_id } = req.body;

  if (!ebay_order_id) {
    return res.status(400).json({ error: "missing ebay_order_id" });
  }

  try {
    await pool.query(`
      UPDATE orders
      SET order_status = 'ordered'
      WHERE ebay_order_id = $1
    `, [ebay_order_id]);

    res.json({ ok: true });
  } catch (e) {
    console.error("SET ORDERED error:", e);
    res.status(500).json({ error: "db_error" });
  }
});

// ================== HEALTH ==================
app.get("/", (req, res) => {
  res.send("Amazon Order Server OK");
});

// ================== START ==================
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
