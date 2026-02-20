# What data we send to what API (for testing)

Quick reference: **our endpoints** and **Clover APIs** we call, with request bodies.

---

## 1. Our server (test with curl / Postman)

Base URL: `http://localhost:3000` (or your `PORT`).  
Headers: `Content-Type: application/json` for POST.

| What to test | Method | Our endpoint | Body we accept |
|--------------|--------|--------------|----------------|
| Connection | GET | `/test-print/check` | — |
| Order types | GET | `/test-print/order-types` | — |
| Items | GET | `/test-print/items` | — |
| Employees | GET | `/test-print/employees` | — |
| Devices | GET | `/test-print/devices` | — |
| Create order + print | POST | `/test-print` | `{}` · `{"orderTypeId":"<id>"}` · `{"itemIds":["ID1","ID2"]}` · `{"employeeId":"<id>"}` · `{"tryAllDevices":true}` · `{"deviceId":"<id>"}` |
| Real-items order + print | POST | `/test-print/real-menu-print` | `{}` · `{"orderTypeId":"<id>","employeeId":"<id>"}` |
| Direct print (no print_event) | POST | `/test-print/test-print-direct` | `{}` |
| Re-send print | POST | `/test-print/send-print` | `{"orderId":"<id>"}` · `{"orderId":"<id>","tryAllDevices":true}` |
| Debug print | POST | `/test-print/debug-print` | `{"orderId":"<id>"}` · `{"orderId":"<id>","tryAllDevices":true}` |
| Verify order | GET | `/test-print/verify/:orderId` | — |

---

## 2. Typical test workflow

```
1. GET  /test-print/items        → copy 1–2 item IDs
2. GET  /test-print/employees    → copy employee ID (optional)
3. GET  /test-print/order-types  → copy order type ID (optional)

4. POST /test-print
   {
     "itemIds":     ["ITEM_ID_1", "ITEM_ID_2"],
     "employeeId":  "EMP_ID",
     "orderTypeId": "ORDER_TYPE_ID"
   }

5. Check response for orderId, paymentId, printEventId, printState
```

---

## 3. Clover APIs we call (what we send)

Use `.env`: `CLOVER_BASE_URL`, `CLOVER_MERCHANT_ID`, `CLOVER_ACCESS_TOKEN`.  
Sandbox: `CLOVER_BASE_URL=https://apisandbox.dev.clover.com`.

| Purpose | Clover API | Method | Body we send |
|---------|------------|--------|--------------|
| Check connection | `{base}/v3/merchants/{mId}/orders?limit=1` | GET | — |
| Order types | `{base}/v3/merchants/{mId}/order_types` | GET | — |
| Items | `{base}/v3/merchants/{mId}/items?limit=200` | GET | — |
| Employees | `{base}/v3/merchants/{mId}/employees` | GET | — |
| Devices | `{base}/v3/merchants/{mId}/devices` | GET | — |
| Create item (dummy) | `{base}/v3/merchants/{mId}/items` | POST | `{"name":"...","price":100}` |
| Create order | `{base}/v3/merchants/{mId}/orders` | POST | `{"state":"open","orderType":{"id":"..."},"employee":{"id":"..."},"externalReferenceId":"A...","title":"Online Delivery Order","note":"..."}` |
| Add line item | `{base}/v3/merchants/{mId}/orders/{orderId}/line_items` | POST | `{"item":{"id":"<itemId>"},"quantity":1}` |
| Lock order | `{base}/v3/merchants/{mId}/orders/{orderId}` | POST | `{"state":"locked"}` |
| Pay (cash) | `{base}/v3/merchants/{mId}/payments` | POST | `{"order":{"id":"<orderId>"},"amount":<cents>,"tender":{"labelKey":"com.clover.tender.cash"}}` |
| **Print (default)** | `{base}/v3/merchants/{mId}/print_event` | POST | `{"orderRef":{"id":"<orderId>"}}` |
| **Print (one device)** | `{base}/v3/merchants/{mId}/print_event` | POST | `{"orderRef":{"id":"<orderId>"},"deviceRef":{"id":"<deviceId>"}}` |
| **Direct print** | `{base}/v3/merchants/{mId}/orders/{orderId}/print` | GET | — |
| Get order | `{base}/v3/merchants/{mId}/orders/{orderId}?expand=lineItems` | GET | — |
| Get print event | `{base}/v3/merchants/{mId}/print_event/{eventId}` | GET | — |

`{base}` = `CLOVER_BASE_URL`, `{mId}` = `CLOVER_MERCHANT_ID`.  
All Clover requests use header: `Authorization: Bearer {CLOVER_ACCESS_TOKEN}`, `Content-Type: application/json`.
