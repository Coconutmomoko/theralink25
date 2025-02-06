const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const startCallButton = document.getElementById("startCall");
const socket = io();

let localStream;
let peerConnection;

const servers = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
  ],
};

startCallButton.addEventListener("click", async () => {
  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });
  localVideo.srcObject = localStream;

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
});

socket.on("offer", async (offer) => {
  if (!peerConnection) {
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
