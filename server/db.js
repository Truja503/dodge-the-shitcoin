const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || (
  process.env.VERCEL === '1' ? '/tmp/tournament.db' : path.join(__dirname, 'tournament.db')
);

let db = null;

async function getDb() {
  if (db) return db;
  const SQL = await initSqlJs({
    locateFile: file => path.join(path.dirname(require.resolve('sql.js')), file)
  });

  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS tournaments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      key TEXT UNIQUE NOT NULL,
      admin_key TEXT UNIQUE NOT NULL,
      format TEXT DEFAULT '16',
      status TEXT DEFAULT 'pending',
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS tournament_players (
      tournament_id INTEGER REFERENCES tournaments(id),
      user_id INTEGER REFERENCES users(id),
      seed INTEGER,
      PRIMARY KEY (tournament_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER REFERENCES tournaments(id),
      round INTEGER NOT NULL,
      match_number INTEGER NOT NULL,
      player1_id INTEGER REFERENCES users(id),
      player2_id INTEGER REFERENCES users(id),
      player1_score INTEGER DEFAULT 0,
      player2_score INTEGER DEFAULT 0,
      winner_id INTEGER REFERENCES users(id),
      status TEXT DEFAULT 'pending'
    );
    CREATE TABLE IF NOT EXISTS user_stats (
      user_id INTEGER PRIMARY KEY REFERENCES users(id),
      games_played INTEGER DEFAULT 0,
      games_won INTEGER DEFAULT 0,
      total_bitcoins INTEGER DEFAULT 0,
      tournaments_won INTEGER DEFAULT 0
    );
  `);

  // Migration: add password_hash if missing
  try { db.run('ALTER TABLE users ADD COLUMN password_hash TEXT'); } catch(e) {}

  save();
  return db;
}

function save() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// Helper wrappers that mimic better-sqlite3 API
function run(sql, params = []) {
  db.run(sql, params);
  // Get lastInsertRowid BEFORE save (save exports and can reset state)
  const r = db.exec('SELECT last_insert_rowid() as id');
  const lastId = r.length ? r[0].values[0][0] : 0;
  save();
  return { lastInsertRowid: lastId };
}

function get(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

module.exports = { getDb, run, get, all, save };
