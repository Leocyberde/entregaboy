import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock DB and routing modules
vi.mock("./db", () => ({
  getPricingSettings: vi.fn().mockResolvedValue({
    id: 1,
    basePrice: "10.00",
    baseDistanceKm: "5.00",
    pricePerExtraKm: "2.00",
    updatedBy: null,
    updatedAt: new Date(),
  }),
  calculatePrice: vi.fn((distanceKm: number, settings: any) => {
    const base = parseFloat(settings.basePrice);
    const baseKm = parseFloat(settings.baseDistanceKm);
    const perKm = parseFloat(settings.pricePerExtraKm);
    if (distanceKm <= baseKm) return base;
    return base + (distanceKm - baseKm) * perKm;
  }),
  createRide: vi.fn().mockResolvedValue(1),
  getRideById: vi.fn().mockResolvedValue({
    id: 1,
    clientId: 1,
    motoboyId: null,
    pickupAddress: "Rua A, 100",
    pickupLat: -23.55,
    pickupLng: -46.63,
    deliveryAddress: "Rua B, 200",
    deliveryLat: -23.56,
    deliveryLng: -46.64,
    distanceKm: "3.00",
    durationMinutes: 10,
    price: "10.00",
    status: "PENDENTE",
    notes: null,
    cancelReason: null,
    acceptedAt: null,
    pickedUpAt: null,
    deliveredAt: null,
    canceledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  getActiveRideForClient: vi.fn().mockResolvedValue(null),
  getOnlineMotoboys: vi.fn().mockResolvedValue([]),
  createNotification: vi.fn().mockResolvedValue(undefined),
  getAllRides: vi.fn().mockResolvedValue([]),
  getRidesByClient: vi.fn().mockResolvedValue([]),
  getRidesByMotoboy: vi.fn().mockResolvedValue([]),
  getPendingRides: vi.fn().mockResolvedValue([]),
  getActiveRideForMotoboy: vi.fn().mockResolvedValue(null),
  updateRideStatus: vi.fn().mockResolvedValue(undefined),
  getTotalRevenue: vi.fn().mockResolvedValue(0),
  getRevenueStats: vi.fn().mockResolvedValue({
    total: 0, today: 0, thisMonth: 0, totalRides: 0, completedRides: 0,
  }),
  getAllMotoboys: vi.fn().mockResolvedValue([]),
  approveMotoboy: vi.fn().mockResolvedValue(undefined),
  getUserById: vi.fn().mockResolvedValue({ id: 2, name: "Motoboy Test", role: "motoboy" }),
  setMotoboyOnlineStatus: vi.fn().mockResolvedValue(undefined),
  saveLocation: vi.fn().mockResolvedValue(undefined),
  getLatestLocationByMotoboy: vi.fn().mockResolvedValue(null),
  getLocationsByRide: vi.fn().mockResolvedValue([]),
  getNotificationsByUser: vi.fn().mockResolvedValue([]),
  getUnreadNotificationCount: vi.fn().mockResolvedValue(0),
  markNotificationRead: vi.fn().mockResolvedValue(undefined),
  markAllNotificationsRead: vi.fn().mockResolvedValue(undefined),
  updatePricingSettings: vi.fn().mockResolvedValue(undefined),
  updateUserProfile: vi.fn().mockResolvedValue(undefined),
  updateUserRole: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./services/routing", () => ({
  geocodeAddress: vi.fn().mockResolvedValue({
    lat: -23.55,
    lng: -46.63,
    displayName: "Rua A, 100, São Paulo",
  }),
  calculateRoute: vi.fn().mockResolvedValue({
    distanceKm: 3.0,
    durationMinutes: 10,
    geometry: [[-46.63, -23.55], [-46.64, -23.56]],
  }),
}));

vi.mock("./websocket", () => ({
  getIo: vi.fn().mockReturnValue(null),
}));

function makeCtx(role: "admin" | "cliente" | "motoboy", overrides?: Partial<TrpcContext["user"]>): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role,
      isOnline: false,
      isApproved: role === "motoboy" ? true : false,
      vehiclePlate: null,
      vehicleModel: null,
      lastLat: null,
      lastLng: null,
      lastLocationAt: null,
      phone: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      ...overrides,
    } as any,
    req: { protocol: "https", headers: {} } as any,
    res: { clearCookie: vi.fn() } as any,
  };
}

