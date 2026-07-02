/**
 * ShopVibe Database Layer
 * Uses sql.js (pure JS SQLite) - no native compilation needed.
 * Perfect for running on any hardware including old computers.
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const config = require('./config');

let db = null;

/**
 * Initialize the database
 */
async function initDB() {
  const SQL = await initSqlJs();

  const dbDir = path.dirname(config.DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Load existing database or create new one
  if (fs.existsSync(config.DB_PATH)) {
    const buffer = fs.readFileSync(config.DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Enable WAL mode for better performance
  db.run('PRAGMA journal_mode=WAL');

  createTables();
  return db;
}

/**
 * Create tables if they don't exist
 */
function createTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      brand TEXT NOT NULL,
      price REAL NOT NULL,
      originalPrice REAL,
      rating REAL DEFAULT 5.0,
      reviews INTEGER DEFAULT 0,
      image TEXT DEFAULT '📦',
      badge TEXT,
      category TEXT,
      desc TEXT,
      stock INTEGER DEFAULT 0,
      sales INTEGER DEFAULT 0,
      status TEXT DEFAULT 'on',
      createdAt TEXT DEFAULT (datetime('now', 'localtime')),
      updatedAt TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS merchants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      shopName TEXT NOT NULL,
      avatar TEXT DEFAULT '🏪',
      createdAt TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wxOpenid TEXT UNIQUE,
      name TEXT,
      phone TEXT,
      level TEXT DEFAULT '普通',
      totalSpent REAL DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      orderNo TEXT UNIQUE NOT NULL,
      userId INTEGER,
      items TEXT,
      total REAL,
      status TEXT DEFAULT 'pending',
      address TEXT,
      createdAt TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      productId INTEGER NOT NULL,
      quantity INTEGER DEFAULT 1,
      FOREIGN KEY (productId) REFERENCES products(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS wishlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      productId INTEGER NOT NULL,
      FOREIGN KEY (productId) REFERENCES products(id)
    )
  `);

  console.log('[DB] Tables initialized');
}

/**
 * Save database to disk
 */
function saveDB() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(config.DB_PATH, buffer);
}

/**
 * Run a query and return all rows
 */
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

/**
 * Run a query and return the first row
 */
function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Run a write operation (INSERT/UPDATE/DELETE)
 * Returns the number of rows affected, or lastInsertID for INSERT
 */
function run(sql, params = []) {
  db.run(sql, params);
  saveDB();
  return db.getRowsModified();
}

/**
 * Get the last inserted row ID
 */
function lastInsertId() {
  return db.exec("SELECT last_insert_rowid() as id")[0]?.values[0][0];
}

/**
 * Close database connection
 */
function closeDB() {
  if (db) {
    saveDB();
    db.close();
    db = null;
  }
}

module.exports = {
  initDB,
  queryAll,
  queryOne,
  run,
  lastInsertId,
  closeDB,
  saveDB
};
