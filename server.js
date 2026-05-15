const express = require('express');
const session = require('express-session');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pw), salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(input, stored) {
  if (!stored || !input) return false;
  if (!String(stored).startsWith('scrypt:')) {
    return String(input) === String(stored);
  }
  const [, salt, hash] = String(stored).split(':');
  try {
    const computed = crypto.scryptSync(String(input), salt, 64);
    const expected = Buffer.from(hash, 'hex');
    return computed.length === expected.length && crypto.timingSafeEqual(computed, expected);
  } catch (e) {
    return false;
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'public', 'uploads');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function defaultSettings() {
  return {
    brand: '岱岭',
    brandEn: 'DAILING',
    phone: '400-888-0000',
    email: 'hello@dailing.com',
    address: '杭州市西湖区文三路 88 号',
    wechat: 'dailing_official',
    hours: '周一至周日 09:00 – 21:00',
    hero: {
      eyebrow: 'Selected · 山野臻品',
      titleLine1: '来自',
      titleAccent: '山川大地',
      titleLine2: '的至诚馈赠',
      desc: '跨越南北二十省，深入产地源头。我们只甄选时令最好、土地最净、匠人最专的那一份，把山野的香气与农人的心意，原封呈到您的餐桌。',
      bgImage: '',
      badge1: 'SINCE 2018',
      badge2: '原产直供',
      badge3: 'EST. 岱岭'
    },
    storyHome: {
      eyebrow: 'Our Story',
      title: '把山野的好\n诚意送到您的餐桌',
      p1: '岱岭起源于一个朴素的念头——让真正的好土产，能被更多人尝到。八年间，我们走遍二十余省，与三百多位农人、匠人建立长期合作。',
      p2: '不催熟、不滥添、不过度包装。我们相信，最好的味道，是土地本来的样子。',
      image: '',
      metaRegions: '20+',
      metaFarmers: '300+',
      metaYears: '8'
    },
    about: {
      bannerEyebrow: 'Our Story',
      bannerTitle: '把山野的好\n诚意送到您的餐桌',
      bannerSub: '八年间，跨越二十省山川，只为甄选这一份最本真的味道',
      originEyebrow: 'Origin · 缘起',
      originTitle: '始于一个\n朴素的念头',
      originP1: '2018 年的春天，创始人在云南香格里拉的深山中第一次见到野生松茸。那一刻她忽然意识到，太多真正的好土产，因为缺乏一座桥梁，无法被远方的人尝到；同时也有太多农人，被层层中间环节稀释着应得的回报。',
      originP2: '于是有了岱岭——一座以诚信为基的桥。我们走得慢，但走得深。我们买得贵，但买得真。我们不在直播间里喧嚣，只在每一份寄出的包裹里，写下产地、写下农人的名字、写下采摘的那一天。',
      originImage: '',
      principle1Title: '原产直供',
      principle1Desc: '我们只与认识超过两年的农户合作。每一批次都附产地档案，可溯可查。',
      principle2Title: '本真味道',
      principle2Desc: '不催熟、不滥添、不漂白、不过度包装。最好的味道，是土地原本的样子。',
      principle3Title: '七日鲜约',
      principle3Desc: '当季时令商品，承诺采后七日内送达。不新鲜，免费重发或全额退款。',
      statRegions: '20+',
      statFarmers: '300+',
      statYears: '8',
      statFamilies: '120k+'
    },
    footerTagline: '山野臻品 · 匠心甄选\n把中国大地的好土产\n送到每一个用心的餐桌'
  };
}

function mergeSettings(saved, defaults) {
  if (!saved || typeof saved !== 'object') return defaults;
  const out = { ...defaults };
  for (const k of Object.keys(saved)) {
    if (saved[k] && typeof saved[k] === 'object' && !Array.isArray(saved[k])) {
      out[k] = mergeSettings(saved[k], defaults[k] || {});
    } else {
      out[k] = saved[k];
    }
  }
  return out;
}

function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    const seed = {
      admin: { username: 'admin', password: 'admin123' },
      settings: defaultSettings(),
      categories: [
        { id: 1, name: '茶叶香茗', slug: 'tea', desc: '高山云雾，匠心烘焙' },
        { id: 2, name: '山珍菌菇', slug: 'mushroom', desc: '深林馈赠，自然生长' },
        { id: 3, name: '蜂蜜糖品', slug: 'honey', desc: '百花酿造，纯净甘甜' },
        { id: 4, name: '五谷杂粮', slug: 'grain', desc: '田间精选，颗粒饱满' },
        { id: 5, name: '干果坚果', slug: 'nuts', desc: '阳光晒制，原味留香' }
      ],
      products: [
        { id: 1, name: '明前龙井·特级', cat: 1, price: 388, unit: '盒/250g', origin: '浙江·杭州', stock: 120, featured: true, image: '', desc: '取自西湖核心产区，清明前手工采摘嫩芽，传统铁锅炒制，色泽嫩绿、香气清雅、滋味甘鲜。' },
        { id: 2, name: '武夷大红袍', cat: 1, price: 268, unit: '罐/100g', origin: '福建·武夷山', stock: 80, featured: true, image: '', desc: '岩骨花香，传统炭焙工艺，汤色橙黄明亮，岩韵悠长，回甘持久。' },
        { id: 3, name: '云南野生松茸', cat: 2, price: 588, unit: '盒/500g', origin: '云南·香格里拉', stock: 30, featured: true, image: '', desc: '海拔3500米原始森林，纯野生采摘，肉质肥厚紧实，香气独特浓郁。' },
        { id: 4, name: '长白山黑木耳', cat: 2, price: 98, unit: '袋/250g', origin: '吉林·长白山', stock: 200, featured: false, image: '', desc: '寒地段木栽培，肉厚耳大，泡发率高，胶质丰盈。' },
        { id: 5, name: '秦岭百花蜜', cat: 3, price: 168, unit: '瓶/500g', origin: '陕西·秦岭', stock: 150, featured: true, image: '', desc: '深山蜂场原蜜，未经加工，琥珀色泽，浓郁花香，自然结晶。' },
        { id: 6, name: '东北五常稻花香', cat: 4, price: 128, unit: '袋/5kg', origin: '黑龙江·五常', stock: 300, featured: false, image: '', desc: '黑土地原产，一年一熟，米粒晶莹，蒸煮后清香扑鼻，软糯回甘。' },
        { id: 7, name: '新疆和田大枣', cat: 5, price: 88, unit: '袋/500g', origin: '新疆·和田', stock: 250, featured: true, image: '', desc: '日照充足的沙漠绿洲，皮薄肉厚核小，自然晾晒，糖分浓郁。' },
        { id: 8, name: '临安山核桃', cat: 5, price: 158, unit: '罐/420g', origin: '浙江·临安', stock: 180, featured: false, image: '', desc: '手剥山核桃，传统椒盐工艺，仁白饱满，香脆可口。' }
      ],
      orders: [],
      messages: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2));
    return seed;
  }
  const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  // migrate: ensure settings exist & contain any new default fields
  const defaults = defaultSettings();
  const merged = mergeSettings(db.settings || {}, defaults);
  if (JSON.stringify(merged) !== JSON.stringify(db.settings || null)) {
    db.settings = merged;
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  }
  return db;
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + ext);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dailing-secret-key-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: '未登录' });
  return res.redirect('/admin/login.html');
}

