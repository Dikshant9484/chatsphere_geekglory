'use strict';

const express = require('express');
const http    = require('http');
const WebSocket = require('ws');
const path    = require('path');
const { v4: uuidv4 } = require('uuid');

// 🔐 SECURITY PACKAGES
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const xss = require('xss');

// Optional .env support
try { require('dotenv').config(); } catch (_) {}

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

/* ================= SECURITY MIDDLEWARE ================= */

// Hide express info
app.disable("x-powered-by");

// Helmet protection
app.use(helmet());

// Strict CORS (IMPORTANT: change URL after deploy)
app.use(cors({
  origin: "*", // 🔥 Change to your Render URL later
  methods: ["GET", "POST"],
}));

// Rate limit (HTTP)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200
});
app.use(limiter);

// Body size limit
app.use(express.json({ limit: '10kb' }));

/* ====================================================== */

app.use(express.static(path.join(__dirname, 'public')));

/* ================= IN-MEMORY STORE ================= */

const users       = new Map();
const usersByName = new Map();
const dmHistory   = new Map();
const rooms       = new Map();
const rateLimits  = new Map();

/* ================= CONFIG ================= */

const RATE_LIMIT  = parseInt(process.env.RATE_LIMIT  || '30');
const RATE_WINDOW = parseInt(process.env.RATE_WINDOW || '10000');
const MAX_MSG_LEN = 500; // 🔐 reduced
const MAX_HISTORY = parseInt(process.env.MAX_HISTORY || '200');
const MAX_ROOMS   = parseInt(process.env.MAX_ROOMS   || '20');
const LOBBY_ID    = 'lobby';

rooms.set(LOBBY_ID, { id: LOBBY_ID, name: '# general', createdBy: 'system', members: new Set(), history: [] });

/* ================= HELPERS ================= */

function sanitize(input) {
  return xss(input);
}

function checkRateLimit(userId) {
  const now  = Date.now();
  const info = rateLimits.get(userId) || { count: 0, resetAt: now + RATE_WINDOW };
  if (now > info.resetAt) { info.count = 0; info.resetAt = now + RATE_WINDOW; }
  info.count++;
  rateLimits.set(userId, info);
  return info.count <= RATE_LIMIT;
}

function dmKey(id1, id2) { return [id1, id2].sort().join('::'); }

function send(ws, data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function broadcast(data, excludeId = null) {
  users.forEach((u) => {
    if (u.id !== excludeId && u.ws?.readyState === WebSocket.OPEN) {
      u.ws.send(JSON.stringify(data));
    }
  });
}

function broadcastToRoom(roomId, data, excludeId = null) {
  const room = rooms.get(roomId);
  if (!room) return;
  room.members.forEach((uid) => {
    if (uid === excludeId) return;
    const u = users.get(uid);
    if (u?.ws?.readyState === WebSocket.OPEN) {
      u.ws.send(JSON.stringify(data));
    }
  });
}

function publicUser(u) {
  return {
    id: u.id,
    username: u.username,
    avatar: u.avatar,
    color: u.color,
    status: u.status,
    lastSeen: u.lastSeen
  };
}

function getUserList() { return [...users.values()].map(publicUser); }

function getRoomList() {
  return [...rooms.values()].map(r => ({
    id: r.id,
    name: r.name,
    createdBy: r.createdBy,
    memberCount: r.members.size
  }));
}

function pushHistory(arr, item) {
  arr.push(item);
  if (arr.length > MAX_HISTORY) {
    arr.splice(0, arr.length - MAX_HISTORY);
  }
}

/* ================= WEBSOCKET ================= */

wss.on('connection', (ws) => {
  let currentUserId = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    /* ===== REGISTER ===== */
    if (msg.type === 'register') {
      const username = sanitize((msg.username || '').trim());

      // 🔐 Strong validation
      if (!/^[a-zA-Z0-9_]{2,30}$/.test(username)) {
        send(ws, { type: 'error', message: 'Invalid username' });
        return;
      }

      const nameLower = username.toLowerCase();

      if (usersByName.has(nameLower)) {
        const uid = usersByName.get(nameLower);
        const existing = users.get(uid);
        existing.ws = ws;
        existing.status = 'online';
        existing.lastSeen = Date.now();
        currentUserId = uid;

        send(ws, {
          type: 'registered',
          user: publicUser(existing),
          users: getUserList(),
          rooms: getRoomList()
        });

        return;
      }

      const id = uuidv4();
      currentUserId = id;

      const user = {
        id,
        username,
        avatar: msg.avatar || '😀',
        color: msg.color || '#6C63FF',
        ws,
        status: 'online',
        lastSeen: Date.now()
      };

      users.set(id, user);
      usersByName.set(nameLower, id);
      rooms.get(LOBBY_ID).members.add(id);

      send(ws, {
        type: 'registered',
        user: publicUser(user),
        users: getUserList(),
        rooms: getRoomList()
      });

      broadcast({ type: 'user_joined', user: publicUser(user) }, id);
      return;
    }

    const me = users.get(currentUserId);
    if (!me) return;

    /* ===== MESSAGES ===== */
    if (msg.type === 'message') {
      if (!checkRateLimit(currentUserId)) return;

      const content = sanitize((msg.content || '').slice(0, MAX_MSG_LEN));
      const recipient = users.get(msg.to);
      if (!recipient) return;

      const message = {
        id: uuidv4(),
        from: currentUserId,
        to: msg.to,
        content,
        timestamp: Date.now()
      };

      send(ws, { type: 'message', message });
      if (recipient.ws) send(recipient.ws, { type: 'message', message });
    }
  });

  ws.on('close', () => {
    if (!currentUserId) return;
    const user = users.get(currentUserId);
    if (user) {
      user.status = 'offline';
      user.lastSeen = Date.now();
      user.ws = null;
    }
  });
});

/* ================= ROUTES ================= */

app.get('/health', (_, res) => {
  res.json({
    status: 'ok',
    users: users.size,
    rooms: rooms.size
  });
});

/* ================= START ================= */

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 Secure Chat running on ${PORT}`);
});