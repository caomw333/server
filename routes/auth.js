/**
 * Auth Routes - Login for merchant and user
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const config = require('../config');

const router = express.Router();

/**
 * POST /api/auth/merchant-login
 * Merchant login (for sale mini program)
 */
router.post('/merchant-login', (req, res) => {
  const { account, password } = req.body;
  if (!account || !password) {
    return res.status(400).json({ error: '请输入账号和密码' });
  }

  const merchant = db.queryOne('SELECT * FROM merchants WHERE account = ?', [account]);
  if (!merchant) {
    return res.status(401).json({ error: '账号或密码错误' });
  }

  const valid = bcrypt.compareSync(password, merchant.password);
  if (!valid) {
    return res.status(401).json({ error: '账号或密码错误' });
  }

  const token = jwt.sign(
    { id: merchant.id, account: merchant.account, role: 'merchant', shopName: merchant.shopName },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN }
  );

  res.json({
    token,
    merchant: {
      id: merchant.id,
      account: merchant.account,
      shopName: merchant.shopName,
      avatar: merchant.avatar
    }
  });
});

/**
 * POST /api/auth/user-login
 * Simple user login (for shopvibe mini program demo)
 */
router.post('/user-login', (req, res) => {
  const { name, phone } = req.body;
  if (!name) {
    return res.status(400).json({ error: '请输入用户名' });
  }

  // Find or create user
  let user = db.queryOne('SELECT * FROM users WHERE name = ?', [name]);
  if (!user) {
    db.run(
      'INSERT INTO users (name, phone, level) VALUES (?, ?, ?)',
      [name, phone || '', '普通']
    );
    user = db.queryOne('SELECT * FROM users WHERE id = ?', [db.lastInsertId()]);
  }

  const token = jwt.sign(
    { id: user.id, name: user.name, role: 'user' },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN }
  );

  res.json({ token, user });
});

module.exports = router;
