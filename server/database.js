import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'data.db');

let db = null;

// 初始化数据库
async function initDatabase() {
  const SQL = await initSqlJs();

  // 如果数据库文件存在，加载它
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // 初始化表结构
  db.run(`
    -- 用户表
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      points INTEGER DEFAULT 0,
      daily_points INTEGER DEFAULT 0,
      daily_points_date VARCHAR(10),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      invited_by INTEGER,
      login_count INTEGER DEFAULT 0,
      FOREIGN KEY (invited_by) REFERENCES users(id)
    );

    -- 邀请码表
    CREATE TABLE IF NOT EXISTS invite_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code VARCHAR(16) UNIQUE NOT NULL,
      owner_id INTEGER NOT NULL,
      used_by INTEGER,
      used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES users(id),
      FOREIGN KEY (used_by) REFERENCES users(id)
    );

    -- 验证码表
    CREATE TABLE IF NOT EXISTS verification_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email VARCHAR(255) NOT NULL,
      code VARCHAR(6) NOT NULL,
      type VARCHAR(20) NOT NULL,
      expires_at DATETIME NOT NULL,
      used BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 积分记录表
    CREATE TABLE IF NOT EXISTS points_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      points INTEGER NOT NULL,
      reason VARCHAR(255) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- 生图历史表
    CREATE TABLE IF NOT EXISTS generation_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      prompt TEXT,
      tags TEXT,
      status VARCHAR(20) DEFAULT 'success',
      points_consumed INTEGER DEFAULT 0,
      aspect_ratio VARCHAR(20),
      image_size VARCHAR(20),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      deleted_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- 生图文件关联表
    CREATE TABLE IF NOT EXISTS generation_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      generation_id INTEGER NOT NULL,
      original_filename VARCHAR(255) NOT NULL,
      thumb_filename VARCHAR(255),
      file_size INTEGER,
      mime_type VARCHAR(50),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (generation_id) REFERENCES generation_history(id)
    );

    -- 索引优化 (Performance Optimization)
    CREATE INDEX IF NOT EXISTS idx_invite_codes_owner_id ON invite_codes(owner_id);
    CREATE INDEX IF NOT EXISTS idx_invite_codes_created_at ON invite_codes(created_at);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  `);

  // ==============================================================================================
  // 自动迁移逻辑 (Auto Migration)
  // 处理旧数据库结构不兼容的问题
  // ==============================================================================================
  try {
    // 1. 检查 users.invited_by
    try {
      db.prepare('SELECT invited_by FROM users LIMIT 1').get();
    } catch (error) {
      console.log('🔄 执行数据库迁移: 为 users 表添加 invited_by 字段...');
      db.run('ALTER TABLE users ADD COLUMN invited_by INTEGER REFERENCES users(id)');
      console.log('✅ users 表迁移完成');
    }

    // 2. 检查 verification_codes.type
    try {
      db.prepare('SELECT type FROM verification_codes LIMIT 1').get();
    } catch (error) {
      console.log('🔄 执行数据库迁移: 为 verification_codes 表添加 type 字段...');
      // SQLite 添加 NOT NULL 列必须指定默认值
      db.run("ALTER TABLE verification_codes ADD COLUMN type VARCHAR(20) NOT NULL DEFAULT 'register'");
      console.log('✅ verification_codes 表迁移完成');
    }

    // 3. 检查 users.login_count
    try {
      db.prepare('SELECT login_count FROM users LIMIT 1').get();
    } catch (error) {
      console.log('🔄 执行数据库迁移: 为 users 表添加 login_count 字段...');
      db.run('ALTER TABLE users ADD COLUMN login_count INTEGER DEFAULT 0');
      console.log('✅ users 表迁移完成 (login_count)');
    }
  } catch (error) {
    console.error('❌ 数据库迁移失败:', error);
    // 不抛出错误，尝试继续运行，因为可能只是部分迁移失败
  }

  saveDatabase();
  console.log('✅ 数据库初始化完成');
  return db;
}

// 保存数据库到文件
function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

// 事务状态标志
let inTransaction = false;

// 包装 prepare 方法以兼容 better-sqlite3 的 API
const dbWrapper = {
  prepare: (sql) => ({
    run: (...params) => {
      db.run(sql, params);
      if (!inTransaction) saveDatabase();
      // 获取 last_insert_rowid - 使用 exec 并正确解析
      const result = db.exec('SELECT last_insert_rowid() as id');
      const lastId = result.length > 0 && result[0].values.length > 0 ? result[0].values[0][0] : 0;
      return { lastInsertRowid: lastId, changes: db.getRowsModified() };
    },
    get: (...params) => {
      const result = db.exec(sql, params);
      if (result.length === 0 || result[0].values.length === 0) return undefined;
      const columns = result[0].columns;
      const values = result[0].values[0];
      const row = {};
      columns.forEach((col, i) => row[col] = values[i]);
      return row;
    },
    all: (...params) => {
      const result = db.exec(sql, params);
      if (result.length === 0) return [];
      const columns = result[0].columns;
      return result[0].values.map(values => {
        const row = {};
        columns.forEach((col, i) => row[col] = values[i]);
        return row;
      });
    },
  }),
  exec: (sql) => {
    db.run(sql);
    if (!inTransaction) saveDatabase();
  },
  // 事务支持
  beginTransaction: () => {
    db.run('BEGIN TRANSACTION');
    inTransaction = true;
  },
  commit: () => {
    db.run('COMMIT');
    inTransaction = false;
    saveDatabase();
  },
  rollback: () => {
    db.run('ROLLBACK');
    inTransaction = false;
    // 回滚后内存状态已恢复，不需要保存，或者保存以确保磁盘同步（如果是之前脏写了）
    // 由于我们现在的机制是事务中不保存，所以磁盘应该是干净的，不需要保存。
    // 为了保险起见（比如之前有非事务写入并发？Node是单线程，没事），可以不保存。
  },
  // 添加 transaction 方法以兼容 better-sqlite3 API
  transaction: (callback) => {
    return async (...args) => {
      db.run('BEGIN TRANSACTION');
      inTransaction = true;
      try {
        const result = await callback(...args);
        db.run('COMMIT');
        inTransaction = false;
        saveDatabase();
        return result;
      } catch (err) {
        db.run('ROLLBACK');
        inTransaction = false;
        throw err;
      }
    };
  },
};

export { initDatabase, dbWrapper as default };

