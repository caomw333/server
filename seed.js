/**
 * Seed Script - Initialize database with sample products
 *
 * Run: node seed.js
 */
const path = require('path');
const config = require('./config');

// Override DB path for seed
config.DB_PATH = path.resolve(config.DB_PATH);

async function seed() {
  const { initDB, run, queryAll } = require('./db');
  await initDB();

  // Check if already seeded
  const existing = queryAll('SELECT COUNT(*) as count FROM products');
  if (existing[0]?.count > 0) {
    console.log(`[SEED] Already has ${existing[0].count} products, skipping`);
    process.exit(0);
  }

  const products = [
    { name: '北欧极简台灯', brand: 'NORDIC LIGHT', price: 299, originalPrice: 399, rating: 4.8, reviews: 234, image: '💡', badge: 'new', category: '家居生活', desc: '荣获红点设计大奖的极简台灯。采用航空级铝合金材质，三档色温可调。', stock: 50, sales: 234 },
    { name: '手工陶瓷花瓶', brand: 'CERAMIC STUDIO', price: 188, rating: 4.9, reviews: 156, image: '🏺', category: '家居生活', desc: '景德镇匠人手工拉坯，哑光釉面处理，适合干花与鲜切花。', stock: 30, sales: 156 },
    { name: '无线降噪耳机', brand: 'SOUNDCORE', price: 899, originalPrice: 1299, rating: 4.7, reviews: 892, image: '🎧', badge: 'sale', category: '数码电子', desc: '自适应主动降噪，40小时超长续航。LDAC高清音频，Hi-Res认证。', stock: 120, sales: 892 },
    { name: '有机棉T恤', brand: 'ECO WEAR', price: 159, rating: 4.6, reviews: 423, image: '👕', badge: 'eco', category: '服饰配饰', stock: 200, sales: 423 },
    { name: '植物精华面霜', brand: 'BOTANICA', price: 328, originalPrice: 428, rating: 4.8, reviews: 567, image: '🧴', badge: 'sale', category: '美妆护肤', desc: '含7种植物精华萃取，24小时长效保湿，敏感肌适用。', stock: 80, sales: 567 },
    { name: '轻量跑步鞋', brand: 'STRIDE PRO', price: 599, originalPrice: 799, rating: 4.5, reviews: 1204, image: '👟', badge: 'sale', category: '运动户外', desc: 'FlyKnit鞋面科技，单只198g。全掌碳纤维板。', stock: 65, sales: 1204 },
    { name: '智能手表', brand: 'TECHWEAR', price: 1499, originalPrice: 1899, rating: 4.9, reviews: 3456, image: '⌚', badge: 'new', category: '数码电子', desc: '1.5英寸AMOLED屏，血氧/心率/睡眠监测，14天续航。', stock: 40, sales: 3456 },
    { name: '设计之书', brand: 'PHAIDON', price: 268, rating: 4.9, reviews: 89, image: '📖', category: '图书文创', stock: 100, sales: 89 },
    { name: '天然大豆蜡烛', brand: 'CANDLE LAB', price: 128, rating: 4.7, reviews: 312, image: '🕯️', badge: 'eco', category: '家居生活', desc: '100%天然大豆蜡，薰衣草雪松精油，燃烧约45小时。', stock: 150, sales: 312 },
    { name: '机械键盘', brand: 'KEYCRAFT', price: 699, originalPrice: 899, rating: 4.6, reviews: 678, image: '⌨️', badge: 'sale', category: '数码电子', stock: 55, sales: 678 },
    { name: '真丝围巾', brand: 'SILK ROAD', price: 358, rating: 4.8, reviews: 145, image: '🧣', category: '服饰配饰', stock: 35, sales: 145 },
    { name: '瑜伽垫', brand: 'ZEN LIFE', price: 249, originalPrice: 349, rating: 4.7, reviews: 567, image: '🧘', badge: 'eco', category: '运动户外', stock: 90, sales: 567 }
  ];

  for (const p of products) {
    run(
      `INSERT INTO products (name, brand, price, originalPrice, rating, reviews, image, badge, category, desc, stock, sales)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [p.name, p.brand, p.price, p.originalPrice || null, p.rating, p.reviews,
       p.image, p.badge || null, p.category, p.desc || '', p.stock, p.sales]
    );
    console.log(`  ✓ ${p.name}`);
  }

  console.log(`\n[SEED] Successfully seeded ${products.length} products`);
  process.exit(0);
}

seed().catch(err => {
  console.error('[SEED] Error:', err);
  process.exit(1);
});
