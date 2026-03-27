const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const http = require('http');
const { getDb, run, get, all, save } = require('./db');
const { setupWebSocket, broadcastBracketUpdate } = require('./ws');

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: true }));
app.use(express.json());

setupWebSocket(server);

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

// ── Users ────────────────────────────────────────────────────────
app.post('/api/users', (req, res) => {
  const { username } = req.body;
  if (!username || username.trim().length < 1) return res.status(400).json({ error: 'Username required' });
  const name = username.trim().slice(0, 20);
  let user = get('SELECT * FROM users WHERE username = ?', [name]);
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
  const { name, username } = req.body;
  if (!name || !username) return res.status(400).json({ error: 'Name and username required' });

  let user = get('SELECT * FROM users WHERE username = ?', [username.trim()]);
  if (!user) {
    const r = run('INSERT INTO users (username) VALUES (?)', [username.trim().slice(0, 20)]);
    user = { id: r.lastInsertRowid, username: username.trim() };
    run('INSERT OR IGNORE INTO user_stats (user_id) VALUES (?)', [user.id]);
  }

  const key = genKey(6);
  const adminKey = genKey(10);
  const r = run('INSERT INTO tournaments (name, key, admin_key, created_by) VALUES (?, ?, ?, ?)',
    [name.trim(), key, adminKey, user.id]);

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
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username required' });

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

  run('INSERT INTO tournament_players (tournament_id, user_id, seed) VALUES (?, ?, ?)', [t.id, user.id, count]);

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

// ── Start ────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

getDb().then(() => {
  server.listen(PORT, () => {
    console.log(`Tournament server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
