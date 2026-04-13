/* ChatSphere — app.js
   Features: Token-gated rooms, SVG Bitmoji avatars, reactions,
   read receipts, delete, mobile-responsive, member panel
*/
(function () {
'use strict';

/* ══════════════════════ SVG AVATAR ENGINE ══════════════════════════════ */
const SKIN = {
  light:        { face:'#FFDBAC', shadow:'#F0C080', ear:'#F0C080' },
  medium_light: { face:'#F1C27D', shadow:'#D9A056', ear:'#D9A056' },
  medium:       { face:'#C68642', shadow:'#A0522D', ear:'#A0522D' },
  medium_dark:  { face:'#8D5524', shadow:'#6B3D1A', ear:'#6B3D1A' },
  dark:         { face:'#4A2912', shadow:'#2E1A0E', ear:'#2E1A0E' },
};
const HAIR = {
  black:'#1a1a1a', brown:'#6B3A2A', blonde:'#D4A017',
  red:'#C0392B', gray:'#95a5a6', pink:'#FF69B4', blue:'#4169E1',
};

function boyAvatar(skin, hair, outfit, size) {
  const sk = SKIN[skin]||SKIN.medium_light, hc = HAIR[hair]||HAIR.black, oc = outfit||'#667eea';
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="50" cy="94" rx="27" ry="13" fill="${oc}" opacity=".9"/>
    <rect x="23" y="74" width="54" height="22" rx="10" fill="${oc}"/>
    <rect x="43" y="64" width="14" height="13" rx="4" fill="${sk.face}"/>
    <ellipse cx="24" cy="50" rx="5" ry="7" fill="${sk.ear}"/>
    <ellipse cx="76" cy="50" rx="5" ry="7" fill="${sk.ear}"/>
    <ellipse cx="50" cy="46" rx="28" ry="31" fill="${sk.face}"/>
    <ellipse cx="32" cy="55" rx="6" ry="4" fill="#FFB6C1" opacity=".4"/>
    <ellipse cx="68" cy="55" rx="6" ry="4" fill="#FFB6C1" opacity=".4"/>
    <path d="M22 38 Q22 12 50 12 Q78 12 78 38 Q74 24 50 22 Q26 24 22 38Z" fill="${hc}"/>
    <ellipse cx="38" cy="47" rx="6.5" ry="7" fill="white"/>
    <ellipse cx="62" cy="47" rx="6.5" ry="7" fill="white"/>
    <ellipse cx="39" cy="48" rx="4" ry="4.5" fill="#2C2C2C"/>
    <ellipse cx="63" cy="48" rx="4" ry="4.5" fill="#2C2C2C"/>
    <ellipse cx="40" cy="46.5" rx="1.5" ry="1.5" fill="white"/>
    <ellipse cx="64" cy="46.5" rx="1.5" ry="1.5" fill="white"/>
    <path d="M32 39 Q38 36 44 38" stroke="${hc}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M56 38 Q62 36 68 39" stroke="${hc}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M48 53 Q50 56 52 53" stroke="${sk.shadow}" stroke-width="1.5" stroke-linecap="round" fill="none"/>
    <path d="M40 62 Q50 70 60 62" stroke="#C0392B" stroke-width="2" stroke-linecap="round" fill="none"/>
    <path d="M42 63 Q50 68 58 63 Q54 67 46 67Z" fill="white"/>
  </svg>`;
}

function girlAvatar(skin, hair, outfit, size) {
  const sk = SKIN[skin]||SKIN.medium_light, hc = HAIR[hair]||HAIR.black, oc = outfit||'#f472b6';
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="50" cy="94" rx="27" ry="13" fill="${oc}" opacity=".9"/>
    <rect x="23" y="74" width="54" height="22" rx="10" fill="${oc}"/>
    <path d="M36 74 Q50 84 64 74" stroke="white" stroke-width="1.5" opacity=".35" fill="none"/>
    <rect x="43" y="64" width="14" height="13" rx="4" fill="${sk.face}"/>
    <ellipse cx="23" cy="50" rx="5" ry="7" fill="${sk.ear}"/>
    <ellipse cx="77" cy="50" rx="5" ry="7" fill="${sk.ear}"/>
    <circle cx="23" cy="55" r="2.5" fill="#FFD700"/>
    <circle cx="77" cy="55" r="2.5" fill="#FFD700"/>
    <path d="M23 38 Q18 55 20 80 Q28 88 38 90 Q26 70 24 50Z" fill="${hc}" opacity=".85"/>
    <path d="M77 38 Q82 55 80 80 Q72 88 62 90 Q74 70 76 50Z" fill="${hc}" opacity=".85"/>
    <ellipse cx="50" cy="46" rx="27" ry="31" fill="${sk.face}"/>
    <path d="M23 38 Q23 10 50 10 Q77 10 77 38 Q73 22 50 20 Q27 22 23 38Z" fill="${hc}"/>
    <path d="M23 38 Q19 48 20 60" stroke="${hc}" stroke-width="8" stroke-linecap="round" fill="none"/>
    <path d="M77 38 Q81 48 80 60" stroke="${hc}" stroke-width="8" stroke-linecap="round" fill="none"/>
    <ellipse cx="31" cy="55" rx="7" ry="5" fill="#FF9AB5" opacity=".45"/>
    <ellipse cx="69" cy="55" rx="7" ry="5" fill="#FF9AB5" opacity=".45"/>
    <ellipse cx="37" cy="47" rx="7" ry="7.5" fill="white"/>
    <ellipse cx="63" cy="47" rx="7" ry="7.5" fill="white"/>
    <ellipse cx="37.5" cy="48" rx="4.5" ry="5" fill="#2C2C2C"/>
    <ellipse cx="63.5" cy="48" rx="4.5" ry="5" fill="#2C2C2C"/>
    <ellipse cx="38.5" cy="46.5" rx="1.8" ry="1.8" fill="white"/>
    <ellipse cx="64.5" cy="46.5" rx="1.8" ry="1.8" fill="white"/>
    <path d="M30 42 L29 39M33 40 L32 37M37 39 L37 36M41 40 L42 37M44 42 L45 39" stroke="${hc}" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M56 42 L55 39M59 40 L58 37M63 39 L63 36M67 40 L68 37M70 42 L71 39" stroke="${hc}" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M30 38.5 Q37 35 44 37.5" stroke="${hc}" stroke-width="2" stroke-linecap="round"/>
    <path d="M56 37.5 Q63 35 70 38.5" stroke="${hc}" stroke-width="2" stroke-linecap="round"/>
    <path d="M48 53 Q50 56 52 53" stroke="${sk.shadow}" stroke-width="1.2" stroke-linecap="round" fill="none"/>
    <path d="M39 63 Q50 70 61 63 Q56 68 50 69 Q44 68 39 63Z" fill="#E75480" opacity=".85"/>
    <path d="M44 62 Q47 60 50 61 Q53 60 56 62" stroke="#C0392B" stroke-width="1" fill="none"/>
  </svg>`;
}

function renderAvatar(avatarStr, size=40) {
  const parts = (avatarStr||'boy:light:black:#667eea').split(':');
  const gender = parts[0]||'boy', skin = parts[1]||'light', hair = parts[2]||'black', outfit = parts[3]||'#667eea';
  return gender === 'girl' ? girlAvatar(skin, hair, outfit, size) : boyAvatar(skin, hair, outfit, size);
}

function encodeAvatar(cfg) { return `${cfg.gender}:${cfg.skin}:${cfg.hair}:${cfg.outfit}`; }
function decodeAvatar(str) {
  const p = (str||'boy:light:black:#667eea').split(':');
  return { gender:p[0]||'boy', skin:p[1]||'light', hair:p[2]||'black', outfit:p[3]||'#667eea' };
}

/* ══════════════════════ STATE ══════════════════════════════════════════ */
const S = {
  ws:null, me:null,
  users: new Map(),
  rooms: new Map(),
  myRooms: new Set(),
  activeChat: null,
  chats: new Map(),
  unread: new Map(),
  typingTimers: new Map(),
  wsRetries: 0,
  avatarCfg: { gender:'boy', skin:'light', hair:'black', outfit:'#667eea' },
  editCfg: null,
  reactionTarget: null,
  membersRoomId: null,
};

/* ══════════════════════ HELPERS ════════════════════════════════════════ */
const EMOJIS = ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','😉','😌','😍','🥰','😘','😋','😛','😜','🤪','😏','😒','😞','😔','😟','😕','🙁','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧','😷','😈','👿','💀','☠️','👻','👽','🤖','💩','👋','🤚','🖐️','✋','🖖','👌','✌️','🤞','🤟','🤘','🤙','👍','👎','✊','👊','👏','🙌','🤲','🤝','🙏','💅','💪','❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','❤️‍🔥','💕','💞','💓','💗','💖','💘','💝','🌈','⭐','🌟','✨','🎉','🎊','🎈','🏆','🥇','🎯','🎮','🎲','🔥','💯','💢','💥','💫','💦','🌊','🚀','🛸','🌍','🌙','⚡','☀️','❄️','💨','🌪️','☔','🎭','🦄','🐉','🌺','🦊','🐼','🦁','🐸','🐝','🦋'];

function $(id) { return document.getElementById(id); }
function esc(s) { const d=document.createElement('div');d.textContent=s;return d.innerHTML; }
function toast(msg, type='info') {
  const t=document.createElement('div'); t.className=`toast ${type}`; t.textContent=msg;
  $('toastContainer').appendChild(t); setTimeout(()=>t.remove(),4000);
}
function formatTime(ts) { return new Date(ts).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}); }
function formatDate(ts) {
  const d=new Date(ts),today=new Date();
  if (d.toDateString()===today.toDateString()) return 'Today';
  const y=new Date(today); y.setDate(today.getDate()-1);
  if (d.toDateString()===y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([],{month:'short',day:'numeric'});
}
function isEmojiOnly(t) { return /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\s)+$/u.test((t||'').trim()); }
function dmKey(a,b) { return [a,b].sort().join('::'); }
function activeChatKey() {
  if (!S.activeChat) return null;
  return S.activeChat.type==='room' ? S.activeChat.id : dmKey(S.me.id, S.activeChat.id);
}
function scrollBottom() { requestAnimationFrame(()=>{ const a=$('messagesArea'); a.scrollTop=a.scrollHeight; }); }

