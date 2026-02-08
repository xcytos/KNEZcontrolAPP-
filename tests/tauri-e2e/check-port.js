import net from "node:net";

const port = Number(process.argv[2] ?? "");
const host = process.argv[3] ?? "127.0.0.1";

if (!port) {
  console.error("usage: node check-port.js <port> [host]");
  process.exit(2);
}

const socket = net.connect({ host, port }, () => {
  console.log("open");
  socket.end();
  process.exit(0);
});
socket.on("error", (e) => {
  console.error(`closed:${e?.code ?? "error"}`);
  process.exit(1);
});
socket.setTimeout(1500, () => {
  console.error("closed:timeout");
  socket.destroy();
  process.exit(1);
});

