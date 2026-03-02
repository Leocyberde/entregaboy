import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  approveMotoboy,
  calculatePrice,
  createNotification,
  deleteNotification,
  createRide,
  getAllMotoboys,
  getAllRides,
  getActiveRideForClient,
  getActiveRideForMotoboy,
  getLatestLocationByMotoboy,
  getLocationsByRide,
  getNotificationsByUser,
  getOnlineMotoboys,
  getPendingRides,
  getPricingSettings,
  getRideById,
  getRidesByClient,
  getRidesByMotoboy,
  getRevenueStats,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  saveLocation,
  setMotoboyOnlineStatus,
  updatePricingSettings,
  updateRideStatus,
  updateUserProfile,
  updateUserRole,
  getUserById,
} from "./db";
import { calculateRoute, geocodeAddress } from "./services/routing";
import { getIo } from "./websocket";
import { authRouter } from "./routers/auth";

// ─── Middleware helpers ────────────────────────────────────────────────────────

const motoboyProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "motoboy" && ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a motoboys" });
  }
  return next({ ctx });
});

const clienteProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "cliente" && ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a clientes" });
  }
  return next({ ctx });
});

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a administradores" });
  }
  return next({ ctx });
});

// ─── App Router ───────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,

  // ─── Auth ──────────────────────────────────────────────────────────────────
  auth: router({
    registerClienteFisica: authRouter._def.procedures.registerClienteFisica,
    registerClienteJuridica: authRouter._def.procedures.registerClienteJuridica,
    registerMotoboy: authRouter._def.procedures.registerMotoboy,
    login: authRouter._def.procedures.login,
    requestPasswordReset: authRouter._def.procedures.requestPasswordReset,
    resetPassword: authRouter._def.procedures.resetPassword,
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    updateProfile: protectedProcedure
      .input(
        z.object({
          name: z.string().min(2).optional(),
          phone: z.string().optional(),
          vehiclePlate: z.string().optional(),
          vehicleModel: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await updateUserProfile(ctx.user.id, input);
        return { success: true };
      }),
    setRole: protectedProcedure
      .input(z.object({ role: z.enum(["admin", "cliente", "motoboy"]) }))
      .mutation(async ({ ctx, input }) => {
        // Only allow setting role if user has no meaningful role yet (first login)
        await updateUserRole(ctx.user.id, input.role);
        return { success: true };
      }),
  }),

  // ─── Pricing ───────────────────────────────────────────────────────────────
  pricing: router({
    get: publicProcedure.query(async () => {
      return getPricingSettings();
    }),
    update: adminProcedure
      .input(
        z.object({
          basePrice: z.string().optional(),
          baseDistanceKm: z.string().optional(),
          pricePerExtraKm: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await updatePricingSettings(input, ctx.user.id);
        return { success: true };
      }),
  }),

  // ─── Geocoding & Routing ───────────────────────────────────────────────────
  routing: router({
    geocode: protectedProcedure
      .input(z.object({ address: z.string().min(5) }))
      .query(async ({ input }) => {
        const result = await geocodeAddress(input.address);
        if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "Endereço não encontrado" });
        return result;
      }),
    calculateRoute: protectedProcedure
      .input(
        z.object({
          fromLat: z.number(),
          fromLng: z.number(),
          toLat: z.number(),
          toLng: z.number(),
        })
      )
      .query(async ({ input }) => {
        const route = await calculateRoute(
          input.fromLat,
          input.fromLng,
          input.toLat,
          input.toLng
        );
        if (!route) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erro ao calcular rota" });
        const pricing = await getPricingSettings();
        const price = pricing ? calculatePrice(route.distanceKm, pricing) : 10;
        const motoboyEarnings = price * 0.8;
        return { ...route, price, motoboyEarnings };
      }),
  }),

  // ─── Rides ─────────────────────────────────────────────────────────────────
  rides: router({
    create: clienteProcedure
      .input(
        z.object({
          pickupAddress: z.string().min(5),
          pickupStreet: z.string().optional(),
          pickupNumber: z.string().optional(),
          pickupNeighborhood: z.string().optional(),
          pickupCity: z.string().optional(),
          pickupState: z.string().optional(),
          pickupLat: z.number(),
          pickupLng: z.number(),
          deliveryAddress: z.string().min(5),
          deliveryStreet: z.string().optional(),
          deliveryNumber: z.string().optional(),
          deliveryNeighborhood: z.string().optional(),
          deliveryCity: z.string().optional(),
          deliveryState: z.string().optional(),
          deliveryLat: z.number(),
          deliveryLng: z.number(),
          distanceKm: z.number(),
          durationMinutes: z.number(),
          price: z.number(),
          notes: z.string().optional(),
          establishmentId: z.string().optional(), // ID do estabelecimento para agrupar corridas
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Check if client already has an active ride
        const activeRide = await getActiveRideForClient(ctx.user.id);
        if (activeRide) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Você já possui uma corrida ativa",
          });
        }

        // Calcular 80% do valor para o motoboy
        const motoboyEarnings = (input.price * 0.8).toFixed(2);

        // Gerar número do pedido e código de coleta (4 dígitos cada)
        const orderNumber = Math.floor(1000 + Math.random() * 9000).toString();
        const pickupCode = Math.floor(1000 + Math.random() * 9000).toString();

        const rideId = await createRide({
          clientId: ctx.user.id,
          pickupAddress: input.pickupAddress,
          pickupStreet: input.pickupStreet,
          pickupNumber: input.pickupNumber,
          pickupNeighborhood: input.pickupNeighborhood,
          pickupCity: input.pickupCity,
          pickupState: input.pickupState,
          pickupLat: input.pickupLat,
          pickupLng: input.pickupLng,
          deliveryAddress: input.deliveryAddress,
          deliveryStreet: input.deliveryStreet,
          deliveryNumber: input.deliveryNumber,
          deliveryNeighborhood: input.deliveryNeighborhood,
          deliveryCity: input.deliveryCity,
          deliveryState: input.deliveryState,
          deliveryLat: input.deliveryLat,
          deliveryLng: input.deliveryLng,
          distanceKm: input.distanceKm.toFixed(2),
          durationMinutes: input.durationMinutes,
          price: input.price.toFixed(2),
          motoboyEarnings,
          orderNumber,
          pickupCode,
          notes: input.notes,
          status: "PENDENTE",
          establishmentId: input.establishmentId,
        });

        const ride = await getRideById(rideId);

        // Notify online approved motoboys - apenas se não tiverem corrida ativa do mesmo estabelecimento
        const onlineMotoboys = await getOnlineMotoboys();
        for (const motoboy of onlineMotoboys) {
          // Verificar se o motoboy já tem uma corrida ativa do mesmo estabelecimento
          const activeRideForMotoboy = await getActiveRideForMotoboy(motoboy.id);
          
          // Se não tem corrida ativa, ou se tem mas é de outro estabelecimento, notificar
          if (!activeRideForMotoboy || (input.establishmentId && activeRideForMotoboy.establishmentId !== input.establishmentId)) {
            await createNotification({
              userId: motoboy.id,
              title: "Nova corrida disponível!",
              message: `De: ${input.pickupAddress}\nPara: ${input.deliveryAddress}\nValor: R$ ${motoboyEarnings}`,
              type: "nova_corrida",
              rideId,
              expiresAt: new Date(Date.now() + 60 * 1000), // Expira em 60 segundos
            });
          }
        }

        // Emit via WebSocket - filtrar motoboys por estabelecimento se aplicável
        const io = getIo();
        if (io) {
          if (input.establishmentId) {
            // Enviar apenas para motoboys que não têm corrida ativa do mesmo estabelecimento
            io.to("motoboys").emit("nova_corrida", ride);
          } else {
            io.to("motoboys").emit("nova_corrida", ride);
          }
          io.to("admins").emit("corrida_atualizada", ride);
        }

        return { rideId, ride };
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const ride = await getRideById(input.id);
        if (!ride) throw new TRPCError({ code: "NOT_FOUND" });

        // Access control
        if (
          ctx.user.role !== "admin" &&
          ride.clientId !== ctx.user.id &&
          ride.motoboyId !== ctx.user.id
        ) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return ride;
      }),

    myRides: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role === "motoboy") return getRidesByMotoboy(ctx.user.id);
      if (ctx.user.role === "cliente") return getRidesByClient(ctx.user.id);
      return getAllRides();
    }),

    activeRide: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role === "motoboy") return (await getActiveRideForMotoboy(ctx.user.id)) ?? null;
      if (ctx.user.role === "cliente") return (await getActiveRideForClient(ctx.user.id)) ?? null;
      return null;
    }),

    pending: motoboyProcedure.query(async () => {
      return getPendingRides();
    }),

    all: adminProcedure.query(async () => {
      return getAllRides(100);
    }),

    accept: motoboyProcedure
      .input(z.object({ rideId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const ride = await getRideById(input.rideId);
        if (!ride) throw new TRPCError({ code: "NOT_FOUND" });
        if (ride.status !== "PENDENTE") {
          throw new TRPCError({ code: "CONFLICT", message: "Corrida não está mais disponível" });
        }

        // Check motoboy doesn't already have an active ride
        const activeRide = await getActiveRideForMotoboy(ctx.user.id);
        if (activeRide) {
          // Se tem corrida ativa, só permitir aceitar se for do mesmo estabelecimento
          if (ride.establishmentId && activeRide.establishmentId !== ride.establishmentId) {
            throw new TRPCError({ code: "CONFLICT", message: "Você já possui uma corrida ativa de outro estabelecimento" });
          }
        }

        await updateRideStatus(input.rideId, "ACEITA", ctx.user.id);
        const updatedRide = await getRideById(input.rideId);

        // Notify client
        await createNotification({
          userId: ride.clientId,
          title: "Corrida aceita!",
          message: "Um motoboy aceitou sua corrida e está a caminho.",
          type: "corrida_aceita",
          rideId: input.rideId,
        });

        const io = getIo();
        if (io && updatedRide) {
          io.to(`ride_${input.rideId}`).emit("corrida_atualizada", updatedRide);
          io.to(`client_${ride.clientId}`).emit("corrida_atualizada", updatedRide);
          io.to("admins").emit("corrida_atualizada", updatedRide);
          io.to("motoboys").emit("corrida_aceita", { rideId: input.rideId });
          io.to("motoboys").emit("corrida_nao_mais_disponivel", { rideId: input.rideId });
        }

        return updatedRide ?? null;
      }),

    updateStatus: protectedProcedure
      .input(
        z.object({
          rideId: z.number(),
          status: z.enum(["CHEGADA_COLETA", "SAIDA_COLETA", "CHEGADA_ENTREGA", "SAIDA_ENTREGA", "FINALIZADA", "CANCELADA"]),
          cancelReason: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const ride = await getRideById(input.rideId);
        if (!ride) throw new TRPCError({ code: "NOT_FOUND" });

        // Access control: only motoboy of the ride or admin can update
        if (ctx.user.role !== "admin" && ride.motoboyId !== ctx.user.id && ride.clientId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        // Client can only cancel
        if (ctx.user.role === "cliente" && input.status !== "CANCELADA") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Clientes só podem cancelar corridas" });
        }

        await updateRideStatus(input.rideId, input.status, undefined);
        const updatedRide = await getRideById(input.rideId);

        // Notify relevant parties
        if (input.status === "CANCELADA") {
          const targetId = ctx.user.id === ride.clientId ? (ride.motoboyId ?? null) : ride.clientId;
          if (targetId) {
            await createNotification({
              userId: targetId,
              title: "Corrida cancelada",
              message: input.cancelReason ?? "A corrida foi cancelada.",
              type: "corrida_cancelada",
              rideId: input.rideId,
            });
          }
        }

        const io = getIo();
        if (io && updatedRide) {
          io.to(`ride_${input.rideId}`).emit("corrida_atualizada", updatedRide);
          io.to(`client_${ride.clientId}`).emit("corrida_atualizada", updatedRide);
          if (ride.motoboyId) io.to(`motoboy_${ride.motoboyId}`).emit("corrida_atualizada", updatedRide);
          io.to("admins").emit("corrida_atualizada", updatedRide);
        }

        return updatedRide ?? null;
      }),
  }),

  // ─── Tracking ──────────────────────────────────────────────────────────────
  tracking: router({
    saveLocation: motoboyProcedure
      .input(
        z.object({
          lat: z.number(),
          lng: z.number(),
          rideId: z.number().optional(),
          accuracy: z.number().optional(),
          speed: z.number().optional(),
          heading: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await saveLocation({
          motoboyId: ctx.user.id,
          rideId: input.rideId,
          lat: input.lat,
          lng: input.lng,
          accuracy: input.accuracy,
          speed: input.speed,
          heading: input.heading,
        });

        const locationData = {
          motoboyId: ctx.user.id,
          lat: input.lat,
          lng: input.lng,
          rideId: input.rideId,
          timestamp: Date.now(),
        };

        const io = getIo();
        if (io) {
          io.to("admins").emit("motoboy_location", locationData);
          if (input.rideId) {
            io.to(`ride_${input.rideId}`).emit("motoboy_location", locationData);
          }
        }

        return { success: true };
      }),

    getMotoboyLocation: protectedProcedure
      .input(z.object({ motoboyId: z.number() }))
      .query(async ({ input }) => {
        return getLatestLocationByMotoboy(input.motoboyId);
      }),

    getRideLocations: protectedProcedure
      .input(z.object({ rideId: z.number() }))
      .query(async ({ input }) => {
        return getLocationsByRide(input.rideId);
      }),

    getOnlineMotoboys: adminProcedure.query(async () => {
      return getOnlineMotoboys();
    }),
  }),

  // ─── Motoboys ──────────────────────────────────────────────────────────────
  motoboys: router({
    setOnline: motoboyProcedure
      .input(z.object({ isOnline: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user.isApproved && input.isOnline) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Seu cadastro ainda não foi aprovado pelo administrador",
          });
        }
        await setMotoboyOnlineStatus(ctx.user.id, input.isOnline);

        const io = getIo();
        if (io) {
          io.to("admins").emit("motoboy_status", {
            motoboyId: ctx.user.id,
            isOnline: input.isOnline,
            name: ctx.user.name,
          });

          if (input.isOnline) {
            io.sockets.sockets.get(ctx.user.id.toString())?.join("motoboys");
          }
        }

        return { success: true };
      }),

    getAll: adminProcedure.query(async () => {
      return getAllMotoboys();
    }),

    approve: adminProcedure
      .input(z.object({ motoboyId: z.number() }))
      .mutation(async ({ input }) => {
        await approveMotoboy(input.motoboyId);
        const motoboy = await getUserById(input.motoboyId);

        await createNotification({
          userId: input.motoboyId,
          title: "Cadastro aprovado!",
          message: "Seu cadastro foi aprovado. Agora você pode ficar online e receber corridas.",
          type: "aprovacao",
        });

        const io = getIo();
        if (io) {
          io.to(`motoboy_${input.motoboyId}`).emit("cadastro_aprovado", { approved: true });
        }

        return { success: true, motoboy };
      }),

    getOnline: protectedProcedure.query(async () => {
      return getOnlineMotoboys();
    }),
  }),

  // ─── Notifications ─────────────────────────────────────────────────────────
  notifications: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getNotificationsByUser(ctx.user.id);
    }),
    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      return getUnreadNotificationCount(ctx.user.id);
    }),
    markRead: protectedProcedure
      .input(z.object({ notificationId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await markNotificationRead(input.notificationId, ctx.user.id);
        return { success: true };
      }),
    markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
      await markAllNotificationsRead(ctx.user.id);
      return { success: true };
    }),
  }),

  // ─── Admin Dashboard ───────────────────────────────────────────────────────
  admin: router({
    revenueStats: adminProcedure.query(async () => {
      return getRevenueStats();
    }),
    allRides: adminProcedure.query(async () => {
      return getAllRides(200);
    }),
    allMotoboys: adminProcedure.query(async () => {
      return getAllMotoboys();
    }),
    reject: motoboyProcedure
      .input(z.object({ notificationId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteNotification(input.notificationId, ctx.user.id);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
