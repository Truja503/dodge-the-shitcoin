// Online 1v1 Multiplayer — Room-based WebSocket relay
// The server only relays messages; all game logic runs on the HOST client.

const crypto = require('crypto');

// Room structure:
// { id, hostWs, clientWs, hostUser, clientUser, state: 'waiting'|'playing'|'finished' }
const rooms = new Map();

// Map ws → roomId for cleanup
const wsRoomMap = new Map();

function genRoomId() {
  return crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 chars
}

function getRoomList() {
  const list = [];
  for (const [id, room] of rooms) {
    if (room.state === 'waiting') {
      list.push({ id, host: room.hostUser, state: room.state });
    }
  }
  return list;
}

function cleanupRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;

  // Notify remaining player
  const notify = { type: 'opponent_disconnected' };
  const payload = JSON.stringify(notify);

  if (room.hostWs && room.hostWs.readyState === 1) {
    try { room.hostWs.send(payload); } catch (e) {}
  }
  if (room.clientWs && room.clientWs.readyState === 1) {
    try { room.clientWs.send(payload); } catch (e) {}
  }

  // Remove ws→room mappings
  if (room.hostWs) wsRoomMap.delete(room.hostWs);
  if (room.clientWs) wsRoomMap.delete(room.clientWs);

  rooms.delete(roomId);
}

function setupOnlineWS(wss) {
  wss.on('connection', (ws) => {
    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch (e) {
        return; // ignore non-JSON
      }

      // Only handle online-specific message types
      switch (msg.type) {

        case 'create_room': {
          const roomId = genRoomId();
          const room = {
            id: roomId,
            hostWs: ws,
            clientWs: null,
            hostUser: msg.username || 'Host',
            clientUser: null,
            state: 'waiting'
          };
          rooms.set(roomId, room);
          wsRoomMap.set(ws, roomId);
          ws.send(JSON.stringify({ type: 'room_created', roomId }));
          break;
        }

        case 'join_room': {
          const room = rooms.get(msg.roomId);
          if (!room) {
            ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
            return;
          }
          if (room.state !== 'waiting') {
            ws.send(JSON.stringify({ type: 'error', message: 'Room is not available' }));
            return;
          }
          if (room.clientWs) {
            ws.send(JSON.stringify({ type: 'error', message: 'Room is full' }));
            return;
          }

          room.clientWs = ws;
          room.clientUser = msg.username || 'Client';
          room.state = 'playing';
          wsRoomMap.set(ws, msg.roomId);

          // Notify host
          if (room.hostWs && room.hostWs.readyState === 1) {
            room.hostWs.send(JSON.stringify({
              type: 'opponent_joined',
              username: room.clientUser
            }));
          }

          // Send match_start to both
          const matchMsg = JSON.stringify({
            type: 'match_start',
            roomId: msg.roomId,
            hostUser: room.hostUser,
            clientUser: room.clientUser
          });
          if (room.hostWs && room.hostWs.readyState === 1) {
            room.hostWs.send(matchMsg);
          }
          ws.send(matchMsg);
          break;
        }

        case 'game_state': {
          // Host → relay to client
          const room = rooms.get(msg.roomId);
          if (!room || !room.clientWs || room.clientWs.readyState !== 1) return;
          room.clientWs.send(raw.toString());
          break;
        }

        case 'player_input': {
          // Client → relay to host
          const room = rooms.get(msg.roomId);
          if (!room || !room.hostWs || room.hostWs.readyState !== 1) return;
          room.hostWs.send(raw.toString());
          break;
        }

        case 'game_event': {
          // Relay to the other player in the room
          const room = rooms.get(msg.roomId);
          if (!room) return;
          const other = (ws === room.hostWs) ? room.clientWs : room.hostWs;
          if (other && other.readyState === 1) {
            other.send(raw.toString());
          }
          break;
        }

        case 'game_over': {
          const room = rooms.get(msg.roomId);
          if (!room) return;
          room.state = 'finished';
          // Relay to both
          const payload = raw.toString();
          if (room.hostWs && room.hostWs.readyState === 1) {
            room.hostWs.send(payload);
          }
          if (room.clientWs && room.clientWs.readyState === 1) {
            room.clientWs.send(payload);
          }
          // Clean up after a delay
          setTimeout(() => cleanupRoom(msg.roomId), 5000);
          break;
        }

        case 'list_rooms': {
          ws.send(JSON.stringify({ type: 'room_list', rooms: getRoomList() }));
          break;
        }

        case 'rejoin_host': {
          const room = rooms.get(msg.roomId);
          if (!room) {
            ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
            return;
          }
          room.hostWs = ws;
          wsRoomMap.set(ws, msg.roomId);
          ws.send(JSON.stringify({ type: 'rejoin_ok', role: 'host', roomId: msg.roomId }));
          break;
        }

        case 'rejoin_client': {
          const room = rooms.get(msg.roomId);
          if (!room) {
            ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
            return;
          }
          room.clientWs = ws;
          wsRoomMap.set(ws, msg.roomId);
          ws.send(JSON.stringify({ type: 'rejoin_ok', role: 'client', roomId: msg.roomId }));
          break;
        }

        case 'leave_room': {
          const rid = wsRoomMap.get(ws);
          if (rid) cleanupRoom(rid);
          break;
        }

        // Ignore other message types (tournament subscribe, etc.)
        default:
          break;
      }
    });

    ws.on('close', () => {
      const rid = wsRoomMap.get(ws);
      if (!rid) return;
      wsRoomMap.delete(ws);

      const room = rooms.get(rid);
      if (!room) return;

      // If playing, give 5s grace period for rejoin (page navigation)
      if (room.state === 'playing') {
        // Mark which side disconnected
        if (ws === room.hostWs) room.hostWs = null;
        if (ws === room.clientWs) room.clientWs = null;

        setTimeout(() => {
          const r = rooms.get(rid);
          if (!r) return;
          // If still missing after grace period, clean up
          if (!r.hostWs || !r.clientWs) {
            // Only notify if one side is still connected
            if (r.hostWs && r.hostWs.readyState === 1) {
              r.hostWs.send(JSON.stringify({ type: 'opponent_disconnected' }));
            }
            if (r.clientWs && r.clientWs.readyState === 1) {
              r.clientWs.send(JSON.stringify({ type: 'opponent_disconnected' }));
            }
            rooms.delete(rid);
          }
        }, 5000);
      } else {
        cleanupRoom(rid);
      }
    });
  });
}

module.exports = { setupOnlineWS };
