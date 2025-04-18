import React, { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import SimplePeer from "simple-peer";
import EmojiPicker from "emoji-picker-react";
import ringtone from "./iphone.mp3";

// Updated socket URL to use the new one
const socket = io("https://auth-c7xw.onrender.com/");

const App = () => {
  const [username, setUsername] = useState("");
  const [hasJoined, setHasJoined] = useState(false);
  const [users, setUsers] = useState({});

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const [stream, setStream] = useState();
  const [receivingCall, setReceivingCall] = useState(false);
  const [caller, setCaller] = useState("");
  const [callerSignal, setCallerSignal] = useState(null);
  const [callAccepted, setCallAccepted] = useState(false);

  const userVideo = useRef();
  const partnerVideo = useRef();
  const connectionRef = useRef();

  useEffect(() => {
    socket.on("message", (msg) => {
      setMessages((prevMessages) => [...prevMessages, msg]);

      // Play ringtone if message is from someone else
      if (msg.username !== username) {
        const audio = new Audio(ringtone); // Ensure this file is in /public folder
        audio.play().catch((err) => {
          console.error("Failed to play sound:", err);
        });
      }
    });

    socket.on("users", (userList) => {
      setUsers(userList);
    });

    socket.on("incoming-call", ({ from, signal, username }) => {
      setReceivingCall(true);
      setCaller(from);
      setCallerSignal(signal);
    });

    socket.on("call-answered", ({ signal }) => {
      setCallAccepted(true);
      connectionRef.current.signal(signal);
    });

    return () => {
      socket.off("message");
      socket.off("users");
      socket.off("incoming-call");
      socket.off("call-answered");
    };
  }, [username]);

  const handleJoin = () => {
    if (username.trim() !== "") {
      setHasJoined(true);
      socket.emit("join", username);

      navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
        .then((currentStream) => {
          setStream(currentStream);
          if (userVideo.current) {
            userVideo.current.srcObject = currentStream;
          }
        });
    }
  };

  const sendMessage = () => {
    if (message.trim() !== "") {
      socket.emit("message", {
        username,
        text: message,
      });
      setMessage("");
    }
  };

  const handleEmojiClick = (emojiData) => {
    setMessage((prev) => prev + emojiData.emoji);
  };

  const callUser = (id) => {
    const peer = new SimplePeer({
      initiator: true,
      trickle: false,
      stream,
    });

    peer.on("signal", (data) => {
      socket.emit("call-user", {
        signal: data,
        to: id,
        username,
      });
    });

    peer.on("stream", (currentStream) => {
      if (partnerVideo.current) {
        partnerVideo.current.srcObject = currentStream;
      }
    });

    connectionRef.current = peer;
  };

  const answerCall = () => {
    setCallAccepted(true);
    const peer = new SimplePeer({
      initiator: false,
      trickle: false,
      stream,
    });

    peer.on("signal", (data) => {
      socket.emit("answer-call", {
        signal: data,
        to: caller,
        username,
      });
    });

    peer.on("stream", (currentStream) => {
      if (partnerVideo.current) {
        partnerVideo.current.srcObject = currentStream;
      }
    });

    peer.signal(callerSignal);
    connectionRef.current = peer;
  };

  if (!hasJoined) {
    return (
      <div style={styles.joinContainer}>
        <h2 style={styles.heading}>🔐 Enter Username</h2>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Your name"
          style={styles.input}
        />
        <button onClick={handleJoin} style={styles.button}>
          Join Chat
        </button>
      </div>
    );
  }

  return (
    <div style={styles.chatContainer}>
      <h2 style={styles.heading}>💬 Welcome, {username}</h2>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
        <div>
          <h3>👥 Users:</h3>
          <ul>
            {Object.entries(users)
              .filter(([id]) => id !== socket.id)
              .map(([id, name]) => (
                <li key={id}>
                  {name}{" "}
                  <button onClick={() => callUser(id)} style={styles.button}>
                    📞 Call
                  </button>
                </li>
              ))}
          </ul>
        </div>

        <div>
          {stream && (
            <video
              ref={userVideo}
              playsInline
              muted
              autoPlay
              style={{ width: 150 }}
            />
          )}
          {callAccepted && (
            <video
              ref={partnerVideo}
              playsInline
              autoPlay
              style={{ width: 150 }}
            />
          )}
        </div>
      </div>

      {receivingCall && !callAccepted && (
        <div>
          <p>📲 Incoming call...</p>
          <button onClick={answerCall} style={styles.button}>
            Answer
          </button>
        </div>
      )}

      <div style={styles.chatBox}>
        {messages.map((msg, index) => (
          <div
            key={index}
            style={{
              ...styles.messageBubble,
              alignSelf: msg.username === username ? "flex-end" : "flex-start",
              backgroundColor: msg.username === username ? "#DCF8C6" : "#FFF",
            }}
          >
            <strong style={styles.username}>{msg.username}</strong>
            <p style={styles.text}>{msg.text}</p>
          </div>
        ))}
      </div>

      <div style={styles.inputContainer}>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message"
          style={styles.input}
        />
        <button
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          style={styles.button}
        >
          😊
        </button>
        <button onClick={sendMessage} style={styles.button}>
          Send
        </button>
      </div>

      {showEmojiPicker && (
        <div style={styles.emojiPicker}>
          <EmojiPicker onEmojiClick={handleEmojiClick} />
        </div>
      )}
    </div>
  );
};

export default App;

const styles = {
  joinContainer: {
    padding: "2rem",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "1rem",
  },
  chatContainer: {
    padding: "2rem",
    display: "flex",
    flexDirection: "column",
    maxWidth: "800px",
    margin: "auto",
    height: "100vh",
    boxSizing: "border-box",
  },
  heading: {
    textAlign: "center",
    marginBottom: "1rem",
  },
  chatBox: {
    flex: 1,
    border: "1px solid #ddd",
    borderRadius: "8px",
    padding: "1rem",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    backgroundColor: "#f9f9f9",
  },
  messageBubble: {
    maxWidth: "70%",
    padding: "0.5rem 1rem",
    borderRadius: "16px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  username: {
    fontSize: "0.85rem",
    color: "#555",
  },
  text: {
    margin: 0,
    fontSize: "1rem",
  },
  inputContainer: {
    display: "flex",
    marginTop: "1rem",
    gap: "0.5rem",
    alignItems: "center",
  },
  input: {
    flex: 1,
    padding: "0.5rem",
    borderRadius: "8px",
    border: "1px solid #ccc",
    fontSize: "1rem",
  },
  button: {
    padding: "0.5rem 1rem",
    backgroundColor: "#4CAF50",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "bold",
  },
  emojiPicker: {
    position: "absolute",
    bottom: "100px",
    right: "20px",
    zIndex: 1000,
  },
};
