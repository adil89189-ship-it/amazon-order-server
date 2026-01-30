import express from "express";
import pkg from "pg";
import cors from "cors";
import axios from "axios";
import "dotenv/config";

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
// Save order to DB
// =======================
app.post("/api/orders", async (req, res) => {
  const {
    ebay_order_id,
    buyer_name,
    buyer_address,
    item_title,
    item_sku,
    quantity,
    price
  } = req.body;

  await pool.query(
    `INSERT INTO orders 
     (ebay_order_id, buyer_name, buyer_address, item_title, item_sku, quantity, price)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (ebay_order_id) DO NOTHING`,
    [ebay_order_id, buyer_name, buyer_address, item_title, item_sku, quantity, price]
  );

  res.json({ success: true });
});

// =======================
// Fetch eBay orders (Trading API)
// =======================
app.post("/api/fetch-ebay-orders", async (req, res) => {
  const xml = `
<?xml version="1.0" encoding="utf-8"?>
<GetOrdersRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${EBAY_TOKEN}</eBayAuthToken>
  </RequesterCredentials>
  <CreateTimeFrom>${new Date(Date.now() - 24*60*60*1000).toISOString()}</CreateTimeFrom>
  <CreateTimeTo>${new Date().toISOString()}</CreateTimeTo>
  <OrderRole>Seller</OrderRole>
  <OrderStatus>All</OrderStatus>
</GetOrdersRequest>`;

  const response = await axios.post(EBAY_TRADING_ENDPOINT, xml, {
    headers: {
      "X-EBAY-API-CALL-NAME": "GetOrders",
      "X-EBAY-API-SITEID": "0",
      "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
      "Content-Type": "text/xml"
    }
  });

  res.send(response.data);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});

