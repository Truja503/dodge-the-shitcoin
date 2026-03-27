const { WebSocketServer } = require('ws');

// Map of tournamentKey -> Set of ws clients
const subscribers = new Map();

function setupWebSocket(server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    ws._tournamentKey = null;

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        if (msg.type === 'subscribe' && msg.key) {
          // Unsubscribe from previous
          if (ws._tournamentKey && subscribers.has(ws._tournamentKey)) {
            subscribers.get(ws._tournamentKey).delete(ws);
          }
          ws._tournamentKey = msg.key;
          if (!subscribers.has(msg.key)) {
            subscribers.set(msg.key, new Set());
          }
          subscribers.get(msg.key).add(ws);
        }
      } catch (e) { /* ignore bad messages */ }
    });

    ws.on('close', () => {
      if (ws._tournamentKey && subscribers.has(ws._tournamentKey)) {
        subscribers.get(ws._tournamentKey).delete(ws);
      }
    });
  });

  return wss;
}

function broadcastBracketUpdate(tournamentKey, tournamentData) {
  const clients = subscribers.get(tournamentKey);
  if (!clients) return;
  const payload = JSON.stringify({ type: 'bracket_update', tournament: tournamentData });
  for (const ws of clients) {
    if (ws.readyState === 1) { // OPEN
      ws.send(payload);
    }
  }
}

module.exports = { setupWebSocket, broadcastBracketUpdate };
