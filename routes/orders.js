/**
 * Order Routes - Create, list, and manage orders
 */
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireUser, requireMerchant } = require('../middleware/auth');

const router = express.Router();

/**
 * Generate a human-readable order number
 * Format: SV + YYYYMMDD + 8 random chars
 */
function generateOrderNo() {
  const now = new Date();
  const dateStr = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');
  const random = uuidv4().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `SV${dateStr}${random}`;
}

/**
 * GET /api/orders
 * List orders for current user
 */
router.get('/', requireUser, (req, res) => {
  const userId = req.user.id;
  const { status, page, limit } = req.query;

  let sql = 'SELECT * FROM orders WHERE userId = ?';
  const params = [userId];

  if (status && status !== 'all') {
    sql += ' AND status = ?';
    params.push(status);
  }

  sql += ' ORDER BY id DESC';

  // Pagination
  const pageNum = Math.max(1, parseInt(page) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(limit) || 10));
  const offset = (pageNum - 1) * pageSize;

  // Get total count
  const total = db.queryOne(
    `SELECT COUNT(*) as count FROM (${sql})`,
    params
  )?.count || 0;

  sql += ' LIMIT ? OFFSET ?';
  params.push(pageSize, offset);

  const orders = db.queryAll(sql, params).map(order => ({
    ...order,
    items: order.items ? JSON.parse(order.items) : [],
  }));

  res.json({
    orders,
    pagination: {
      page: pageNum,
      limit: pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
});

/**
 * GET /api/orders/admin
 * List all orders (merchant only)
 */
router.get('/admin', requireMerchant, (req, res) => {
  const { status, page, limit } = req.query;

  let sql = 'SELECT * FROM orders WHERE 1=1';
  const params = [];

  if (status && status !== 'all') {
    sql += ' AND status = ?';
    params.push(status);
  }

  sql += ' ORDER BY id DESC';

  const pageNum = Math.max(1, parseInt(page) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(limit) || 10));
  const offset = (pageNum - 1) * pageSize;

  const total = db.queryOne(
    `SELECT COUNT(*) as count FROM (${sql})`,
    params
  )?.count || 0;

  sql += ' LIMIT ? OFFSET ?';
  params.push(pageSize, offset);

  const orders = db.queryAll(sql, params).map(order => ({
    ...order,
    items: order.items ? JSON.parse(order.items) : [],
  }));

  res.json({
    orders,
    pagination: {
      page: pageNum,
      limit: pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
});

/**
 * GET /api/orders/stats/merchant
 * Order statistics for merchant dashboard (merchant only)
 */
router.get('/stats/merchant', requireMerchant, (req, res) => {
  const all = db.queryAll('SELECT * FROM orders');
  const total = all.length;
  const pending = all.filter(o => o.status === 'pending').length;
  const paid = all.filter(o => o.status === 'paid').length;
  const shipped = all.filter(o => o.status === 'shipped').length;
  const delivered = all.filter(o => o.status === 'delivered').length;
  const cancelled = all.filter(o => o.status === 'cancelled').length;

  // Revenue = paid + shipped + delivered (excludes cancelled and pending)
  const revenue = all
    .filter(o => ['paid', 'shipped', 'delivered'].includes(o.status))
    .reduce((sum, o) => sum + (o.total || 0), 0);

  const today = new Date().toISOString().slice(0, 10);
  const todayOrders = all.filter(o => (o.createdAt || '').slice(0, 10) === today).length;

  res.json({
    total,
    pending,
    paid,
    shipped,
    delivered,
    cancelled,
    revenue: Math.round(revenue * 100) / 100,
    todayOrders,
    toProcess: pending + paid  // 待处理：待付款 + 待发货
  });
});

/**
 * GET /api/orders/:id
 * Get single order detail
 */
router.get('/:id', requireUser, (req, res) => {
  const userId = req.user.id;
  const order = db.queryOne(
    'SELECT * FROM orders WHERE id = ? AND userId = ?',
    [req.params.id, userId]
  );

  if (!order) {
    return res.status(404).json({ error: '订单不存在' });
  }

  order.items = order.items ? JSON.parse(order.items) : [];
  res.json(order);
});

/**
 * POST /api/orders
 * Create an order from cart items
 */
router.post('/', requireUser, (req, res) => {
  const userId = req.user.id;
  const { address } = req.body;

  // Get cart items
  const cartItems = db.queryAll(`
    SELECT c.quantity, p.id as productId, p.name, p.brand, p.price, p.image, p.stock
    FROM cart_items c
    JOIN products p ON c.productId = p.id
    WHERE c.userId = ? AND p.status = 'on'
  `, [userId]);

  if (cartItems.length === 0) {
    return res.status(400).json({ error: '购物车为空，无法下单' });
  }

  // Validate stock and calculate total
  let total = 0;
  const items = [];
  const errors = [];

  for (const item of cartItems) {
    if (item.stock < item.quantity) {
      errors.push(`${item.name} 库存不足（剩余 ${item.stock} 件）`);
    }
    total += item.price * item.quantity;
    items.push({
      productId: item.productId,
      name: item.name,
      brand: item.brand,
      price: item.price,
      quantity: item.quantity,
      image: item.image,
    });
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join('；') });
  }

  total = Math.round(total * 100) / 100;

  const orderNo = generateOrderNo();
  const itemsJson = JSON.stringify(items);

  // Create order
  db.run(
    `INSERT INTO orders (orderNo, userId, items, total, status, address)
     VALUES (?, ?, ?, ?, 'pending', ?)`,
    [orderNo, userId, itemsJson, total, address || '']
  );

  const orderId = db.lastInsertId();

  // Deduct stock
  for (const item of items) {
    db.run(
      'UPDATE products SET stock = stock - ?, sales = sales + ? WHERE id = ?',
      [item.quantity, item.quantity, item.productId]
    );
  }

  // Clear cart
  db.run('DELETE FROM cart_items WHERE userId = ?', [userId]);

  // Update user total spent
  const user = db.queryOne('SELECT * FROM users WHERE id = ?', [userId]);
  if (user) {
    const newTotal = (user.totalSpent || 0) + total;
    const newLevel = newTotal >= 5000 ? '钻石会员' : newTotal >= 2000 ? '金卡会员' : '普通会员';
    db.run(
      'UPDATE users SET totalSpent = ?, level = ? WHERE id = ?',
      [Math.round(newTotal * 100) / 100, newLevel, userId]
    );
  }

  // Return order
  const order = db.queryOne('SELECT * FROM orders WHERE id = ?', [orderId]);
  order.items = items;

  res.status(201).json({ success: true, order });
});

/**
 * PUT /api/orders/:id/status
 * Update order status (merchant only)
 */
router.put('/:id/status', requireMerchant, (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: '无效的订单状态' });
  }

  const order = db.queryOne('SELECT * FROM orders WHERE id = ?', [req.params.id]);
  if (!order) {
    return res.status(404).json({ error: '订单不存在' });
  }

  db.run('UPDATE orders SET status = ? WHERE id = ?', [status, order.id]);

  const updated = db.queryOne('SELECT * FROM orders WHERE id = ?', [order.id]);
  updated.items = updated.items ? JSON.parse(updated.items) : [];

  res.json({ success: true, order: updated });
});

