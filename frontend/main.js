const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const startCallButton = document.getElementById("startCall");
const endCallButton = document.getElementById("endCall");
const sendMessageButton = document.getElementById("send-message");
const toggleVideoButton = document.getElementById("toggle-video");
const toggleAudioButton = document.getElementById("toggle-audio");
const messageInput = document.getElementById("message");
const messagesList = document.getElementById("messages");
const startRecordingButton = document.getElementById("start-recording");

const socket = io();
let localStream;
let peerConnection;
let isVideoEnabled = true;
let isAudioEnabled = true;
let hasVideoDevice = false;
let hasAudioDevice = false;

const servers = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

// Check available media input devices
async function checkDevices() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  hasVideoDevice = devices.some((device) => device.kind === "videoinput");
  hasAudioDevice = devices.some((device) => device.kind === "audioinput");
}

// Start media stream
async function startMedia() {
  await checkDevices();

  const constraints = {
    video: hasVideoDevice,
    audio: hasAudioDevice,
  };

  try {
    localStream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (error) {
    console.warn("Error accessing media devices:", error);
    alert("No available media devices!");
    return;
  }

  localVideo.srcObject = localStream;
  updateToggleButtons();
}

// Update UI button states
function updateToggleButtons() {
  toggleVideoButton.disabled = !hasVideoDevice;
  toggleAudioButton.disabled = !hasAudioDevice;
  toggleVideoButton.textContent = isVideoEnabled
    ? "Turn video Off"
    : "Turn video On";
  toggleAudioButton.textContent = isAudioEnabled ? "Mute" : "Unmute";
}

// Start a video call
async function startCall() {
  await startMedia();

  peerConnection = new RTCPeerConnection(servers);
  localStream
    .getTracks()
    .forEach((track) => peerConnection.addTrack(track, localStream));

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("candidate", event.candidate);
    }
  };

  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit("offer", offer);
}

// End the call
function endCall() {
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
  }
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
  socket.emit("endCall");

  removeRecordingIndicator();
}

// Toggle local video stream
toggleVideoButton.addEventListener("click", () => {
  if (!hasVideoDevice) return;
  isVideoEnabled = !isVideoEnabled;
  localStream
    .getVideoTracks()
    .forEach((track) => (track.enabled = isVideoEnabled));
  updateToggleButtons();
});

// Toggle local audio stream
toggleAudioButton.addEventListener("click", () => {
  if (!hasAudioDevice) return;
  isAudioEnabled = !isAudioEnabled;
  localStream
    .getAudioTracks()
    .forEach((track) => (track.enabled = isAudioEnabled));
  updateToggleButtons();
});

// Auto-scroll chat to the latest message
function scrollToBottom() {
  messagesList.scrollTop = messagesList.scrollHeight;
}

// Send chat message
sendMessageButton.addEventListener("click", () => {
  const message = messageInput.value.trim();
  if (message) {
    socket.emit("message", { text: message });
    addMessageToChat(`You: ${message}`, true);
    messageInput.value = "";
    scrollToBottom();
  }
});

// Receive chat message
socket.on("message", (data) => {
  addMessageToChat(`Peer: ${data.text}`);
  scrollToBottom();
});

// Add message to the chat UI
function addMessageToChat(msg, isOwnMessage = false) {
  const li = document.createElement("li");
  li.textContent = msg;
  li.style.whiteSpace = "pre-wrap";
  li.style.backgroundColor = isOwnMessage ? "#d1ffd1" : "#d1e0ff";
  messagesList.appendChild(li);
}

// Recording logic
let recorder;
let isRecording = false;

// Show red dot on screen
function showRecordingIndicator() {
  const indicator = document.createElement("div");
  indicator.id = "recording-indicator";
  indicator.textContent = "● Recording";
  indicator.style.position = "fixed";
  indicator.style.top = "10px";
  indicator.style.right = "10px";
  indicator.style.color = "red";
  indicator.style.fontWeight = "bold";
  indicator.style.zIndex = "9999";
  indicator.style.fontSize = "1.2rem";
  document.body.appendChild(indicator);
  socket.emit("recording-status", { isRecording: true });
}

// Remove red dot
function removeRecordingIndicator() {
  const indicator = document.getElementById("recording-indicator");
  if (indicator) {
    indicator.remove();
  }
  socket.emit("recording-status", { isRecording: false });
}

// Toggle recording
startRecordingButton.addEventListener("click", async () => {
  if (isRecording) {
    recorder.stop();
    isRecording = false;
    startRecordingButton.textContent = "Start recording";
    removeRecordingIndicator();
  } else {
    recorder = new MediaRecorder(localStream);
    const chunks = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    recorder.onstop = async () => {
      const blob = new Blob(chunks, { type: "video/webm" });

      if (window.showSaveFilePicker) {
        try {
          const handle = await showSaveFilePicker({
            suggestedName: "recording.webm",
            types: [
              {
                description: "WebM Video",
                accept: { "video/webm": [".webm"] },
              },
            ],
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
        } catch (error) {
          console.error("Error saving file:", error);
        }
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "recording.webm";
        a.click();
        URL.revokeObjectURL(url);
      }
    };

    recorder.start();
    isRecording = true;
    startRecordingButton.textContent = "Stop recording";
    showRecordingIndicator();
  }
});

// WebRTC and signaling

startCallButton.addEventListener("click", startCall);
endCallButton.addEventListener("click", endCall);

socket.on("offer", async (offer) => {
  if (!peerConnection) {
    await startMedia();
    peerConnection = new RTCPeerConnection(servers);
    localStream
      .getTracks()
      .forEach((track) => peerConnection.addTrack(track, localStream));

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("candidate", event.candidate);
      }
    };

    peerConnection.ontrack = (event) => {
      remoteVideo.srcObject = event.streams[0];
    };
  }

  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit("answer", answer);
});

socket.on("answer", async (answer) => {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on("candidate", async (candidate) => {
  await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
});

// Handle peer’s recording indicator
socket.on("recording-status", (data) => {
  if (data.isRecording) {
    showRecordingIndicator();
  } else {
    removeRecordingIndicator();
  }
});

// Join room based on path
const roomId = window.location.pathname.split("/")[1];
socket.emit("join-room", roomId);

socket.on("room-full", () => {
  window.location.href = "/room-full";
});

// Control chat box open/close
const chatIcon = document.getElementById("chat-icon");
const chatBox = document.getElementById("chat");
const closeChatButton = document.getElementById("close-chat");

if (chatIcon && chatBox && closeChatButton) {
  chatIcon.addEventListener("click", () => {
    chatBox.style.display = "block";
    chatIcon.style.display = "none";
  });

  closeChatButton.addEventListener("click", () => {
    chatBox.style.display = "none";
    chatIcon.style.display = "block";
  });

  // Initialize: hide chat box, show chat icon
  chatBox.style.display = "none";
  chatIcon.style.display = "block";
}






