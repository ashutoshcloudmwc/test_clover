# API Reference

All endpoints are relative to `http://localhost:3000` (or your `PORT`). Request/response bodies are JSON unless noted.

---

## GET /test-print/check

Verify Clover API connection (merchant ID, token, base URL).

**Response (200):**

```json
{
  "success": true,
  "message": "Clover API connection OK. You can POST /test-print to create an order.",
  "baseURL": "https://api.clover.com",
  "merchantId": "...",
  "recentOrderCount": 1
}
```

On error: `success: false`, `error`, `cloverStatus`, `cloverResponse`, optional `hint`.

---

## GET /test-print/order-types

List all order types for the merchant. Use an `id` (e.g. "Online Order", "Take Out", "Delivery") as `orderTypeId` in `POST /test-print` so your orders print like Uber Eats/DoorDash.

**Response (200):**

```json
{
  "success": true,
  "message": "Use orderTypeId from one of these...",
  "orderTypes": [
    {
      "id": "ABC123",
      "label": "Online Order",
      "labelKey": "...",
      "isDefault": false,
      "systemOrderTypeId": "..."
    }
  ],
  "usage": "POST /test-print with body { \"orderTypeId\": \"<id from above>\" }"
}
```

---

## GET /test-print/items

List all sellable inventory items (`available: true`, `hidden: false`). Use `id` values as `itemIds` in `POST /test-print` to create an order using real menu items.

**Response (200):**

```json
{
  "success": true,
  "count": 12,
  "items": [
    { "id": "ITEM_ID_1", "name": "Burger", "price": 1099 },
    { "id": "ITEM_ID_2", "name": "Fries",  "price": 399  }
  ]
}
```

---

## GET /test-print/employees

List all Clover employees. Use `id` as `employeeId` in `POST /test-print` to associate the order with a specific employee.

**Response (200):**

```json
{
  "success": true,
  "count": 3,
  "employees": [
    { "id": "EMP_ID_1", "name": "Alice", "role": "ADMIN" },
    { "id": "EMP_ID_2", "name": "Bob",   "role": "EMPLOYEE" }
  ]
}
```

---

## GET /test-print/devices

List Clover POS devices. Physical printers (e.g. Star SP700) are configured on one of these devices in the Printers app. Use `id` as `deviceId` in `POST /test-print` to target a specific device.

**Response (200):**

```json
{
  "success": true,
  "message": "...",
  "deviceCount": 2,
  "devices": [
    {
      "id": "926766ca-5636-8598-e959-6e3c6fe047e1",
      "name": "...",
      "model": "C406",
      "serial": "...",
      "deviceTypeName": "..."
    }
  ],
  "note": "..."
}
```

---

## GET /test-print/how-to-print

Returns a step-by-step guide and API call summary for getting print on a Star printer.

**Response (200):** JSON with `title`, `steps`, `whyOurPrintsDontShow`, `apiCalls`.

---

## POST /test-print

Create a Clover order, pay it (cash), and trigger a `print_event`. Supports dummy items (default) or real inventory items via `itemIds`. Order metadata mirrors an online delivery order so Clover routing fires to the kitchen printer.

**Request body (all optional):**

| Field | Type | Description |
|-------|------|-------------|
| `orderTypeId` | string | Order type ID from `GET /test-print/order-types`. Use the same as Online Order/Delivery. |
| `employeeId` | string | Employee ID from `GET /test-print/employees`. Defaults to first active employee. |
| `itemIds` | string[] | Real Clover item IDs from `GET /test-print/items`. If omitted, dummy items are created. |
| `deviceId` | string | Clover device UUID from `GET /test-print/devices`. Send print to this device only. |
| `tryAllDevices` | boolean | If `true`, send print to every Clover device. |

**Example — default (dummy items, auto employee):**

```json
{}
```

**Example — real menu items:**

```json
{
  "itemIds": ["ITEM_ID_1", "ITEM_ID_2"]
}
```

**Example — real items + specific employee + order type:**

```json
{
  "itemIds": ["ITEM_ID_1", "ITEM_ID_2"],
  "employeeId": "EMP_ID_1",
  "orderTypeId": "ORDER_TYPE_ID"
}
```

**Example — try all devices:**

```json
{ "tryAllDevices": true }
```

**Response (200):**

