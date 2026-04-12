/* ═══════════════════════════════════════════════════════════════════════
   ChatSphere v2 — Frontend
   New: Group Rooms, Reactions, Message Deletion, Read Receipts,
        Profile Editing, Context Menu, Room Management
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────────
  const S = {
    ws: null,
    me: null,
    users: new Map(),
    rooms: new Map(),     // roomId -> room info
    myRooms: new Set(),   // roomIds I've joined
    activeChat: null,     // { type: 'dm'|'room', id }
    chats: new Map(),     // dmKey(me,peer) or roomId -> [messages]
    unread: new Map(),    // chatId -> count
    typingTimers: new Map(),
    selectedAvatar: '😀',
    selectedColor: '#6C63FF',
    editAvatar: null,
    editColor: null,
    wsRetries: 0,
    ctxTarget: null,      // { messageId, type, peerId, roomId }
  };

  // ── Emoji library ──────────────────────────────────────────────────────
  const EMOJIS = [
    '😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰',
    '😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🥸','🤩','🥳',
    '😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤',
    '😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫',
    '🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵',
    '💀','☠️','👻','👽','🤖','💩','😺','😸','😹','😻','😼','😽','🙀','😿','😾',
    '👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👍','👎','✊',
    '👏','🙌','👐','🤲','🤝','🙏','💅','💪','❤️','🧡','💛','💚','💙','💜','🖤','🤍',
    '💔','❤️‍🔥','💕','💞','💓','💗','💖','💘','💝','🌈','⭐','🌟','✨','🎉','🎊','🎈',
    '🏆','🥇','🎯','🎮','🎲','🔥','💯','💢','💥','💫','💦','🌊','🚀','🛸','🌍','🌙',
    '⚡','☀️','🌤️','⛅','🌧️','❄️','🌬️','💨','🌪️','☔','🎭','🦄','🐉','🌺','🦊','🐼',
  ];

  // ── DOM refs ───────────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const el = {
    loginScreen:    $('loginScreen'),
    appScreen:      $('appScreen'),
    usernameInput:  $('usernameInput'),
    loginBtn:       $('loginBtn'),
    loginError:     $('loginError'),
    avatarPicker:   $('avatarPicker'),
    colorPicker:    $('colorPicker'),
    myAvatar:       $('myAvatar'),
    myName:         $('myName'),
    logoutBtn:      $('logoutBtn'),
    editProfileBtn: $('editProfileBtn'),
    searchInput:    $('searchInput'),
    clearSearch:    $('clearSearch'),
    userList:       $('userList'),
    searchResults:  $('searchResults'),
    searchList:     $('searchList'),
    roomList:       $('roomList'),
    emptyState:     $('emptyState'),
    chatWindow:     $('chatWindow'),
    peerAvatar:     $('peerAvatar'),
    peerName:       $('peerName'),
    peerStatus:     $('peerStatus'),
    closeChatBtn:   $('closeChatBtn'),
    messagesInner:  $('messagesInner'),
    messagesArea:   $('messagesArea'),
    typingBar:      $('typingBar'),
    typingName:     $('typingName'),
    messageInput:   $('messageInput'),
    sendBtn:        $('sendBtn'),
    emojiToggle:    $('emojiToggle'),
    emojiPicker:    $('emojiPicker'),
    imgUpload:      $('imgUpload'),
    vidUpload:      $('vidUpload'),
    lightbox:       $('lightbox'),
    lightboxContent:$('lightboxContent'),
    lightboxClose:  $('lightboxClose'),
    lightboxOverlay:$('lightboxOverlay'),
    toastContainer: $('toastContainer'),
    createRoomBtn:  $('createRoomBtn'),
    createRoomModal:$('createRoomModal'),
    roomNameInput:  $('roomNameInput'),
    cancelRoomBtn:  $('cancelRoomBtn'),
    confirmRoomBtn: $('confirmRoomBtn'),
    editProfileModal:$('editProfileModal'),
    editAvatarPicker:$('editAvatarPicker'),
    editColorPicker:$('editColorPicker'),
    cancelProfileBtn:$('cancelProfileBtn'),
    saveProfileBtn: $('saveProfileBtn'),
    ctxMenu:        $('ctxMenu'),
    ctxReact:       $('ctx-react'),
    ctxDelete:      $('ctx-delete'),
    ctxCopy:        $('ctx-copy'),
    reactionPicker: $('reactionPicker'),
  };

  // ── Helpers ────────────────────────────────────────────────────────────
  function toast(msg, type = 'info') {
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    el.toastContainer.appendChild(t);
    setTimeout(() => t.remove(), 4000);
  }
  function formatTime(ts) { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  function formatDate(ts) {
    const d = new Date(ts), today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Today';
    const yest = new Date(today); yest.setDate(today.getDate()-1);
    if (d.toDateString() === yest.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
  function isEmojiOnly(text) { return /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\s)+$/u.test(text.trim()); }
  function esc(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }
  function scrollBottom() { requestAnimationFrame(() => { el.messagesArea.scrollTop = el.messagesArea.scrollHeight; }); }
  function chatKey(id) { if (!id) return null; return id; } // room: roomId, dm: sorted pair
  function dmChatKey(a, b) { return [a,b].sort().join('::'); }
  function activeChatKey() {
    if (!S.activeChat) return null;
    return S.activeChat.type === 'room' ? S.activeChat.id : dmChatKey(S.me.id, S.activeChat.id);
  }

  // ── WebSocket ──────────────────────────────────────────────────────────
  function connectWS() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    S.ws = new WebSocket(`${proto}://${location.host}`);
    S.ws.onopen = () => {
      S.wsRetries = 0;
      if (S.me) wsSend({ type: 'register', username: S.me.username, avatar: S.me.avatar, color: S.me.color });
    };
    S.ws.onmessage = (e) => handleMsg(JSON.parse(e.data));
    S.ws.onclose = () => {
      if (S.me && S.wsRetries < 10) { S.wsRetries++; setTimeout(connectWS, Math.min(1000 * S.wsRetries, 8000)); }
    };
    S.ws.onerror = () => {};
  }
  function wsSend(data) { if (S.ws && S.ws.readyState === WebSocket.OPEN) S.ws.send(JSON.stringify(data)); }

  // ── Message Handlers ───────────────────────────────────────────────────
  function handleMsg(msg) {
    switch (msg.type) {
      case 'registered': {
        S.me = msg.user;
        S.users.clear();
        msg.users.forEach(u => S.users.set(u.id, u));
        S.rooms.clear();
        msg.rooms.forEach(r => S.rooms.set(r.id, r));
        S.myRooms.clear();
        (msg.myRooms || []).forEach(r => { S.myRooms.add(r.id); S.rooms.set(r.id, r); });
        el.myAvatar.textContent = S.me.avatar;
        el.myName.textContent   = S.me.username;
        renderUserList();
        renderRoomList();
        loginScreen(false);
        break;
      }
      case 'error': toast(msg.message, 'error'); break;
      case 'server_shutdown': toast(msg.message, 'error'); break;

      case 'user_joined': {
        S.users.set(msg.user.id, msg.user);
        renderUserList();
        toast(`${msg.user.avatar} ${msg.user.username} joined`);
        break;
      }
      case 'user_status': {
        const u = S.users.get(msg.userId); if (!u) return;
        u.status = msg.status; u.lastSeen = msg.lastSeen;
        renderUserList();
        updatePeerStatus();
        break;
      }
      case 'user_updated': {
        const u = S.users.get(msg.user.id); if (u) { Object.assign(u, msg.user); renderUserList(); updatePeerStatus(); }
        break;
      }
      case 'profile_updated': {
        S.me = msg.user;
        el.myAvatar.textContent = S.me.avatar;
        el.myName.textContent   = S.me.username;
        break;
      }
      case 'user_list': { S.users.clear(); msg.users.forEach(u => S.users.set(u.id, u)); renderUserList(); break; }
      case 'search_results': renderSearchResults(msg.results); break;

      // DM
      case 'message': {
        const m = msg.message;
        const key = dmChatKey(m.from, m.to);
        if (!S.chats.has(key)) S.chats.set(key, []);
        S.chats.get(key).push(m);
        const isActive = S.activeChat?.type === 'dm' && (S.activeChat.id === m.from || S.activeChat.id === m.to) && m.from !== S.me.id;
        if (S.activeChat?.type === 'dm' && (S.activeChat.id === m.from || S.activeChat.id === m.to)) {
          appendMsg(m, false);
          if (m.from !== S.me.id) wsSend({ type: 'read', messageId: m.id, fromUserId: m.from });
        } else if (m.from !== S.me.id) {
          const cnt = (S.unread.get(m.from) || 0) + 1;
          S.unread.set(m.from, cnt);
          renderUserList();
          const sender = S.users.get(m.from);
          if (sender) toast(`${sender.avatar} ${sender.username}: ${m.contentType === 'text' ? m.content.slice(0,40) : '📎 media'}`);
        }
        break;
      }
      case 'history': {
        const key = dmChatKey(S.me.id, msg.with);
        S.chats.set(key, msg.messages);
        if (S.activeChat?.type === 'dm' && S.activeChat.id === msg.with) renderMessages();
        break;
      }
      case 'read_receipt': {
        const msgEl = document.querySelector(`[data-msgid="${msg.messageId}"] .msg-read`);
        if (msgEl) msgEl.textContent = '✓✓';
        break;
      }

      // Rooms
      case 'rooms_updated': { msg.rooms.forEach(r => S.rooms.set(r.id, r)); renderRoomList(); break; }
      case 'room_list':    { S.rooms.clear(); msg.rooms.forEach(r => S.rooms.set(r.id, r)); renderRoomList(); break; }
      case 'room_created': { S.rooms.set(msg.room.id, msg.room); S.myRooms.add(msg.room.id); renderRoomList(); break; }
      case 'room_joined':  {
        S.myRooms.add(msg.room.id); S.rooms.set(msg.room.id, msg.room);
        S.chats.set(msg.room.id, msg.history || []);
        renderRoomList();
        if (S.activeChat?.id === msg.room.id) renderMessages();
        break;
      }
      case 'room_left': { S.myRooms.delete(msg.roomId); renderRoomList(); if (S.activeChat?.id === msg.roomId) closeChat(); break; }
      case 'room_member_count': { const r = S.rooms.get(msg.roomId); if (r) { r.memberCount = msg.count; renderRoomList(); } break; }
      case 'room_message': {
        const m = msg.message;
        if (!S.chats.has(m.roomId)) S.chats.set(m.roomId, []);
        S.chats.get(m.roomId).push(m);
        if (S.activeChat?.type === 'room' && S.activeChat.id === m.roomId) appendMsg(m, false);
        else if (m.from !== S.me.id) {
          const cnt = (S.unread.get(m.roomId) || 0) + 1;
          S.unread.set(m.roomId, cnt);
          renderRoomList();
          toast(`${m.senderAvatar} ${m.senderName} [${S.rooms.get(m.roomId)?.name}]: ${m.contentType === 'text' ? m.content.slice(0,40) : '📎 media'}`);
        }
        break;
      }
      case 'room_history': {
        S.chats.set(msg.roomId, msg.messages);
        if (S.activeChat?.type === 'room' && S.activeChat.id === msg.roomId) renderMessages();
        break;
      }

      // Reactions & delete
      case 'reaction_updated': updateReactions(msg.messageId, msg.reactions); break;
      case 'message_deleted': markDeleted(msg.messageId); break;

      case 'typing': {
        const key = msg.roomId || msg.from;
        if (msg.roomId && S.activeChat?.id !== msg.roomId) break;
        if (!msg.roomId && S.activeChat?.id !== msg.from) break;
        clearTimeout(S.typingTimers.get(key));
        if (msg.isTyping) {
          el.typingName.textContent = msg.fromName || 'Someone';
          el.typingBar.classList.remove('hidden');
          S.typingTimers.set(key, setTimeout(() => el.typingBar.classList.add('hidden'), 3500));
        } else {
          el.typingBar.classList.add('hidden');
        }
        break;
      }
    }
  }

  // ── Rendering ──────────────────────────────────────────────────────────
  function renderUserList() {
    const query = el.searchInput.value.trim().toLowerCase();
    el.userList.innerHTML = '';
    const sorted = [...S.users.values()].filter(u => u.id !== S.me.id).sort((a, b) => {
      if (a.status === b.status) return a.username.localeCompare(b.username);
      return a.status === 'online' ? -1 : 1;
    });
    sorted.forEach(u => {
      if (query && !u.username.toLowerCase().includes(query)) return;
      const unread = S.unread.get(u.id) || 0;
      const div = document.createElement('div');
      div.className = 'user-item' + (S.activeChat?.type === 'dm' && S.activeChat.id === u.id ? ' active' : '');
      div.innerHTML = `
        <div class="user-av" style="color:${u.color}">${u.avatar}</div>
        <div class="user-info">
          <div class="user-name">${esc(u.username)}</div>
          <div class="user-sub">${u.status === 'online' ? 'Online' : 'Offline'}</div>
        </div>
        <div class="user-status-indicator ${u.status}"></div>
        ${unread ? `<div class="unread-badge">${unread}</div>` : ''}
      `;
      div.onclick = () => openDM(u.id);
      el.userList.appendChild(div);
    });
  }

  function renderRoomList() {
    el.roomList.innerHTML = '';
    S.rooms.forEach((room) => {
      const joined = S.myRooms.has(room.id);
      const unread = S.unread.get(room.id) || 0;
      const isActive = S.activeChat?.type === 'room' && S.activeChat.id === room.id;
      const div = document.createElement('div');
      div.className = 'room-item' + (isActive ? ' active' : '');
      div.innerHTML = `
        <div class="room-item-left">
          <span class="room-name">${esc(room.name)}</span>
          ${unread ? `<span class="unread-badge">${unread}</span>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:4px;">
          <span class="room-count">${room.memberCount}</span>
          ${joined && room.id !== 'lobby' ? `<span class="room-leave" title="Leave" data-rid="${room.id}">✕</span>` : ''}
        </div>
      `;
      div.onclick = (e) => {
        if (e.target.classList.contains('room-leave')) {
          e.stopPropagation();
          wsSend({ type: 'leave_room', roomId: room.id });
          return;
        }
        if (joined) openRoom(room.id);
        else { wsSend({ type: 'join_room', roomId: room.id }); }
      };
      el.roomList.appendChild(div);
    });
  }

  function renderSearchResults(results) {
    el.searchList.innerHTML = '';
    if (!results.length) { el.searchList.innerHTML = '<div style="padding:12px;color:var(--text-muted);font-size:13px;">No results found</div>'; }
    results.forEach(u => {
      const div = document.createElement('div');
      div.className = 'user-item';
      div.innerHTML = `<div class="user-av">${u.avatar}</div><div class="user-info"><div class="user-name">${esc(u.username)}</div></div>`;
      div.onclick = () => { openDM(u.id); el.searchResults.classList.add('hidden'); el.searchInput.value = ''; el.clearSearch.classList.add('hidden'); };
      el.searchList.appendChild(div);
    });
    el.searchResults.classList.remove('hidden');
  }

  function renderMessages() {
    el.messagesInner.innerHTML = '';
    const key = activeChatKey(); if (!key) return;
    const msgs = S.chats.get(key) || [];
    let lastDate = null;
    msgs.forEach(m => {
      const d = formatDate(m.timestamp);
      if (d !== lastDate) { lastDate = d; const div = document.createElement('div'); div.className = 'date-divider'; div.textContent = d; el.messagesInner.appendChild(div); }
      el.messagesInner.appendChild(buildMsgEl(m));
    });
    scrollBottom();
  }

  function appendMsg(m, scroll = true) {
    const key = activeChatKey();
    const msgs = S.chats.get(key) || [];
    const existing = document.querySelector(`[data-msgid="${m.id}"]`);
    if (!existing) {
      const last = msgs[msgs.length - 2];
      if (!last || formatDate(last.timestamp) !== formatDate(m.timestamp)) {
        const div = document.createElement('div'); div.className = 'date-divider'; div.textContent = formatDate(m.timestamp);
        el.messagesInner.appendChild(div);
      }
      el.messagesInner.appendChild(buildMsgEl(m));
    }
    if (scroll) scrollBottom();
  }

  function buildMsgEl(m) {
    const mine = m.from === S.me.id;
    const deleted = m.deleted;
    const row = document.createElement('div');
    row.className = `msg-row${mine ? ' mine' : ''}`;
    row.dataset.msgid = m.id;

    let contentHTML = '';
    if (deleted) {
      contentHTML = `<span class="msg-deleted">🗑 Message deleted</span>`;
    } else if (m.contentType === 'image') {
      contentHTML = `<img class="msg-img" src="${m.content}" alt="image" />`;
    } else if (m.contentType === 'video') {
      contentHTML = `<video class="msg-video" src="${m.content}" controls></video>`;
    } else {
      const emojiOnly = isEmojiOnly(m.content);
      contentHTML = `<div class="msg-bubble${emojiOnly ? ' emoji-only' : ''}" style="${!mine && !emojiOnly ? '' : (!emojiOnly ? `background:${m.senderColor}` : '')}">${esc(m.content)}</div>`;
    }

    // Reactions
    let reactionsHTML = '';
    if (m.reactions && Object.keys(m.reactions).length) {
      reactionsHTML = '<div class="msg-reactions">';
      for (const [emoji, users] of Object.entries(m.reactions)) {
        const isMine = users.includes(S.me.id);
        reactionsHTML += `<span class="reaction-pill${isMine ? ' mine' : ''}" data-emoji="${emoji}" data-msgid="${m.id}">
          ${emoji}<span class="reaction-count">${users.length}</span></span>`;
      }
      reactionsHTML += '</div>';
    }

    const readHTML = mine && !deleted ? `<span class="msg-read" title="Sent">✓</span>` : '';
    const actionsHTML = !deleted ? `
      <div class="msg-actions">
        <button class="msg-action-btn" data-action="react" title="React">😊</button>
        ${mine ? `<button class="msg-action-btn" data-action="delete" title="Delete">🗑</button>` : ''}
        <button class="msg-action-btn" data-action="copy" title="Copy">📋</button>
      </div>` : '';

    row.innerHTML = `
      <div class="msg-av">${m.senderAvatar}</div>
      <div class="msg-body">
        ${!mine ? `<div class="msg-sender" style="color:${m.senderColor}">${esc(m.senderName)}</div>` : ''}
        <div class="msg-content-wrap" style="position:relative;">
          ${actionsHTML}
          ${contentHTML}
        </div>
        ${reactionsHTML}
        <div class="msg-meta">
          <span class="msg-time">${formatTime(m.timestamp)}</span>
          ${readHTML}
        </div>
      </div>
    `;

    // Click image/video -> lightbox
    const img = row.querySelector('.msg-img');
    if (img) img.onclick = () => openLightbox('img', m.content);
    const vid = row.querySelector('.msg-video');
    if (vid) vid.onclick = (e) => { e.preventDefault(); openLightbox('video', m.content); };

    // Action buttons
    row.querySelectorAll('.msg-action-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        if (action === 'copy') { navigator.clipboard.writeText(m.content).then(() => toast('Copied!')); }
        else if (action === 'delete') { confirmDelete(m); }
        else if (action === 'react') { showReactionPicker(e, m); }
      };
    });

    // Reaction pill clicks
    row.querySelectorAll('.reaction-pill').forEach(pill => {
      pill.onclick = () => sendReaction(m, pill.dataset.emoji);
    });

    return row;
  }

  function updateReactions(messageId, reactions) {
    const row = document.querySelector(`[data-msgid="${messageId}"]`); if (!row) return;
    // Find the message to update it
    S.chats.forEach(msgs => {
      const m = msgs.find(m => m.id === messageId);
      if (m) m.reactions = reactions;
    });
    let wrap = row.querySelector('.msg-reactions');
    if (!wrap) { wrap = document.createElement('div'); wrap.className = 'msg-reactions'; row.querySelector('.msg-body').insertBefore(wrap, row.querySelector('.msg-meta')); }
    wrap.innerHTML = '';
    for (const [emoji, users] of Object.entries(reactions)) {
      if (!users.length) continue;
      const isMine = users.includes(S.me.id);
      const pill = document.createElement('span');
      pill.className = `reaction-pill${isMine ? ' mine' : ''}`;
      pill.dataset.emoji = emoji;
      pill.innerHTML = `${emoji}<span class="reaction-count">${users.length}</span>`;
      // find the msg
      let theMsg = null;
      S.chats.forEach(msgs => { const m = msgs.find(m => m.id === messageId); if (m) theMsg = m; });
      if (theMsg) pill.onclick = () => sendReaction(theMsg, emoji);
      wrap.appendChild(pill);
    }
  }

  function markDeleted(messageId) {
    const row = document.querySelector(`[data-msgid="${messageId}"]`); if (!row) return;
    const wrap = row.querySelector('.msg-content-wrap'); if (!wrap) return;
    wrap.innerHTML = `<span class="msg-deleted">🗑 Message deleted</span>`;
    const actWrap = row.querySelector('.msg-actions'); if (actWrap) actWrap.remove();
    S.chats.forEach(msgs => { const m = msgs.find(m => m.id === messageId); if (m) { m.deleted = true; m.content = ''; } });
  }

  function updatePeerStatus() {
    if (!S.activeChat || S.activeChat.type !== 'dm') return;
    const u = S.users.get(S.activeChat.id); if (!u) return;
    el.peerStatus.textContent = u.status === 'online' ? 'online' : `last seen ${formatTime(u.lastSeen || Date.now())}`;
  }

  // ── Chat open/close ────────────────────────────────────────────────────
  function openDM(userId) {
    S.activeChat = { type: 'dm', id: userId };
    S.unread.delete(userId);
    const u = S.users.get(userId);
    el.peerAvatar.textContent = u ? u.avatar : '?';
    el.peerName.textContent   = u ? u.username : userId;
    el.peerStatus.textContent = u?.status === 'online' ? 'online' : `last seen ${formatTime(u?.lastSeen || Date.now())}`;
    el.emptyState.classList.add('hidden');
    el.chatWindow.classList.remove('hidden');
    el.typingBar.classList.add('hidden');
    renderUserList(); renderRoomList();
    const key = dmChatKey(S.me.id, userId);
    if (S.chats.has(key)) renderMessages();
    else wsSend({ type: 'load_history', with: userId });
  }

  function openRoom(roomId) {
    S.activeChat = { type: 'room', id: roomId };
    S.unread.delete(roomId);
    const r = S.rooms.get(roomId);
    el.peerAvatar.textContent = '#';
    el.peerName.textContent   = r ? r.name : roomId;
    el.peerStatus.textContent = `${r?.memberCount || 0} members`;
    el.emptyState.classList.add('hidden');
    el.chatWindow.classList.remove('hidden');
    el.typingBar.classList.add('hidden');
    renderUserList(); renderRoomList();
    if (S.chats.has(roomId)) renderMessages();
    else wsSend({ type: 'load_room_history', roomId });
  }

  function closeChat() {
    S.activeChat = null;
    el.chatWindow.classList.add('hidden');
    el.emptyState.classList.remove('hidden');
    renderUserList(); renderRoomList();
  }

  // ── Sending ────────────────────────────────────────────────────────────
  function sendMessage() {
    const text = el.messageInput.value.trim(); if (!text || !S.activeChat) return;
    if (S.activeChat.type === 'dm') wsSend({ type: 'message', to: S.activeChat.id, content: text, contentType: 'text' });
    else wsSend({ type: 'room_message', roomId: S.activeChat.id, content: text, contentType: 'text' });
    el.messageInput.value = '';
    el.messageInput.style.height = '';
  }

  function sendMedia(dataUrl, contentType) {
    if (!S.activeChat) return;
    if (S.activeChat.type === 'dm') wsSend({ type: 'message', to: S.activeChat.id, content: dataUrl, contentType });
    else wsSend({ type: 'room_message', roomId: S.activeChat.id, content: dataUrl, contentType });
  }

  function sendReaction(m, emoji) {
    if (S.activeChat.type === 'room') wsSend({ type: 'react', messageId: m.id, emoji, roomId: m.roomId });
    else wsSend({ type: 'react', messageId: m.id, emoji, withUserId: S.activeChat.id });
  }

  function confirmDelete(m) {
    if (S.activeChat.type === 'room') wsSend({ type: 'delete_message', messageId: m.id, roomId: m.roomId });
    else wsSend({ type: 'delete_message', messageId: m.id, withUserId: m.from === S.me.id ? m.to : m.from });
  }

  // ── Reaction picker ────────────────────────────────────────────────────
  let reactionTarget = null;
  function showReactionPicker(e, m) {
    reactionTarget = m;
    const picker = el.reactionPicker;
    picker.classList.remove('hidden');
    const rect = e.target.getBoundingClientRect();
    picker.style.top  = (rect.top - 50) + 'px';
    picker.style.left = Math.min(rect.left, window.innerWidth - 220) + 'px';
  }
  el.reactionPicker.querySelectorAll('span').forEach(s => {
    s.onclick = (e) => {
      e.stopPropagation();
      if (reactionTarget) { sendReaction(reactionTarget, s.dataset.emoji); reactionTarget = null; }
      el.reactionPicker.classList.add('hidden');
    };
  });

  // ── Emoji picker ───────────────────────────────────────────────────────
  function buildEmojiPicker() {
    el.emojiPicker.innerHTML = '';
    EMOJIS.forEach(e => {
      const s = document.createElement('span'); s.textContent = e;
      s.onclick = () => { el.messageInput.value += e; el.emojiPicker.classList.add('hidden'); el.messageInput.focus(); };
      el.emojiPicker.appendChild(s);
    });
  }

  // ── Lightbox ───────────────────────────────────────────────────────────
  function openLightbox(type, src) {
    el.lightboxContent.innerHTML = type === 'img' ? `<img src="${src}" />` : `<video src="${src}" controls autoplay></video>`;
    el.lightbox.classList.remove('hidden');
  }
  function closeLightbox() { el.lightbox.classList.add('hidden'); el.lightboxContent.innerHTML = ''; }

  // ── Login screen toggle ────────────────────────────────────────────────
  function loginScreen(show) {
    if (show) { el.loginScreen.classList.add('active'); el.appScreen.classList.remove('active'); }
    else       { el.loginScreen.classList.remove('active'); el.appScreen.classList.add('active'); }
  }

  // ── Typing ─────────────────────────────────────────────────────────────
  let typingTimeout = null;
  function sendTyping(isTyping) {
    if (!S.activeChat) return;
    if (S.activeChat.type === 'dm') wsSend({ type: 'typing', to: S.activeChat.id, isTyping });
    else wsSend({ type: 'typing', roomId: S.activeChat.id, isTyping });
  }

  // ── Event listeners ────────────────────────────────────────────────────

  // Login
  el.loginBtn.onclick = () => {
    const username = el.usernameInput.value.trim();
    if (username.length < 2) { el.loginError.textContent = 'Name must be at least 2 characters.'; return; }
    el.loginError.textContent = '';
    connectWS();
    S.ws.onopen = () => { wsSend({ type: 'register', username, avatar: S.selectedAvatar, color: S.selectedColor }); };
  };
  el.usernameInput.onkeydown = (e) => { if (e.key === 'Enter') el.loginBtn.click(); };

  // Avatar/color picker login
  el.avatarPicker.querySelectorAll('.av-opt').forEach(o => o.onclick = () => {
    el.avatarPicker.querySelectorAll('.av-opt').forEach(x => x.classList.remove('selected'));
    o.classList.add('selected'); S.selectedAvatar = o.dataset.emoji;
  });
  el.colorPicker.querySelectorAll('.cl-opt').forEach(o => o.onclick = () => {
    el.colorPicker.querySelectorAll('.cl-opt').forEach(x => x.classList.remove('selected'));
    o.classList.add('selected'); S.selectedColor = o.dataset.color;
  });

  // Logout
  el.logoutBtn.onclick = () => { S.me = null; S.ws?.close(); S.users.clear(); S.rooms.clear(); S.chats.clear(); S.unread.clear(); S.myRooms.clear(); S.activeChat = null; loginScreen(true); };

  // Close chat
  el.closeChatBtn.onclick = closeChat;

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    };
  });

  // Search
  let searchTimer = null;
  el.searchInput.oninput = () => {
    const q = el.searchInput.value.trim();
    el.clearSearch.classList.toggle('hidden', !q);
    clearTimeout(searchTimer);
    if (q.length >= 1) { searchTimer = setTimeout(() => wsSend({ type: 'search', query: q }), 280); }
    else { el.searchResults.classList.add('hidden'); renderUserList(); }
  };
  el.clearSearch.onclick = () => { el.searchInput.value = ''; el.clearSearch.classList.add('hidden'); el.searchResults.classList.add('hidden'); renderUserList(); };

  // Send message
  el.sendBtn.onclick = sendMessage;
  el.messageInput.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };
  el.messageInput.oninput = () => {
    el.messageInput.style.height = 'auto';
    el.messageInput.style.height = Math.min(el.messageInput.scrollHeight, 120) + 'px';
    clearTimeout(typingTimeout);
    sendTyping(true);
    typingTimeout = setTimeout(() => sendTyping(false), 2500);
  };

  // Emoji picker
  buildEmojiPicker();
  el.emojiToggle.onclick = () => el.emojiPicker.classList.toggle('hidden');

  // File uploads
  el.imgUpload.onchange = () => {
    const f = el.imgUpload.files[0]; if (!f) return;
    if (f.size > 10 * 1024 * 1024) { toast('Max 10MB for images', 'error'); return; }
    const r = new FileReader();
    r.onload = (e) => sendMedia(e.target.result, 'image');
    r.readAsDataURL(f);
    el.imgUpload.value = '';
  };
  el.vidUpload.onchange = () => {
    const f = el.vidUpload.files[0]; if (!f) return;
    if (f.size > 50 * 1024 * 1024) { toast('Max 50MB for video', 'error'); return; }
    const r = new FileReader();
    r.onload = (e) => sendMedia(e.target.result, 'video');
    r.readAsDataURL(f);
    el.vidUpload.value = '';
  };

  // Clipboard paste
  document.addEventListener('paste', (e) => {
    if (!S.activeChat) return;
    const items = e.clipboardData?.items || [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const blob = item.getAsFile();
        const r = new FileReader();
        r.onload = (ev) => sendMedia(ev.target.result, 'image');
        r.readAsDataURL(blob);
      }
    }
  });

  // Lightbox close
  el.lightboxClose.onclick = closeLightbox;
  el.lightboxOverlay.onclick = closeLightbox;

  // Create room
  el.createRoomBtn.onclick = () => { el.createRoomModal.classList.remove('hidden'); el.roomNameInput.focus(); };
  el.cancelRoomBtn.onclick = () => { el.createRoomModal.classList.add('hidden'); el.roomNameInput.value = ''; };
  el.confirmRoomBtn.onclick = () => {
    const name = el.roomNameInput.value.trim();
    if (name.length < 2) { toast('Room name must be 2+ chars', 'error'); return; }
    wsSend({ type: 'create_room', name });
    el.createRoomModal.classList.add('hidden'); el.roomNameInput.value = '';
  };
  el.roomNameInput.onkeydown = (e) => { if (e.key === 'Enter') el.confirmRoomBtn.click(); if (e.key === 'Escape') el.cancelRoomBtn.click(); };

  // Edit profile
  el.editProfileBtn.onclick = () => {
    el.editProfileModal.classList.remove('hidden');
    S.editAvatar = S.me.avatar; S.editColor = S.me.color;
    el.editAvatarPicker.querySelectorAll('.av-opt').forEach(o => { o.classList.toggle('selected', o.dataset.emoji === S.editAvatar); });
    el.editColorPicker.querySelectorAll('.cl-opt').forEach(o => { o.classList.toggle('selected', o.dataset.color === S.editColor); });
  };
  el.editAvatarPicker.querySelectorAll('.av-opt').forEach(o => o.onclick = () => {
    el.editAvatarPicker.querySelectorAll('.av-opt').forEach(x => x.classList.remove('selected'));
    o.classList.add('selected'); S.editAvatar = o.dataset.emoji;
  });
  el.editColorPicker.querySelectorAll('.cl-opt').forEach(o => o.onclick = () => {
    el.editColorPicker.querySelectorAll('.cl-opt').forEach(x => x.classList.remove('selected'));
    o.classList.add('selected'); S.editColor = o.dataset.color;
  });
  el.cancelProfileBtn.onclick = () => el.editProfileModal.classList.add('hidden');
  el.saveProfileBtn.onclick = () => {
    wsSend({ type: 'update_profile', avatar: S.editAvatar, color: S.editColor });
    el.editProfileModal.classList.add('hidden');
    toast('Profile updated!', 'success');
  };

  // Close menus on outside click
  document.addEventListener('click', (e) => {
    if (!el.emojiPicker.contains(e.target) && e.target !== el.emojiToggle) el.emojiPicker.classList.add('hidden');
    if (!el.reactionPicker.contains(e.target)) el.reactionPicker.classList.add('hidden');
    if (!el.ctxMenu.contains(e.target)) el.ctxMenu.classList.add('hidden');
    if (e.target === el.createRoomModal) el.cancelRoomBtn.click();
    if (e.target === el.editProfileModal) el.cancelProfileBtn.click();
  });

})();
