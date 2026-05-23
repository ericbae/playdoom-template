const ROOM_RE = /^[0-9a-f]{64}-[0-9a-f]{8}$/i;
const DEFAULT_DEV_KEY = "local-development-room-signing-key";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const needsRoomKey = url.pathname === "/api/newroom" || /^\/api\/(?:room|ws)\//.test(url.pathname);
    const roomKey = needsRoomKey ? getRoomKey(env, url.hostname) : "";

    if (url.pathname === "/api/health") {
      return json({ ok: true });
    }

    if (needsRoomKey && !roomKey) {
      return json({ error: "DOOM_KEY is required" }, 500);
    }

    if (url.pathname === "/api/newroom") {
      return json({ room: await createRoom(env, roomKey) }, 201);
    }

    const roomMatch = url.pathname.match(/^\/api\/(?:room|ws)\/([^/]+)$/);
    if (roomMatch) {
      const room = roomMatch[1];
      const id = await checkRoom(room, env, roomKey);

      if (!id) {
        return json({ error: "Invalid room" }, 404);
      }

      return env.ROOMS.get(id).fetch(request);
    }

    if (url.pathname.startsWith("/api/")) {
      return json({ error: "Not found" }, 404);
    }

    return env.ASSETS.fetch(request);
  }
};

export class DoomRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = [];
    this.gameStarted = false;
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/ws/")) {
      return this.handleWebSocket(request);
    }

    if (url.pathname.startsWith("/api/room/") && request.method === "POST") {
      this.gameStarted = true;
      await this.state.storage.put("gameStarted", true);
      return json({ ok: true, started: true });
    }

    if (url.pathname.startsWith("/api/room/")) {
      const storedStarted = await this.state.storage.get("gameStarted");
      return json({
        ok: true,
        started: Boolean(this.gameStarted || storedStarted),
        players: this.sessions.length
      });
    }

    return json({ error: "Not found" }, 404);
  }

  async handleWebSocket(request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return json({ error: "Expected websocket" }, 426);
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();

    const session = { ws: server, from: undefined };

    server.addEventListener("message", async (event) => {
      if (!(event.data instanceof ArrayBuffer) || event.data.byteLength < 8) {
        return;
      }

      const view = new DataView(event.data);
      const to = view.getUint32(0, true);
      const from = view.getUint32(4, true);

      if (from === 1 && to === 0) {
        for (const oldSession of this.sessions) {
          if (oldSession.ws !== server) {
            closeQuietly(oldSession.ws);
          }
        }

        this.sessions = [];
        this.gameStarted = false;
        await this.state.storage.delete("gameStarted");
      }

      if (session.from === undefined) {
        session.from = from;
        this.sessions.push(session);
      }

      const target = this.sessions.find((candidate) => candidate.from === to);
      if (target) {
        target.ws.send(event.data.slice(4));
      }
    });

    const removeSession = () => {
      this.sessions = this.sessions.filter((candidate) => candidate !== session);
    };

    server.addEventListener("close", removeSession);
    server.addEventListener("error", removeSession);

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }
}

async function createRoom(env, roomKey) {
  const id = env.ROOMS.newUniqueId();
  const digest = await sign(id.toString(), roomKey);

  return `${id}-${digest}`;
}

async function checkRoom(room, env, roomKey) {
  if (!ROOM_RE.test(room)) {
    return null;
  }

  const [idString, hash] = room.split("-");
  const expected = await sign(idString, roomKey);

  if (hash !== expected) {
    return null;
  }

  return env.ROOMS.idFromString(idString);
}

async function sign(value, key) {
  const payload = new TextEncoder().encode(`${key}:${value}`);
  const digest = await crypto.subtle.digest("SHA-256", payload);
  const bytes = [...new Uint8Array(digest.slice(0, 4))];

  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getRoomKey(env, hostname) {
  if (env.DOOM_KEY) {
    return env.DOOM_KEY;
  }

  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]") {
    return DEFAULT_DEV_KEY;
  }

  return "";
}

function closeQuietly(socket) {
  try {
    socket.close(1012, "Game restarted");
  } catch {
    // The socket may already be closed.
  }
}

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
