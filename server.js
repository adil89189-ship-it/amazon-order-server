import express from "express";
import fetch from "node-fetch";
import bodyParser from "body-parser";
import cors from "cors";

const app = express();
app.use(cors());
app.use(bodyParser.json());

const EBAY_ENDPOINT = "https://api.ebay.com/ws/api.dll";
const SITE_ID = "3"; // UK = 3 (change if needed)
const EBAY_TOKEN = process.env.EBAY_TRADING_TOKEN;

if (!EBAY_TOKEN) {
  console.error("❌ EBAY_TRADING_TOKEN missing");
  process.exit(1);
}

function buildHeaders(callName) {
  return {
    "Content-Type": "text/xml",
    "X-EBAY-API-CALL-NAME": callName,
    "X-EBAY-API-SITEID": SITE_ID,
    "X-EBAY-API-COMPATIBILITY-LEVEL": "967"
  };
}

// ========== GET ORDERS ==========
app.post("/getOrders", async (req, res) => {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetOrdersRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${EBAY_TOKEN}</eBayAuthToken>
  </RequesterCredentials>
  <CreateTimeFrom>${new Date(Date.now() - 24*60*60*1000).toISOString()}</CreateTimeFrom>
  <OrderRole>Seller</OrderRole>
  <OrderStatus>Completed</OrderStatus>
  <DetailLevel>ReturnAll</DetailLevel>
</GetOrdersRequest>`;

  try {
    const r = await fetch(EBAY_ENDPOINT, {
      method: "POST",
      headers: buildHeaders("GetOrders"),
      body: xml
    });

    const text = await r.text();
    res.send(text);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/", (req, res) => {
  res.send("✅ Amazon Order Server Running");
});

app.listen(3000, () => {
  console.log("🚀 Order server running on port 3000");
});
