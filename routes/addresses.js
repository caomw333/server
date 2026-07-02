/**
 * Address Routes - User shipping address CRUD
 */
const express = require('express');
const db = require('../db');
const { requireUser } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/addresses
 * List user's addresses
 */
router.get('/', requireUser, (req, res) => {
  const userId = req.user.id;
  const addresses = db.queryAll(
    'SELECT * FROM addresses WHERE userId = ? ORDER BY isDefault DESC, id DESC',
    [userId]
  );
  res.json({ addresses });
});

/**
 * POST /api/addresses
 * Add a new address
 */
router.post('/', requireUser, (req, res) => {
  const userId = req.user.id;
  const { name, phone, province, city, district, detail, isDefault } = req.body;

  if (!name || !phone || !detail) {
    return res.status(400).json({ error: '请填写姓名、电话和详细地址' });
  }

  // If set as default, clear other defaults
  if (isDefault) {
    db.run('UPDATE addresses SET isDefault = 0 WHERE userId = ?', [userId]);
  }

  db.run(
    `INSERT INTO addresses (userId, name, phone, province, city, district, detail, isDefault)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, name, phone, province || '', city || '', district || '', detail, isDefault ? 1 : 0]
  );

  const addr = db.queryOne('SELECT * FROM addresses WHERE id = ?', [db.lastInsertId()]);
  res.status(201).json({ success: true, address: addr });
});

/**
 * PUT /api/addresses/:id
 * Update an address
 */
router.put('/:id', requireUser, (req, res) => {
  const userId = req.user.id;
  const addr = db.queryOne(
    'SELECT * FROM addresses WHERE id = ? AND userId = ?',
    [req.params.id, userId]
  );
  if (!addr) return res.status(404).json({ error: '地址不存在' });

  const { name, phone, province, city, district, detail, isDefault } = req.body;

  if (isDefault) {
    db.run('UPDATE addresses SET isDefault = 0 WHERE userId = ?', [userId]);
  }

  const fields = ['name','phone','province','city','district','detail','isDefault'];
  const updates = [];
  const params = [];

  fields.forEach(f => {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      params.push(f === 'isDefault' ? (req.body[f] ? 1 : 0) : req.body[f]);
    }
  });

  if (updates.length === 0) {
    return res.status(400).json({ error: '没有需要更新的字段' });
  }

  params.push(req.params.id);
  db.run(`UPDATE addresses SET ${updates.join(', ')} WHERE id = ?`, params);

  const updated = db.queryOne('SELECT * FROM addresses WHERE id = ?', [req.params.id]);
  res.json({ success: true, address: updated });
});

/**
 * DELETE /api/addresses/:id
 */
router.delete('/:id', requireUser, (req, res) => {
  const userId = req.user.id;
  const addr = db.queryOne(
    'SELECT * FROM addresses WHERE id = ? AND userId = ?',
    [req.params.id, userId]
  );
  if (!addr) return res.status(404).json({ error: '地址不存在' });

  db.run('DELETE FROM addresses WHERE id = ?', [addr.id]);
  res.json({ success: true, message: '已删除' });
});

module.exports = router;
