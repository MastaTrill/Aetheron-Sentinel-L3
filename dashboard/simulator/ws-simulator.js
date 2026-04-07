import WebSocket, { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 7071 });

console.log("Sentinel WS Simulator running on ws://localhost:7071");

setInterval(() => {
  const event = {
    type: "sentinel.event",
    timestamp: Date.now(),
    integrity: Math.random(),
    threat: Math.random(),
    state: ["IDLE", "SCAN", "LOCK", "VERIFY"][Math.floor(Math.random() * 4)]
  };
  wss.clients.forEach(c => c.send(JSON.stringify(event)));
}, 1000);
