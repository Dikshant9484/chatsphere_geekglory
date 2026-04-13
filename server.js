'use strict';

const express   = require('express');
const http      = require('http');
const WebSocket = require('ws');
const path      = require('path');
const { v4: uuidv4 } = require('uuid');
const helmet    = require('helmet');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');
const xss       = require('xss');

try { require('dotenv').config(); } catch (_) {}

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

/* ================= SECURITY ================= */
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*', methods: ['GET','POST'] }));
app.use(rateLimit({ windowMs: 15*60*1000, max: 300 }));
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));

/* ================= CONFIG ================= */
const WS_RATE_LIMIT  = parseInt(process.env.RATE_LIMIT  || '60');
const WS_RATE_WINDOW = parseInt(process.env.RATE_WINDOW || '10000');
const MAX_MSG_LEN    = parseInt(process.env.MAX_MSG_LEN || '2000');
const MAX_HISTORY    = parseInt(process.env.MAX_HISTORY || '200');
const MAX_ROOMS      = parseInt(process.env.MAX_ROOMS   || '50');

/* ================= STORAGE ================= */
const users       = new Map();
const usersByName = new Map();
const dmHistory   = new Map();
const rooms       = new Map();
const rateLimits  = new Map();

/* ================= HELPERS ================= */
const san = s => xss(String(s||'').trim());
const dmKey = (a,b) => [a,b].sort().join('::');

const send = (ws, d) => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(d));
  }
};

const sendErr = (ws, msg, code='ERR') =>
  send(ws, { type:'error', code, message:msg });

function broadcastAll(data, excludeId=null) {
  users.forEach((u,id) => {
    if (id !== excludeId) send(u.ws, data);
  });
}

function push(arr, item) {
  arr.push(item);
  if (arr.length > MAX_HISTORY) {
    arr.splice(0, arr.length - MAX_HISTORY);
  }
}

function wsRateOk(userId) {
  const now = Date.now();
  const r = rateLimits.get(userId) || { count:0, resetAt:now+WS_RATE_WINDOW };

  if (now > r.resetAt) {
    r.count = 0;
    r.resetAt = now + WS_RATE_WINDOW;
  }

  r.count++;
  rateLimits.set(userId, r);

  return r.count <= WS_RATE_LIMIT;
}

function pubUser(u) {
  return {
    id: u.id,
    username: u.username,
    avatar: u.avatar,
    color: u.color,
    status: u.status,
    lastSeen: u.lastSeen
  };
}

function allUsers() {
  return [...users.values()].map(pubUser);
}

/* ================= WEBSOCKET ================= */

wss.on('connection', ws => {
  let me = null;

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    /* ===== REGISTER ===== */
    if (msg.type === 'register') {
      const username = san(msg.username);

      if (username.length < 2 || username.length > 30) {
        return sendErr(ws, 'Username must be 2-30 chars.', 'BAD_NAME');
      }

      const key = username.toLowerCase();

      if (usersByName.has(key)) {
        const uid = usersByName.get(key);
        const user = users.get(uid);

        user.ws = ws;
        user.status = 'online';
        user.lastSeen = Date.now();
        me = user;

        send(ws, {
          type:'registered',
          user: pubUser(user),
          users: allUsers()
        });

        broadcastAll({ type:'user_status', userId:uid, status:'online' }, uid);
        return;
      }

      const id = uuidv4();

      const user = {
        id,
        username,
        avatar: san(msg.avatar || '😀'),
        color: san(msg.color || '#667eea'),
        ws,
        status: 'online',
        lastSeen: Date.now()
      };

      users.set(id, user);
      usersByName.set(key, id);
      me = user;

      send(ws, {
        type:'registered',
        user: pubUser(user),
        users: allUsers()
      });

      broadcastAll({ type:'user_joined', user: pubUser(user) }, id);
      return;
    }

    if (!me) return;

    /* ===== MESSAGE ===== */
    if (msg.type === 'message') {
      if (!wsRateOk(me.id)) return;

      const to = users.get(msg.to);
      if (!to) return;

      const content = san(msg.content || '').slice(0, MAX_MSG_LEN);

      const message = {
        id: uuidv4(),
        from: me.id,
        to: msg.to,
        content,
        contentType: msg.contentType || 'text',
        timestamp: Date.now()
      };

      send(ws, { type:'message', message });
      send(to.ws, { type:'message', message });
    }
  });

  /* ================= 🔥 OFFLINE REMOVE ================= */
  ws.on('close', () => {
    if (!me) return;

    const userId = me.id;
    const username = me.username.toLowerCase();

    // ✅ REMOVE USER COMPLETELY
    users.delete(userId);
    usersByName.delete(username);

    // ✅ INFORM EVERYONE
    broadcastAll({
      type: 'user_left',
      userId: userId
    });
  });

  ws.on('error', err => console.error('WS Error:', err.message));
});

/* ================= ROUTES ================= */

app.get('/health', (_,res) => {
  res.json({ ok:true, users:users.size, uptime:process.uptime() });
});

app.get('*', (_,res) => {
  res.sendFile(path.join(__dirname,'public','index.html'));
});

/* ================= START ================= */

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});