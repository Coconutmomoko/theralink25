const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const startCallButton = document.getElementById("startCall");
const endCallButton = document.getElementById("endCall");

// Create toggle buttons
const toggleVideoButton = document.createElement("button");
toggleVideoButton.textContent = "Toggle Video";
document.body.appendChild(toggleVideoButton);

const toggleAudioButton = document.createElement("button");
toggleAudioButton.textContent = "Toggle Audio";
document.body.appendChild(toggleAudioButton);

const socket = io();
let localStream;
let peerConnection;
let isVideoEnabled = true;
let isAudioEnabled = true;
let hasVideoDevice = false;
let hasAudioDevice = false;

const servers = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
  ],
};

// Check available devices
async function checkDevices() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  hasVideoDevice = devices.some(device => device.kind === "videoinput");
  hasAudioDevice = devices.some(device => device.kind === "audioinput");
}

// Function to start media
async function startMedia() {
  await checkDevices(); // Check for available devices

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

// Function to update toggle button states
function updateToggleButtons() {
  toggleVideoButton.disabled = !hasVideoDevice;
  toggleAudioButton.disabled = !hasAudioDevice;

  toggleVideoButton.textContent = isVideoEnabled ? "Turn Video Off" : "Turn Video On";
  toggleAudioButton.textContent = isAudioEnabled ? "Mute" : "Unmute";
}

// Function to start a call
async function startCall() {
  await startMedia();

  peerConnection = new RTCPeerConnection(servers);
  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

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

// Function to end a call
function endCall() {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
  }
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
  socket.emit("endCall");
}

// Toggle Video On/Off
toggleVideoButton.addEventListener("click", () => {
  if (!hasVideoDevice) return;
  isVideoEnabled = !isVideoEnabled;
  localStream.getVideoTracks().forEach(track => (track.enabled = isVideoEnabled));
  updateToggleButtons();
});

// Toggle Audio On/Off
toggleAudioButton.addEventListener("click", () => {
  if (!hasAudioDevice) return;
  isAudioEnabled = !isAudioEnabled;
  localStream.getAudioTracks().forEach(track => (track.enabled = isAudioEnabled));
  updateToggleButtons();
});

// Event Listeners
startCallButton.addEventListener("click", startCall);
endCallButton.addEventListener("click", endCall);

// Handle incoming WebRTC signals
socket.on("offer", async (offer) => {
  if (!peerConnection) {
    await startMedia();
    peerConnection = new RTCPeerConnection(servers);
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

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