/* ══════════════════════ AVATAR UI HELPERS ══════════════════════════════ */
function setAvatarEl(el, avatarStr, size=40) {
  el.innerHTML = renderAvatar(avatarStr, size);
}

function refreshLoginPreview() {
  const str = encodeAvatar(S.avatarCfg);
  const p1 = $('avPreview'), p2 = $('avPreview2');
  if (p1) setAvatarEl(p1, str, 90);
  if (p2) setAvatarEl(p2, str, 70);
}

function refreshEditPreview() {
  if (!S.editCfg) return;
  setAvatarEl($('editAvPreview'), encodeAvatar(S.editCfg), 80);
}

/* ══════════════════════ LOGIN STEPS ════════════════════════════════════ */
function loginStep(n) {
  $('loginStep1').classList.toggle('hidden', n!==1);
  $('loginStep2').classList.toggle('hidden', n!==2);
  if (n===2) { refreshLoginPreview(); $('usernameInput').focus(); }
}
window.loginStep = loginStep;

// Avatar builder – login
document.querySelectorAll('[data-key]').forEach(btn => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.key, val = btn.dataset.val;
    S.avatarCfg[key] = val;
    // deactivate siblings
    document.querySelectorAll(`[data-key="${key}"]`).forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    refreshLoginPreview();
  });
});
refreshLoginPreview();

