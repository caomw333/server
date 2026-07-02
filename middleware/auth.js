/**
 * JWT Authentication Middleware
 */
const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * Verify merchant token (for sale mini program)
 */
function requireMerchant(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录，请先登录商户端' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    if (decoded.role !== 'merchant') {
      return res.status(403).json({ error: '无商户权限' });
    }
    req.merchant = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }
}

/**
 * Verify user token (for shopvibe mini program)
 */
function requireUser(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: '登录已过期' });
  }
}

/**
 * Optional auth - doesn't block but sets req.user/merchant if token present
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    if (decoded.role === 'merchant') {
      req.merchant = decoded;
    } else {
      req.user = decoded;
    }
  } catch (err) {
    // Token invalid, continue without auth
  }
  next();
}

module.exports = { requireMerchant, requireUser, optionalAuth };
