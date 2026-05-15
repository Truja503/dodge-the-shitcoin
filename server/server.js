const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const http = require('http');
const path = require('path');
const { getDb, run, get, all, save } = require('./db');
const { setupWebSocket, broadcastBracketUpdate } = require('./ws');
const { setupOnlineWS } = require('./online');
const QRCode = require('qrcode');
const { createInvoice, getInvoiceStatus } = require('./blink');

const app = express();
const server = http.createServer(app);
const isVercel = process.env.VERCEL === '1';

app.use(cors({ origin: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

if (!isVercel) {
  const wss = setupWebSocket(server);
  setupOnlineWS(wss);
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, vercel: isVercel });
});

const dbReady = getDb();
let paymentTablesReady = false;

app.use(async (req, res, next) => {
  try {
    await dbReady;

    if (!paymentTablesReady) {
      ensurePaymentTables();
      paymentTablesReady = true;
    }

    next();
  } catch (err) {
    next(err);
  }
});
function ensurePaymentTables() {
  run(`
    CREATE TABLE IF NOT EXISTS tournament_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_key TEXT NOT NULL,
      player_name TEXT NOT NULL,
      amount_sats INTEGER NOT NULL,
      payment_hash TEXT UNIQUE NOT NULL,
      payment_request TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      external_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      paid_at DATETIME,
      joined_at DATETIME
    )
  `);
}
// ── Helpers ──────────────────────────────────────────────────────
function genKey(len = 6) {
  return crypto.randomBytes(len).toString('hex').toUpperCase().slice(0, len);
}

function getTournamentFull(key) {
  const t = get('SELECT * FROM tournaments WHERE key = ?', [key]);
  if (!t) return null;
  const players = all(`
    SELECT u.id, u.username, tp.seed
    FROM tournament_players tp JOIN users u ON u.id = tp.user_id
    WHERE tp.tournament_id = ? ORDER BY tp.seed
  `, [t.id]);
  const matches = all(`
    SELECT m.*,
      u1.username AS player1_name,
      u2.username AS player2_name,
      w.username AS winner_name
    FROM matches m
    LEFT JOIN users u1 ON u1.id = m.player1_id
    LEFT JOIN users u2 ON u2.id = m.player2_id
    LEFT JOIN users w ON w.id = m.winner_id
    WHERE m.tournament_id = ? ORDER BY m.round, m.match_number
  `, [t.id]);
  return { ...t, players, matches };
}

function advanceWinner(tournamentId, round, matchNumber, winnerId, format) {
  const totalRounds = Math.log2(format);
  if (round >= totalRounds) return;

  const nextRound = round + 1;
  const nextMatchNumber = Math.ceil(matchNumber / 2);
  const isTopSlot = matchNumber % 2 === 1;

  const nextMatch = get('SELECT * FROM matches WHERE tournament_id = ? AND round = ? AND match_number = ?',
    [tournamentId, nextRound, nextMatchNumber]);

  if (nextMatch) {
    if (isTopSlot) {
      run('UPDATE matches SET player1_id = ? WHERE id = ?', [winnerId, nextMatch.id]);
    } else {
      run('UPDATE matches SET player2_id = ? WHERE id = ?', [winnerId, nextMatch.id]);
    }

    const updated = get('SELECT * FROM matches WHERE id = ?', [nextMatch.id]);
    const feederMatch1 = (nextMatchNumber * 2) - 1;
    const feederMatch2 = nextMatchNumber * 2;
    const feeders = all('SELECT * FROM matches WHERE tournament_id = ? AND round = ? AND match_number IN (?, ?)',
      [tournamentId, round, feederMatch1, feederMatch2]);

    if (feeders.every(f => f.status === 'finished')) {
      if (updated.player1_id && !updated.player2_id) {
        run('UPDATE matches SET winner_id = ?, status = ? WHERE id = ?', [updated.player1_id, 'finished', updated.id]);
        advanceWinner(tournamentId, nextRound, nextMatchNumber, updated.player1_id, format);
      } else if (!updated.player1_id && updated.player2_id) {
        run('UPDATE matches SET winner_id = ?, status = ? WHERE id = ?', [updated.player2_id, 'finished', updated.id]);
        advanceWinner(tournamentId, nextRound, nextMatchNumber, updated.player2_id, format);
      }
    }
  }
}

// ── Auth helpers ─────────────────────────────────────────────────
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(password, salt, 64).toString('hex');
  return test === hash;
}

function generateToken(userId, username) {
  const payload = JSON.stringify({ id: userId, username, ts: Date.now() });
  const hmac = crypto.createHmac('sha256', 'dodge-the-shitcoin-secret').update(payload).digest('hex');
  return Buffer.from(payload).toString('base64') + '.' + hmac;
}

