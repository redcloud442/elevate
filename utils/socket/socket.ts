import { io } from "socket.io-client";

async function initializeSocket() {
  const socket = io(
    process.env.NODE_ENV === "development"
      ? "http://localhost:8000"
      : "https://loadbalancer.elevateglobal.app",
    {
      transports: ["websocket"],
      reconnection: true,
      upgrade: true,
      path: "/socket.io",
    }
  );

  return socket;
}

//test

export default initializeSocket;
