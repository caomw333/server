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
  const { category, search, status, page, limit } = req.query;
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

  // Count total before pagination
  const total = db.queryOne(
    `SELECT COUNT(*) as count FROM (${sql})`,
    params
  )?.count || 0;

  // Pagination
  const pageNum = Math.max(1, parseInt(page) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(limit) || 20));
  const offset = (pageNum - 1) * pageSize;

  sql += ' LIMIT ? OFFSET ?';
  params.push(pageSize, offset);

  const products = db.queryAll(sql, params);
  res.json({
    products,
    total,
    page: pageNum,
    limit: pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
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

  if (!name || !price) {
    return res.status(400).json({ error: '请填写商品名称和售价' });
  }

  db.run(
    `INSERT INTO products (name, brand, price, originalPrice, image, badge, category, desc, stock, rating, sales)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 5.0, 0)`,
    [name, brand || '', parseFloat(price), originalPrice ? parseFloat(originalPrice) : null,
     image || '', badge || null, category || '', desc || '', parseInt(stock) || 0]
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
 * POST /api/products/reset
 * Reset products to default seed data (merchant only)
 */
router.post('/reset', requireMerchant, (req, res) => {
  const defaultProducts = [
    { name:'北欧极简台灯', brand:'NORDIC LIGHT', price:299, originalPrice:399, rating:4.8, reviews:234, image:'💡', badge:'new', category:'家居生活', desc:'荣获红点设计大奖的极简台灯。航空级铝合金材质，三档色温可调。', stock:50, sales:234 },
    { name:'手工陶瓷花瓶', brand:'CERAMIC STUDIO', price:188, rating:4.9, reviews:156, image:'🏺', category:'家居生活', desc:'景德镇匠人手工拉坯，哑光釉面处理。', stock:30, sales:156 },
    { name:'无线降噪耳机', brand:'SOUNDCORE', price:899, originalPrice:1299, rating:4.7, reviews:892, image:'🎧', badge:'sale', category:'数码电子', desc:'自适应主动降噪，40小时超长续航。', stock:120, sales:892 },
    { name:'有机棉T恤', brand:'ECO WEAR', price:159, rating:4.6, reviews:423, image:'👕', badge:'eco', category:'服饰配饰', stock:200, sales:423 },
    { name:'植物精华面霜', brand:'BOTANICA', price:328, originalPrice:428, rating:4.8, reviews:567, image:'🧴', badge:'sale', category:'美妆护肤', stock:80, sales:567 },
    { name:'轻量跑步鞋', brand:'STRIDE PRO', price:599, originalPrice:799, rating:4.5, reviews:1204, image:'👟', badge:'sale', category:'运动户外', stock:65, sales:1204 },
    { name:'智能手表', brand:'TECHWEAR', price:1499, originalPrice:1899, rating:4.9, reviews:3456, image:'⌚', badge:'new', category:'数码电子', stock:40, sales:3456 },
    { name:'设计之书', brand:'PHAIDON', price:268, rating:4.9, reviews:89, image:'📖', category:'图书文创', stock:100, sales:89 },
    { name:'天然大豆蜡烛', brand:'CANDLE LAB', price:128, rating:4.7, reviews:312, image:'🕯️', badge:'eco', category:'家居生活', stock:150, sales:312 },
    { name:'机械键盘', brand:'KEYCRAFT', price:699, originalPrice:899, rating:4.6, reviews:678, image:'⌨️', badge:'sale', category:'数码电子', stock:55, sales:678 },
    { name:'真丝围巾', brand:'SILK ROAD', price:358, rating:4.8, reviews:145, image:'🧣', category:'服饰配饰', stock:35, sales:145 },
    { name:'瑜伽垫', brand:'ZEN LIFE', price:249, originalPrice:349, rating:4.7, reviews:567, image:'🧘', badge:'eco', category:'运动户外', stock:90, sales:567 }
  ];

  db.run('DELETE FROM products');
  for (const p of defaultProducts) {
    db.run(
      `INSERT INTO products (name,brand,price,originalPrice,rating,reviews,image,badge,category,desc,stock,sales)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [p.name, p.brand, p.price, p.originalPrice||null, p.rating, p.reviews,
       p.image, p.badge||null, p.category, p.desc||'', p.stock, p.sales]
    );
  }
  res.json({ success: true, message: '已重置12款默认商品' });
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
