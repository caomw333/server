/**
 * Cart Routes - Shopping cart CRUD
 */
const express = require('express');
const db = require('../db');
const { requireUser } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/cart
 * Get current user's cart with product details
 */
router.get('/', requireUser, (req, res) => {
  const userId = req.user.id;
  const items = db.queryAll(`
    SELECT c.id, c.quantity, c.productId,
           p.name, p.brand, p.price, p.originalPrice, p.image, p.stock, p.status
    FROM cart_items c
    JOIN products p ON c.productId = p.id
    WHERE c.userId = ?
    ORDER BY c.id DESC
  `, [userId]);

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const count = items.reduce((sum, item) => sum + item.quantity, 0);

  res.json({ items, total: Math.round(total * 100) / 100, count });
});

/**
 * POST /api/cart
 * Add item to cart. If already exists, increase quantity.
 */
router.post('/', requireUser, (req, res) => {
  const userId = req.user.id;
  const { productId, quantity } = req.body;

  if (!productId) {
    return res.status(400).json({ error: '请选择商品' });
  }

  // Check product exists and is on sale
  const product = db.queryOne('SELECT * FROM products WHERE id = ?', [productId]);
  if (!product) {
    return res.status(404).json({ error: '商品不存在' });
  }
  if (product.status === 'off') {
    return res.status(400).json({ error: '商品已下架' });
  }

  const qty = Math.max(1, parseInt(quantity) || 1);

  // Check if already in cart
  const existing = db.queryOne(
    'SELECT * FROM cart_items WHERE userId = ? AND productId = ?',
    [userId, productId]
  );

  if (existing) {
    // Update quantity, but don't exceed stock
    const newQty = Math.min(existing.quantity + qty, product.stock || 999);
    db.run(
      'UPDATE cart_items SET quantity = ? WHERE id = ?',
      [newQty, existing.id]
    );
    return res.json({ success: true, message: '已更新数量', quantity: newQty });
  }

  // Add new cart item
  db.run(
    'INSERT INTO cart_items (userId, productId, quantity) VALUES (?, ?, ?)',
    [userId, productId, Math.min(qty, product.stock || 999)]
  );

  const newItem = db.queryOne(
    'SELECT * FROM cart_items WHERE id = ?',
    [db.lastInsertId()]
  );
  res.status(201).json({ success: true, item: newItem });
});

/**
 * PUT /api/cart/:id
 * Update cart item quantity
 */
router.put('/:id', requireUser, (req, res) => {
  const userId = req.user.id;
  const { quantity } = req.body;

  const item = db.queryOne(
    'SELECT * FROM cart_items WHERE id = ? AND userId = ?',
    [req.params.id, userId]
  );
  if (!item) {
    return res.status(404).json({ error: '购物车商品不存在' });
  }

  const product = db.queryOne('SELECT * FROM products WHERE id = ?', [item.productId]);
  const qty = Math.max(1, Math.min(parseInt(quantity) || 1, product?.stock || 999));

  db.run('UPDATE cart_items SET quantity = ? WHERE id = ?', [qty, item.id]);
  res.json({ success: true, quantity: qty });
});

/**
 * DELETE /api/cart/:id
 * Remove item from cart
 */
router.delete('/:id', requireUser, (req, res) => {
  const userId = req.user.id;
  const item = db.queryOne(
    'SELECT * FROM cart_items WHERE id = ? AND userId = ?',
    [req.params.id, userId]
  );
  if (!item) {
    return res.status(404).json({ error: '购物车商品不存在' });
  }

  db.run('DELETE FROM cart_items WHERE id = ?', [item.id]);
  res.json({ success: true, message: '已移除' });
});

/**
 * DELETE /api/cart
 * Clear entire cart
 */
router.delete('/', requireUser, (req, res) => {
  const userId = req.user.id;
  db.run('DELETE FROM cart_items WHERE userId = ?', [userId]);
  res.json({ success: true, message: '购物车已清空' });
});

module.exports = router;
