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
  const { name, brand, price, originalPrice, image, images, badge, category, desc, stock } = req.body;

  if (!name || !price) {
    return res.status(400).json({ error: '请填写商品名称和售价' });
  }

  const imagesStr = images ? (typeof images === 'string' ? images : JSON.stringify(images)) : '[]';

  db.run(
    `INSERT INTO products (name, brand, price, originalPrice, image, images, badge, category, desc, stock, rating, sales)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 5.0, 0)`,
    [name, brand || '', parseFloat(price), originalPrice ? parseFloat(originalPrice) : null,
     image || '', imagesStr, badge || null, category || '', desc || '', parseInt(stock) || 0]
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

  const fields = ['name', 'brand', 'price', 'originalPrice', 'image', 'images', 'badge', 'category', 'desc', 'stock', 'rating', 'status'];
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
    { name:'虾仁烧麦', brand:'茶楼鲜制', price:18, originalPrice:22, rating:4.8, reviews:1283, image:'/uploads/40c08d1f11830021fd216c0d049721d4.jpg', badge:'畅销', category:'茶点', desc:'整颗虾仁搭配鲜肉，皮薄馅大，茶楼经典。', stock:200, sales:1283 },
    { name:'凤尾虾饺', brand:'茶楼鲜制', price:25, rating:4.9, reviews:956, image:'/uploads/3a1171e536003bcfac79d68797639673.jpg', badge:'茶楼极美味', category:'茶点', desc:'虾尾完整外露，皮薄肉弹，鲜甜多汁。', stock:150, sales:956 },
    { name:'水晶粉果', brand:'茶楼鲜制', price:16, originalPrice:20, rating:4.7, reviews:723, image:'/uploads/598a650054b2bb66c939295908b4c622.jpg', badge:'new', category:'茶点', desc:'透明外皮包裹青菜馅料，Q弹爽滑。', stock:180, sales:723 },
    { name:'薄皮蒸饺', brand:'茶楼鲜制', price:15, originalPrice:18, rating:4.6, reviews:1123, image:'/uploads/9e355cdc184768a09d06431ec6b23a52.jpg', badge:'sale', category:'饺子', desc:'薄皮大馅，玉米猪肉鲜香，蒸制美味。', stock:160, sales:1123 },
    { name:'海丰小米', brand:'茶楼鲜制', price:12, originalPrice:15, rating:4.7, reviews:867, image:'/uploads/689f388396b25c05080cf5af5ca95f71.jpg', badge:'new', category:'包点', desc:'汕尾海丰传统小吃，外皮软糯内馅鲜香。', stock:200, sales:867 },
    { name:'鲜肉玉米紫菜卷', brand:'茶楼鲜制', price:28, originalPrice:32, rating:4.8, reviews:654, image:'/uploads/f3e713c94be4e51ecde78034f87344f9.jpg', badge:'批发价', category:'茶点', desc:'紫菜包裹鲜肉玉米，营养丰富，老少皆宜。', stock:100, sales:654 },
    { name:'韭菜饺', brand:'茶楼鲜制', price:14, originalPrice:18, rating:4.5, reviews:432, image:'/uploads/894b9a4dd4a26de6c22aef188ad8c7f6.jpg', badge:'sale', category:'饺子', desc:'新鲜韭菜馅料，皮薄汁多，经典口味。', stock:120, sales:432 }
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
  res.json({ success: true, message: '已重置7款默认商品' });
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
