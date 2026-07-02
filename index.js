/**
 * ShopVibe Server - Main Entry Point
 *
 * Start the server:
 *   node index.js
 *
 * Environment variables (see .env.example):
 *   PORT              - Server port (default: 3000)
 *   JWT_SECRET        - JWT signing secret
 *   DB_PATH           - SQLite database file path
 *   CORS_ORIGINS      - Comma-separated allowed origins
 *   RATE_LIMIT_WINDOW_MS - Rate limit time window (default: 15min)
 *   RATE_LIMIT_MAX    - Max requests per window (default: 100)
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const db = require('./db');
const config = require('./config');

const app = express();

// ===== Security Middleware =====

// Helmet: set secure HTTP headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS: restrict allowed origins
const corsOptions = {
  origin: config.CORS_ORIGINS[0] === '*'
    ? '*'
    : function (origin, callback) {
        if (!origin || config.CORS_ORIGINS.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
  credentials: true,
};
app.use(cors(corsOptions));

// Rate limiting: global API rate limiter
const globalLimiter = rateLimit({
  windowMs: config.RATE_LIMIT.windowMs,
  max: config.RATE_LIMIT.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '请求过于频繁，请稍后再试' },
});
app.use('/api', globalLimiter);

// Auth endpoints have stricter rate limit
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '登录请求过于频繁，请15分钟后再试' },
});
app.use('/api/auth', authLimiter);

// Body parsing with size limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url} → ${res.statusCode} (${ms}ms)`);
  });
  next();
});

// ===== Routes =====
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/wishlist', require('./routes/wishlist'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/user', require('./routes/user'));
app.use('/api/addresses', require('./routes/addresses'));

// ===== Health Check =====
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    env: process.env.NODE_ENV || 'development',
  });
});

// ===== 404 Handler =====
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ===== Error Handler =====
app.use((err, req, res, next) => {
  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: '文件过大，最大支持 5MB' });
  }
  // JSON body too large
  if (err.type === 'entity.too.large') {
    return res.status(400).json({ error: '请求体过大' });
  }
  console.error('[ERROR]', err.message || err);
  res.status(err.status || 500).json({
    error: err.expose ? err.message : '服务器内部错误',
    detail: process.env.NODE_ENV !== 'production' ? err.message : undefined,
  });
});

// ===== Graceful Shutdown =====
process.on('SIGTERM', async () => {
  console.log('\n[SHUTDOWN] SIGTERM received, closing gracefully...');
  db.closeDB();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n[SHUTDOWN] SIGINT received, closing gracefully...');
  db.closeDB();
  process.exit(0);
});

// ===== Start Server =====
async function start() {
  // Initialize database
  await db.initDB();
  console.log('[DB] Database ready at:', config.DB_PATH);

  // Create default merchant accounts if not exist
  const defaultMerchants = [
    { account: 'admin', password: '888888', shopName: 'ShopVibe 官方旗舰店' },
    { account: 'shop1', password: '123456', shopName: '品质生活馆' },
    { account: 'shop2', password: '123456', shopName: '数码潮品店' }
  ];

  for (const m of defaultMerchants) {
    const existing = db.queryOne('SELECT * FROM merchants WHERE account = ?', [m.account]);
    if (!existing) {
      const bcrypt = require('bcryptjs');
      const hash = bcrypt.hashSync(m.password, 10);
      db.run(
        'INSERT INTO merchants (account, password, shopName) VALUES (?, ?, ?)',
        [m.account, hash, m.shopName]
      );
      console.log(`[AUTH] Created merchant: ${m.account} / ${m.password}`);
    }
  }

  // Start listening
  app.listen(config.PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════╗');
    console.log(`║  ShopVibe Server running on port ${config.PORT}    ║`);
    console.log('║                                              ║');
    console.log(`║  Local:   http://localhost:${config.PORT}/api/health ║`);
    console.log(`║  Network: http://YOUR_IP:${config.PORT}/api/health  ║`);
    console.log('║                                              ║');
    console.log('║  Login: admin/888888 shop1/123456 shop2/123456 ║');
    console.log('╚══════════════════════════════════════════════╝');
    console.log('');
  });
}

start().catch(err => {
  console.error('[FATAL] Failed to start server:', err);
  process.exit(1);
});
