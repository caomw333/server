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
    { name: '虾仁烧麦', brand: '茶楼鲜制', price: 18, originalPrice: 22, rating: 4.8, reviews: 1283, image: '/uploads/40c08d1f11830021fd216c0d049721d4.jpg', badge: '畅销', category: '茶点', desc: '整颗虾仁搭配鲜肉，皮薄馅大，茶楼经典。', stock: 200, sales: 1283 },
    { name: '凤尾虾饺', brand: '茶楼鲜制', price: 25, rating: 4.9, reviews: 956, image: '/uploads/3a1171e536003bcfac79d68797639673.jpg', badge: '茶楼极美味', category: '茶点', desc: '虾尾完整外露，皮薄肉弹，鲜甜多汁。', stock: 150, sales: 956 },
    { name: '水晶粉果', brand: '茶楼鲜制', price: 16, originalPrice: 20, rating: 4.7, reviews: 723, image: '/uploads/598a650054b2bb66c939295908b4c622.jpg', badge: 'new', category: '茶点', desc: '透明外皮包裹青菜馅料，Q弹爽滑。', stock: 180, sales: 723 },
    { name: '薄皮蒸饺', brand: '茶楼鲜制', price: 15, originalPrice: 18, rating: 4.6, reviews: 1123, image: '/uploads/9e355cdc184768a09d06431ec6b23a52.jpg', badge: 'sale', category: '饺子', desc: '薄皮大馅，玉米猪肉鲜香，蒸制美味。', stock: 160, sales: 1123 },
    { name: '海丰小米', brand: '茶楼鲜制', price: 12, originalPrice: 15, rating: 4.7, reviews: 867, image: '/uploads/689f388396b25c05080cf5af5ca95f71.jpg', badge: 'new', category: '包点', desc: '汕尾海丰传统小吃，外皮软糯内馅鲜香。', stock: 200, sales: 867 },
    { name: '鲜肉玉米紫菜卷', brand: '茶楼鲜制', price: 28, originalPrice: 32, rating: 4.8, reviews: 654, image: '/uploads/f3e713c94be4e51ecde78034f87344f9.jpg', badge: '批发价', category: '茶点', desc: '紫菜包裹鲜肉玉米，营养丰富，老少皆宜。', stock: 100, sales: 654 },
    { name: '韭菜饺', brand: '茶楼鲜制', price: 14, originalPrice: 18, rating: 4.5, reviews: 432, image: '/uploads/894b9a4dd4a26de6c22aef188ad8c7f6.jpg', badge: 'sale', category: '饺子', desc: '新鲜韭菜馅料，皮薄汁多，经典口味。', stock: 120, sales: 432 }
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
