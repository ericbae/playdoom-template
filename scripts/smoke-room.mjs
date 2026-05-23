const base = process.env.SMOKE_BASE_URL || "http://localhost:8787";
const roomResponse = await fetch(`${base}/api/newroom`);

if (!roomResponse.ok) {
  throw new Error(`Room creation failed: ${roomResponse.status}`);
}

const { room } = await roomResponse.json();
const socketBase = base.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
const host = await connect(`${socketBase}/api/ws/${room}`);
const guest = await connect(`${socketBase}/api/ws/${room}`);

host.send(packet(0, 1, [0xaa]));
guest.send(packet(1, 2, [0xbb]));

const hostMessage = await nextMessage(host);
assertPacket(hostMessage, 2, 0xbb);

host.send(packet(2, 1, [0xcc]));
const guestMessage = await nextMessage(guest);
assertPacket(guestMessage, 1, 0xcc);

await Promise.allSettled([closeSocket(host), closeSocket(guest)]);

console.log(`Room WebSocket smoke passed for ${room}`);
process.exit(0);

function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.binaryType = "arraybuffer";
    socket.addEventListener("open", () => resolve(socket), { once: true });
    socket.addEventListener("error", () => reject(new Error(`WebSocket failed: ${url}`)), {
      once: true
    });
  });
}

function nextMessage(socket) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timed out waiting for routed packet")), 5000);
    socket.addEventListener(
      "message",
      (event) => {
        clearTimeout(timeout);
        resolve(event.data);
      },
      { once: true }
    );
  });
}

function closeSocket(socket) {
  return new Promise((resolve) => {
    if (socket.readyState === WebSocket.CLOSED) {
      resolve();
      return;
    }

    const timeout = setTimeout(resolve, 1000);
    socket.addEventListener(
      "close",
      () => {
        clearTimeout(timeout);
        resolve();
      },
      { once: true }
    );
    socket.close();
  });
}

function packet(to, from, payload) {
  const bytes = new Uint8Array(8 + payload.length);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, to, true);
  view.setUint32(4, from, true);
  bytes.set(payload, 8);

  return bytes.buffer;
}

function assertPacket(data, from, payloadByte) {
  if (!(data instanceof ArrayBuffer)) {
    throw new Error("Expected ArrayBuffer packet");
  }

  const view = new DataView(data);
  const payload = new Uint8Array(data);

  if (view.getUint32(0, true) !== from || payload[4] !== payloadByte) {
    throw new Error("Routed packet payload did not match");
  }
}
