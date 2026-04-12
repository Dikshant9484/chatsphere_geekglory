# 💬 ChatSphere v2 — Real-Time Chat App

A production-ready chat application with group rooms, reactions, read receipts, and more.

## ✨ What's New in v2

| Feature | Details |
|---|---|
| **Group Rooms** | Create/join rooms like `# general`, `# design-team` etc. |
| **Message Reactions** | React with emoji (👍 ❤️ 😂 🔥 🎉 and more) |
| **Message Deletion** | Delete your own messages for all parties |
| **Read Receipts** | See when your DMs have been read (✓ → ✓✓) |
| **Profile Editing** | Change avatar & color without logging out |
| **Rate Limiting** | Per-user rate limiting to prevent spam |
| **Health Check** | `/health` endpoint for uptime monitoring |
| **Graceful Shutdown** | SIGTERM/SIGINT handling for zero-downtime restarts |
| **`.env` Config** | All limits configurable via environment variables |
| **Room Management** | Auto-delete empty rooms, member counts, leave rooms |
| **Typing in Rooms** | Typing indicators work in group rooms too |

## 🚀 Quick Start

```bash
npm install
cp .env.example .env   # edit if needed
npm start
```

Open `http://localhost:3000` — open multiple tabs to test.

## 🏗️ Project Structure

```
chat-app/
├── server.js          # Node.js + Express + WebSocket server
├── package.json
├── .env.example       # Config template
├── .gitignore
└── public/
    ├── index.html
    ├── style.css
    └── app.js
```

## ⚙️ Configuration (.env)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP/WS port |
| `RATE_LIMIT` | `30` | Max messages per window |
| `RATE_WINDOW` | `10000` | Rate window in ms |
| `MAX_MSG_LEN` | `4000` | Max message length |
| `MAX_HISTORY` | `200` | Messages stored per chat |
| `MAX_ROOMS` | `20` | Max concurrent rooms |

## 🌐 Deployment

### Railway / Render / Fly.io
Set `PORT` env var, push repo, done. The health endpoint at `/health` works for health checks.

### Docker
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

### nginx reverse proxy (for HTTPS/WSS)
```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
}
```

## 🔌 WebSocket API

### Client → Server

| Type | Payload | Description |
|---|---|---|
| `register` | `{ username, avatar, color }` | Join / re-join |
| `message` | `{ to, content, contentType }` | Send DM |
| `room_message` | `{ roomId, content, contentType }` | Send room message |
| `create_room` | `{ name }` | Create new room |
| `join_room` | `{ roomId }` | Join existing room |
| `leave_room` | `{ roomId }` | Leave room |
| `search` | `{ query }` | Search users |
| `typing` | `{ to?, roomId?, isTyping }` | Typing indicator |
| `react` | `{ messageId, emoji, roomId?, withUserId? }` | React to message |
| `delete_message` | `{ messageId, roomId?, withUserId? }` | Delete message |
| `read` | `{ messageId, fromUserId }` | Mark DM as read |
| `update_profile` | `{ avatar?, color? }` | Update profile |
| `load_history` | `{ with }` | Load DM history |
| `load_room_history` | `{ roomId }` | Load room history |

## 🛡️ Security Notes

- XSS prevention via HTML escaping on the client
- Rate limiting per user (configurable)
- Input validation & length caps
- Media sent as base64 (no server-side storage)
- In-memory only — add a DB for persistence
- Add JWT auth for production identity management
