import { and, eq, lt, isNotNull, or } from "drizzle-orm";
import { getDb } from "./db";
import { rides, notifications } from "../drizzle/schema";
import { getIo } from "./websocket";

export function initCron() {
  // Executar a cada 30 segundos
  setInterval(async () => {
    try {
      const db = await getDb();
      if (!db) return;

      const now = new Date();

      // 1. Buscar corridas que expiraram o tempo de chegada (15 min)
      const expiredRides = await db
        .select()
        .from(rides)
        .where(
          and(
            or(
              eq(rides.status, "ACEITA"),
              eq(rides.status, "CHEGADA_COLETA")
            ),
            isNotNull(rides.expiresAt),
            lt(rides.expiresAt, now)
          )
        );

      for (const ride of expiredRides) {
        console.log(`[Cron] Ride ${ride.id} expired. Reverting to PENDENTE.`);
        
        // Voltar para PENDENTE e limpar motoboy
        await db
          .update(rides)
          .set({
            status: "PENDENTE",
            motoboyId: null,
            acceptedAt: null,
            pickupArrivedAt: null,
            expiresAt: null
          })
          .where(eq(rides.id, ride.id));

        const io = getIo();
        if (io) {
          const updatedRide = { ...ride, status: "PENDENTE", motoboyId: null };
          io.to(`ride_${ride.id}`).emit("corrida_atualizada", updatedRide);
          io.to(`client_${ride.clientId}`).emit("corrida_atualizada", updatedRide);
          if (ride.motoboyId) io.to(`motoboy_${ride.motoboyId}`).emit("corrida_atualizada", updatedRide);
          io.to("admins").emit("corrida_atualizada", updatedRide);
          io.to("motoboys").emit("nova_corrida", updatedRide);
        }
      }

      // 2. Limpar notificações expiradas (timer de 60s do aceite)
      const deletedNotifs = await db
        .delete(notifications)
        .where(
          and(
            isNotNull(notifications.expiresAt),
            lt(notifications.expiresAt, now)
          )
        );
      
      if (deletedNotifs) {
        console.log(`[Cron] Deleted ${Object.keys(deletedNotifs).length} expired notifications`);
      }

    } catch (err) {
      console.error("[Cron] Error in background task:", err);
    }
  }, 30000);
}
