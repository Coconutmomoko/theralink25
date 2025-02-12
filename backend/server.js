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

app.get("/", (req, res) => {
  res.redirect(`/${uuidv4()}`);
});

app.use(express.static(path.join(__dirname, "../frontend")));

app.get("/:room", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

io.on("connection", (socket) => {
  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    socket.on("offer", (data) => {
      socket.to(roomId).emit("offer", data);
    });
    socket.on("answer", (data) => {
      socket.to(roomId).emit("answer", data);
    });
    socket.on("candidate", (data) => {
      socket.to(roomId).emit("candidate", data);
    });
    socket.on("endCall", () => {
      socket.to(roomId).emit("endCall");
    });
  });
});
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
