/**
 * ShopVibe Server Configuration
 */
module.exports = {
  PORT: process.env.PORT || 3000,
  JWT_SECRET: process.env.JWT_SECRET || 'shopvibe-dev-secret-key-2026',
  JWT_EXPIRES_IN: '7d',
  DB_PATH: process.env.DB_PATH || './data/shopvibe.db'
};