// ===== Public API =====
app.get('/api/settings', (req, res) => {
  res.json(loadDB().settings);
});

app.get('/api/categories', (req, res) => {
  res.json(loadDB().categories);
});

app.get('/api/products', (req, res) => {
  const db = loadDB();
  let products = db.products;
  const { cat, featured, q } = req.query;
  if (cat) products = products.filter(p => String(p.cat) === String(cat));
  if (featured === '1') products = products.filter(p => p.featured);
  if (q) {
    const kw = q.toLowerCase();
    products = products.filter(p => p.name.toLowerCase().includes(kw) || (p.desc || '').toLowerCase().includes(kw));
  }
  const withCat = products.map(p => ({
    ...p,
    catName: (db.categories.find(c => c.id === p.cat) || {}).name || ''
  }));
  res.json(withCat);
});

app.get('/api/products/:id', (req, res) => {
  const db = loadDB();
  const p = db.products.find(x => x.id === Number(req.params.id));
  if (!p) return res.status(404).json({ error: '未找到' });
  res.json({ ...p, catName: (db.categories.find(c => c.id === p.cat) || {}).name || '' });
});

app.post('/api/messages', (req, res) => {
  const { name, contact, content } = req.body;
  if (!name || !contact || !content) return res.status(400).json({ error: '请填写完整信息' });
  const db = loadDB();
  db.messages.push({
    id: Date.now(),
    name, contact, content,
    createdAt: new Date().toISOString()
  });
  saveDB(db);
  res.json({ ok: true });
});

