/**
 * Product Routes - Full CRUD for merchant + read for customer
 */
const express = require('express');
const db = require('../db');
const { requireMerchant } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/products
 * List products with optional filters
 */
router.get('/', (req, res) => {
  const { category, search, status } = req.query;
  let sql = 'SELECT * FROM products WHERE 1=1';
  const params = [];

  if (category && category !== '全部') {
    sql += ' AND category = ?';
    params.push(category);
  }

  if (search) {
    sql += ' AND (name LIKE ? OR brand LIKE ? OR category LIKE ?)';
    const kw = `%${search}%`;
    params.push(kw, kw, kw);
  }

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }

  // Customer-facing: only show on-sale products by default
  if (!req.query.includeOff) {
    sql += ' AND status = \'on\'';
  }

  sql += ' ORDER BY id DESC';

  const products = db.queryAll(sql, params);
  res.json({ products, total: products.length });
});

/**
 * GET /api/products/:id
 * Get single product
 */
router.get('/:id', (req, res) => {
  const product = db.queryOne('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (!product) {
    return res.status(404).json({ error: '商品不存在' });
  }
  res.json(product);
});

/**
 * POST /api/products
 * Create product (merchant only)
 */
router.post('/', requireMerchant, (req, res) => {
  const { name, brand, price, originalPrice, image, badge, category, desc, stock } = req.body;

  if (!name || !brand || !price) {
    return res.status(400).json({ error: '请填写商品名称、品牌和售价' });
  }

  db.run(
    `INSERT INTO products (name, brand, price, originalPrice, image, badge, category, desc, stock, rating, sales)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 5.0, 0)`,
    [name, brand, parseFloat(price), originalPrice ? parseFloat(originalPrice) : null,
     image || '📦', badge || null, category || '', desc || '', parseInt(stock) || 0]
  );

  const product = db.queryOne('SELECT * FROM products WHERE id = ?', [db.lastInsertId()]);
  res.status(201).json(product);
});

/**
 * PUT /api/products/:id
 * Update product (merchant only)
 */
router.put('/:id', requireMerchant, (req, res) => {
  const id = parseInt(req.params.id);
  const existing = db.queryOne('SELECT * FROM products WHERE id = ?', [id]);
  if (!existing) {
    return res.status(404).json({ error: '商品不存在' });
  }

  const fields = ['name', 'brand', 'price', 'originalPrice', 'image', 'badge', 'category', 'desc', 'stock', 'rating', 'status'];
  const updates = [];
  const params = [];

  fields.forEach(f => {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      params.push(req.body[f]);
    }
  });

  if (updates.length === 0) {
    return res.status(400).json({ error: '没有需要更新的字段' });
  }

  updates.push("updatedAt = datetime('now', 'localtime')");
  params.push(id);

  db.run(
    `UPDATE products SET ${updates.join(', ')} WHERE id = ?`,
    params
  );

  const product = db.queryOne('SELECT * FROM products WHERE id = ?', [id]);
  res.json(product);
});

/**
 * DELETE /api/products/:id
 * Delete product (merchant only)
 */
router.delete('/:id', requireMerchant, (req, res) => {
  const id = parseInt(req.params.id);
  const existing = db.queryOne('SELECT * FROM products WHERE id = ?', [id]);
  if (!existing) {
    return res.status(404).json({ error: '商品不存在' });
  }

  db.run('DELETE FROM products WHERE id = ?', [id]);
  res.json({ success: true, message: '已删除' });
});

/**
 * PUT /api/products/:id/status
 * Toggle product on/off shelf (merchant only)
 */
router.put('/:id/status', requireMerchant, (req, res) => {
  const id = parseInt(req.params.id);
  const product = db.queryOne('SELECT * FROM products WHERE id = ?', [id]);
  if (!product) {
    return res.status(404).json({ error: '商品不存在' });
  }

  const newStatus = product.status === 'on' ? 'off' : 'on';
  db.run("UPDATE products SET status = ?, updatedAt = datetime('now', 'localtime') WHERE id = ?", [newStatus, id]);

  res.json({ success: true, status: newStatus });
});

module.exports = router;
