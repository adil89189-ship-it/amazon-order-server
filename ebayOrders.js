import axios from "axios";
import xml2js from "xml2js";
import { db } from "./db.js";

export async function fetchEbayOrders() {
  const from = new Date(Date.now() - 24*60*60*1000).toISOString();
  const to = new Date().toISOString();

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetOrdersRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${process.env.EBAY_TRADING_TOKEN}</eBayAuthToken>
  </RequesterCredentials>
  <CreateTimeFrom>${from}</CreateTimeFrom>
  <CreateTimeTo>${to}</CreateTimeTo>
  <OrderRole>Seller</OrderRole>
  <OrderStatus>All</OrderStatus>
</GetOrdersRequest>`;

  const res = await axios.post("https://api.ebay.com/ws/api.dll", xml, {
    headers: {
      "X-EBAY-API-CALL-NAME": "GetOrders",
      "X-EBAY-API-SITEID": "3",
      "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
      "Content-Type": "text/xml"
    }
  });

  const parsed = await xml2js.parseStringPromise(res.data);
  const orders = parsed.GetOrdersResponse.OrderArray?.[0]?.Order || [];

  for (const order of orders) {
    const tx = order.TransactionArray[0].Transaction[0];

    const data = {
      ebay_order_id: order.OrderID[0],
      ebay_item_id: tx.Item[0].ItemID[0],
      ebay_transaction_id: tx.TransactionID[0],
      buyer_name: order.ShippingAddress[0].Name[0],
      buyer_username: order.BuyerUserID[0],
      address_json: JSON.stringify(order.ShippingAddress[0]),
      sku: tx.Variation?.[0]?.SKU?.[0] || tx.Item[0].SKU?.[0],
      quantity: parseInt(tx.QuantityPurchased[0]),
      ebay_price: parseFloat(tx.TransactionPrice[0]._),
      currency: tx.TransactionPrice[0].$.currencyID
    };

    await db.query(`
      INSERT INTO orders
      (ebay_order_id, ebay_item_id, ebay_transaction_id, buyer_name,
       buyer_username, address_json, sku, quantity, ebay_price, currency)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (ebay_order_id) DO NOTHING
    `, Object.values(data));
  }
}
