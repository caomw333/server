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

  const refreshToken = jwt.sign(
    { id: merchant.id, role: 'merchant', type: 'refresh' },
    config.JWT_SECRET,
    { expiresIn: '30d' }
  );

  res.json({
    token,
    refreshToken,
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
router.post('/user-login', (req, res, next) => {
  try {
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
      const lid = db.lastInsertId();
      user = db.queryOne('SELECT * FROM users WHERE id = ?', [lid]);
      if (!user) {
        throw new Error('User creation failed');
      }
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, role: 'user' },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN }
    );

    res.json({ token, user });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/wechat-login
 * WeChat login using wx.login() code (for buyer mini program)
 */
router.post('/wechat-login', async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: '缺少微信登录码' });
    }

    if (!config.WECHAT_APPID || !config.WECHAT_APPSECRET) {
      return res.status(500).json({ error: '服务端未配置微信登录' });
    }

    // Exchange code for openid via WeChat API
    const wxResp = await fetch(
      `https://api.weixin.qq.com/sns/jscode2session?appid=${config.WECHAT_APPID}&secret=${config.WECHAT_APPSECRET}&js_code=${code}&grant_type=authorization_code`
    );
    const wxData = await wxResp.json();

    if (wxData.errcode) {
      console.error('[WECHAT LOGIN ERROR]', wxData);
      return res.status(400).json({ error: '微信登录失败，请重试' });
    }

    const { openid } = wxData;

    // Find or create user by openid
    let user = db.queryOne('SELECT * FROM users WHERE wxOpenid = ?', [openid]);
    if (!user) {
      db.run(
        'INSERT INTO users (wxOpenid, name, level) VALUES (?, ?, ?)',
        [openid, '微信用户', '普通']
      );
      const lid = db.lastInsertId();
      user = db.queryOne('SELECT * FROM users WHERE id = ?', [lid]);
      if (!user) {
        throw new Error('User creation failed');
      }
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, role: 'user', wxOpenid: openid },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN }
    );

    res.json({ token, user: { ...user, wxOpenid: undefined } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: '缺少 refreshToken' });
  }

  try {
    const decoded = jwt.verify(refreshToken, config.JWT_SECRET);
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: '无效的 refreshToken' });
    }

    const newToken = jwt.sign(
      { id: decoded.id, account: decoded.account, role: decoded.role, shopName: decoded.shopName },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN }
    );

    res.json({ token: newToken });
  } catch (err) {
    return res.status(401).json({ error: 'refreshToken 已过期，请重新登录' });
  }
});