function verifyToken(token) {
  if (!token) return null;
  try {
    const [b64, hmac] = token.split('.');
    const payload = Buffer.from(b64, 'base64').toString();
    const expected = crypto.createHmac('sha256', 'dodge-the-shitcoin-secret').update(payload).digest('hex');
    if (hmac !== expected) return null;
    return JSON.parse(payload);
  } catch(e) { return null; }
}

// ── Auth: Register ───────────────────────────────────────────────
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  const name = username.trim().slice(0, 20);
  if (name.length < 2) return res.status(400).json({ error: 'Username must be at least 2 characters' });
  if (password.length < 3) return res.status(400).json({ error: 'Password must be at least 3 characters' });

  const existing = get('SELECT id FROM users WHERE username = ?', [name]);
  if (existing) return res.status(409).json({ error: 'Username taken' });

  const passHash = hashPassword(password);
  const r = run('INSERT INTO users (username, password_hash) VALUES (?, ?)', [name, passHash]);
  const userId = r.lastInsertRowid;
  run('INSERT OR IGNORE INTO user_stats (user_id) VALUES (?)', [userId]);

  const token = generateToken(userId, name);
  res.json({ id: userId, username: name, token });
});

// ── Auth: Login ──────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  const user = get('SELECT * FROM users WHERE username = ?', [username.trim()]);
  if (!user || !user.password_hash) return res.status(401).json({ error: 'Invalid credentials' });

  if (!verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  run('INSERT OR IGNORE INTO user_stats (user_id) VALUES (?)', [user.id]);
  const token = generateToken(user.id, user.username);
  res.json({ id: user.id, username: user.username, token });
});

// ── Auth: Verify (check if logged in) ───────────────────────────
app.get('/api/me', (req, res) => {
  const auth = req.headers.authorization;
  const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Not authenticated' });

  const user = get('SELECT id, username, created_at FROM users WHERE id = ?', [payload.id]);
  if (!user) return res.status(401).json({ error: 'User not found' });

  const stats = get('SELECT * FROM user_stats WHERE user_id = ?', [user.id]);
  res.json({ ...user, stats: stats || {} });
});

// ── Users (legacy, still works for tournaments) ──────────────────
app.post('/api/users', (req, res) => {
  const { username } = req.body;
  if (!username || username.trim().length < 1) return res.status(400).json({ error: 'Username required' });
  const name = username.trim().slice(0, 20);
  let user = get('SELECT id, username FROM users WHERE username = ?', [name]);
  if (!user) {
    const r = run('INSERT INTO users (username) VALUES (?)', [name]);
    user = { id: r.lastInsertRowid, username: name };
  }
  run('INSERT OR IGNORE INTO user_stats (user_id) VALUES (?)', [user.id]);
  res.json(user);
});

