import axios from "axios";
import { parseStringPromise } from "xml2js";
import pool from "./db.js";

export async function syncEbayOrders(req, res) {
  try {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetOrdersRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${process.env.EBAY_TRADING_TOKEN}</eBayAuthToken>
  </RequesterCredentials>
  <OrderStatus>Completed</OrderStatus>
  <DetailLevel>ReturnAll</DetailLevel>
  <Pagination>
    <EntriesPerPage>50</EntriesPerPage>
    <PageNumber>1</PageNumber>
  </Pagination>
</GetOrdersRequest>`;

    const response = await axios.post(
      "https://api.ebay.com/ws/api.dll",
      xml,
      {
        headers: {
          "X-EBAY-API-SITEID": "3",
          "X-EBAY-API-CALL-NAME": "GetOrders",
          "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
          "Content-Type": "text/xml"
        }
      }
    );

    const parsed = await parseStringPromise(response.data, { explicitArray: false });

    const orders = parsed.GetOrdersResponse.OrderArray?.Order || [];

    for (const order of [].concat(orders)) {
      const ebayOrderId = order.OrderID;
      const buyer = order.ShippingAddress?.Name || "";
      const address = order.ShippingAddress?.Street1 || "";
      const item = order.TransactionArray.Transaction.Item;
      const title = item.Title;
      const sku = item.SKU || "";
      const qty = parseInt(order.TransactionArray.Transaction.QuantityPurchased);
      const price = parseFloat(order.Total.Amount);

      await pool.query(
        `INSERT INTO orders 
        (ebay_order_id, buyer_name, buyer_address, item_title, item_sku, quantity, price)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (ebay_order_id) DO NOTHING`,
        [ebayOrderId, buyer, address, title, sku, qty, price]
      );
    }

    res.json({ status: "synced", count: orders.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
