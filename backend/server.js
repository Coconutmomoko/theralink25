const express = require("express");
const http = require("http");
const https = require("https");
const fs = require("fs");
const socketIo = require("socket.io");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const PORT = process.env.PORT || 5000;

const app = express();
let server;

if (process.env.USE_HTTPS) {
  const options = {
    key: fs.readFileSync("certificates/cert.key"),
    cert: fs.readFileSync("certificates/cert.crt"),
  };
  server = https.createServer(options, app);
  console.log("Using HTTPS");
} else {
  server = http.createServer(app);
  console.log("Using HTTP");
}

const io = socketIo(server, { secure: true });

app.use(express.static(path.join(__dirname, "../frontend")));

io.on("connection", (socket) => {
  socket.on("offer", (data) => {
    socket.broadcast.emit("offer", data);
  });
  socket.on("answer", (data) => {
    socket.broadcast.emit("answer", data);
  });
  socket.on("candidate", (data) => {
    socket.broadcast.emit("candidate", data);
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
