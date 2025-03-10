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
// Get the chat icon and chat box elements
const chatIcon = document.getElementById("chat-icon");
const chatBox = document.getElementById("chat");
const closeChatButton = document.getElementById("close-chat");
const recordingCanvas = document.getElementById("recordingCanvas");
const recordingContext = recordingCanvas.getContext("2d");

const socket = io();
let localStream;
let remoteStream = new MediaStream(); // Initialize remoteStream
let peerConnection;
let isVideoEnabled = true;
let isAudioEnabled = true;
let hasVideoDevice = false;
let hasAudioDevice = false;

const servers = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

// Check available devices
async function checkDevices() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  hasVideoDevice = devices.some((device) => device.kind === "videoinput");
  hasAudioDevice = devices.some((device) => device.kind === "audioinput");
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
  toggleVideoButton.textContent = isVideoEnabled
    ? "Turn video Off"
    : "Turn video On";
  toggleAudioButton.textContent = isAudioEnabled ? "Mute" : "Unmute";
}

// Function to start a call
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
    remoteStream.addTrack(event.track); // Add track to remoteStream
    remoteVideo.srcObject = remoteStream;
  };

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit("offer", offer);
}

// Function to end a call
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
}

// Handle end call from the other user
socket.on("endCall", () => {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  remoteVideo.srcObject = null;
});

// Toggle Video On/Off
toggleVideoButton.addEventListener("click", () => {
  if (!hasVideoDevice) return;
  isVideoEnabled = !isVideoEnabled;
  localStream
    .getVideoTracks()
    .forEach((track) => (track.enabled = isVideoEnabled));
  updateToggleButtons();
});

// Toggle Audio On/Off
toggleAudioButton.addEventListener("click", () => {
  if (!hasAudioDevice) return;
  isAudioEnabled = !isAudioEnabled;
  localStream
    .getAudioTracks()
    .forEach((track) => (track.enabled = isAudioEnabled));
  updateToggleButtons();
});

// Function to scroll to the bottom of the messages list
function scrollToBottom() {
  messagesList.scrollTop = messagesList.scrollHeight;
}

messageInput.addEventListener("keydown", function (event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault(); // Prevent new line in input
    sendMessage(); // Call the sendMessage function
  }
});

function sendMessage() {
  const message = messageInput.value.trim();
  if (message) {
    // Emit the message
    socket.emit("message", { text: message });

    // Display the message immediately
    addMessageToChat(`You: ${message}`, true);
    messageInput.value = "";
    scrollToBottom();
  }
}

// Listen for incoming messages:
socket.on("message", (data) => {
  addMessageToChat(`Peer: ${data.text}`);
  scrollToBottom(); // Autoscroll to the bottom
});

// Helper function to append a new message to the chat:
function addMessageToChat(msg, isOwnMessage = false) {
  const li = document.createElement("li");
  li.textContent = msg;
  li.style.whiteSpace = "pre-wrap"; // Preserve multiline formatting
  li.style.backgroundColor = isOwnMessage ? "#d1ffd1" : "#d1e0ff";
  messagesList.appendChild(li);
}

// Variable to keep track of the recorder and recording state
let recorder;
let isRecording = false;

// Function to draw video streams onto the canvas
function drawVideosToCanvas() {
  if (!isRecording) return;

  // Set canvas dimensions to match the video dimensions
  recordingCanvas.width = localVideo.videoWidth + remoteVideo.videoWidth;
  recordingCanvas.height = Math.max(localVideo.videoHeight, remoteVideo.videoHeight);

  // Clear the canvas
  recordingContext.clearRect(0, 0, recordingCanvas.width, recordingCanvas.height);

  // Draw local video
  recordingContext.drawImage(localVideo, 0, 0, localVideo.videoWidth, localVideo.videoHeight);

  // Draw remote video
  recordingContext.drawImage(remoteVideo, localVideo.videoWidth, 0, remoteVideo.videoWidth, remoteVideo.videoHeight);

  // Continue drawing at the next animation frame
  requestAnimationFrame(drawVideosToCanvas);
}

// Start/Stop recording
startRecordingButton.addEventListener("click", async () => {
  if (isRecording) {
    // Stop recording
    recorder.stop();
    isRecording = false;
    startRecordingButton.textContent = "Start recording";
  } else {
    // Start drawing videos to canvas
    isRecording = true;
    drawVideosToCanvas();

    // Create MediaRecorder from the canvas stream
    const canvasStream = recordingCanvas.captureStream();

    // Combine audio tracks from local and remote streams
    const audioContext = new AudioContext();
    const destination = audioContext.createMediaStreamDestination();

    if (localStream.getAudioTracks().length > 0) {
      const localAudioSource = audioContext.createMediaStreamSource(localStream);
      localAudioSource.connect(destination);
    }

    if (remoteStream.getAudioTracks().length > 0) {
      const remoteAudioSource = audioContext.createMediaStreamSource(remoteStream);
      remoteAudioSource.connect(destination);
    }

    // Combine canvas stream and audio tracks
    const combinedStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...destination.stream.getAudioTracks(),
    ]);

    recorder = new MediaRecorder(combinedStream);

    const chunks = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    recorder.onstop = async () => {
      console.log("Recording stopped.");
      const blob = new Blob(chunks, { type: "video/webm" });

      // Save the file using File System API if available
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
        // Fallback to a download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "recording.webm";
        a.click();
        URL.revokeObjectURL(url);
      }
    };

    recorder.start();
    startRecordingButton.textContent = "Stop recording";
  }
});

// Event Listeners
startCallButton.addEventListener("click", startCall);
endCallButton.addEventListener("click", endCall);

// Handle incoming WebRTC signals
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
      remoteStream.addTrack(event.track); // Add track to remoteStream
      remoteVideo.srcObject = remoteStream;
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

// Join the room
const roomId = window.location.pathname.split("/")[1];
socket.emit("join-room", roomId);

socket.on("room-full", () => {
  window.location.href = "/room-full"; // Redirect to the home page or any other URL
});

socket.on("user-disconnected", () => {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  remoteVideo.srcObject = null;
});

// Add event listener to toggle chat visibility
chatIcon.addEventListener("click", () => {
  // Toggle the display property of the chat box
  chatBox.style.display = "flex"; // Show the chat box
  chatIcon.style.display = "none"; // Hide the chat icon
});

// Add event listener to close the chat box
closeChatButton.addEventListener("click", () => {
  // Hide the chat box and show the chat icon
  chatBox.style.display = "none"; // Hide the chat box
  chatIcon.style.display = "block"; // Show the chat icon
});