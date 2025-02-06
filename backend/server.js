const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

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

server.listen(5000, () => {
  console.log("Server is running on port 5000");
});
