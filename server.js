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

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*', methods: ['GET','POST'] }));
app.use(rateLimit({ windowMs: 15*60*1000, max: 300 }));
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const WS_RATE_LIMIT  = parseInt(process.env.RATE_LIMIT  || '60');
const WS_RATE_WINDOW = parseInt(process.env.RATE_WINDOW || '10000');
const MAX_MSG_LEN    = parseInt(process.env.MAX_MSG_LEN || '2000');
const MAX_HISTORY    = parseInt(process.env.MAX_HISTORY || '200');
const MAX_ROOMS      = parseInt(process.env.MAX_ROOMS   || '50');

const users       = new Map();
const usersByName = new Map();
const dmHistory   = new Map();
const rooms       = new Map();
const rateLimits  = new Map();

const san    = s  => xss(String(s||'').trim());
const dmKey  = (a,b) => [a,b].sort().join('::');
const send   = (ws, d) => ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify(d));
const sendErr = (ws, msg, code='ERR') => send(ws, { type:'error', code, message:msg });

function wsRateOk(userId) {
  const now = Date.now();
  const r   = rateLimits.get(userId) || { count:0, resetAt:now+WS_RATE_WINDOW };
  if (now > r.resetAt) { r.count = 0; r.resetAt = now+WS_RATE_WINDOW; }
  r.count++; rateLimits.set(userId, r);
  return r.count <= WS_RATE_LIMIT;
}
function push(arr, item) { arr.push(item); if (arr.length > MAX_HISTORY) arr.splice(0, arr.length-MAX_HISTORY); }
function pubUser(u) { return { id:u.id, username:u.username, avatar:u.avatar, color:u.color, status:u.status, lastSeen:u.lastSeen }; }
function pubRoom(r) { return { id:r.id, name:r.name, createdBy:r.createdBy, memberCount:r.members.size, createdAt:r.createdAt }; }
function allUsers() { return [...users.values()].map(pubUser); }
function allRooms() { return [...rooms.values()].map(pubRoom); }
function myRooms(uid) { return [...rooms.values()].filter(r=>r.members.has(uid)).map(pubRoom); }
function broadcastAll(data, excludeId=null) { users.forEach((u,id) => { if (id!==excludeId) send(u.ws, data); }); }
function broadcastRoom(roomId, data, excludeId=null) {
  const room = rooms.get(roomId); if (!room) return;
  room.members.forEach(uid => { if (uid!==excludeId) send(users.get(uid)?.ws, data); });
}
function getRoomMembers(roomId) {
  const room = rooms.get(roomId); if (!room) return [];
  return [...room.members].map(uid => pubUser(users.get(uid))).filter(Boolean);
}

