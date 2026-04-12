/* ═══════════════════════════════════════════════════════════════════════
   ChatSphere Server v2
   Features: DMs, Group Rooms, Rate Limiting, Health Check, Reactions,
             Message Deletion, Read Receipts, .env config, Graceful Shutdown
   ═══════════════════════════════════════════════════════════════════════ */

'use strict';

const express = require('express');
const http    = require('http');
const WebSocket = require('ws');
const path    = require('path');
const { v4: uuidv4 } = require('uuid');

// Optional .env support
try { require('dotenv').config(); } catch (_) {}

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// In-memory store
const users       = new Map(); // userId -> user object
const usersByName = new Map(); // username.lower -> userId
const dmHistory   = new Map(); // dmKey -> [messages]
const rooms       = new Map(); // roomId -> room object
const rateLimits  = new Map(); // userId -> { count, resetAt }

// Config
const RATE_LIMIT  = parseInt(process.env.RATE_LIMIT  || '30');
const RATE_WINDOW = parseInt(process.env.RATE_WINDOW || '10000');
const MAX_MSG_LEN = parseInt(process.env.MAX_MSG_LEN || '4000');
const MAX_HISTORY = parseInt(process.env.MAX_HISTORY || '200');
const MAX_ROOMS   = parseInt(process.env.MAX_ROOMS   || '20');
const LOBBY_ID    = 'lobby';

// Default lobby room
rooms.set(LOBBY_ID, { id: LOBBY_ID, name: '# general', createdBy: 'system', members: new Set(), history: [] });

function checkRateLimit(userId) {
  const now  = Date.now();
  const info = rateLimits.get(userId) || { count: 0, resetAt: now + RATE_WINDOW };
  if (now > info.resetAt) { info.count = 0; info.resetAt = now + RATE_WINDOW; }
  info.count++;
  rateLimits.set(userId, info);
  return info.count <= RATE_LIMIT;
}

function dmKey(id1, id2) { return [id1, id2].sort().join('::'); }
function send(ws, data) { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data)); }
function broadcast(data, excludeId = null) {
  users.forEach((u) => { if (u.id !== excludeId && u.ws?.readyState === WebSocket.OPEN) u.ws.send(JSON.stringify(data)); });
}
function broadcastToRoom(roomId, data, excludeId = null) {
  const room = rooms.get(roomId); if (!room) return;
  room.members.forEach((uid) => {
    if (uid === excludeId) return;
    const u = users.get(uid);
    if (u?.ws?.readyState === WebSocket.OPEN) u.ws.send(JSON.stringify(data));
  });
}
function publicUser(u) { return { id: u.id, username: u.username, avatar: u.avatar, color: u.color, status: u.status, lastSeen: u.lastSeen }; }
function getUserList() { return [...users.values()].map(publicUser); }
function getRoomList() { return [...rooms.values()].map(r => ({ id: r.id, name: r.name, createdBy: r.createdBy, memberCount: r.members.size })); }
function pushHistory(arr, item) { arr.push(item); if (arr.length > MAX_HISTORY) arr.splice(0, arr.length - MAX_HISTORY); }

