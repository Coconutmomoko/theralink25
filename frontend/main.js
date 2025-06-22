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
const typingIndicator = document.getElementById("typing-indicator");
//Screen sharing
const startShareBtn = document.getElementById("startShare");
const stopShareBtn = document.getElementById("stopShare");
//UI Dark or Light mode
const darkModeToggle = document.getElementById("dark-mode-toggle");
const themeIcons = darkModeToggle.querySelectorAll("i");

const socket = io();
let localStream;
let remoteStream = new MediaStream(); // Initialize remoteStream
let peerConnection;
let typingTimeout;
let isVideoEnabled = true;
let isAudioEnabled = true;
let hasVideoDevice = false;
let hasAudioDevice = false;
//Screen sharing
let screenStream;
let isSharingScreen = false;
let originalLocalStream; // 保存原始摄像头流

// Theme Handling
function toggleDarkMode() {
	const isDark = document.body.getAttribute("data-theme") === "dark";
	document.body.setAttribute("data-theme", isDark ? "light" : "dark");

	themeIcons?.forEach((icon) => {
		icon.style.display = icon.classList.contains(isDark ? "fa-sun" : "fa-moon")
			? "inline-block"
			: "none";
	});

	localStorage.setItem("theme", isDark ? "light" : "dark");
}

// Initialize theme
const savedTheme = localStorage.getItem("theme");
if (savedTheme) {
	document.body.setAttribute("data-theme", savedTheme);
	themeIcons?.forEach((icon) => {
		icon.style.display = icon.classList.contains(
			savedTheme === "dark" ? "fa-moon" : "fa-sun"
		)
			? "inline-block"
			: "none";
	});
}

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
		originalLocalStream = localStream; // 保存原始流
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
		//remoteVideo.style.transform = "";  // screen sharing
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
	if (screenStream) {
		screenStream.getTracks().forEach((track) => track.stop());
		screenStream = null;
	}
	if (peerConnection) {
		peerConnection.close();
		peerConnection = null;
	}

	localVideo.srcObject = null;
	remoteVideo.srcObject = null;
	isSharingScreen = false;
	startShareBtn.disabled = false;
	stopShareBtn.disabled = true;
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
	const chatMessages = document.querySelector(".chat-messages");
	const lastMessage = messagesList.lastElementChild;

	if (lastMessage) {
		// Scroll to show last message fully
		lastMessage.scrollIntoView({
			behavior: "smooth",
			block: "end",
		});
	}
}

messageInput.addEventListener("keydown", function (event) {
	if (event.key === "Enter" && !event.shiftKey) {
		event.preventDefault(); // Prevent new line in input
		sendMessage(); // Call the sendMessage function
	}
});

socket.on("typing", (isTyping) => {
	typingIndicator.style.display = isTyping ? "flex" : "none";
	if (isTyping) {
		const chatMessages = document.querySelector(".chat-messages");
		const threshold = 100;
		const shouldScroll =
			chatMessages.scrollHeight -
				chatMessages.scrollTop -
				chatMessages.clientHeight <
			threshold;

		if (shouldScroll) {
			scrollToBottom();
		}
	}
});

messageInput.addEventListener("input", () => {
	const hasContent = messageInput.value.trim().length > 0;

	// Always emit typing status when input changes
	socket.emit("typing", hasContent);

	// Manage the timeout for hiding the indicator
	clearTimeout(typingTimeout);
	if (hasContent) {
		typingTimeout = setTimeout(() => {
			socket.emit("typing", false);
		}, 1000);
	}
});

function sendMessage() {
	const message = messageInput.value.trim();
	if (message) {
		if (typingTimeout) {
			clearTimeout(typingTimeout);
			socket.emit("typing", false);
		}

		socket.emit("message", { text: message });
		addMessageToChat(`You: ${message}`, true);
		messageInput.value = "";
		scrollToBottom();
	}
}

// Listen for incoming messages:
socket.on("message", (data) => {
	addMessageToChat(`Peer: ${data.text}`);
	scrollToBottom();
});

// Helper function to append a new message to the chat:
function addMessageToChat(msg, isOwnMessage = false) {
	const li = document.createElement("li");
	li.setAttribute("data-own", isOwnMessage.toString()); // This enables the CSS bubble styling

	// Preserve your original formatting requirements
	li.style.whiteSpace = "pre-wrap"; // Keep multiline support
	li.textContent = msg; // Keep simple text content

	// Remove the inline background colors (now handled by CSS)
	li.style.backgroundColor = "";

	messagesList.appendChild(li);
	scrollToBottom(); // Keep your existing auto-scroll
}

// Variable to keep track of the recorder and recording state
let recorder;
let isRecording = false;

