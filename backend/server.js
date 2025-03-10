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

if (true) {
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

// Object to keep track of users in each room
const rooms = {};

io.on("connection", (socket) => {
  socket.on("join-room", (roomId) => {
    // Check if the room exists, if not create it
    if (!rooms[roomId]) {
      rooms[roomId] = [];
    }

    // Check if the room is full
    if (rooms[roomId].length >= 2) {
      socket.emit("room-full");
      return;
    }

    // Add the user to the room
    rooms[roomId].push(socket.id);

    socket.join(roomId);
    console.log("User joined room: " + roomId + " with userId: " + socket.id);

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

    // Chat message handler:
    socket.on("message", (data) => {
      // Broadcast the message to all other sockets in the room.
      socket.to(roomId).emit("message", data);
    });

    // Handle user disconnection
    socket.on("disconnect", () => {
      socket.to(roomId).emit("user-disconnected");
      rooms[roomId] = rooms[roomId].filter((id) => id !== socket.id);
      if (rooms[roomId].length === 0) {
        delete rooms[roomId];
      }
    });
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
