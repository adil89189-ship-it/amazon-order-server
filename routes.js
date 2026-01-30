import express from "express";
import { db } from "./db.js";
import { fetchEbayOrders } from "./ebayOrders.js";

const router = express.Router();

router.get("/orders", async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM orders ORDER BY created_at DESC");
    res.json(rows);
  } catch (e) {
    console.error("ORDERS ERROR:", e);
    res.status(500).json({ error: e.message });
  }
});

router.post("/fetch-orders", async (req, res) => {
  try {
    await fetchEbayOrders();
    res.json({ status: "ok" });
  } catch (e) {
    console.error("FETCH ERROR:", e);
    res.status(500).json({ error: e.message });
  }
});

router.post("/order-status", async (req, res) => {
  try {
    const { ebay_order_id, status } = req.body;
    await db.query(
      "UPDATE orders SET order_status=$1, updated_at=NOW() WHERE ebay_order_id=$2",
      [status, ebay_order_id]
    );
    res.json({ status: "updated" });
  } catch (e) {
    console.error("STATUS ERROR:", e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