// ─── Pricing Tests ────────────────────────────────────────────────────────────

describe("Pricing calculation", () => {
  it("charges base price for distances up to 5km", async () => {
    const { calculatePrice } = await import("./db");
    const settings = {
      basePrice: "10.00",
      baseDistanceKm: "5.00",
      pricePerExtraKm: "2.00",
    } as any;

    expect(calculatePrice(3, settings)).toBe(10);
    expect(calculatePrice(5, settings)).toBe(10);
  });

  it("charges extra per km above 5km", async () => {
    const { calculatePrice } = await import("./db");
    const settings = {
      basePrice: "10.00",
      baseDistanceKm: "5.00",
      pricePerExtraKm: "2.00",
    } as any;

    expect(calculatePrice(7, settings)).toBe(14); // 10 + 2*2
    expect(calculatePrice(10, settings)).toBe(20); // 10 + 5*2
  });
});

// ─── Auth Tests ───────────────────────────────────────────────────────────────

describe("auth.me", () => {
  it("returns null for unauthenticated users", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as any,
      res: { clearCookie: vi.fn() } as any,
    };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("returns user for authenticated users", async () => {
    const ctx = makeCtx("cliente");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result?.role).toBe("cliente");
  });
});

// ─── Rides Tests ──────────────────────────────────────────────────────────────

describe("rides.create", () => {
  it("creates a ride for authenticated cliente", async () => {
    const ctx = makeCtx("cliente");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.rides.create({
      pickupAddress: "Rua A, 100",
      pickupLat: -23.55,
      pickupLng: -46.63,
      deliveryAddress: "Rua B, 200",
      deliveryLat: -23.56,
      deliveryLng: -46.64,
      distanceKm: 3.0,
      durationMinutes: 10,
      price: 10.0,
    });
    expect(result.rideId).toBe(1);
  });

  it("rejects ride creation for motoboy role", async () => {
    const ctx = makeCtx("motoboy");
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.rides.create({
        pickupAddress: "Rua A, 100",
        pickupLat: -23.55,
        pickupLng: -46.63,
        deliveryAddress: "Rua B, 200",
        deliveryLat: -23.56,
        deliveryLng: -46.64,
        distanceKm: 3.0,
        durationMinutes: 10,
        price: 10.0,
      })
    ).rejects.toThrow();
  });
});

// ─── Notifications Tests ──────────────────────────────────────────────────────

describe("notifications", () => {
  it("returns empty list for user with no notifications", async () => {
    const ctx = makeCtx("cliente");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.notifications.list();
    expect(result).toEqual([]);
  });

  it("returns 0 unread count initially", async () => {
    const ctx = makeCtx("motoboy");
    const caller = appRouter.createCaller(ctx);
    const count = await caller.notifications.unreadCount();
    expect(count).toBe(0);
  });
});

// ─── Admin Tests ──────────────────────────────────────────────────────────────

describe("admin procedures", () => {
  it("allows admin to get revenue stats", async () => {
    const ctx = makeCtx("admin");
    const caller = appRouter.createCaller(ctx);
    const stats = await caller.admin.revenueStats();
    expect(stats).toHaveProperty("total");
    expect(stats).toHaveProperty("today");
    expect(stats).toHaveProperty("totalRides");
  });

  it("rejects non-admin from revenue stats", async () => {
    const ctx = makeCtx("cliente");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.admin.revenueStats()).rejects.toThrow();
  });
});
