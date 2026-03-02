import prisma from "./prisma";
import { User, Ride, PricingSettings, Location, Notification, Role, RideStatus, NotificationType } from "@prisma/client";

// Re-export types for compatibility
export type { User, Ride, PricingSettings, Location, Notification };

// ─── Users ────────────────────────────────────────────────────────────────────

export async function upsertUser(userData: any): Promise<void> {
  if (!userData.openId) throw new Error("User openId is required for upsert");

  const data: any = {
    openId: userData.openId,
    name: userData.name,
    email: userData.email,
    loginMethod: userData.loginMethod,
    lastSignedIn: userData.lastSignedIn || new Date(),
  };

  if (userData.role) {
    data.role = userData.role;
  }

  await prisma.user.upsert({
    where: { openId: userData.openId },
    update: data,
    create: {
      ...data,
      role: data.role || 'cliente',
    },
  });
}

export async function getUserByOpenId(openId: string): Promise<User | null> {
  return prisma.user.findUnique({
    where: { openId },
  });
}

export async function getUserById(id: number): Promise<User | null> {
  return prisma.user.findUnique({
    where: { id },
  });
}

export async function updateUserRole(userId: number, role: Role): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { role },
  });
}

export async function updateUserProfile(
  userId: number,
  data: any
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data,
  });
}

export async function setMotoboyOnlineStatus(userId: number, isOnline: boolean): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { isOnline },
  });
}

export async function approveMotoboy(userId: number): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { isApproved: true },
  });
}

export async function getAllMotoboys(): Promise<User[]> {
  return prisma.user.findMany({
    where: { role: 'motoboy' },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getOnlineMotoboys(): Promise<User[]> {
  return prisma.user.findMany({
    where: {
      role: 'motoboy',
      isOnline: true,
      isApproved: true,
    },
  });
}

export async function updateMotoboyLocation(
  userId: number,
  lat: number,
  lng: number
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      lastLat: lat,
      lastLng: lng,
      lastLocationAt: new Date(),
    },
  });
}

// ─── Pricing Settings ─────────────────────────────────────────────────────────

export async function getPricingSettings(): Promise<PricingSettings | null> {
  const settings = await prisma.pricingSettings.findFirst();
  if (!settings) {
    return prisma.pricingSettings.create({
      data: {
        basePrice: 10.00,
        baseDistanceKm: 5.00,
        pricePerExtraKm: 2.00,
      },
    });
  }
  return settings;
}

export async function updatePricingSettings(
  data: any,
  updatedBy: number
): Promise<void> {
  const existing = await prisma.pricingSettings.findFirst();
  if (!existing) {
    await prisma.pricingSettings.create({
      data: { ...data, updatedBy },
    });
  } else {
    await prisma.pricingSettings.update({
      where: { id: existing.id },
      data: { ...data, updatedBy },
    });
  }
}

// ─── Rides ────────────────────────────────────────────────────────────────────

export async function createRide(data: any): Promise<number> {
  const ride = await prisma.ride.create({
    data,
  });
  return ride.id;
}

export async function getRideById(id: number): Promise<Ride | null> {
  return prisma.ride.findUnique({
    where: { id },
  });
}

export async function getAllRides(limit = 50): Promise<Ride[]> {
  return prisma.ride.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function getRidesByClient(clientId: number): Promise<Ride[]> {
  return prisma.ride.findMany({
    where: { clientId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getRidesByMotoboy(motoboyId: number): Promise<Ride[]> {
  return prisma.ride.findMany({
    where: { motoboyId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getPendingRides(): Promise<Ride[]> {
  return prisma.ride.findMany({
    where: { status: 'PENDENTE' },
    orderBy: { createdAt: 'asc' },
  });
}

export async function getActiveRideForMotoboy(motoboyId: number): Promise<Ride | null> {
  return prisma.ride.findFirst({
    where: {
      motoboyId,
      status: {
        in: ['ACEITA', 'CHEGADA_COLETA', 'SAIDA_COLETA', 'CHEGADA_ENTREGA', 'SAIDA_ENTREGA'],
      },
    },
  });
}

export async function getActiveRideForClient(clientId: number): Promise<Ride | null> {
  return prisma.ride.findFirst({
    where: {
      clientId,
      status: {
        in: ['PENDENTE', 'ACEITA', 'CHEGADA_COLETA', 'SAIDA_COLETA', 'CHEGADA_ENTREGA', 'SAIDA_ENTREGA'],
      },
    },
  });
}

export async function updateRideStatus(
  rideId: number,
  status: RideStatus,
  motoboyId?: number
): Promise<void> {
  const now = new Date();
  const updateData: any = { status };

  if (status === 'ACEITA' && motoboyId) {
    updateData.motoboyId = motoboyId;
    updateData.acceptedAt = now;
    updateData.expiresAt = new Date(now.getTime() + 15 * 60 * 1000);
  } else if (status === 'CHEGADA_COLETA') {
    updateData.pickupArrivedAt = now;
  } else if (status === 'SAIDA_COLETA') {
    updateData.pickupDepartedAt = now;
    updateData.expiresAt = null;
  } else if (status === 'CHEGADA_ENTREGA') {
    updateData.deliveryArrivedAt = now;
  } else if (status === 'SAIDA_ENTREGA') {
    updateData.deliveryDepartedAt = now;
  } else if (status === 'FINALIZADA') {
    updateData.deliveryDepartedAt = now;
  } else if (status === 'CANCELADA') {
    updateData.canceledAt = now;
  }

  await prisma.ride.update({
    where: { id: rideId },
    data: updateData,
  });
}

export async function getTotalRevenue(): Promise<number> {
  const result = await prisma.ride.aggregate({
    where: { status: 'FINALIZADA' },
    _sum: { price: true },
  });
  return Number(result._sum.price || 0);
}

export async function getRevenueStats(): Promise<any> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [total, today, month, totalRides, completedRides] = await Promise.all([
    prisma.ride.aggregate({
      where: { status: 'FINALIZADA' },
      _sum: { price: true },
    }),
    prisma.ride.aggregate({
      where: {
        status: 'FINALIZADA',
        createdAt: { gte: startOfDay },
      },
      _sum: { price: true },
    }),
    prisma.ride.aggregate({
      where: {
        status: 'FINALIZADA',
        createdAt: { gte: startOfMonth },
      },
      _sum: { price: true },
    }),
    prisma.ride.count(),
    prisma.ride.count({
      where: { status: 'FINALIZADA' },
    }),
  ]);

  return {
    total: Number(total._sum.price || 0),
    today: Number(today._sum.price || 0),
    thisMonth: Number(month._sum.price || 0),
    totalRides,
    completedRides,
  };
}

// ─── Locations ────────────────────────────────────────────────────────────────

export async function createLocation(data: any): Promise<void> {
  await prisma.location.create({ data });
}

export async function getLocationsByRide(rideId: number): Promise<Location[]> {
  return prisma.location.findMany({
    where: { rideId },
    orderBy: { createdAt: 'asc' },
  });
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function createNotification(data: any): Promise<void> {
  await prisma.notification.create({ data });
}

export async function getNotificationsByUser(userId: number): Promise<Notification[]> {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
}

export async function markNotificationAsRead(id: number): Promise<void> {
  await prisma.notification.update({
    where: { id },
    data: { isRead: true },
  });
}
