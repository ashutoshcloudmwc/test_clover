/**
 * Clover REST API operations.
 * All Clover v3 calls live here so routes stay thin and logic is easy to test or reuse.
 */

const { toList } = require('../utils/normalize');

const PRINT_EVENT_DELAY_MS = 2500;

/**
 * GET /v3/merchants/:mId/devices → list of devices.
 */
async function getDevices(clover, merchantId) {
  const res = await clover.get(`/v3/merchants/${merchantId}/devices`);
  return toList(res.data);
}

/**
 * GET /v3/merchants/:mId/order_types → list of order types.
 */
async function getOrderTypes(clover, merchantId) {
  const res = await clover.get(`/v3/merchants/${merchantId}/order_types`);
  return toList(res.data);
}

/**
 * GET /v3/merchants/:mId/employees → all employees as an array.
 * @throws {object|string} error.response?.data || error.message on failure
 */
async function getAllEmployees(clover, merchantId) {
  try {
    const res = await clover.get(`/v3/merchants/${merchantId}/employees`);
    return res.data?.elements ?? [];
  } catch (error) {
    throw error.response?.data || error.message;
  }
}

/**
 * Return id of first active (non-deleted) employee from the full list, or null.
 */
async function getFirstActiveEmployee(clover, merchantId) {
  const employees = await getAllEmployees(clover, merchantId);
  const active = employees.find((e) => !e.deletedTime);
  return active?.id ?? null;
}

/**
 * GET /v3/merchants/:mId/items → all items as an array.
 * @throws {object|string} error.response?.data || error.message on failure
 */
async function getAllItems(clover, merchantId) {
  try {
    const res = await clover.get(`/v3/merchants/${merchantId}/items`, { params: { limit: 200 } });
    return res.data?.elements ?? [];
  } catch (error) {
    throw error.response?.data || error.message;
  }
}

/**
 * GET /v3/merchants/:mId/items → first 10 sellable (available, not hidden) items.
 */
async function getSellableItems(clover, merchantId) {
  const res = await clover.get(`/v3/merchants/${merchantId}/items`, {
    params: { limit: 100 },
  });
  const all = res.data?.elements ?? [];
  return all.filter((item) => item.available === true && item.hidden === false).slice(0, 10);
}

/**
 * Create one item. Returns { id }.
 */
async function createItem(clover, merchantId, item) {
  const res = await clover.post(`/v3/merchants/${merchantId}/items`, item);
  return res.data;
}

/**
 * Create order (state: open, optional orderType and online-order metadata). Returns { id }.
 */
async function createOrder(clover, merchantId, options = {}) {
  const body = { state: 'open' };
  if (options.orderTypeId) body.orderType = { id: options.orderTypeId };
  if (options.employeeId) body.employee = { id: options.employeeId };
  if (options.externalReferenceId) body.externalReferenceId = options.externalReferenceId;
  if (options.title) body.title = options.title;
  if (options.note) body.note = options.note;
  const res = await clover.post(`/v3/merchants/${merchantId}/orders`, body);
  return res.data;
}

/**
 * Add a line item to an order.
 */
async function addLineItem(clover, merchantId, orderId, itemId, quantity = 1) {
  await clover.post(`/v3/merchants/${merchantId}/orders/${orderId}/line_items`, {
    item: { id: itemId },
    quantity,
  });
}

/**
 * Lock an order (state: locked).
 */
async function lockOrder(clover, merchantId, orderId) {
  await clover.post(`/v3/merchants/${merchantId}/orders/${orderId}`, {
    state: 'locked',
  });
}

/**
 * Create a cash payment for an order. POST /v3/merchants/{merchantId}/payments
 * Clover requires tender id or labelKey; we use the standard cash tender label key.
 * @param {object} clover - Axios instance
 * @param {string} merchantId - Merchant ID
 * @param {string} orderId - Order ID
 * @param {number} amount - Amount in cents
 * @returns {Promise<object>} response.data
 */
async function payOrderCash(clover, merchantId, orderId, amount) {
  const res = await clover.post(`/v3/merchants/${merchantId}/payments`, {
    order: { id: orderId },
    amount,
    tender: { labelKey: 'com.clover.tender.cash' },
  });
  return res.data;
}

/**
 * Direct order print. GET /v3/merchants/{merchantId}/orders/{orderId}/print (no body).
 * For testing direct print behavior only.
 * @throws {object|string} error.response?.data || error.message on failure
 */