wss.on('connection', ws => {
  let me = null;

  ws.on('message', raw => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'register') {
      const username = san(msg.username);
      if (username.length < 2 || username.length > 30) return sendErr(ws, 'Username must be 2-30 chars.', 'BAD_NAME');
      const key = username.toLowerCase();
      if (usersByName.has(key)) {
        const uid = usersByName.get(key), user = users.get(uid);
        user.ws = ws; user.status = 'online'; user.lastSeen = Date.now(); me = user;
        send(ws, { type:'registered', user:pubUser(user), users:allUsers(), rooms:allRooms(), myRooms:myRooms(uid) });
        broadcastAll({ type:'user_status', userId:uid, status:'online' }, uid);
        return;
      }
      const id = uuidv4();
      const user = { id, username, avatar:san(msg.avatar||'boy:light:black:#667eea'), color:san(msg.color||'#667eea'), ws, status:'online', lastSeen:Date.now() };
      users.set(id, user); usersByName.set(key, id); me = user;
      send(ws, { type:'registered', user:pubUser(user), users:allUsers(), rooms:allRooms(), myRooms:[] });
      broadcastAll({ type:'user_joined', user:pubUser(user) }, id);
      return;
    }

    if (!me) return sendErr(ws, 'Not registered.', 'NOT_AUTHED');

    switch (msg.type) {
      case 'message': {
        if (!wsRateOk(me.id)) return sendErr(ws,'Slow down!','RATE');
        const to = users.get(msg.to); if (!to) return;
        const content = san(msg.content||'').slice(0,MAX_MSG_LEN);
        if (!content && msg.contentType==='text') return;
        const m = { id:uuidv4(), kind:'dm', from:me.id, to:msg.to, content, contentType:msg.contentType||'text', timestamp:Date.now(), senderName:me.username, senderAvatar:me.avatar, senderColor:me.color, readBy:[me.id], deleted:false, reactions:{} };
        const k = dmKey(me.id, msg.to);
        if (!dmHistory.has(k)) dmHistory.set(k,[]);
        push(dmHistory.get(k), m);
        send(ws, { type:'message', message:m });
        send(to.ws, { type:'message', message:m });
        break;
      }
      case 'create_room': {
        if (rooms.size >= MAX_ROOMS) return sendErr(ws,'Max rooms reached.','MAX_ROOMS');
        const name  = san(msg.name||'').slice(0,50);
        const token = san(msg.token||'').slice(0,40);
        if (name.length  < 2) return sendErr(ws,'Room name 2+ chars.','BAD_NAME');
        if (token.length < 4) return sendErr(ws,'Token must be 4+ chars.','BAD_TOKEN');
        const rid = uuidv4();
        const room = { id:rid, name, token, createdBy:me.id, members:new Set([me.id]), history:[], createdAt:Date.now() };
        rooms.set(rid, room);
        send(ws, { type:'room_created', room:pubRoom(room), token, history:[], members:[pubUser(me)] });
        broadcastAll({ type:'rooms_updated', rooms:allRooms() });
        break;
      }
      case 'join_room': {
        const room = rooms.get(msg.roomId); if (!room) return sendErr(ws,'Room not found.','NOT_FOUND');
        if (room.members.has(me.id)) {
          return send(ws, { type:'room_joined', room:pubRoom(room), history:room.history, members:getRoomMembers(room.id) });
        }
        if (san(msg.token||'') !== room.token) return sendErr(ws,'Invalid token. Ask the room creator.','BAD_TOKEN');
        room.members.add(me.id);
        send(ws, { type:'room_joined', room:pubRoom(room), history:room.history, members:getRoomMembers(room.id) });
        broadcastRoom(room.id, { type:'room_member_joined', roomId:room.id, user:pubUser(me), memberCount:room.members.size }, me.id);
        broadcastAll({ type:'rooms_updated', rooms:allRooms() });
        break;
      }
      case 'leave_room': {
        const room = rooms.get(msg.roomId); if (!room) return;
        room.members.delete(me.id);
        send(ws, { type:'room_left', roomId:room.id });
        if (room.members.size === 0) rooms.delete(room.id);
        else broadcastRoom(room.id, { type:'room_member_left', roomId:room.id, userId:me.id, memberCount:room.members.size });
        broadcastAll({ type:'rooms_updated', rooms:allRooms() });
        break;
      }
      case 'room_message': {
        if (!wsRateOk(me.id)) return sendErr(ws,'Slow down!','RATE');
        const room = rooms.get(msg.roomId); if (!room) return sendErr(ws,'Room not found.','NOT_FOUND');
        if (!room.members.has(me.id)) return sendErr(ws,'Not a member.','NOT_MEMBER');
        const content = san(msg.content||'').slice(0,MAX_MSG_LEN);
        if (!content && msg.contentType==='text') return;
        const m = { id:uuidv4(), kind:'room', roomId:room.id, from:me.id, content, contentType:msg.contentType||'text', timestamp:Date.now(), senderName:me.username, senderAvatar:me.avatar, senderColor:me.color, deleted:false, reactions:{} };
        push(room.history, m);
        broadcastRoom(room.id, { type:'room_message', message:m });
        break;
      }
      case 'get_room_members': {
        const room = rooms.get(msg.roomId); if (!room||!room.members.has(me.id)) return;
        send(ws, { type:'room_members', roomId:room.id, members:getRoomMembers(room.id) });
        break;
      }
      case 'load_history': {
        const k = dmKey(me.id, msg.with);
        send(ws, { type:'history', with:msg.with, messages:dmHistory.get(k)||[] });
        break;
      }
      case 'load_room_history': {
        const room = rooms.get(msg.roomId); if (!room||!room.members.has(me.id)) return;
        send(ws, { type:'room_history', roomId:msg.roomId, messages:room.history });
        break;
      }
      case 'typing': {
        if (msg.roomId) broadcastRoom(msg.roomId, { type:'typing', from:me.id, fromName:me.username, roomId:msg.roomId, isTyping:msg.isTyping }, me.id);
        else send(users.get(msg.to)?.ws, { type:'typing', from:me.id, fromName:me.username, isTyping:msg.isTyping });
        break;
      }
      case 'react': {
        const { messageId, emoji, roomId, withUserId } = msg;
        let target = null;
        if (roomId) target = rooms.get(roomId)?.history.find(m=>m.id===messageId);
        else { const k=dmKey(me.id,withUserId); target = dmHistory.get(k)?.find(m=>m.id===messageId); }
        if (!target) return;
        if (!target.reactions) target.reactions = {};
        const arr = target.reactions[emoji]||[]; const idx=arr.indexOf(me.id);
        if (idx>-1) arr.splice(idx,1); else arr.push(me.id);
        if (arr.length===0) delete target.reactions[emoji]; else target.reactions[emoji]=arr;
        const ev = { type:'reaction_updated', messageId, reactions:target.reactions };
        if (roomId) broadcastRoom(roomId, ev); else { send(ws,ev); send(users.get(withUserId)?.ws,ev); }
        break;
      }
      case 'delete_message': {
        const { messageId, roomId, withUserId } = msg;
        if (roomId) {
          const room=rooms.get(roomId), m=room?.history.find(m=>m.id===messageId&&m.from===me.id);
          if (m) { m.deleted=true; m.content=''; broadcastRoom(roomId,{type:'message_deleted',messageId,roomId}); }
        } else {
          const k=dmKey(me.id,withUserId), m=dmHistory.get(k)?.find(m=>m.id===messageId&&m.from===me.id);
          if (m) { m.deleted=true; m.content=''; send(ws,{type:'message_deleted',messageId}); send(users.get(withUserId)?.ws,{type:'message_deleted',messageId}); }
        }
        break;
      }
      case 'read': {
        const k=dmKey(me.id,msg.fromUserId), m=dmHistory.get(k)?.find(m=>m.id===msg.messageId);
        if (m&&!m.readBy?.includes(me.id)) { m.readBy=[...(m.readBy||[]),me.id]; send(users.get(msg.fromUserId)?.ws,{type:'read_receipt',messageId:msg.messageId,by:me.id}); }
        break;
      }
      case 'update_profile': {
        if (msg.avatar) me.avatar = san(msg.avatar);
        if (msg.color)  me.color  = san(msg.color);
        send(ws, { type:'profile_updated', user:pubUser(me) });
        broadcastAll({ type:'user_updated', user:pubUser(me) }, me.id);
        break;
      }
      case 'search': {
        const q = san(msg.query||'').toLowerCase();
        send(ws, { type:'search_results', results:[...users.values()].filter(u=>u.id!==me.id&&u.username.toLowerCase().includes(q)).map(pubUser) });
        break;
      }
      case 'get_users': send(ws, { type:'user_list', users:allUsers() }); break;
      case 'get_rooms': send(ws, { type:'room_list', rooms:allRooms() }); break;
    }
  });

  ws.on('close', () => {
    if (!me) return;
    me.status='offline'; me.lastSeen=Date.now(); me.ws=null;
    broadcastAll({ type:'user_status', userId:me.id, status:'offline', lastSeen:me.lastSeen });
  });
  ws.on('error', err => console.error('WS:', err.message));
});

app.get('/health', (_,res) => res.json({ ok:true, users:users.size, rooms:rooms.size, uptime:process.uptime() }));
app.get('/api/users', (_,res) => res.json(allUsers()));
app.get('/api/rooms', (_,res) => res.json(allRooms()));
app.get('*', (_,res) => res.sendFile(path.join(__dirname,'public','index.html')));

['SIGTERM','SIGINT'].forEach(sig => process.on(sig, () => {
  users.forEach(u => send(u.ws,{type:'server_shutdown',message:'Server restarting.'}));
  wss.close(() => server.close(() => process.exit(0)));
  setTimeout(()=>process.exit(1),5000);
}));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`\n🚀  ChatSphere → http://localhost:${PORT}\n`));
