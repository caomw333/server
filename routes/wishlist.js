/**
 * Wishlist Routes - Customer favorites collection
 */
const express = require('express');
const db = require('../db');
const { requireUser } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/wishlist
 * Get current user's wishlist with product details
 */
router.get('/', requireUser, (req, res) => {
  const userId = req.user.id;
  const items = db.queryAll(`
    SELECT w.id, w.productId,
           p.name, p.brand, p.price, p.originalPrice, p.image, p.badge,
           p.rating, p.reviews, p.stock, p.status
    FROM wishlist w
    JOIN products p ON w.productId = p.id
    WHERE w.userId = ?
    ORDER BY w.id DESC
  `, [userId]);

  res.json({ items, total: items.length });
});

/**
 * POST /api/wishlist
 * Add item to wishlist (toggle: add if not exists)
 */
router.post('/', requireUser, (req, res) => {
  const userId = req.user.id;
  const { productId } = req.body;

  if (!productId) {
    return res.status(400).json({ error: '请选择商品' });
  }

  // Check product exists
  const product = db.queryOne('SELECT * FROM products WHERE id = ?', [productId]);
  if (!product) {
    return res.status(404).json({ error: '商品不存在' });
  }

  // Check already in wishlist
  const existing = db.queryOne(
    'SELECT * FROM wishlist WHERE userId = ? AND productId = ?',
    [userId, productId]
  );

  if (existing) {
    return res.json({ success: true, message: '已在心愿单中', existed: true });
  }

  db.run(
    'INSERT INTO wishlist (userId, productId) VALUES (?, ?)',
    [userId, productId]
  );

  res.status(201).json({ success: true, message: '已加入心愿单' });
});

/**
 * DELETE /api/wishlist/:productId
 * Remove item from wishlist
 */
router.delete('/:productId', requireUser, (req, res) => {
  const userId = req.user.id;
  const { productId } = req.params;

  const item = db.queryOne(
    'SELECT * FROM wishlist WHERE userId = ? AND productId = ?',
    [userId, productId]
  );

  if (!item) {
    return res.status(404).json({ error: '心愿单中无此商品' });
  }

  db.run('DELETE FROM wishlist WHERE id = ?', [item.id]);
  res.json({ success: true, message: '已移出心愿单' });
});

module.exports = router;