// Edit profile avatar builder
document.querySelectorAll('[data-ekey]').forEach(btn => {
  btn.addEventListener('click', () => {
    const key=btn.dataset.ekey, val=btn.dataset.val;
    if (!S.editCfg) return;
    S.editCfg[key]=val;
    document.querySelectorAll(`[data-ekey="${key}"]`).forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    refreshEditPreview();
  });
});

/* ══════════════════════ WEBSOCKET ══════════════════════════════════════ */
function connectWS() {
  const proto = location.protocol==='https:' ? 'wss' : 'ws';
  S.ws = new WebSocket(`${proto}://${location.host}`);
  S.ws.onopen = () => {
    S.wsRetries=0;
    if (S.me) wsSend({ type:'register', username:S.me.username, avatar:S.me.avatar, color:S.me.color });
  };
  S.ws.onmessage = e => { try { handleMsg(JSON.parse(e.data)); } catch {} };
  S.ws.onclose = () => { if (S.me && S.wsRetries<10) { S.wsRetries++; setTimeout(connectWS, Math.min(1000*S.wsRetries,8000)); } };
  S.ws.onerror = ()=>{};
}
function wsSend(data) { if (S.ws?.readyState===WebSocket.OPEN) S.ws.send(JSON.stringify(data)); }

/* ══════════════════════ MESSAGE HANDLER ════════════════════════════════ */
function handleMsg(msg) {
  switch(msg.type) {

    case 'registered': {
      S.me = msg.user;
      S.users.clear(); msg.users.forEach(u=>S.users.set(u.id,u));
      S.rooms.clear(); msg.rooms.forEach(r=>S.rooms.set(r.id,r));
      S.myRooms.clear(); (msg.myRooms||[]).forEach(r=>{ S.myRooms.add(r.id); S.rooms.set(r.id,r); });
      setAvatarEl($('myAvatarEl'), S.me.avatar, 36);
      $('myName').textContent = S.me.username;
      renderUserList(); renderRoomList();
      // show app
      $('loginScreen').classList.remove('active');
      $('appScreen').classList.add('active');
      break;
    }
    case 'error': toast(msg.message,'error'); break;
    case 'server_shutdown': toast(msg.message,'error'); break;

    case 'user_joined': S.users.set(msg.user.id,msg.user); renderUserList(); toast(`${msg.user.username} joined`); break;
    case 'user_status': {
      const u=S.users.get(msg.userId); if(!u) break;
      u.status=msg.status; u.lastSeen=msg.lastSeen; renderUserList(); updatePeerStatus(); break;
    }
    case 'user_updated': { const u=S.users.get(msg.user.id); if(u){Object.assign(u,msg.user);renderUserList();updatePeerStatus();} break; }
    case 'profile_updated': { S.me=msg.user; setAvatarEl($('myAvatarEl'),S.me.avatar,36); $('myName').textContent=S.me.username; break; }
    case 'user_list': { S.users.clear(); msg.users.forEach(u=>S.users.set(u.id,u)); renderUserList(); break; }
    case 'search_results': renderSearchResults(msg.results); break;

    // DM
    case 'message': {
      const m=msg.message, key=dmKey(m.from,m.to);
      if (!S.chats.has(key)) S.chats.set(key,[]);
      if (!S.chats.get(key).find(x=>x.id===m.id)) S.chats.get(key).push(m);
      if (S.activeChat?.type==='dm'&&(S.activeChat.id===m.from||S.activeChat.id===m.to)) {
        appendMsg(m); if(m.from!==S.me.id) wsSend({type:'read',messageId:m.id,fromUserId:m.from});
      } else if (m.from!==S.me.id) {
        S.unread.set(m.from,(S.unread.get(m.from)||0)+1); renderUserList();
        const s=S.users.get(m.from); if(s) toast(`${s.username}: ${m.contentType==='text'?m.content.slice(0,40):'📎 media'}`);
      }
      break;
    }
    case 'history': {
      S.chats.set(dmKey(S.me.id,msg.with),msg.messages);
      if (S.activeChat?.type==='dm'&&S.activeChat.id===msg.with) renderMessages();
      break;
    }
    case 'read_receipt': { const e=document.querySelector(`[data-msgid="${msg.messageId}"] .msg-read`); if(e) e.textContent='✓✓'; break; }

    // Rooms
    case 'rooms_updated': { msg.rooms.forEach(r=>S.rooms.set(r.id,r)); renderRoomList(); populateJoinSelect(); break; }
    case 'room_list':    { S.rooms.clear(); msg.rooms.forEach(r=>S.rooms.set(r.id,r)); renderRoomList(); break; }
    case 'room_created': {
      S.rooms.set(msg.room.id,msg.room); S.myRooms.add(msg.room.id);
      S.chats.set(msg.room.id, msg.history||[]);
      renderRoomList();
      // Show token to creator
      toast(`Room created! Token: ${msg.token} (copied)`, 'success');
      navigator.clipboard.writeText(msg.token).catch(()=>{});
      openRoom(msg.room.id);
      break;
    }
    case 'room_joined': {
      S.myRooms.add(msg.room.id); S.rooms.set(msg.room.id,msg.room);
      S.chats.set(msg.room.id, msg.history||[]);
      renderRoomList(); populateJoinSelect();
      if (S.activeChat?.id===msg.room.id) renderMessages();
      break;
    }
    case 'room_left': {
      S.myRooms.delete(msg.roomId); renderRoomList();
      if (S.activeChat?.id===msg.roomId) closeChat();
      break;
    }
    case 'room_member_joined': {
      const r=S.rooms.get(msg.roomId); if(r) r.memberCount=msg.memberCount; renderRoomList();
      if(S.activeChat?.id===msg.roomId) {
        $('peerStatus').textContent=`${msg.memberCount} members`;
        toast(`${msg.user.username} joined the room`);
      }
      break;
    }
    case 'room_member_left': {
      const r=S.rooms.get(msg.roomId); if(r) r.memberCount=msg.memberCount; renderRoomList();
      if(S.activeChat?.id===msg.roomId) $('peerStatus').textContent=`${msg.memberCount} members`;
      break;
    }
    case 'room_member_count': { const r=S.rooms.get(msg.roomId); if(r){r.memberCount=msg.count;renderRoomList();} break; }
    case 'room_message': {
      const m=msg.message;
      if (!S.chats.has(m.roomId)) S.chats.set(m.roomId,[]);
      if (!S.chats.get(m.roomId).find(x=>x.id===m.id)) S.chats.get(m.roomId).push(m);
      if (S.activeChat?.type==='room'&&S.activeChat.id===m.roomId) appendMsg(m);
      else if (m.from!==S.me.id) {
        S.unread.set(m.roomId,(S.unread.get(m.roomId)||0)+1); renderRoomList();
        const r=S.rooms.get(m.roomId); toast(`${m.senderName} [${r?.name||'room'}]: ${m.contentType==='text'?m.content.slice(0,40):'📎 media'}`);
      }
      break;
    }
    case 'room_history': {
      S.chats.set(msg.roomId,msg.messages);
      if (S.activeChat?.type==='room'&&S.activeChat.id===msg.roomId) renderMessages();
      break;
    }
    case 'room_members': renderMembersModal(msg.members); break;

    case 'reaction_updated': updateReactions(msg.messageId,msg.reactions); break;
    case 'message_deleted':  markDeleted(msg.messageId); break;

    case 'typing': {
      const chatId = msg.roomId||msg.from;
      if (msg.roomId&&S.activeChat?.id!==msg.roomId) break;
      if (!msg.roomId&&S.activeChat?.id!==msg.from) break;
      clearTimeout(S.typingTimers.get(chatId));
      if (msg.isTyping) {
        $('typingName').textContent=msg.fromName||'Someone';
        $('typingBar').classList.remove('hidden');
        S.typingTimers.set(chatId,setTimeout(()=>$('typingBar').classList.add('hidden'),3500));
      } else { $('typingBar').classList.add('hidden'); }
      break;
    }
  }
}

