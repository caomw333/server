/**
 * ShopVibe Server - Main Entry Point
 *
 * Start the server:
 *   node index.js
 *
 * Environment variables:
 *   PORT     - Server port (default: 3000)
 *   JWT_SECRET - JWT signing secret
 *   DB_PATH  - SQLite database file path
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const config = require('./config');

const app = express();

// ===== Middleware =====
app.use(cors());
app.use(express.json());

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

// ===== Health Check =====
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0'
  });
});

// ===== 404 Handler =====
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ===== Error Handler =====
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(500).json({ error: '服务器内部错误' });
});

// ===== Start Server =====
async function start() {
  // Initialize database
  await db.initDB();
  console.log('[DB] Database ready at:', config.DB_PATH);

  // Check if default merchant exists, create if not
  const merchant = db.queryOne('SELECT * FROM merchants WHERE account = ?', ['admin']);
  if (!merchant) {
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync('888888', 10);
    db.run(
      'INSERT INTO merchants (account, password, shopName) VALUES (?, ?, ?)',
      ['admin', hash, 'ShopVibe 官方旗舰店']
    );
    console.log('[AUTH] Default merchant created: admin / 888888');
  }

  // Start listening
  app.listen(config.PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════╗');
    console.log(`║  ShopVibe Server running on port ${config.PORT}  ║`);
    console.log('║                                              ║');
    console.log(`║  Local:   http://localhost:${config.PORT}/api/health ║`);
    console.log(`║  Network: http://YOUR_IP:${config.PORT}/api/health  ║`);
    console.log('║                                              ║');
    console.log('║  Login: admin / 888888                       ║');
    console.log('╚══════════════════════════════════════════════╝');
    console.log('');
  });
}

start().catch(err => {
  console.error('[FATAL] Failed to start server:', err);
  process.exit(1);
});
