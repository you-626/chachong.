const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const os = require('os');
const fs = require('fs');
const multer = require('multer');
const XLSX = require('xlsx');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = 'checklist_system_secret_2024';

// ─── 上传文件大小限制 50MB（10万行Excel约10-30MB）────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/octet-stream'
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls', '.csv'].includes(ext)) cb(null, true);
    else cb(new Error('只支持 Excel(.xlsx/.xls) 或 CSV 文件'));
  }
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ─── 静态文件托管 ─────────────────────────────────────────────────────────────
const publicDir = path.join(__dirname, '..', 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  console.log('✅ 前端静态文件托管已启用');
}

// ─── 局域网 IP ────────────────────────────────────────────────────────────────
function getLanIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}

// ─── 数据库路径 ───────────────────────────────────────────────────────────────
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  try { fs.mkdirSync(dataDir, { recursive: true }); } catch {}
}
const dbPath = fs.existsSync(dataDir)
  ? path.join(dataDir, 'checklist.db')
  : path.join(__dirname, 'checklist.db');

// ─── 数据库连接 ───────────────────────────────────────────────────────────────
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) { console.error('数据库连接失败:', err); process.exit(1); }
  console.log('✅ 数据库连接:', dbPath);
});

// WAL 模式大幅提升并发写入性能，批量导入速度提升 5-10x
db.run('PRAGMA journal_mode = WAL');
db.run('PRAGMA synchronous = NORMAL');
db.run('PRAGMA cache_size = 10000');
db.run('PRAGMA temp_store = MEMORY');

// ─── Promise 包装 ─────────────────────────────────────────────────────────────
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err); else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
  });
}
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
  });
}