/**
 * PUT /api/orders/:id/cancel
 * Customer cancels their own order (only if pending)
 */
router.put('/:id/cancel', requireUser, (req, res) => {
  const userId = req.user.id;
  const order = db.queryOne(
    'SELECT * FROM orders WHERE id = ? AND userId = ?',
    [req.params.id, userId]
  );

  if (!order) {
    return res.status(404).json({ error: '订单不存在' });
  }

  if (order.status !== 'pending') {
    return res.status(400).json({ error: '只能取消待付款的订单' });
  }

  db.run('UPDATE orders SET status = ? WHERE id = ?', ['cancelled', order.id]);

  // Restore stock
  const items = order.items ? JSON.parse(order.items) : [];
  for (const item of items) {
    db.run(
      'UPDATE products SET stock = stock + ? WHERE id = ?',
      [item.quantity, item.productId]
    );
  }

  const updated = db.queryOne('SELECT * FROM orders WHERE id = ?', [order.id]);
  updated.items = updated.items ? JSON.parse(updated.items) : [];
  res.json({ success: true, order: updated });
});

/**
 * PUT /api/orders/:id/pay
 * Customer pays for their own pending order (mock payment)
 */
router.put('/:id/pay', requireUser, (req, res) => {
  const userId = req.user.id;
  const order = db.queryOne(
    'SELECT * FROM orders WHERE id = ? AND userId = ?',
    [req.params.id, userId]
  );

  if (!order) {
    return res.status(404).json({ error: '订单不存在' });
  }

  if (order.status !== 'pending') {
    return res.status(400).json({ error: '该订单已支付或已取消' });
  }

  // Mock payment: mark as paid
  db.run('UPDATE orders SET status = ? WHERE id = ?', ['paid', order.id]);

  const updated = db.queryOne('SELECT * FROM orders WHERE id = ?', [order.id]);
  updated.items = updated.items ? JSON.parse(updated.items) : [];

  res.json({
    success: true,
    order: updated,
    payment: {
      method: 'mock',
      paidAt: new Date().toISOString(),
      amount: updated.total
    }
  });
});

module.exports = router;