/* ══════════════════════ RENDER ═════════════════════════════════════════ */
function renderUserList() {
  const list=$('userList'); list.innerHTML='';
  const sorted=[...S.users.values()].filter(u=>u.id!==S.me?.id).sort((a,b)=>{
    if(a.status===b.status) return a.username.localeCompare(b.username);
    return a.status==='online'?-1:1;
  });
  const onlineCount=sorted.filter(u=>u.status==='online').length;
  $('peopleSectionLabel').textContent=`ONLINE NOW${onlineCount?` — ${onlineCount}`:''}`; 
  sorted.forEach(u => {
    const isActive=S.activeChat?.type==='dm'&&S.activeChat.id===u.id;
    const ub=S.unread.get(u.id)||0;
    const div=document.createElement('div');
    div.className=`user-item${isActive?' active':''}`;
    div.innerHTML=`
      <div class="user-av-wrap">${renderAvatar(u.avatar,34)}<span class="user-dot ${u.status}"></span></div>
      <div class="user-info"><div class="user-name">${esc(u.username)}</div><div class="user-sub">${u.status==='online'?'Online':'Offline'}</div></div>
      ${ub?`<div class="unread-badge">${ub}</div>`:''}
    `;
    div.onclick=()=>openDM(u.id);
    list.appendChild(div);
  });
}

function renderRoomList() {
  const myList=$('roomList'); myList.innerHTML='';
  const discoverList=$('discoverList'); discoverList.innerHTML='';
  let hasDiscover=false;

  S.rooms.forEach(room => {
    const joined=S.myRooms.has(room.id);
    const isActive=S.activeChat?.type==='room'&&S.activeChat.id===room.id;
    const ub=S.unread.get(room.id)||0;
    const div=document.createElement('div');
    div.className=`room-item${isActive?' active':''}`;

    if (joined) {
      div.innerHTML=`
        <div class="room-icon">#</div>
        <div class="room-info"><span class="room-name">${esc(room.name)}</span><span class="room-meta">${room.memberCount} member${room.memberCount!==1?'s':''}</span></div>
        ${ub?`<div class="unread-badge">${ub}</div>`:''}
        <button class="room-leave-btn" data-rid="${room.id}" title="Leave">✕</button>
      `;
      div.onclick=e=>{
        if(e.target.classList.contains('room-leave-btn')||e.target.dataset.rid) { e.stopPropagation(); wsSend({type:'leave_room',roomId:e.target.dataset.rid||room.id}); return; }
        openRoom(room.id); closeSidebar();
      };
      myList.appendChild(div);
    } else {
      hasDiscover=true;
      div.innerHTML=`
        <div class="room-icon">#</div>
        <div class="room-info"><span class="room-name">${esc(room.name)}</span><span class="room-meta">${room.memberCount} member${room.memberCount!==1?'s':''}</span></div>
        <span class="join-chip">Join</span>
      `;
      div.onclick=()=>openJoinModal(room.id);
      discoverList.appendChild(div);
    }
  });

  $('discoverSection').classList.toggle('hidden',!hasDiscover);
}