```json
{
  "success": true,
  "orderId": "Y8TNWGTYHVP7G",
  "paymentId": "...",
  "printEventId": "...",
  "printState": "CREATED",
  "orderState": "locked",
  "printEvent": { "id": "...", "state": "CREATED" },
  "confirmation": {
    "message": "Order created, paid (cash), and print requested.",
    "orderState": "locked",
    "lineItemCount": 2,
    "orderDetails": { "..." : "..." }
  },
  "noPrintTroubleshooting": { "..." : "..." }
}
```

On Clover API error: `success: false`, `failedStep`, `error`, `cloverStatus`, `cloverResponse`, `hint`.

---

## POST /test-print/real-menu-print

Create an order using the first 2 real sellable inventory items, pay it (cash), and trigger a `print_event`. Useful for testing print with actual menu items without having to supply IDs.

**Request body (all optional):**

| Field | Type | Description |
|-------|------|-------------|
| `orderTypeId` | string | Order type ID from `GET /test-print/order-types`. |
| `employeeId` | string | Employee ID. Defaults to first active employee. |

**Example:**

```json
{}
```

**Response (200):**

```json
{
  "success": true,
  "orderId": "...",
  "paymentId": "...",
  "itemsUsed": [
    { "id": "ITEM_ID_1", "name": "Burger" },
    { "id": "ITEM_ID_2", "name": "Fries" }
  ],
  "printEventId": "...",
  "printState": "CREATED",
  "printEvent": { "..." : "..." }
}
```

On error (fewer than 2 sellable items): `success: false`, `error`, `itemsFound`.

---

## POST /test-print/test-print-direct

Create an order, pay it (cash), then call the Clover direct order print endpoint (`GET /v3/merchants/{mId}/orders/{orderId}/print`). Does **not** use `print_event`. For testing the direct print API only.

**Request body:** none required.

**Response (200 — success):**

```json
{
  "success": true,
  "orderId": "...",
  "paymentId": "...",
  "directPrintTriggered": true
}
```

**Response (200 — print failed):**

```json
{
  "success": false,
  "orderId": "...",
  "paymentId": "...",
  "printError": { "..." : "..." }
}
```

---

## POST /test-print/send-print

Re-send a print request for an existing order.

**Request body:**

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `orderId` | Yes | string | Clover order ID. |
| `deviceId` | No | string | Target this device only. |
| `tryAllDevices` | No | boolean | If `true`, send to all devices. |

**Example:**

```json
{ "orderId": "Y8TNWGTYHVP7G", "tryAllDevices": true }
```

**Response (200):**

```json
{
  "success": true,
  "message": "Print request sent.",
  "printEvent": { "id": "...", "state": "...", "deviceRef": { "..." : "..." } },
  "noPrintTroubleshooting": { "..." : "..." }
}
```

---

## POST /test-print/debug-print

Run a diagnostic: send print to default or all devices, then check print event status after a short delay. Use when print doesn't appear.

**Request body:**

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `orderId` | Yes | string | Clover order ID. |
| `deviceId` | No | string | Target this device only. |
| `tryAllDevices` | No | boolean | If `true`, try all devices. |

**Response (200):**

```json
{
  "success": true,
  "message": "Debug run complete. See printRequests, statusChecks, and whyNoPrint.",
  "diagnostic": {
    "config": { "baseURL": "...", "merchantId": "..." },
    "orderId": "...",
    "printRequests": [ "..." ],
    "statusChecks": [ "..." ],
    "whyNoPrint": [ "..." ]
  }
}
```

---

## GET /test-print/verify/:orderId

Fetch full order details (state, line items) for an existing order. Useful for remote verification.

**Response (200):**

```json
{
  "success": true,
  "orderId": "...",
  "orderState": "locked",
  "lineItemCount": 2,
  "orderDetails": { "..." : "..." }
}
```

---

## Clover print request format

The server calls Clover's [Print API](https://docs.clover.com/dev/docs/printing-orders-rest-api#request-exampleprint-an-order):

- **Endpoint:** `POST /v3/merchants/{mId}/print_event`
- **Body:** `{ "orderRef": { "id": "<orderId>" } }` (optional `"deviceRef": { "id": "<deviceId>" }`)
- Print is routed to the **firing device's order printer** (or onboard printer if no order printer).
