import express from "express";
import { db } from "./db.js";
import { fetchEbayOrders } from "./ebayOrders.js";

const router = express.Router();

router.get("/orders", async (req, res) => {
  const { rows } = await db.query("SELECT * FROM orders ORDER BY created_at DESC");
  res.json(rows);
});

router.post("/fetch-orders", async (req, res) => {
  await fetchEbayOrders();
  res.json({ status: "ok" });
});

router.post("/order-status", async (req, res) => {
  const { ebay_order_id, status } = req.body;
  await db.query(
    "UPDATE orders SET order_status=$1, updated_at=NOW() WHERE ebay_order_id=$2",
    [status, ebay_order_id]
  );
  res.json({ status: "updated" });
});

export default router;
