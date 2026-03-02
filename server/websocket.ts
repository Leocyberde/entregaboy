import type { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { saveLocation, setMotoboyOnlineStatus, updateMotoboyLocation } from "./db";

let io: SocketIOServer | null = null;

export function getIo(): SocketIOServer | null {
  return io;
}

export function initWebSocket(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
    path: "/api/socket.io",
  });

  io.on("connection", (socket: Socket) => {
    const userId = socket.handshake.auth?.userId as number | undefined;
    const role = socket.handshake.auth?.role as string | undefined;

    console.log(`[WS] Connected: socket=${socket.id} userId=${userId} role=${role}`);

    // Join role-based rooms
    if (role === "admin") {
      socket.join("admins");
    } else if (role === "motoboy" && userId) {
      socket.join("motoboys");
      socket.join(`motoboy_${userId}`);
    } else if (role === "cliente" && userId) {
      socket.join(`client_${userId}`);
    }

    // ─── Motoboy: join a specific ride room ──────────────────────────────────
    socket.on("join_ride", (rideId: number) => {
      socket.join(`ride_${rideId}`);
      console.log(`[WS] socket=${socket.id} joined ride_${rideId}`);
    });

    socket.on("leave_ride", (rideId: number) => {
      socket.leave(`ride_${rideId}`);
    });

    // ─── Motoboy: GPS location update ────────────────────────────────────────
    socket.on(
      "location_update",
      async (data: {
        lat: number;
        lng: number;
        rideId?: number;
        accuracy?: number;
        speed?: number;
        heading?: number;
      }) => {
        if (!userId || role !== "motoboy") return;

        try {
          await saveLocation({
            motoboyId: userId,
            rideId: data.rideId,
            lat: data.lat,
            lng: data.lng,
            accuracy: data.accuracy,
            speed: data.speed,
            heading: data.heading,
          });

          const locationPayload = {
            motoboyId: userId,
            lat: data.lat,
            lng: data.lng,
            rideId: data.rideId,
            timestamp: Date.now(),
          };

          // Broadcast to admins
          socket.to("admins").emit("motoboy_location", locationPayload);

          // Broadcast to ride participants
          if (data.rideId) {
            socket.to(`ride_${data.rideId}`).emit("motoboy_location", locationPayload);
          }
        } catch (err) {
          console.error("[WS] Error saving location:", err);
        }
      }
    );

    // ─── Motoboy: toggle online status ───────────────────────────────────────
    socket.on("set_online", async (isOnline: boolean) => {
      if (!userId || role !== "motoboy") return;
      try {
        await setMotoboyOnlineStatus(userId, isOnline);
        io?.to("admins").emit("motoboy_status", {
          motoboyId: userId,
          isOnline,
        });
      } catch (err) {
        console.error("[WS] Error setting online status:", err);
      }
    });

    // ─── Disconnect ───────────────────────────────────────────────────────────
    socket.on("disconnect", async () => {
      console.log(`[WS] Disconnected: socket=${socket.id} userId=${userId}`);
      if (userId && role === "motoboy") {
        try {
          await setMotoboyOnlineStatus(userId, false);
          io?.to("admins").emit("motoboy_status", {
            motoboyId: userId,
            isOnline: false,
          });
        } catch (err) {
          console.error("[WS] Error on disconnect:", err);
        }
      }
    });
  });

  console.log("[WS] Socket.IO initialized");
  return io;
}