// ─── 初始化表 ────────────────────────────────────────────────────────────────
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'employee',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now','localtime')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now','localtime'))
  )`);

  // collected_accounts 支持动态扩展字段（extra_fields JSON列）
  db.run(`CREATE TABLE IF NOT EXISTS collected_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account TEXT UNIQUE NOT NULL,
    collected_by TEXT NOT NULL,
    collector_id INTEGER NOT NULL,
    extra_fields TEXT DEFAULT '{}',
    collected_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now','localtime'))
  )`);

  // field_schema 表：存储当前激活的字段映射方案
  db.run(`CREATE TABLE IF NOT EXISTS field_schema (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    account_field TEXT NOT NULL,
    extra_fields TEXT DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now','localtime'))
  )`);

  // import_logs 表：记录每次导入的结果
  db.run(`CREATE TABLE IF NOT EXISTS import_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT,
    total INTEGER,
    inserted INTEGER,
    skipped INTEGER,
    operator TEXT,
    schema_name TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now','localtime'))
  )`);

  db.get("SELECT id FROM users WHERE role='admin' LIMIT 1", [], (err, row) => {
    if (!row) {
      const hashed = bcrypt.hashSync('admin123', 10);
      db.run("INSERT INTO users (username,password,role,status) VALUES (?,?,'admin','active')",
        ['admin', hashed], () => console.log('✅ 默认管理员: admin / admin123'));
    }
  });
});

// ─── 鉴权中间件 ───────────────────────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const token = (req.headers['authorization'] || '').split(' ')[1];
  if (!token) return res.status(401).json({ message: '未授权访问' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ message: 'Token 无效或已过期' }); }
}
function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ message: '仅管理员可操作' });
  next();
}

// ══════════════════════════════════════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════════════════════════════════════
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: '用户名和密码不能为空' });
    const user = await get('SELECT * FROM users WHERE username=?', [username]);
    if (!user) return res.status(401).json({ message: '用户名或密码错误' });
    if (user.status === 'suspended') return res.status(403).json({ message: '账号已被停用，请联系管理员' });
    if (!bcrypt.compareSync(password, user.password)) return res.status(401).json({ message: '用户名或密码错误' });
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch { res.status(500).json({ message: '服务器错误' }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// 员工管理
// ══════════════════════════════════════════════════════════════════════════════
app.get('/api/users', authMiddleware, adminOnly, async (req, res) => {
  try { res.json(await all("SELECT id,username,role,status,created_at,updated_at FROM users WHERE role='employee' ORDER BY created_at DESC")); }
  catch { res.status(500).json({ message: '服务器错误' }); }
});

app.post('/api/users', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: '用户名和密码不能为空' });
    if (username.trim().length < 2) return res.status(400).json({ message: '用户名至少2个字符' });
    if (password.length < 6) return res.status(400).json({ message: '密码至少6位' });
    if (await get('SELECT id FROM users WHERE username=?', [username.trim()])) return res.status(409).json({ message: '用户名已存在' });
    await run("INSERT INTO users(username,password,role,status) VALUES(?,?,'employee','active')", [username.trim(), bcrypt.hashSync(password, 10)]);
    res.json({ message: '员工账号创建成功' });
  } catch { res.status(500).json({ message: '服务器错误' }); }
});

app.put('/api/users/:id/password', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) return res.status(400).json({ message: '新密码至少6位' });
    if (!await get("SELECT id FROM users WHERE id=? AND role='employee'", [req.params.id])) return res.status(404).json({ message: '员工不存在' });
    await run("UPDATE users SET password=?,updated_at=strftime('%Y-%m-%d %H:%M:%S','now','localtime') WHERE id=?", [bcrypt.hashSync(password, 10), req.params.id]);
    res.json({ message: '密码修改成功' });
  } catch { res.status(500).json({ message: '服务器错误' }); }
});

app.put('/api/users/:id/reset-password', authMiddleware, adminOnly, async (req, res) => {
  try {
    if (!await get("SELECT id FROM users WHERE id=? AND role='employee'", [req.params.id])) return res.status(404).json({ message: '员工不存在' });
    await run("UPDATE users SET password=?,updated_at=strftime('%Y-%m-%d %H:%M:%S','now','localtime') WHERE id=?", [bcrypt.hashSync('123456', 10), req.params.id]);
    res.json({ message: '密码已重置为：123456' });
  } catch { res.status(500).json({ message: '服务器错误' }); }
});

app.put('/api/users/:id/status', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active','suspended'].includes(status)) return res.status(400).json({ message: '状态值无效' });
    if (!await get("SELECT id FROM users WHERE id=? AND role='employee'", [req.params.id])) return res.status(404).json({ message: '员工不存在' });
    await run("UPDATE users SET status=?,updated_at=strftime('%Y-%m-%d %H:%M:%S','now','localtime') WHERE id=?", [status, req.params.id]);
    res.json({ message: status === 'active' ? '账号已恢复' : '账号已停用' });
  } catch { res.status(500).json({ message: '服务器错误' }); }
});

app.delete('/api/users/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    if (!await get("SELECT id FROM users WHERE id=? AND role='employee'", [req.params.id])) return res.status(404).json({ message: '员工不存在' });
    await run('DELETE FROM users WHERE id=?', [req.params.id]);
    res.json({ message: '账号已删除' });
  } catch { res.status(500).json({ message: '服务器错误' }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// 采集账号 CRUD
// ══════════════════════════════════════════════════════════════════════════════
app.post('/api/accounts', authMiddleware, async (req, res) => {
  try {
    const { account, extra_fields = {} } = req.body;
    if (!account || !account.trim()) return res.status(400).json({ message: '账号不能为空' });
    const trimmed = account.trim();
    if (await get('SELECT id FROM collected_accounts WHERE account=?', [trimmed])) {
      return res.status(409).json({ message: '该采集账号已经存在', duplicate: true });
    }
    await run('INSERT INTO collected_accounts(account,collected_by,collector_id,extra_fields) VALUES(?,?,?,?)',
      [trimmed, req.user.username, req.user.id, JSON.stringify(extra_fields)]);
    res.json({ message: '添加成功', duplicate: false });
  } catch { res.status(500).json({ message: '服务器错误' }); }
});

app.get('/api/accounts', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { page = 1, pageSize = 20, search = '' } = req.query;
    const offset = (Number(page) - 1) * Number(pageSize);
    const where = search ? ' WHERE account LIKE ? OR collected_by LIKE ?' : '';
    const params = search ? [`%${search}%`, `%${search}%`] : [];
    const total = (await get(`SELECT COUNT(*) as c FROM collected_accounts${where}`, params)).c;
    const accounts = await all(`SELECT * FROM collected_accounts${where} ORDER BY collected_at DESC LIMIT ? OFFSET ?`, [...params, Number(pageSize), offset]);
    // 解析 extra_fields
    const result = accounts.map(r => ({ ...r, extra_fields: (() => { try { return JSON.parse(r.extra_fields || '{}'); } catch { return {}; } })() }));
    res.json({ accounts: result, total, page: Number(page), pageSize: Number(pageSize) });
  } catch { res.status(500).json({ message: '服务器错误' }); }
});

app.delete('/api/accounts/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    if (!await get('SELECT id FROM collected_accounts WHERE id=?', [req.params.id])) return res.status(404).json({ message: '记录不存在' });
    await run('DELETE FROM collected_accounts WHERE id=?', [req.params.id]);
    res.json({ message: '删除成功' });
  } catch { res.status(500).json({ message: '服务器错误' }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// 统计
// ══════════════════════════════════════════════════════════════════════════════
app.get('/api/stats', authMiddleware, adminOnly, async (req, res) => {
  try {
    const [ta, te, ae, today] = await Promise.all([
      get('SELECT COUNT(*) as c FROM collected_accounts'),
      get("SELECT COUNT(*) as c FROM users WHERE role='employee'"),
      get("SELECT COUNT(*) as c FROM users WHERE role='employee' AND status='active'"),
      get("SELECT COUNT(*) as c FROM collected_accounts WHERE date(collected_at)=date('now','localtime')")
    ]);
    res.json({ totalAccounts: ta.c, totalEmployees: te.c, activeEmployees: ae.c, todayAccounts: today.c });
  } catch { res.status(500).json({ message: '服务器错误' }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// 字段方案管理
// ══════════════════════════════════════════════════════════════════════════════
// 获取所有字段方案
app.get('/api/schemas', authMiddleware, adminOnly, async (req, res) => {
  try {
    const schemas = await all('SELECT * FROM field_schema ORDER BY created_at DESC');
    res.json(schemas.map(s => ({ ...s, extra_fields: JSON.parse(s.extra_fields || '[]') })));
  } catch { res.status(500).json({ message: '服务器错误' }); }
});

// 保存字段方案
app.post('/api/schemas', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { name, account_field, extra_fields = [] } = req.body;
    if (!name || !account_field) return res.status(400).json({ message: '方案名称和账号字段不能为空' });
    const result = await run('INSERT INTO field_schema(name,account_field,extra_fields) VALUES(?,?,?)',
      [name, account_field, JSON.stringify(extra_fields)]);
    res.json({ message: '字段方案已保存', id: result.lastID });
  } catch { res.status(500).json({ message: '服务器错误' }); }
});

app.delete('/api/schemas/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    await run('DELETE FROM field_schema WHERE id=?', [req.params.id]);
    res.json({ message: '方案已删除' });
  } catch { res.status(500).json({ message: '服务器错误' }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// Excel 预览：解析文件头，让前端做字段映射
// ══════════════════════════════════════════════════════════════════════════════
app.post('/api/import/preview', authMiddleware, adminOnly, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: '请上传文件' });

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', sheetRows: 6 }); // 只读前6行
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (!rows || rows.length === 0) return res.status(400).json({ message: 'Excel 文件为空' });

    const headers = rows[0].map(h => String(h).trim()).filter(Boolean);
    const preview = rows.slice(1, 5).map(row =>
      Object.fromEntries(headers.map((h, i) => [h, row[i] ?? '']))
    );

    // 统计总行数（只扫描 A 列避免全量解析）
    const fullSheet = XLSX.read(req.file.buffer, { type: 'buffer' });
    const fullData = XLSX.utils.sheet_to_json(fullSheet.Sheets[fullSheet.SheetNames[0]], { header: 1 });
    const totalRows = Math.max(0, fullData.length - 1);

    res.json({ headers, preview, totalRows, filename: req.file.originalname });
  } catch (err) {
    res.status(400).json({ message: `文件解析失败: ${err.message}` });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// Excel 批量导入（核心：分批事务 + WAL 模式，10万行约 5-15 秒）
// ══════════════════════════════════════════════════════════════════════════════
app.post('/api/import/execute', authMiddleware, adminOnly, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: '请上传文件' });

    const { account_field, extra_fields: extraFieldsRaw = '[]', schema_name = '导入' } = req.body;
    if (!account_field) return res.status(400).json({ message: '请指定账号字段' });

    let extraFields = [];
    try { extraFields = JSON.parse(extraFieldsRaw); } catch {}

    // 解析整个 Excel
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', raw: false });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (!rows || rows.length === 0) return res.status(400).json({ message: 'Excel 没有数据行' });

    const total = rows.length;
    const BATCH_SIZE = 500; // 每批500条，平衡内存和速度
    let inserted = 0;
    let skipped = 0;
    const errors = [];

    // 批量处理函数：单批在一个事务里完成
    function insertBatch(batch) {
      return new Promise((resolve, reject) => {
        db.serialize(() => {
          db.run('BEGIN TRANSACTION', (err) => { if (err) return reject(err); });

          let pending = batch.length;
          if (pending === 0) {
            db.run('COMMIT', () => resolve({ inserted: 0, skipped: 0 }));
            return;
          }

          let batchInserted = 0;
          let batchSkipped = 0;
          let hasError = false;

          for (const row of batch) {
            const accountVal = String(row[account_field] || '').trim();
            if (!accountVal) { pending--; batchSkipped++; if (pending === 0 && !hasError) { db.run('COMMIT', () => resolve({ inserted: batchInserted, skipped: batchSkipped })); } continue; }

            // 构建 extra_fields JSON
            const extra = {};
            for (const f of extraFields) {
              if (f && row[f] !== undefined) extra[f] = String(row[f] ?? '').trim();
            }

            db.run(
              'INSERT OR IGNORE INTO collected_accounts(account,collected_by,collector_id,extra_fields) VALUES(?,?,?,?)',
              [accountVal, req.user.username, req.user.id, JSON.stringify(extra)],
              function(err) {
                if (err && !hasError) { hasError = true; db.run('ROLLBACK', () => reject(err)); return; }
                if (this.changes > 0) batchInserted++; else batchSkipped++;
                pending--;
                if (pending === 0 && !hasError) {
                  db.run('COMMIT', () => resolve({ inserted: batchInserted, skipped: batchSkipped }));
                }
              }
            );
          }
        });
      });
    }

    // 分批执行
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      try {
        const result = await insertBatch(batch);
        inserted += result.inserted;
        skipped += result.skipped;
      } catch (err) {
        errors.push(`第 ${i+1}-${i+batch.length} 行处理失败: ${err.message}`);
        skipped += batch.length;
      }
    }

    // 记录导入日志
    await run('INSERT INTO import_logs(filename,total,inserted,skipped,operator,schema_name) VALUES(?,?,?,?,?,?)',
      [req.file.originalname, total, inserted, skipped, req.user.username, schema_name]);

    res.json({
      message: '导入完成',
      total,
      inserted,
      skipped,
      errors: errors.slice(0, 10) // 最多返回10条错误信息
    });
  } catch (err) {
    res.status(500).json({ message: `导入失败: ${err.message}` });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// 批量外部导入（支持指定采集人）
// ══════════════════════════════════════════════════════════════════════════════
app.post('/api/import/batch-custom', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { data } = req.body; // Expecting [{ employee: 'user1', account: 'acc1' }, ...]
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ message: '数据格式不正确或为空' });
    }

    // 1. 获取所有用户映射表，用于转换用户名到 ID
    const users = await all('SELECT id, username FROM users');
    const userMap = {};
    users.forEach(u => userMap[u.username] = u.id);

    const total = data.length;
    let inserted = 0;
    let skipped = 0;
    const errors = [];

    // 2. 批量处理
    await new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION', (err) => { if (err) return reject(err); });

        let pending = total;
        let hasError = false;

        for (const item of data) {
          const { employee, account } = item;
          const trimmedAccount = String(account || '').trim();
          const collectorId = userMap[employee];

          if (!trimmedAccount || !employee || !collectorId) {
            skipped++;
            pending--;
            if (!collectorId && employee) errors.push(`员工 ${employee} 不存在`);
            if (pending === 0 && !hasError) {
              db.run('COMMIT', () => resolve());
            }
            continue;
          }

          db.run(
            'INSERT OR IGNORE INTO collected_accounts(account,collected_by,collector_id) VALUES(?,?,?)',
            [trimmedAccount, employee, collectorId],
            function(err) {
              if (err && !hasError) {
                hasError = true;
                db.run('ROLLBACK', () => reject(err));
                return;
              }
              if (this.changes > 0) inserted++; else skipped++;
              pending--;
              if (pending === 0 && !hasError) {
                db.run('COMMIT', () => resolve());
              }
            }
          );
        }
      });
    });

    res.json({ message: '批量导入完成', total, inserted, skipped, errors: errors.slice(0, 10) });
  } catch (err) {
    res.status(500).json({ message: `服务器错误: ${err.message}` });
  }
});

// 获取导入历史
app.get('/api/import/logs', authMiddleware, adminOnly, async (req, res) => {
  try {
    const logs = await all('SELECT * FROM import_logs ORDER BY created_at DESC LIMIT 20');
    res.json(logs);
  } catch { res.status(500).json({ message: '服务器错误' }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// 导出
// ══════════════════════════════════════════════════════════════════════════════
app.get('/api/export', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { format = 'json', search = '' } = req.query;
    const where = search ? ' WHERE account LIKE ? OR collected_by LIKE ?' : '';
    const params = search ? [`%${search}%`, `%${search}%`] : [];
    const rows = await all(`SELECT account,collected_by,extra_fields,collected_at FROM collected_accounts${where} ORDER BY collected_at DESC`, params);

    // 展平 extra_fields
    const flat = rows.map(r => {
      let extra = {};
      try { extra = JSON.parse(r.extra_fields || '{}'); } catch {}
      return { 采集账号: r.account, 采集人: r.collected_by, ...extra, 采集时间: r.collected_at };
    });

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="accounts_${Date.now()}.json"`);
      return res.send(JSON.stringify({ exportTime: new Date().toLocaleString('zh-CN'), total: flat.length, data: flat }, null, 2));
    }
    if (format === 'csv') {
      if (flat.length === 0) return res.send('\uFEFF采集账号,采集人,采集时间\n');
      const headers = Object.keys(flat[0]);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="accounts_${Date.now()}.csv"`);
      const header = '\uFEFF' + headers.join(',') + '\n';
      const body = flat.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
      return res.send(header + body);
    }
    res.status(400).json({ message: '不支持的格式' });
  } catch { res.status(500).json({ message: '导出失败' }); }
});

// ── SPA 回退 ──────────────────────────────────────────────────────────────────
if (fs.existsSync(publicDir)) {
  app.get('*', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));
}

// ── 启动 ──────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  const ip = getLanIP();
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║        查重管理系统 已成功启动           ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  本机:   http://localhost:${PORT}          ║`);
  console.log(`║  局域网: http://${ip}:${PORT}       ║`);
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
});
