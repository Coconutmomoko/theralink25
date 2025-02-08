const express = require("express");
const https = require("https");
const fs = require("fs");
const socketIo = require("socket.io");
const path = require("path");
const PORT = process.env.PORT || 5000;

// Read the certificate and key files
const options = {
  key: fs.readFileSync("certificates/cert.key"),
  cert: fs.readFileSync("certificates/cert.crt"),
};

const app = express();
const server = https.createServer(options, app);
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
  console.log(`Server is running on https://localhost:${PORT}`);
});
