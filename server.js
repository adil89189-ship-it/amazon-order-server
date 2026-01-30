import express from "express";
import fetch from "node-fetch";
import bodyParser from "body-parser";
import cors from "cors";

const app = express();
app.use(cors());
app.use(bodyParser.json());

const EBAY_ENDPOINT = "https://api.ebay.com/ws/api.dll";
const SITE_ID = "3"; // UK
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

function extract(tag, xml) {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  return m ? m[1].trim() : "";
}

// ================= GET ORDERS (PARSED) =================
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

    const orders = [];
    const orderBlocks = text.match(/<Order>[\s\S]*?<\/Order>/g) || [];

    for (const block of orderBlocks) {
      const orderId = extract("OrderID", block);
      const buyer = extract("Name", block);
      const phone = extract("Phone", block);
      const street1 = extract("Street1", block);
      const street2 = extract("Street2", block);
      const city = extract("CityName", block);
      const postcode = extract("PostalCode", block);
      const country = extract("Country", block);

      const lineItemBlock = block.match(/<Transaction>[\s\S]*?<\/Transaction>/);
      if (!lineItemBlock) continue;

      const sku = extract("SKU", lineItemBlock[0]);
      const qty = extract("QuantityPurchased", lineItemBlock[0]);

      orders.push({
        orderId,
        buyer,
        phone,
        address: {
          street1,
          street2,
          city,
          postcode,
          country
        },
        sku,
        quantity: qty
      });
    }

    res.json({
      count: orders.length,
      orders
    });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.get("/", (req, res) => {
  res.send("✅ Amazon Order Server Running (Parsed)");
});

app.listen(3000, () => {
  console.log("🚀 Order server running on port 3000");
});