function renderSearchResults(results) {
  const list=$('searchList'); list.innerHTML='';
  if (!results.length) { list.innerHTML='<div style="padding:12px;color:var(--muted);font-size:13px">No users found</div>'; }
  results.forEach(u=>{
    const div=document.createElement('div'); div.className='user-item';
    div.innerHTML=`<div class="user-av-wrap">${renderAvatar(u.avatar,34)}</div><div class="user-info"><div class="user-name">${esc(u.username)}</div></div>`;
    div.onclick=()=>{ openDM(u.id); $('searchResults').classList.add('hidden'); $('searchInput').value=''; $('clearSearch').classList.add('hidden'); closeSidebar(); };
    list.appendChild(div);
  });
  $('searchResults').classList.remove('hidden');
}

function renderMessages() {
  $('messagesInner').innerHTML='';
  const key=activeChatKey(); if(!key) return;
  const msgs=S.chats.get(key)||[];
  let lastDate=null;
  msgs.forEach(m=>{
    const d=formatDate(m.timestamp);
    if(d!==lastDate){ lastDate=d; const div=document.createElement('div'); div.className='date-divider'; div.textContent=d; $('messagesInner').appendChild(div); }
    $('messagesInner').appendChild(buildMsgEl(m));
  });
  scrollBottom();
}

function appendMsg(m) {
  const existing=document.querySelector(`[data-msgid="${m.id}"]`);
  if(existing) return;
  const key=activeChatKey();
  const msgs=S.chats.get(key)||[];
  const last=msgs[msgs.length-2];
  if(!last||formatDate(last.timestamp)!==formatDate(m.timestamp)){
    const div=document.createElement('div');div.className='date-divider';div.textContent=formatDate(m.timestamp);$('messagesInner').appendChild(div);
  }
  $('messagesInner').appendChild(buildMsgEl(m));
  scrollBottom();
}

function buildMsgEl(m) {
  const mine=m.from===S.me.id, del=m.deleted;
  const row=document.createElement('div');
  row.className=`msg-row${mine?' mine':''}`;
  row.dataset.msgid=m.id;

  let content='';
  if(del) content='<span class="msg-deleted">🗑 Message deleted</span>';
  else if(m.contentType==='image') content=`<img class="msg-img" src="${m.content}" alt="img"/>`;
  else if(m.contentType==='video') content=`<video class="msg-video" src="${m.content}" controls></video>`;
  else {
    const emoOnly=isEmojiOnly(m.content);
    const bubStyle=!mine&&!emoOnly?'':`background:${emoOnly?'transparent':m.senderColor}`;
    content=`<div class="msg-bubble${emoOnly?' emoji-only':''}" style="${bubStyle}">${esc(m.content)}</div>`;
  }

  let reactHTML='';
  if(m.reactions&&Object.keys(m.reactions).length){
    reactHTML='<div class="msg-reactions">';
    Object.entries(m.reactions).forEach(([emoji,users])=>{
      const im=users.includes(S.me.id);
      reactHTML+=`<span class="reaction-pill${im?' mine':''}" data-emoji="${emoji}" data-msgid="${m.id}">${emoji}<span class="reaction-count">${users.length}</span></span>`;
    });
    reactHTML+='</div>';
  }

  const readHTML=mine&&!del?`<span class="msg-read" title="Sent">✓</span>`:'';
  const actions=!del?`<div class="msg-actions">
    <button class="msg-action-btn" data-act="react" title="React">😊</button>
    ${mine?`<button class="msg-action-btn" data-act="delete" title="Delete">🗑</button>`:''}
    <button class="msg-action-btn" data-act="copy" title="Copy">📋</button>
  </div>`:'';

  row.innerHTML=`
    <div class="msg-av-wrap">${renderAvatar(m.senderAvatar,26)}</div>
    <div class="msg-body">
      ${!mine?`<div class="msg-sender" style="color:${m.senderColor}">${esc(m.senderName)}</div>`:''}
      <div style="position:relative">${actions}${content}</div>
      ${reactHTML}
      <div class="msg-meta"><span class="msg-time">${formatTime(m.timestamp)}</span>${readHTML}</div>
    </div>
  `;

  row.querySelector('.msg-img')?.addEventListener('click',()=>openLightbox('img',m.content));
  row.querySelector('.msg-video')?.addEventListener('click',e=>{e.preventDefault();openLightbox('video',m.content);});
  row.querySelectorAll('.msg-action-btn').forEach(btn=>{
    btn.addEventListener('click',e=>{
      e.stopPropagation();
      if(btn.dataset.act==='copy') navigator.clipboard.writeText(m.content).then(()=>toast('Copied!'));
      else if(btn.dataset.act==='delete') doDelete(m);
      else if(btn.dataset.act==='react') showReactionPicker(e,m);
    });
  });
  row.querySelectorAll('.reaction-pill').forEach(pill=>{
    pill.addEventListener('click',()=>doReact(m,pill.dataset.emoji));
  });
  return row;
}

