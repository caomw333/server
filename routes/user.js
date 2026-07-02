/**
 * User Routes - Profile management
 */
const express = require('express');
const db = require('../db');
const { requireUser } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/user/profile
 * Get current user's profile
 */
router.get('/profile', requireUser, (req, res) => {
  const userId = req.user.id;
  const user = db.queryOne('SELECT * FROM users WHERE id = ?', [userId]);

  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }

  // Get stats
  const orderCount = db.queryOne(
    'SELECT COUNT(*) as count FROM orders WHERE userId = ?',
    [userId]
  )?.count || 0;

  const cartCount = db.queryOne(
    'SELECT COUNT(*) as count FROM cart_items WHERE userId = ?',
    [userId]
  )?.count || 0;

  const wishlistCount = db.queryOne(
    'SELECT COUNT(*) as count FROM wishlist WHERE userId = ?',
    [userId]
  )?.count || 0;

  // Don't expose password or sensitive fields
  const { password, ...userInfo } = user;

  res.json({
    ...userInfo,
    stats: {
      orderCount,
      cartCount,
      wishlistCount,
    },
  });
});

/**
 * PUT /api/user/profile
 * Update user profile
 */
router.put('/profile', requireUser, (req, res) => {
  const userId = req.user.id;
  const { name, phone } = req.body;

  const user = db.queryOne('SELECT * FROM users WHERE id = ?', [userId]);
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }

  const updates = [];
  const params = [];

  if (name !== undefined) {
    updates.push('name = ?');
    params.push(name);
  }
  if (phone !== undefined) {
    updates.push('phone = ?');
    params.push(phone);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: '没有需要更新的字段' });
  }

  params.push(userId);
  db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

  const updated = db.queryOne('SELECT * FROM users WHERE id = ?', [userId]);
  const { password, ...userInfo } = updated;

  res.json(userInfo);
});

/**
 * GET /api/user/orders
 * Shortcut: get current user's orders
 */
router.get('/orders', requireUser, (req, res) => {
  const userId = req.user.id;
  const orders = db.queryAll(
    'SELECT * FROM orders WHERE userId = ? ORDER BY id DESC LIMIT 20',
    [userId]
  ).map(order => ({
    ...order,
    items: order.items ? JSON.parse(order.items) : [],
  }));

  res.json({ orders, total: orders.length });
});

module.exports = router;
