import express from "express";
import pkg from "pg";
import cors from "cors";
import axios from "axios";
import "dotenv/config";
import { parseStringPromise } from "xml2js";

const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const EBAY_TRADING_ENDPOINT = "https://api.ebay.com/ws/api.dll";
const EBAY_TOKEN = process.env.EBAY_TRADING_TOKEN;

// =======================
// Health check
// =======================
app.get("/", (req, res) => {
  res.json({ status: "Backend running" });
});

// =======================
// Get Orders from DB
// =======================
app.get("/api/orders", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT * FROM orders ORDER BY created_at DESC"
  );
  res.json(rows);
});

// =======================
// Get last fetch time
// =======================
async function getLastFetchTime() {
  const { rows } = await pool.query(
    "SELECT value FROM app_meta WHERE key='last_fetch_time'"
  );
  return rows[0]?.value;
}

// =======================
// Set last fetch time
// =======================
async function setLastFetchTime(time) {
  await pool.query(
    "UPDATE app_meta SET value=$1 WHERE key='last_fetch_time'",
    [time]
  );
}

// =======================
// Fetch ONLY NEW eBay orders
// =======================
app.post("/api/fetch-ebay-orders", async (req, res) => {
  try {
    const from = await getLastFetchTime();
    const to = new Date().toISOString();

    const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetOrdersRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${EBAY_TOKEN}</eBayAuthToken>
  </RequesterCredentials>
  <CreateTimeFrom>${from}</CreateTimeFrom>
  <CreateTimeTo>${to}</CreateTimeTo>
  <OrderRole>Seller</OrderRole>
  <OrderStatus>All</OrderStatus>
</GetOrdersRequest>`;

    const response = await axios.post(EBAY_TRADING_ENDPOINT, xml, {
      headers: {
        "X-EBAY-API-CALL-NAME": "GetOrders",
        "X-EBAY-API-SITEID": "3",
        "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
        "Content-Type": "text/xml"
      }
    });

    const parsed = await parseStringPromise(response.data, { explicitArray: false });
    const orders = parsed.GetOrdersResponse?.OrderArray?.Order || [];

    let inserted = 0;

    for (const order of [].concat(orders)) {
      const tx = order.TransactionArray.Transaction;

      const ebayOrderId = order.OrderID;
      const buyer = order.ShippingAddress?.Name || "";
      const address = JSON.stringify(order.ShippingAddress || {});
      const item = tx.Item;
      const title = item.Title;
      const sku = item.SKU || "";
      const qty = parseInt(tx.QuantityPurchased);
      const price = parseFloat(tx.TransactionPrice?.Amount || tx.TransactionPrice);

      const result = await pool.query(
        `INSERT INTO orders
         (ebay_order_id, buyer_name, address_json, item_title, item_sku, quantity, price)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (ebay_order_id) DO NOTHING`,
        [ebayOrderId, buyer, address, title, sku, qty, price]
      );

      if (result.rowCount > 0) inserted++;
    }

    // Update last fetch time to NOW
    await setLastFetchTime(to);

    res.json({ status: "ok", new_orders: inserted });

  } catch (err) {
    console.error("FETCH ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// =======================
// Update order status
// =======================
app.post("/order-status", async (req, res) => {
  const { ebay_order_id, status } = req.body;
  await pool.query(
    "UPDATE orders SET order_status=$1, updated_at=NOW() WHERE ebay_order_id=$2",
    [status, ebay_order_id]
  );
  res.json({ status: "updated" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
