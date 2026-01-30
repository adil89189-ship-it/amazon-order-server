import express from "express";
import cors from "cors";
import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();
const { Pool } = pkg;

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.get("/", (req, res) => res.send("API OK"));

// SAVE ORDER
app.post("/api/save-order", async (req, res) => {
  const { ebay_order_id, item_title, quantity, product_url } = req.body;
  if (!ebay_order_id) return res.status(400).json({ error: "Missing ebay_order_id" });

  try {
    await pool.query(`
      INSERT INTO orders (ebay_order_id, item_title, quantity, product_url, order_status)
      VALUES ($1,$2,$3,$4,'pending')
      ON CONFLICT (ebay_order_id)
      DO UPDATE SET item_title=EXCLUDED.item_title,
                    quantity=EXCLUDED.quantity,
                    product_url=EXCLUDED.product_url
    `, [ebay_order_id, item_title, quantity || 1, product_url]);

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "db error" });
  }
});

// GET ORDERS
app.get("/api/orders", async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM orders ORDER BY id DESC");
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: "db error" });
  }
});

// SET STATUS
app.post("/api/set-status", async (req, res) => {
  const { ebay_order_id, status } = req.body;
  if (!ebay_order_id || !status) return res.status(400).json({ error: "Missing params" });

  try {
    await pool.query(
      "UPDATE orders SET order_status=$1 WHERE ebay_order_id=$2",
      [status, ebay_order_id]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "db error" });
  }
});

app.listen(process.env.PORT || 10000, () => console.log("Server running"));