// Function to draw video streams onto the canvas
function drawVideosToCanvas() {
	if (!isRecording) return;

	// Set canvas dimensions to match the video dimensions
	recordingCanvas.width = localVideo.videoWidth + remoteVideo.videoWidth;
	recordingCanvas.height = Math.max(
		localVideo.videoHeight,
		remoteVideo.videoHeight
	);

	// Clear the canvas
	recordingContext.clearRect(
		0,
		0,
		recordingCanvas.width,
		recordingCanvas.height
	);

	// Draw local video
	recordingContext.drawImage(
		localVideo,
		0,
		0,
		localVideo.videoWidth,
		localVideo.videoHeight
	);

	// Draw remote video
	recordingContext.drawImage(
		remoteVideo,
		localVideo.videoWidth,
		0,
		remoteVideo.videoWidth,
		remoteVideo.videoHeight
	);

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
			const localAudioSource =
				audioContext.createMediaStreamSource(localStream);
			localAudioSource.connect(destination);
		}

		if (remoteStream.getAudioTracks().length > 0) {
			const remoteAudioSource =
				audioContext.createMediaStreamSource(remoteStream);
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
			remoteVideo.style.transform = "scaleX(1)";
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

// Screen sharing - 修复后的版本
async function startScreenShare() {
	try {
		// 检查是否有活跃的对等连接
		if (!peerConnection) {
			console.error("No active peer connection");
			alert("Please start a call first before sharing screen");
			return;
		}

		// 获取屏幕共享流
		screenStream = await navigator.mediaDevices.getDisplayMedia({
			video: {
				width: { ideal: 1920 },
				height: { ideal: 1080 },
				frameRate: { ideal: 30 },
				cursor: 'always'
			},
			audio: true // 包含系统音频
		});

		// 找到视频发送器并替换轨道
		const videoSender = peerConnection
			.getSenders()
			.find((s) => s.track && s.track.kind === "video");
		
		if (videoSender) {
			await videoSender.replaceTrack(screenStream.getVideoTracks()[0]);
		}

		// 更新本地视频显示
		localVideo.srcObject = screenStream;
		localVideo.style.transform = "scaleX(1)";

		// 设置状态
		isSharingScreen = true;
		startShareBtn.disabled = true;
		stopShareBtn.disabled = false;

		// 监听屏幕共享结束事件（用户点击浏览器的停止共享按钮）
		screenStream.getVideoTracks()[0].onended = () => {
			console.log("Screen sharing ended by user");
			stopScreenShare();
		};

		socket.emit("share-screen");
		console.log("Screen sharing started successfully");
	} catch (error) {
		console.error("Error sharing screen:", error);
		alert("Failed to start screen sharing: " + error.message);
	}
}

async function stopScreenShare() {
	try {
		// 停止屏幕共享流
		if (screenStream) {
			screenStream.getTracks().forEach((track) => {
				track.stop();
			});
			screenStream = null;
		}

		// 检查是否有活跃的对等连接
		if (!peerConnection) {
			console.error("No active peer connection");
			return;
		}

		// 重新获取摄像头流（如果原始流已停止）
		if (!originalLocalStream || originalLocalStream.getTracks().some(track => track.readyState === 'ended')) {
			const constraints = {
				video: hasVideoDevice,
				audio: hasAudioDevice,
			};
			
			originalLocalStream = await navigator.mediaDevices.getUserMedia(constraints);
			localStream = originalLocalStream;
		}

		// 找到视频发送器并替换回摄像头轨道
		const videoSender = peerConnection
			.getSenders()
			.find((s) => s.track && s.track.kind === "video");
		
		if (videoSender && originalLocalStream.getVideoTracks().length > 0) {
			await videoSender.replaceTrack(originalLocalStream.getVideoTracks()[0]);
		}

		// 恢复本地视频显示
		localVideo.srcObject = originalLocalStream;
		localVideo.style.transform = "scaleX(-1)"; // 恢复镜像效果

		// 更新状态
		isSharingScreen = false;
		startShareBtn.disabled = false;
		stopShareBtn.disabled = true;

		socket.emit("stop-share-screen");
		console.log("Screen sharing stopped successfully");
	} catch (error) {
		console.error("Error stopping screen share:", error);
		alert("Failed to stop screen sharing: " + error.message);
	}
}

// Event listeners
startShareBtn.addEventListener("click", startScreenShare);
stopShareBtn.addEventListener("click", stopScreenShare);
if (darkModeToggle) {
	darkModeToggle.addEventListener("click", toggleDarkMode);
}

// Handle stopping screen share
socket.on("stop-share-screen", () => {
	remoteVideo.srcObject = remoteStream;
	remoteVideo.style.transform = "scaleX(1)";
});

socket.on("share-screen", () => {
	remoteVideo.style.transform = "scaleX(1)"; // Show it correctly to you
	remoteVideo.style.width = "100%"; // Ensures full width
	remoteVideo.style.height = "100%";
});

//full screen
function toggleFullscreen(videoElement) {
	if (!document.fullscreenElement) {
		if (videoElement.requestFullscreen) {
			videoElement.requestFullscreen();
		} else if (videoElement.mozRequestFullScreen) {
			// Firefox
			videoElement.mozRequestFullScreen();
		} else if (videoElement.webkitRequestFullscreen) {
			// Chrome, Safari, Opera
			videoElement.webkitRequestFullscreen();
		} else if (videoElement.msRequestFullscreen) {
			// IE/Edge
			videoElement.msRequestFullscreen();
		}
	} else {
		if (document.exitFullscreen) {
			document.exitFullscreen();
		} else if (document.mozCancelFullScreen) {
			// Firefox
			document.mozCancelFullScreen();
		} else if (document.webkitExitFullscreen) {
			// Chrome, Safari, Opera
			document.webkitExitFullscreen();
		} else if (document.msExitFullscreen) {
			// IE/Edge
			document.msExitFullscreen();
		}
	}
}

// Attach double-click event to both videos
localVideo.addEventListener("dblclick", () => toggleFullscreen(localVideo));
remoteVideo.addEventListener("dblclick", () => toggleFullscreen(remoteVideo));