function updateReactions(msgId, reactions) {
  const row=document.querySelector(`[data-msgid="${msgId}"]`); if(!row) return;
  S.chats.forEach(msgs=>{ const m=msgs.find(m=>m.id===msgId); if(m) m.reactions=reactions; });
  let wrap=row.querySelector('.msg-reactions');
  if(!wrap){wrap=document.createElement('div');wrap.className='msg-reactions';row.querySelector('.msg-body').insertBefore(wrap,row.querySelector('.msg-meta'));}
  wrap.innerHTML='';
  Object.entries(reactions).forEach(([emoji,users])=>{
    if(!users.length) return;
    const im=users.includes(S.me.id);
    const pill=document.createElement('span'); pill.className=`reaction-pill${im?' mine':''}`;
    pill.innerHTML=`${emoji}<span class="reaction-count">${users.length}</span>`;
    let theMsg=null; S.chats.forEach(msgs=>{const m=msgs.find(m=>m.id===msgId);if(m)theMsg=m;});
    if(theMsg) pill.addEventListener('click',()=>doReact(theMsg,emoji));
    wrap.appendChild(pill);
  });
}

function markDeleted(msgId) {
  const row=document.querySelector(`[data-msgid="${msgId}"]`); if(!row) return;
  const wrap=row.querySelector('[style*="position:relative"]');
  if(wrap) wrap.innerHTML='<span class="msg-deleted">🗑 Message deleted</span>';
  S.chats.forEach(msgs=>{const m=msgs.find(m=>m.id===msgId);if(m){m.deleted=true;m.content='';}});
}

function updatePeerStatus() {
  if(!S.activeChat||S.activeChat.type!=='dm') return;
  const u=S.users.get(S.activeChat.id); if(!u) return;
  $('peerStatus').textContent=u.status==='online'?'online':`last seen ${formatTime(u.lastSeen||Date.now())}`;
}

function renderMembersModal(members) {
  const list=$('membersList'); list.innerHTML='';
  members.forEach(u=>{
    const div=document.createElement('div'); div.className='member-item';
    div.innerHTML=`<div class="member-item-av">${renderAvatar(u.avatar,30)}</div><div><div class="member-name">${esc(u.username)}</div><div class="member-status">${u.status==='online'?'🟢 Online':'⚫ Offline'}</div></div>`;
    list.appendChild(div);
  });
  $('membersModal').classList.remove('hidden');
}

/* ══════════════════════ CHAT OPEN/CLOSE ════════════════════════════════ */
function openDM(userId) {
  S.activeChat={type:'dm',id:userId};
  S.unread.delete(userId);
  const u=S.users.get(userId);
  setAvatarEl($('peerAvatarWrap'), u?.avatar||'boy:light:black:#667eea', 34);
  $('peerName').textContent=u?.username||userId;
  $('peerStatus').textContent=u?.status==='online'?'online':`last seen ${formatTime(u?.lastSeen||Date.now())}`;
  $('membersBtn').style.display='none';
  $('emptyState').classList.add('hidden'); $('chatWindow').classList.remove('hidden');
  $('typingBar').classList.add('hidden');
  renderUserList(); renderRoomList();
  const key=dmKey(S.me.id,userId);
  if(S.chats.has(key)) renderMessages(); else wsSend({type:'load_history',with:userId});
}

function openRoom(roomId) {
  S.activeChat={type:'room',id:roomId};
  S.unread.delete(roomId);
  const r=S.rooms.get(roomId);
  $('peerAvatarWrap').innerHTML='<div style="width:34px;height:34px;background:var(--s3);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:900;color:var(--accent)">#</div>';
  $('peerName').textContent=r?.name||roomId;
  $('peerStatus').textContent=`${r?.memberCount||0} members`;
  $('membersBtn').style.display='inline-flex';
  $('emptyState').classList.add('hidden'); $('chatWindow').classList.remove('hidden');
  $('typingBar').classList.add('hidden');
  renderUserList(); renderRoomList();
  if(S.chats.has(roomId)) renderMessages(); else wsSend({type:'load_room_history',roomId});
}

function closeChat() {
  S.activeChat=null;
  $('chatWindow').classList.add('hidden'); $('emptyState').classList.remove('hidden');
  renderUserList(); renderRoomList();
}
window.closeChat = closeChat;

/* ══════════════════════ ACTIONS ════════════════════════════════════════ */
function sendMessage() {
  const text=$('messageInput').value.trim(); if(!text||!S.activeChat) return;
  if(S.activeChat.type==='dm') wsSend({type:'message',to:S.activeChat.id,content:text,contentType:'text'});
  else wsSend({type:'room_message',roomId:S.activeChat.id,content:text,contentType:'text'});
  $('messageInput').value=''; $('messageInput').style.height='';
}

function sendMedia(dataUrl, contentType) {
  if(!S.activeChat) return;
  if(S.activeChat.type==='dm') wsSend({type:'message',to:S.activeChat.id,content:dataUrl,contentType});
  else wsSend({type:'room_message',roomId:S.activeChat.id,content:dataUrl,contentType});
}

function doReact(m, emoji) {
  if(S.activeChat.type==='room') wsSend({type:'react',messageId:m.id,emoji,roomId:m.roomId});
  else wsSend({type:'react',messageId:m.id,emoji,withUserId:S.activeChat.id});
}

function doDelete(m) {
  if(S.activeChat.type==='room') wsSend({type:'delete_message',messageId:m.id,roomId:m.roomId});
  else wsSend({type:'delete_message',messageId:m.id,withUserId:m.from===S.me.id?m.to:m.from});
}