async function printOrderDirect(clover, merchantId, orderId) {
  try {
    const res = await clover.get(`/v3/merchants/${merchantId}/orders/${orderId}/print`);
    return res.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
}

/**
 * Request print for an order. Optional deviceId; if omitted, uses default firing device.
 * Returns Clover print_event response or { error, cloverResponse } on failure.
 */
async function requestPrint(clover, merchantId, orderId, deviceId = null) {
  const payload = { orderRef: { id: orderId } };
  if (deviceId) payload.deviceRef = { id: deviceId };
  try {
    const res = await clover.post(`/v3/merchants/${merchantId}/print_event`, payload);
    return res.data;
  } catch (err) {
    return {
      error: err.response?.data?.message || err.message,
      cloverResponse: err.response?.data,
    };
  }
}

/**
 * Request print to every device. Returns { tryAllDevices: true, results: [...] }.
 */
async function requestPrintAllDevices(clover, merchantId, orderId) {
  const devices = await getDevices(clover, merchantId);
  const results = [];
  for (const d of devices) {
    if (!d.id) continue;
    const printResult = await requestPrint(clover, merchantId, orderId, d.id);
    const success = !printResult.error;
    results.push({
      deviceId: d.id,
      model: d.model,
      success,
      ...(success ? { state: printResult.state } : { error: printResult.error }),
    });
  }
  return { tryAllDevices: true, results };
}

/**
 * GET /v3/merchants/:mId/orders/:orderId with expand=lineItems.
 */
async function getOrder(clover, merchantId, orderId) {
  const res = await clover.get(`/v3/merchants/${merchantId}/orders/${orderId}`, {
    params: { expand: 'lineItems' },
  });
  return res.data;
}

/**
 * GET /v3/merchants/:mId/print_event/:eventId.
 */
async function getPrintEventStatus(clover, merchantId, eventId) {
  try {
    const res = await clover.get(`/v3/merchants/${merchantId}/print_event/${eventId}`);
    return res.data;
  } catch (e) {
    return { error: e.response?.data || e.message };
  }
}

/**
 * Check orders list (limit 1) to verify connection.
 */
async function checkConnection(clover, merchantId) {
  const res = await clover.get(`/v3/merchants/${merchantId}/orders`, { params: { limit: 1 } });
  const elements = res.data?.elements ?? [];
  return { recentOrderCount: elements.length };
}

/**
 * Full flow: create dummy items, create order (optional orderType), add line items, lock.
 * Returns { orderId, itemIds }.
 * Use when building a test order for print (no payment).
 */
async function createTestOrderWithItemsAndLock(clover, merchantId, dummyItems, options = {}) {
  const itemIds = [];
  for (const item of dummyItems) {
    const created = await createItem(clover, merchantId, item);
    if (!created?.id) throw new Error('Item creation returned no id');
    itemIds.push(created.id);
  }
  const orderData = await createOrder(clover, merchantId, { orderTypeId: options.orderTypeId });
  const orderId = orderData?.id;
  if (!orderId) throw new Error('Order creation returned no id');
  for (const itemId of itemIds) {
    await addLineItem(clover, merchantId, orderId, itemId, 1);
  }
  await lockOrder(clover, merchantId, orderId);
  return { orderId, itemIds };
}

/**
 * Full flow: create dummy items, order, line items, lock, fetch total, pay with cash.
 * Returns { orderId, itemIds, paymentId }.
 * Throws if order.total is 0 or payment fails.
 */
async function createTestOrderWithItemsAndPay(clover, merchantId, dummyItems, options = {}) {
  const employeeId = options.employeeId || await getFirstActiveEmployee(clover, merchantId);
  const orderData = await createOrder(clover, merchantId, {
    orderTypeId: options.orderTypeId,
    employeeId,
    externalReferenceId: `A${Date.now().toString().slice(-11)}`,
    title: 'Online Delivery Order',
    note: 'Created via API with employee',
  });
  const orderId = orderData?.id;
  if (!orderId) throw new Error('Order creation returned no id');

  let itemIds;
  if (options.itemIds && options.itemIds.length > 0) {
    // Use provided real Clover item IDs directly
    itemIds = options.itemIds;
    for (const itemId of itemIds) {
      await addLineItem(clover, merchantId, orderId, itemId, 1);
    }
  } else {
    // Fallback: create dummy items then add them
    itemIds = [];
    for (const item of dummyItems) {
      const created = await createItem(clover, merchantId, item);
      if (!created?.id) throw new Error('Item creation returned no id');
      itemIds.push(created.id);
    }
    for (const itemId of itemIds) {
      await addLineItem(clover, merchantId, orderId, itemId, 1);
    }
  }

  await lockOrder(clover, merchantId, orderId);
  const order = await getOrder(clover, merchantId, orderId);
  let total = order?.total ?? 0;
  if (total === 0) {
    const elements = order?.lineItems?.elements ?? [];
    for (const line of elements) {
      const price = line.unitPrice ?? line.price ?? 0;
      const qty = line.quantity ?? 1;
      total += Number(price) * Number(qty);
    }
  }
  if (total === 0) {
    for (const item of dummyItems) {
      total += Number(item.price ?? 0) * 1;
    }
  }
  if (total === 0) {
    throw new Error('Order total is zero. Cannot create payment.');
  }
  const paymentData = await payOrderCash(clover, merchantId, orderId, total);
  const paymentId = paymentData?.id ?? null;
  return { orderId, itemIds, paymentId };
}

module.exports = {
  getDevices,
  getOrderTypes,
  getAllEmployees,
  getFirstActiveEmployee,
  getAllItems,
  getSellableItems,
  createItem,
  createOrder,
  addLineItem,
  lockOrder,
  payOrderCash,
  printOrderDirect,
  requestPrint,
  requestPrintAllDevices,
  getOrder,
  getPrintEventStatus,
  checkConnection,
  createTestOrderWithItemsAndLock,
  createTestOrderWithItemsAndPay,
  PRINT_EVENT_DELAY_MS,
};
