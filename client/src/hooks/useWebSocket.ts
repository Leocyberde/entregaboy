import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@/_core/hooks/useAuth";

let globalSocket: Socket | null = null;

export function useWebSocket() {
  const { user, isAuthenticated } = useAuth();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    if (!globalSocket || !globalSocket.connected) {
      globalSocket = io(window.location.origin, {
        path: "/api/socket.io",
        auth: {
          userId: user.id,
          role: user.role,
        },
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionDelay: 2000,
        reconnectionAttempts: 10,
      });

      globalSocket.on("connect", () => {
        console.log("[WS] Connected:", globalSocket?.id);
      });

      globalSocket.on("disconnect", (reason) => {
        console.log("[WS] Disconnected:", reason);
      });

      globalSocket.on("connect_error", (err) => {
        console.error("[WS] Connection error:", err.message);
      });
    }

    socketRef.current = globalSocket;

    return () => {
      // Don't disconnect on unmount — keep global connection alive
    };
  }, [isAuthenticated, user?.id, user?.role]);

  const on = useCallback(<T = unknown>(event: string, handler: (data: T) => void) => {
    const socket = socketRef.current ?? globalSocket;
    if (!socket) return () => {};
    socket.on(event, handler);
    return () => socket.off(event, handler);
  }, []);

  const emit = useCallback((event: string, data?: unknown) => {
    const socket = socketRef.current ?? globalSocket;
    if (!socket?.connected) return;
    socket.emit(event, data);
  }, []);

  const joinRoom = useCallback((room: string) => {
    emit("join_ride", room);
  }, [emit]);

  const leaveRoom = useCallback((room: string) => {
    emit("leave_ride", room);
  }, [emit]);

  return { socket: socketRef.current ?? globalSocket, on, emit, joinRoom, leaveRoom };
}