function showReactionPicker(e, m) {
  S.reactionTarget=m;
  const picker=$('reactionPicker'); picker.classList.remove('hidden');
  const rect=e.target.getBoundingClientRect();
  picker.style.top=(rect.top-52)+'px';
  picker.style.left=Math.min(rect.left,window.innerWidth-240)+'px';
}

/* ══════════════════════ ROOM MODALS ════════════════════════════════════ */
function populateJoinSelect() {
  const sel=$('joinRoomSelect');
  const currentVal=sel.value;
  sel.innerHTML='<option value="">— Select a room —</option>';
  S.rooms.forEach(r=>{
    if(!S.myRooms.has(r.id)){
      const opt=document.createElement('option'); opt.value=r.id; opt.textContent=`${r.name} (${r.memberCount} members)`;
      sel.appendChild(opt);
    }
  });
  if(currentVal) sel.value=currentVal;
}

function openJoinModal(preRoomId=null) {
  populateJoinSelect();
  if(preRoomId) $('joinRoomSelect').value=preRoomId;
  $('joinTokenInput').value=''; $('joinRoomErr').textContent='';
  $('joinRoomModal').classList.remove('hidden');
  $('joinTokenInput').focus();
}

window.generateToken = function() {
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const tok=Array.from({length:8},()=>chars[Math.floor(Math.random()*chars.length)]).join('');
  $('roomTokenInput').value=tok;
  $('tokenDisplay').textContent=tok;
  $('tokenPreview').classList.remove('hidden');
};

window.copyToken = function() {
  navigator.clipboard.writeText($('roomTokenInput').value).then(()=>toast('Token copied!','success'));
};

/* ══════════════════════ LIGHTBOX ═══════════════════════════════════════ */
function openLightbox(type, src) {
  $('lightboxContent').innerHTML=type==='img'?`<img src="${src}"/>`:`<video src="${src}" controls autoplay></video>`;
  $('lightbox').classList.remove('hidden');
}
function closeLightbox() { $('lightbox').classList.add('hidden'); $('lightboxContent').innerHTML=''; }

/* ══════════════════════ MOBILE ═════════════════════════════════════════ */
function toggleSidebar() {
  const sb=$('sidebar'), ov=$('sidebarOverlay');
  sb.classList.toggle('open'); ov.classList.toggle('hidden',!sb.classList.contains('open'));
}
function closeSidebar() {
  $('sidebar').classList.remove('open'); $('sidebarOverlay').classList.add('hidden');
}
window.toggleSidebar=toggleSidebar;
window.closeSidebar=closeSidebar;

/* ══════════════════════ EVENT LISTENERS ════════════════════════════════ */

// Login
$('loginBtn').onclick=()=>{
  const username=$('usernameInput').value.trim();
  if(username.length<2){$('loginError').textContent='Name must be at least 2 chars.';return;}
  $('loginError').textContent='';
  S.avatarCfg.outfit=S.avatarCfg.outfit||'#667eea';
  const avatarStr=encodeAvatar(S.avatarCfg);
  connectWS();
  S.ws.onopen=()=>{ wsSend({type:'register',username,avatar:avatarStr,color:S.avatarCfg.outfit}); };
};
$('usernameInput').onkeydown=e=>{ if(e.key==='Enter') $('loginBtn').click(); };

// Logout
$('logoutBtn').onclick=()=>{
  S.me=null; S.ws?.close(); S.users.clear(); S.rooms.clear(); S.chats.clear(); S.unread.clear(); S.myRooms.clear(); S.activeChat=null;
  $('appScreen').classList.remove('active'); $('loginScreen').classList.add('active');
};

// Close chat
$('closeChatBtn').onclick=closeChat;

// Tabs
document.querySelectorAll('.tab-btn').forEach(btn=>{
  btn.onclick=()=>{
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c=>{c.classList.remove('active');c.classList.add('hidden');});
    btn.classList.add('active');
    const t=document.getElementById(`tab-${btn.dataset.tab}`);
    t.classList.remove('hidden'); t.classList.add('active');
  };
});

// Search
let searchTimer=null;
$('searchInput').oninput=()=>{
  const q=$('searchInput').value.trim();
  $('clearSearch').classList.toggle('hidden',!q);
  clearTimeout(searchTimer);
  if(q.length>=1) searchTimer=setTimeout(()=>wsSend({type:'search',query:q}),280);
  else { $('searchResults').classList.add('hidden'); renderUserList(); }
};
$('clearSearch').onclick=()=>{ $('searchInput').value=''; $('clearSearch').classList.add('hidden'); $('searchResults').classList.add('hidden'); renderUserList(); };

// Send
$('sendBtn').onclick=sendMessage;
$('messageInput').onkeydown=e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();} };
let typingTimeout=null;
$('messageInput').oninput=()=>{
  $('messageInput').style.height='auto';
  $('messageInput').style.height=Math.min($('messageInput').scrollHeight,120)+'px';
  clearTimeout(typingTimeout);
  if(S.activeChat){
    if(S.activeChat.type==='dm') wsSend({type:'typing',to:S.activeChat.id,isTyping:true});
    else wsSend({type:'typing',roomId:S.activeChat.id,isTyping:true});
  }
  typingTimeout=setTimeout(()=>{
    if(S.activeChat){
      if(S.activeChat.type==='dm') wsSend({type:'typing',to:S.activeChat.id,isTyping:false});
      else wsSend({type:'typing',roomId:S.activeChat.id,isTyping:false});
    }
  },2500);
};