app.post('/api/orders', (req, res) => {
  const { productId, qty, name, phone, address, note } = req.body;
  if (!productId || !qty || !name || !phone || !address) return res.status(400).json({ error: '请填写完整信息' });
  const db = loadDB();
  const product = db.products.find(p => p.id === Number(productId));
  if (!product) return res.status(404).json({ error: '商品不存在' });
  const order = {
    id: Date.now(),
    productId: product.id,
    productName: product.name,
    unit: product.unit,
    price: product.price,
    qty: Number(qty),
    total: product.price * Number(qty),
    name, phone, address, note: note || '',
    status: '待处理',
    createdAt: new Date().toISOString()
  };
  db.orders.push(order);
  saveDB(db);
  res.json({ ok: true, order });
});

// ===== Admin Auth =====
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  const db = loadDB();
  if (username === db.admin.username && verifyPassword(password, db.admin.password)) {
    req.session.isAdmin = true;
    return res.json({ ok: true });
  }
  res.status(401).json({ error: '账号或密码错误' });
});

app.put('/api/admin/password', requireAuth, (req, res) => {
  const { oldPassword, newPassword, newUsername } = req.body || {};
  if (!oldPassword || !newPassword) return res.status(400).json({ error: '请填写原密码和新密码' });
  if (String(newPassword).length < 6) return res.status(400).json({ error: '新密码至少 6 位' });
  const db = loadDB();
  if (!verifyPassword(oldPassword, db.admin.password)) {
    return res.status(401).json({ error: '原密码错误' });
  }
  db.admin.password = hashPassword(newPassword);
  if (newUsername && String(newUsername).trim()) {
    db.admin.username = String(newUsername).trim();
  }
  saveDB(db);
  // Invalidate current session — force re-login with new password
  req.session.destroy(() => res.json({ ok: true }));
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/admin/me', (req, res) => {
  res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

// ===== Admin Stats =====
app.get('/api/admin/stats', requireAuth, (req, res) => {
  const db = loadDB();
  res.json({
    products: db.products.length,
    categories: db.categories.length,
    orders: db.orders.length,
    pendingOrders: db.orders.filter(o => o.status === '待处理').length,
    messages: db.messages.length,
    totalSales: db.orders.reduce((s, o) => s + (o.total || 0), 0)
  });
});

// ===== Admin Products CRUD =====
app.get('/api/admin/products', requireAuth, (req, res) => {
  const db = loadDB();
  const products = db.products.map(p => ({
    ...p,
    catName: (db.categories.find(c => c.id === p.cat) || {}).name || ''
  }));
  res.json(products);
});

app.post('/api/admin/products', requireAuth, (req, res) => {
  const db = loadDB();
  const { name, cat, price, unit, origin, stock, featured, image, desc } = req.body;
  const id = (db.products.reduce((m, p) => Math.max(m, p.id), 0) || 0) + 1;
  const product = {
    id,
    name: String(name || '').trim(),
    cat: Number(cat) || 0,
    price: Number(price) || 0,
    unit: String(unit || ''),
    origin: String(origin || ''),
    stock: Number(stock) || 0,
    featured: !!featured,
    image: String(image || ''),
    desc: String(desc || '')
  };
  db.products.push(product);
  saveDB(db);
  res.json(product);
});

app.put('/api/admin/products/:id', requireAuth, (req, res) => {
  const db = loadDB();
  const idx = db.products.findIndex(p => p.id === Number(req.params.id));
  if (idx < 0) return res.status(404).json({ error: '未找到' });
  const cur = db.products[idx];
  const { name, cat, price, unit, origin, stock, featured, image, desc } = req.body;
  db.products[idx] = {
    ...cur,
    name: name !== undefined ? String(name).trim() : cur.name,
    cat: cat !== undefined ? Number(cat) : cur.cat,
    price: price !== undefined ? Number(price) : cur.price,
    unit: unit !== undefined ? String(unit) : cur.unit,
    origin: origin !== undefined ? String(origin) : cur.origin,
    stock: stock !== undefined ? Number(stock) : cur.stock,
    featured: featured !== undefined ? !!featured : cur.featured,
    image: image !== undefined ? String(image) : cur.image,
    desc: desc !== undefined ? String(desc) : cur.desc
  };
  saveDB(db);
  res.json(db.products[idx]);
});

app.delete('/api/admin/products/:id', requireAuth, (req, res) => {
  const db = loadDB();
  const idx = db.products.findIndex(p => p.id === Number(req.params.id));
  if (idx < 0) return res.status(404).json({ error: '未找到' });
  db.products.splice(idx, 1);
  saveDB(db);
  res.json({ ok: true });
});

// ===== Admin Categories CRUD =====
app.get('/api/admin/categories', requireAuth, (req, res) => {
  res.json(loadDB().categories);
});

app.post('/api/admin/categories', requireAuth, (req, res) => {
  const db = loadDB();
  const { name, slug, desc } = req.body;
  const id = (db.categories.reduce((m, c) => Math.max(m, c.id), 0) || 0) + 1;
  const cat = { id, name: String(name || '').trim(), slug: String(slug || '').trim(), desc: String(desc || '') };
  db.categories.push(cat);
  saveDB(db);
  res.json(cat);
});

app.put('/api/admin/categories/:id', requireAuth, (req, res) => {
  const db = loadDB();
  const idx = db.categories.findIndex(c => c.id === Number(req.params.id));
  if (idx < 0) return res.status(404).json({ error: '未找到' });
  const cur = db.categories[idx];
  const { name, slug, desc } = req.body;
  db.categories[idx] = {
    ...cur,
    name: name !== undefined ? String(name) : cur.name,
    slug: slug !== undefined ? String(slug) : cur.slug,
    desc: desc !== undefined ? String(desc) : cur.desc
  };
  saveDB(db);
  res.json(db.categories[idx]);
});

app.delete('/api/admin/categories/:id', requireAuth, (req, res) => {
  const db = loadDB();
  const id = Number(req.params.id);
  const inUse = db.products.some(p => p.cat === id);
  if (inUse) return res.status(400).json({ error: '该分类下仍有商品，无法删除' });
  const idx = db.categories.findIndex(c => c.id === id);
  if (idx < 0) return res.status(404).json({ error: '未找到' });
  db.categories.splice(idx, 1);
  saveDB(db);
  res.json({ ok: true });
});

// ===== Admin Orders =====
app.get('/api/admin/orders', requireAuth, (req, res) => {
  res.json(loadDB().orders.slice().reverse());
});

app.put('/api/admin/orders/:id', requireAuth, (req, res) => {
  const db = loadDB();
  const idx = db.orders.findIndex(o => o.id === Number(req.params.id));
  if (idx < 0) return res.status(404).json({ error: '未找到' });
  if (req.body.status) db.orders[idx].status = String(req.body.status);
  saveDB(db);
  res.json(db.orders[idx]);
});

app.delete('/api/admin/orders/:id', requireAuth, (req, res) => {
  const db = loadDB();
  const idx = db.orders.findIndex(o => o.id === Number(req.params.id));
  if (idx < 0) return res.status(404).json({ error: '未找到' });
  db.orders.splice(idx, 1);
  saveDB(db);
  res.json({ ok: true });
});

// ===== Admin Messages =====
app.get('/api/admin/messages', requireAuth, (req, res) => {
  res.json(loadDB().messages.slice().reverse());
});

app.delete('/api/admin/messages/:id', requireAuth, (req, res) => {
  const db = loadDB();
  const idx = db.messages.findIndex(m => m.id === Number(req.params.id));
  if (idx < 0) return res.status(404).json({ error: '未找到' });
  db.messages.splice(idx, 1);
  saveDB(db);
  res.json({ ok: true });
});

// ===== Admin Settings =====
app.get('/api/admin/settings', requireAuth, (req, res) => {
  res.json(loadDB().settings);
});

app.put('/api/admin/settings', requireAuth, (req, res) => {
  const db = loadDB();
  const merged = mergeSettings(req.body || {}, db.settings || defaultSettings());
  db.settings = merged;
  saveDB(db);
  res.json(db.settings);
});

app.post('/api/admin/settings/reset', requireAuth, (req, res) => {
  const db = loadDB();
  db.settings = defaultSettings();
  saveDB(db);
  res.json(db.settings);
});

// ===== Upload =====
app.post('/api/admin/upload', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '未上传文件' });
  res.json({ url: '/uploads/' + req.file.filename });
});

// ===== Static =====
// Login page must be accessible without auth
app.get('/admin/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'login.html'));
});
app.get(['/admin', '/admin/'], requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});
app.use('/admin', requireAuth, express.static(path.join(__dirname, 'admin')));
// Serve uploads from UPLOAD_DIR (allows persistent-volume mounts outside /public)
app.use('/uploads', express.static(UPLOAD_DIR));
app.use(express.static(path.join(__dirname, 'public')));

loadDB();

app.listen(PORT, () => {
  console.log(`\n  ╭──────────────────────────────────────────╮`);
  console.log(`  │   岱岭·农特产品展销平台已启动            │`);
  console.log(`  │                                          │`);
  console.log(`  │   前台:  http://localhost:${PORT}            │`);
  console.log(`  │   后台:  http://localhost:${PORT}/admin      │`);
  console.log(`  │                                          │`);
  console.log(`  │   默认账号: admin                         │`);
  console.log(`  │   默认密码: admin123                      │`);
  console.log(`  ╰──────────────────────────────────────────╯\n`);
});