app.get('/api/users/:username/stats', (req, res) => {
  const user = get('SELECT * FROM users WHERE username = ?', [req.params.username]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const stats = get('SELECT * FROM user_stats WHERE user_id = ?', [user.id]);
  res.json({ ...user, stats: stats || { games_played: 0, games_won: 0, total_bitcoins: 0, tournaments_won: 0 } });
});

// ── Tournaments ──────────────────────────────────────────────────
app.post('/api/tournaments', (req, res) => {
  const { name, username, format } = req.body;
  if (!name || !username) return res.status(400).json({ error: 'Name and username required' });

  // Validate format: must be 2, 4, 8, or 16
  const validFormats = [2, 4, 8, 16];
  const bracketFormat = validFormats.includes(parseInt(format)) ? parseInt(format) : 16;

  let user = get('SELECT * FROM users WHERE username = ?', [username.trim()]);
  if (!user) {
    const r = run('INSERT INTO users (username) VALUES (?)', [username.trim().slice(0, 20)]);
    user = { id: r.lastInsertRowid, username: username.trim() };
    run('INSERT OR IGNORE INTO user_stats (user_id) VALUES (?)', [user.id]);
  }

  const key = genKey(6);
  const adminKey = genKey(10);
  const r = run('INSERT INTO tournaments (name, key, admin_key, format, created_by) VALUES (?, ?, ?, ?, ?)',
    [name.trim(), key, adminKey, String(bracketFormat), user.id]);

  run('INSERT INTO tournament_players (tournament_id, user_id, seed) VALUES (?, ?, 0)',
    [r.lastInsertRowid, user.id]);

  res.json({ id: r.lastInsertRowid, key, adminKey });
});

app.get('/api/tournaments/:key', (req, res) => {
  const t = getTournamentFull(req.params.key);
  if (!t) return res.status(404).json({ error: 'Tournament not found' });
  const { admin_key, ...safe } = t;
  res.json(safe);
});

app.post('/api/tournaments/:key/join', (req, res) => {
  const { username, paymentHash } = req.body;
  if (!username) return res.status(400).json({ error: 'Username required' });

  if (!paymentHash) {
    return res.status(400).json({ error: 'Payment required' });
  }

  const t = get('SELECT * FROM tournaments WHERE key = ?', [req.params.key]);
  if (!t) return res.status(404).json({ error: 'Tournament not found' });
  if (t.status !== 'pending') return res.status(400).json({ error: 'Tournament already started' });

  const countRow = get('SELECT COUNT(*) as c FROM tournament_players WHERE tournament_id = ?', [t.id]);
  const count = countRow ? countRow.c : 0;
  const maxPlayers = parseInt(t.format) || 16;
  if (count >= maxPlayers) return res.status(400).json({ error: 'Tournament is full' });

  let user = get('SELECT * FROM users WHERE username = ?', [username.trim()]);
  if (!user) {
    const r = run('INSERT INTO users (username) VALUES (?)', [username.trim().slice(0, 20)]);
    user = { id: r.lastInsertRowid, username: username.trim() };
    run('INSERT OR IGNORE INTO user_stats (user_id) VALUES (?)', [user.id]);
  }

  const exists = get('SELECT 1 as x FROM tournament_players WHERE tournament_id = ? AND user_id = ?', [t.id, user.id]);
  if (exists) return res.status(400).json({ error: 'Already joined' });

  const paidEntry = get(`
    SELECT *
    FROM tournament_payments
    WHERE tournament_key = ?
      AND player_name = ?
      AND payment_hash = ?
      AND status = 'PAID'
      AND joined_at IS NULL
  `, [req.params.key, username.trim(), paymentHash]);

  if (!paidEntry) {
    return res.status(402).json({ error: 'Entry payment not confirmed' });
  }
  
  run('INSERT INTO tournament_players (tournament_id, user_id, seed) VALUES (?, ?, ?)', [t.id, user.id, count]);

    run(`
    UPDATE tournament_payments
    SET joined_at = CURRENT_TIMESTAMP
    WHERE payment_hash = ?
  `, [paymentHash]);
  
  broadcastBracketUpdate(req.params.key, getTournamentFull(req.params.key));
  res.json({ success: true, username: user.username });
});

app.post('/api/tournaments/:key/start', (req, res) => {
  const { adminKey } = req.body;
  const t = get('SELECT * FROM tournaments WHERE key = ?', [req.params.key]);
  if (!t) return res.status(404).json({ error: 'Tournament not found' });
  if (t.admin_key !== adminKey) return res.status(403).json({ error: 'Invalid admin key' });
  if (t.status !== 'pending') return res.status(400).json({ error: 'Already started' });

  const players = all('SELECT user_id FROM tournament_players WHERE tournament_id = ?', [t.id]);
  const count = players.length;
  if (count < 2) return res.status(400).json({ error: 'Need at least 2 players' });

  let format;
  if (count <= 2) format = 2;
  else if (count <= 4) format = 4;
  else if (count <= 8) format = 8;
  else format = 16;

  // Shuffle
  const shuffled = players.sort(() => Math.random() - 0.5);
  shuffled.forEach((p, i) => {
    run('UPDATE tournament_players SET seed = ? WHERE tournament_id = ? AND user_id = ?', [i, t.id, p.user_id]);
  });

  const totalRounds = Math.log2(format);

  // Create first round matches
  const firstRoundMatches = format / 2;
  for (let i = 0; i < firstRoundMatches; i++) {
    const p1 = shuffled[i * 2] ? shuffled[i * 2].user_id : null;
    const p2 = shuffled[i * 2 + 1] ? shuffled[i * 2 + 1].user_id : null;
    run('INSERT INTO matches (tournament_id, round, match_number, player1_id, player2_id, status) VALUES (?, 1, ?, ?, ?, ?)',
      [t.id, i + 1, p1, p2, 'pending']);
  }

  // Create placeholder matches for subsequent rounds
  for (let round = 2; round <= totalRounds; round++) {
    const matchesInRound = format / Math.pow(2, round);
    for (let i = 0; i < matchesInRound; i++) {
      run('INSERT INTO matches (tournament_id, round, match_number, status) VALUES (?, ?, ?, ?)',
        [t.id, round, i + 1, 'pending']);
    }
  }

  // Auto-advance byes
  const firstMatches = all('SELECT * FROM matches WHERE tournament_id = ? AND round = 1', [t.id]);
  for (const m of firstMatches) {
    if (m.player1_id && !m.player2_id) {
      run('UPDATE matches SET winner_id = ?, status = ? WHERE id = ?', [m.player1_id, 'finished', m.id]);
      advanceWinner(t.id, 1, m.match_number, m.player1_id, format);
    } else if (!m.player1_id && m.player2_id) {
      run('UPDATE matches SET winner_id = ?, status = ? WHERE id = ?', [m.player2_id, 'finished', m.id]);
      advanceWinner(t.id, 1, m.match_number, m.player2_id, format);
    }
  }

  run('UPDATE tournaments SET status = ?, format = ? WHERE id = ?', ['active', String(format), t.id]);

  broadcastBracketUpdate(req.params.key, getTournamentFull(req.params.key));
  res.json({ success: true, format });
});

app.post('/api/tournaments/:key/match/:matchId', (req, res) => {
  const { adminKey, player1Score, player2Score } = req.body;
  const t = get('SELECT * FROM tournaments WHERE key = ?', [req.params.key]);
  if (!t) return res.status(404).json({ error: 'Tournament not found' });
  if (t.admin_key !== adminKey) return res.status(403).json({ error: 'Invalid admin key' });

  const match = get('SELECT * FROM matches WHERE id = ? AND tournament_id = ?', [parseInt(req.params.matchId), t.id]);
  if (!match) return res.status(404).json({ error: 'Match not found' });
  if (match.status === 'finished') return res.status(400).json({ error: 'Match already finished' });
  if (!match.player1_id || !match.player2_id) return res.status(400).json({ error: 'Match not ready' });

  const s1 = parseInt(player1Score) || 0;
  const s2 = parseInt(player2Score) || 0;
  const winnerId = s1 >= s2 ? match.player1_id : match.player2_id;
  const loserId = winnerId === match.player1_id ? match.player2_id : match.player1_id;

  run('UPDATE matches SET player1_score = ?, player2_score = ?, winner_id = ?, status = ? WHERE id = ?',
    [s1, s2, winnerId, 'finished', match.id]);

  // Update stats
  const winnerBtc = s1 >= s2 ? s1 : s2;
  const loserBtc = s1 >= s2 ? s2 : s1;
  run('UPDATE user_stats SET games_played = games_played + 1, games_won = games_won + 1, total_bitcoins = total_bitcoins + ? WHERE user_id = ?',
    [winnerBtc, winnerId]);
  run('UPDATE user_stats SET games_played = games_played + 1, total_bitcoins = total_bitcoins + ? WHERE user_id = ?',
    [loserBtc, loserId]);

  // Advance winner
  const format = parseInt(t.format) || 16;
  advanceWinner(t.id, match.round, match.match_number, winnerId, format);

  // Check if tournament finished
  const totalRounds = Math.log2(format);
  const finalMatch = get('SELECT * FROM matches WHERE tournament_id = ? AND round = ?', [t.id, totalRounds]);
  if (finalMatch && finalMatch.status === 'finished') {
    run('UPDATE tournaments SET status = ? WHERE id = ?', ['finished', t.id]);
    if (finalMatch.winner_id) {
      run('UPDATE user_stats SET tournaments_won = tournaments_won + 1 WHERE user_id = ?', [finalMatch.winner_id]);
    }
  }

  broadcastBracketUpdate(req.params.key, getTournamentFull(req.params.key));
  res.json({ success: true, winnerId });
});

app.get('/api/tournaments/:key/stats', (req, res) => {
  const t = get('SELECT * FROM tournaments WHERE key = ?', [req.params.key]);
  if (!t) return res.status(404).json({ error: 'Tournament not found' });
  const stats = all(`
    SELECT u.username, us.*
    FROM tournament_players tp
    JOIN users u ON u.id = tp.user_id
    JOIN user_stats us ON us.user_id = tp.user_id
    WHERE tp.tournament_id = ?
  `, [t.id]);
  res.json(stats);
});
app.post('/api/payments/tournament-entry', async (req, res) => {
  try {
    const { tournamentKey, playerName, amountSats } = req.body;

    if (!tournamentKey || !playerName) {
      return res.status(400).json({ error: 'tournamentKey and playerName required' });
    }

    const t = get('SELECT * FROM tournaments WHERE key = ?', [tournamentKey]);
    if (!t) return res.status(404).json({ error: 'Tournament not found' });
    if (t.status !== 'pending') return res.status(400).json({ error: 'Tournament already started' });

    const exists = get(`
      SELECT 1 as x
      FROM tournament_payments
      WHERE tournament_key = ? AND player_name = ? AND status = 'PAID'
    `, [tournamentKey, playerName.trim()]);

    if (exists) {
      return res.status(409).json({ error: 'This player already has a paid entry' });
    }

    const sats = parseInt(amountSats || process.env.TOURNAMENT_ENTRY_SATS || '100');

    if (!Number.isInteger(sats) || sats < 1 || sats > 100000) {
      return res.status(400).json({ error: 'Invalid amountSats' });
    }

    const externalId = `dts-entry:${tournamentKey}:${playerName}:${crypto.randomUUID()}`;

    const invoice = await createInvoice({
      walletId: process.env.BLINK_WALLET_ID,
      amountSats: sats,
      memo: `Dodge the Shitcoin tournament entry - ${playerName}`,
      externalId,
    });

    run(`
      INSERT INTO tournament_payments
      (tournament_key, player_name, amount_sats, payment_hash, payment_request, status, external_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      tournamentKey,
      playerName.trim(),
      sats,
      invoice.paymentHash,
      invoice.paymentRequest,
      invoice.paymentStatus || 'PENDING',
      externalId,
    ]);

    const qrDataUrl = await QRCode.toDataURL(`lightning:${invoice.paymentRequest}`);

    res.json({
      ok: true,
      amountSats: sats,
      paymentHash: invoice.paymentHash,
      paymentRequest: invoice.paymentRequest,
      qrDataUrl,
      status: invoice.paymentStatus || 'PENDING',
    });
  } catch (err) {
    console.error('Create tournament entry invoice error:', err);
    res.status(500).json({ error: 'Could not create payment invoice' });
  }
});

app.get('/api/payments/status/:paymentHash', async (req, res) => {
  try {
    const { paymentHash } = req.params;

    const local = get('SELECT * FROM tournament_payments WHERE payment_hash = ?', [paymentHash]);
    if (!local) return res.status(404).json({ error: 'Payment not found' });

    const remote = await getInvoiceStatus(paymentHash);

    if (remote.status === 'PAID' && local.status !== 'PAID') {
      run(`
        UPDATE tournament_payments
        SET status = 'PAID', paid_at = CURRENT_TIMESTAMP
        WHERE payment_hash = ?
      `, [paymentHash]);
    }

    if (remote.status === 'EXPIRED' && local.status !== 'PAID') {
      run(`
        UPDATE tournament_payments
        SET status = 'EXPIRED'
        WHERE payment_hash = ?
      `, [paymentHash]);
    }

    res.json({
      ok: true,
      paymentHash,
      status: remote.status,
      paid: remote.status === 'PAID',
    });
  } catch (err) {
    console.error('Check payment status error:', err);
    res.status(500).json({ error: 'Could not check payment status' });
  }
});
// ── Online Match Result ──────────────────────────────────────────
app.post('/api/online-match', (req, res) => {
  const { player1, player2, player1Score, player2Score } = req.body;
  if (!player1 || !player2) return res.status(400).json({ error: 'Both players required' });

  const s1 = parseInt(player1Score) || 0;
  const s2 = parseInt(player2Score) || 0;

  const u1 = get('SELECT id FROM users WHERE username = ?', [player1]);
  const u2 = get('SELECT id FROM users WHERE username = ?', [player2]);
  if (!u1 || !u2) return res.status(404).json({ error: 'User not found' });

  const winnerId = s1 > s2 ? u1.id : s2 > s1 ? u2.id : null;
  const loserId = winnerId === u1.id ? u2.id : winnerId === u2.id ? u1.id : null;

  // Update stats for both
  run('INSERT OR IGNORE INTO user_stats (user_id) VALUES (?)', [u1.id]);
  run('INSERT OR IGNORE INTO user_stats (user_id) VALUES (?)', [u2.id]);
  run('UPDATE user_stats SET games_played = games_played + 1 WHERE user_id = ?', [u1.id]);
  run('UPDATE user_stats SET games_played = games_played + 1 WHERE user_id = ?', [u2.id]);

  if (winnerId) {
    run('UPDATE user_stats SET games_won = games_won + 1 WHERE user_id = ?', [winnerId]);
  }

  res.json({ success: true, winner: winnerId === u1.id ? player1 : winnerId === u2.id ? player2 : 'draw' });
});



// ── Start ────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

if (!isVercel) {
  dbReady.then(() => {
    server.listen(PORT, () => {
      console.log(`Tournament server running on port ${PORT}`);
    });
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} already in use. Kill the other process or use PORT=XXXX node server.js`);
      } else {
        console.error('Server error:', err);
      }
      process.exit(1);
    });
  }).catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
}

module.exports = app;