// Emoji
const emojiPicker=$('emojiPicker');
EMOJIS.forEach(e=>{ const s=document.createElement('span'); s.textContent=e; s.onclick=()=>{ $('messageInput').value+=e; emojiPicker.classList.add('hidden'); $('messageInput').focus(); }; emojiPicker.appendChild(s); });
$('emojiToggle').onclick=()=>emojiPicker.classList.toggle('hidden');

// Files
$('imgUpload').onchange=()=>{
  const f=$('imgUpload').files[0]; if(!f) return;
  if(f.size>10*1024*1024){toast('Max 10MB','error');return;}
  const r=new FileReader(); r.onload=e=>sendMedia(e.target.result,'image'); r.readAsDataURL(f); $('imgUpload').value='';
};
$('vidUpload').onchange=()=>{
  const f=$('vidUpload').files[0]; if(!f) return;
  if(f.size>50*1024*1024){toast('Max 50MB','error');return;}
  const r=new FileReader(); r.onload=e=>sendMedia(e.target.result,'video'); r.readAsDataURL(f); $('vidUpload').value='';
};
document.addEventListener('paste',e=>{
  if(!S.activeChat) return;
  for(const item of (e.clipboardData?.items||[])){
    if(item.type.startsWith('image/')){const r=new FileReader();r.onload=ev=>sendMedia(ev.target.result,'image');r.readAsDataURL(item.getAsFile());}
  }
});

// Lightbox
$('lightboxClose').onclick=closeLightbox;
$('lightboxOverlay').onclick=closeLightbox;

// Reaction picker
$('reactionPicker').querySelectorAll('span').forEach(s=>{
  s.onclick=e=>{ e.stopPropagation(); if(S.reactionTarget){doReact(S.reactionTarget,s.dataset.emoji);S.reactionTarget=null;} $('reactionPicker').classList.add('hidden'); };
});

// Members button
$('membersBtn').onclick=()=>{
  if(S.activeChat?.type==='room') wsSend({type:'get_room_members',roomId:S.activeChat.id});
};
$('closeMembersBtn').onclick=()=>$('membersModal').classList.add('hidden');

// Create room modal
$('createRoomBtn').onclick=()=>{ $('roomNameInput').value=''; $('roomTokenInput').value=''; $('createRoomErr').textContent=''; $('tokenPreview').classList.add('hidden'); $('createRoomModal').classList.remove('hidden'); $('roomNameInput').focus(); };
$('cancelRoomBtn').onclick=()=>$('createRoomModal').classList.add('hidden');
$('confirmRoomBtn').onclick=()=>{
  const name=$('roomNameInput').value.trim();
  const token=$('roomTokenInput').value.trim();
  if(name.length<2){$('createRoomErr').textContent='Room name must be 2+ chars.';return;}
  if(token.length<4){$('createRoomErr').textContent='Token must be at least 4 chars.';return;}
  wsSend({type:'create_room',name,token});
  $('createRoomModal').classList.add('hidden');
};
$('roomNameInput').onkeydown=e=>{ if(e.key==='Enter') $('roomTokenInput').focus(); };
$('roomTokenInput').oninput=()=>{
  const t=$('roomTokenInput').value.trim();
  if(t.length>=4){$('tokenDisplay').textContent=t;$('tokenPreview').classList.remove('hidden');}
  else $('tokenPreview').classList.add('hidden');
};

// Join room modal
$('joinRoomBtn').onclick=()=>openJoinModal();
$('cancelJoinBtn').onclick=()=>$('joinRoomModal').classList.add('hidden');
$('confirmJoinBtn').onclick=()=>{
  const roomId=$('joinRoomSelect').value;
  const token=$('joinTokenInput').value.trim();
  if(!roomId){$('joinRoomErr').textContent='Please select a room.';return;}
  if(token.length<4){$('joinRoomErr').textContent='Enter the room token (4+ chars).';return;}
  wsSend({type:'join_room',roomId,token});
  $('joinRoomModal').classList.add('hidden');
  $('joinRoomErr').textContent='';
};
$('joinTokenInput').onkeydown=e=>{ if(e.key==='Enter') $('confirmJoinBtn').click(); };

// Edit profile
$('editProfileBtn').onclick=()=>{
  if(!S.me) return;
  S.editCfg=decodeAvatar(S.me.avatar);
  // sync pill/swatch states
  ['gender','skin','hair','outfit'].forEach(key=>{
    document.querySelectorAll(`[data-ekey="${key}"]`).forEach(b=>{
      b.classList.toggle('active', b.dataset.val===S.editCfg[key]);
    });
  });
  refreshEditPreview();
  $('editProfileModal').classList.remove('hidden');
};
$('cancelProfileBtn').onclick=()=>$('editProfileModal').classList.add('hidden');
$('saveProfileBtn').onclick=()=>{
  if(!S.editCfg) return;
  const avatarStr=encodeAvatar(S.editCfg);
  wsSend({type:'update_profile',avatar:avatarStr,color:S.editCfg.outfit});
  $('editProfileModal').classList.add('hidden');
  toast('Profile updated!','success');
};

// Close modals on backdrop click
['createRoomModal','joinRoomModal','editProfileModal','membersModal'].forEach(id=>{
  $(id).addEventListener('click',e=>{ if(e.target===e.currentTarget) $(id).classList.add('hidden'); });
});

// Close pickers on outside click
document.addEventListener('click',e=>{
  if(!emojiPicker.contains(e.target)&&e.target!==$('emojiToggle')) emojiPicker.classList.add('hidden');
  if(!$('reactionPicker').contains(e.target)) $('reactionPicker').classList.add('hidden');
});

// Edit profile my-profile click
$('myProfile').onclick=()=>$('editProfileBtn').click();

})();