wss.on('connection', (ws) => {
  let currentUserId = null;

  ws.on('message', (raw) => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'register') {
      const username = (msg.username || '').trim();
      if (username.length < 2 || username.length > 30) { send(ws, { type: 'error', message: 'Username must be 2-30 chars.' }); return; }
      const nameLower = username.toLowerCase();
      if (usersByName.has(nameLower)) {
        const uid = usersByName.get(nameLower);
        const existing = users.get(uid);
        existing.ws = ws; existing.status = 'online'; existing.lastSeen = Date.now();
        currentUserId = uid;
        const myRooms = [...rooms.values()].filter(r => r.members.has(uid)).map(r => ({ id: r.id, name: r.name, createdBy: r.createdBy, memberCount: r.members.size }));
        send(ws, { type: 'registered', user: publicUser(existing), users: getUserList(), rooms: getRoomList(), myRooms });
        broadcast({ type: 'user_status', userId: uid, status: 'online' }, uid);
        return;
      }
      const id = uuidv4(); currentUserId = id;
      const user = { id, username, avatar: msg.avatar || '😀', color: msg.color || '#6C63FF', ws, status: 'online', lastSeen: Date.now() };
      users.set(id, user); usersByName.set(nameLower, id);
      rooms.get(LOBBY_ID).members.add(id);
      send(ws, { type: 'registered', user: publicUser(user), users: getUserList(), rooms: getRoomList(), myRooms: [{ id: LOBBY_ID, name: '# general', createdBy: 'system', memberCount: rooms.get(LOBBY_ID).members.size }] });
      broadcast({ type: 'user_joined', user: publicUser(user) }, id);
      return;
    }

    const me = users.get(currentUserId);
    if (!me) { send(ws, { type: 'error', message: 'Not registered.' }); return; }

    switch (msg.type) {
      case 'message': {
        if (!checkRateLimit(currentUserId)) { send(ws, { type: 'error', message: 'Rate limit hit. Slow down.' }); return; }
        const recipient = users.get(msg.to); if (!recipient) return;
        const content = (msg.content || '').slice(0, MAX_MSG_LEN);
        const message = { id: uuidv4(), kind: 'dm', from: currentUserId, to: msg.to, content, contentType: msg.contentType || 'text', timestamp: Date.now(), senderName: me.username, senderAvatar: me.avatar, senderColor: me.color, readBy: [currentUserId], deleted: false };
        const key = dmKey(currentUserId, msg.to);
        if (!dmHistory.has(key)) dmHistory.set(key, []);
        pushHistory(dmHistory.get(key), message);
        send(ws, { type: 'message', message });
        if (recipient.ws?.readyState === WebSocket.OPEN) send(recipient.ws, { type: 'message', message });
        break;
      }
      case 'room_message': {
        if (!checkRateLimit(currentUserId)) { send(ws, { type: 'error', message: 'Rate limit hit. Slow down.' }); return; }
        const room = rooms.get(msg.roomId);
        if (!room || !room.members.has(currentUserId)) { send(ws, { type: 'error', message: 'Not a member.' }); return; }
        const content = (msg.content || '').slice(0, MAX_MSG_LEN);
        const message = { id: uuidv4(), kind: 'room', roomId: room.id, from: currentUserId, content, contentType: msg.contentType || 'text', timestamp: Date.now(), senderName: me.username, senderAvatar: me.avatar, senderColor: me.color, deleted: false };
        pushHistory(room.history, message);
        broadcastToRoom(room.id, { type: 'room_message', message });
        break;
      }
      case 'create_room': {
        if (rooms.size >= MAX_ROOMS) { send(ws, { type: 'error', message: 'Max rooms reached.' }); return; }
        const name = (msg.name || '').trim().slice(0, 40);
        if (name.length < 2) { send(ws, { type: 'error', message: 'Room name 2+ chars.' }); return; }
        const rid = uuidv4();
        rooms.set(rid, { id: rid, name: `# ${name}`, createdBy: currentUserId, members: new Set([currentUserId]), history: [] });
        send(ws, { type: 'room_created', room: { id: rid, name: `# ${name}`, createdBy: currentUserId, memberCount: 1 } });
        broadcast({ type: 'rooms_updated', rooms: getRoomList() });
        break;
      }
      case 'join_room': {
        const room = rooms.get(msg.roomId); if (!room) return;
        room.members.add(currentUserId);
        send(ws, { type: 'room_joined', room: { id: room.id, name: room.name, createdBy: room.createdBy, memberCount: room.members.size }, history: room.history });
        broadcastToRoom(room.id, { type: 'room_member_count', roomId: room.id, count: room.members.size });
        broadcast({ type: 'rooms_updated', rooms: getRoomList() });
        break;
      }
      case 'leave_room': {
        const room = rooms.get(msg.roomId); if (!room || room.id === LOBBY_ID) return;
        room.members.delete(currentUserId);
        send(ws, { type: 'room_left', roomId: room.id });
        broadcastToRoom(room.id, { type: 'room_member_count', roomId: room.id, count: room.members.size });
        if (room.members.size === 0) { rooms.delete(room.id); broadcast({ type: 'rooms_updated', rooms: getRoomList() }); }
        break;
      }
      case 'load_history': {
        const key = dmKey(currentUserId, msg.with);
        send(ws, { type: 'history', with: msg.with, messages: dmHistory.get(key) || [] });
        break;
      }
      case 'load_room_history': {
        const room = rooms.get(msg.roomId); if (!room) return;
        send(ws, { type: 'room_history', roomId: msg.roomId, messages: room.history });
        break;
      }
      case 'search': {
        const q = (msg.query || '').trim().toLowerCase();
        send(ws, { type: 'search_results', results: [...users.values()].filter(u => u.id !== currentUserId && u.username.toLowerCase().includes(q)).map(publicUser) });
        break;
      }
      case 'typing': {
        if (msg.roomId) { broadcastToRoom(msg.roomId, { type: 'typing', from: currentUserId, fromName: me.username, isTyping: msg.isTyping, roomId: msg.roomId }, currentUserId); }
        else { const t = users.get(msg.to); if (t?.ws?.readyState === WebSocket.OPEN) send(t.ws, { type: 'typing', from: currentUserId, fromName: me.username, isTyping: msg.isTyping }); }
        break;
      }
      case 'react': {
        const { messageId, emoji, roomId, withUserId } = msg;
        // Find message and update reaction
        let targetMsg = null;
        if (roomId) {
          const room = rooms.get(roomId);
          if (room) targetMsg = room.history.find(h => h.id === messageId);
        } else {
          const key = dmKey(currentUserId, withUserId);
          const hist = dmHistory.get(key) || [];
          targetMsg = hist.find(h => h.id === messageId);
        }
        if (!targetMsg) return;
        if (!targetMsg.reactions) targetMsg.reactions = {};
        if (!targetMsg.reactions[emoji]) targetMsg.reactions[emoji] = [];
        const arr = targetMsg.reactions[emoji];
        const idx = arr.indexOf(currentUserId);
        if (idx > -1) arr.splice(idx, 1); else arr.push(currentUserId);
        if (arr.length === 0) delete targetMsg.reactions[emoji];
        const event = { type: 'reaction_updated', messageId, reactions: targetMsg.reactions };
        if (roomId) broadcastToRoom(roomId, event);
        else {
          send(ws, event);
          const other = users.get(withUserId);
          if (other?.ws?.readyState === WebSocket.OPEN) send(other.ws, event);
        }
        break;
      }
      case 'delete_message': {
        const { messageId, roomId: rid, withUserId } = msg;
        if (rid) {
          const room = rooms.get(rid);
          if (!room) return;
          const m = room.history.find(h => h.id === messageId && h.from === currentUserId);
          if (m) { m.deleted = true; m.content = ''; broadcastToRoom(rid, { type: 'message_deleted', messageId, roomId: rid }); }
        } else {
          const key = dmKey(currentUserId, withUserId);
          const hist = dmHistory.get(key) || [];
          const m = hist.find(h => h.id === messageId && h.from === currentUserId);
          if (m) {
            m.deleted = true; m.content = '';
            send(ws, { type: 'message_deleted', messageId });
            const other = users.get(withUserId);
            if (other?.ws?.readyState === WebSocket.OPEN) send(other.ws, { type: 'message_deleted', messageId });
          }
        }
        break;
      }
      case 'read': {
        const { messageId, fromUserId } = msg;
        const key = dmKey(currentUserId, fromUserId);
        const hist = dmHistory.get(key) || [];
        const m = hist.find(h => h.id === messageId);
        if (m && !m.readBy.includes(currentUserId)) {
          m.readBy.push(currentUserId);
          const sender = users.get(fromUserId);
          if (sender?.ws?.readyState === WebSocket.OPEN) send(sender.ws, { type: 'read_receipt', messageId, by: currentUserId });
        }
        break;
      }
      case 'update_profile': {
        if (msg.avatar) me.avatar = msg.avatar;
        if (msg.color) me.color = msg.color;
        send(ws, { type: 'profile_updated', user: publicUser(me) });
        broadcast({ type: 'user_updated', user: publicUser(me) }, currentUserId);
        break;
      }
      case 'get_users': send(ws, { type: 'user_list', users: getUserList() }); break;
      case 'get_rooms': send(ws, { type: 'room_list', rooms: getRoomList() }); break;
    }
  });

  ws.on('close', () => {
    if (!currentUserId) return;
    const user = users.get(currentUserId);
    if (user) { user.status = 'offline'; user.lastSeen = Date.now(); user.ws = null; broadcast({ type: 'user_status', userId: currentUserId, status: 'offline', lastSeen: user.lastSeen }); }
  });

  ws.on('error', (err) => console.error('WS error:', err.message));
});

app.get('/health', (_, res) => res.json({ status: 'ok', uptime: process.uptime(), users: users.size, rooms: rooms.size, memory: process.memoryUsage().heapUsed, time: new Date().toISOString() }));
app.get('/api/users', (_, res) => res.json(getUserList()));
app.get('/api/rooms', (_, res) => res.json(getRoomList()));

function shutdown(signal) {
  console.log(`\n${signal} — shutting down gracefully…`);
  users.forEach(u => { if (u.ws) send(u.ws, { type: 'server_shutdown', message: 'Server restarting. Please reconnect shortly.' }); });
  wss.close(() => server.close(() => { console.log('Server closed.'); process.exit(0); }));
  setTimeout(() => process.exit(1), 8000);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🚀  ChatSphere v2 → http://localhost:${PORT}`);
  console.log(`   Health check → http://localhost:${PORT}/health\n`);
});
