import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useWebSocket } from "@/hooks/useWebSocket";
import DeliveryMap, { MapMarker, MapRoute } from "@/components/DeliveryMap";
import StatusBadge, { RideStatus } from "@/components/StatusBadge";
import NotificationBell from "@/components/NotificationBell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Bike,
  CheckCircle,
  Clock,
  DollarSign,
  History,
  Loader2,
  LogOut,
  MapPin,
  Navigation,
  Package,
  XCircle,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type Ride = {
  id: number;
  pickupAddress: string;
  pickupStreet?: string | null;
  pickupNumber?: string | null;
  pickupNeighborhood?: string | null;
  pickupCity?: string | null;
  pickupState?: string | null;
  pickupLat: number;
  pickupLng: number;
  deliveryAddress: string;
  deliveryStreet?: string | null;
  deliveryNumber?: string | null;
  deliveryNeighborhood?: string | null;
  deliveryCity?: string | null;
  deliveryState?: string | null;
  deliveryLat: number;
  deliveryLng: number;
  distanceKm: string | number;
  durationMinutes: number;
  price: string | number;
  status: string;
  createdAt: Date;
  notes?: string | null;
};

const STATUS_SEQUENCE: Record<string, string> = {
  ACEITA: "CHEGADA_COLETA",
  CHEGADA_COLETA: "SAIDA_COLETA",
  SAIDA_COLETA: "CHEGADA_ENTREGA",
  CHEGADA_ENTREGA: "SAIDA_ENTREGA",
  SAIDA_ENTREGA: "FINALIZADA",
};

const STATUS_NEXT_LABEL: Record<string, string> = {
  ACEITA: "Cheguei na Coleta",
  CHEGADA_COLETA: "Saída da Coleta",
  SAIDA_COLETA: "Cheguei na Entrega",
  CHEGADA_ENTREGA: "Saída da Entrega",
  SAIDA_ENTREGA: "Finalizar Entrega",
};

export default function MotoboyDashboard() {
  const { user, logout } = useAuth();
  const { on, emit, joinRoom, leaveRoom } = useWebSocket();
  const utils = trpc.useUtils();

  // Use user.isOnline directly from auth instead of local state to avoid loops
  const isOnline = user?.isOnline ?? false;
  
  const [tab, setTab] = useState<"corridas" | "ativa" | "historico">("corridas");
  const [pendingRides, setPendingRides] = useState<(Ride & { notificationId?: number; expiresAt?: string })[]>([]);
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [holdProgress, setHoldProgress] = useState(0);
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Update now every second for timers
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const gpsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // Queries
  const { data: activeRide, refetch: refetchActive } = trpc.rides.activeRide.useQuery(undefined, {
    refetchInterval: isOnline ? 10000 : false,
    staleTime: 5000,
    retry: false,
  });
  const { data: myRides = [] } = trpc.rides.myRides.useQuery();
  const { data: serverNotifications = [] } = trpc.notifications.list.useQuery(undefined, {
    enabled: isOnline && !activeRide,
    refetchInterval: isOnline && !activeRide ? 10000 : false,
  });

  const { data: serverPending = [] } = trpc.rides.pending.useQuery(undefined, {
    enabled: isOnline && !activeRide,
    refetchInterval: isOnline && !activeRide ? 15000 : false,
  });

  // Mutations
  const setOnlineMutation = trpc.motoboys.setOnline.useMutation({
    onSuccess: (_, vars) => {
      toast.success(vars.isOnline ? "Você está online!" : "Você está offline.");
      utils.auth.me.invalidate();
    },
    onError: (e) => {
      toast.error(e.message);
    },
  });

  const acceptRide = trpc.rides.accept.useMutation({
    onSuccess: (ride) => {
      toast.success("Corrida aceita!");
      setTab("ativa");
      if (ride) joinRoom(String(ride.id));
      refetchActive();
      setPendingRides([]);
      utils.notifications.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const rejectRide = trpc.admin.reject.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateStatus = trpc.rides.updateStatus.useMutation({
    onSuccess: (ride) => {
      if (ride?.status === "FINALIZADA") {
        toast.success("Entrega finalizada! Parabéns!");
        setTab("historico");
        if (activeRide) leaveRoom(String(activeRide.id));
      } else {
        toast.success("Status atualizado!");
      }
      setHoldProgress(0);
      refetchActive();
      utils.rides.myRides.invalidate();
    },
    onError: (e) => {
      toast.error(e.message);
      setHoldProgress(0);
    },
  });

  // Sync pending rides from notifications (to get expiresAt)
  useEffect(() => {
    if (serverNotifications && serverNotifications.length > 0) {
      const rideNotifications = serverNotifications.filter(n => n.type === 'nova_corrida' && n.rideId);
      const ridesFromNotifs = rideNotifications.map(n => {
        const rideData = serverPending.find(r => r.id === n.rideId);
        if (!rideData) return null;
        return {
          ...rideData,
          notificationId: n.id,
          expiresAt: n.expiresAt || undefined
        };
      }).filter(Boolean) as (Ride & { notificationId?: number; expiresAt?: string })[];
      
      setPendingRides(ridesFromNotifs);
    } else if (serverPending.length > 0) {
      setPendingRides(serverPending as any);
    } else {
      setPendingRides([]);
    }
  }, [serverNotifications, serverPending]);

  // WebSocket: receive new rides
  useEffect(() => {
    const unsubNew = on<Ride>("nova_corrida", (ride) => {
      if (!activeRide) {
        setPendingRides((prev) => {
          if (prev.find((r) => r.id === ride.id)) return prev;
          toast.info(`Nova corrida disponível! R$ ${parseFloat(String(ride.price)).toFixed(2)}`);
          return [ride, ...prev];
        });
      }
    });

    const unsubAccepted = on<{ rideId: number }>("corrida_aceita", ({ rideId }) => {
      setPendingRides((prev) => prev.filter((r) => r.id !== rideId));
    });

    const unsubNotAvailable = on<{ rideId: number }>("corrida_nao_mais_disponivel", ({ rideId }) => {
      setPendingRides((prev) => prev.filter((r) => r.id !== rideId));
    });

    const unsubUpdated = on<Ride>("corrida_atualizada", (updatedRide) => {
      if (activeRide && updatedRide.id === activeRide.id) {
        utils.rides.activeRide.setData(undefined, updatedRide);
      }
      refetchActive();
      setHoldProgress(0);
    });

    const unsubApproved = on<{ approved: boolean }>("cadastro_aprovado", ({ approved }) => {
      if (approved) {
        toast.success("Seu cadastro foi aprovado! Agora você pode ficar online.");
        utils.auth.me.invalidate();
      }
    });

    return () => {
      unsubNew();
      unsubAccepted();
      unsubNotAvailable();
      unsubUpdated();
      unsubApproved();
    };
  }, [on, activeRide?.id, utils.rides.activeRide, utils.auth.me, refetchActive]);

  // GPS tracking functions
  const stopGPS = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (gpsIntervalRef.current) {
      clearInterval(gpsIntervalRef.current);
      gpsIntervalRef.current = null;
    }
  }, []);

  const handleHoldStart = (targetStatus: any) => {
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    
    let progress = 0;
    holdIntervalRef.current = setInterval(() => {
      progress += 5;
      setHoldProgress(progress);
      if (progress >= 100) {
        if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
        updateStatus.mutate({
          rideId: activeRide!.id,
          status: targetStatus,
        });
      }
    }, 50);
  };

  const handleHoldEnd = () => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    setHoldProgress(0);
  };

  const openWaze = (lat: number, lng: number) => {
    const url = `https://www.waze.com/ul?ll=${lat},${lng}&navigate=yes`;
    window.open(url, "_blank");
  };

  const startGPS = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error("GPS não disponível neste dispositivo");
      return;
    }

    // Clear previous GPS watchers
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (gpsIntervalRef.current) {
      clearInterval(gpsIntervalRef.current);
      gpsIntervalRef.current = null;
    }

    // Watch position
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => console.warn("[GPS] Error:", err),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );

    // Send to server every 5 seconds
    gpsIntervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude: lat, longitude: lng, accuracy, speed, heading } = pos.coords;
          setMyLocation({ lat, lng });
          emit("location_update", {
            lat,
            lng,
            accuracy: accuracy ?? undefined,
            speed: speed ?? undefined,
            heading: heading ?? undefined,
            rideId: activeRide?.id,
          });
        },
        (err) => console.warn("[GPS] Interval error:", err),
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 5000 }
      );
    }, 5000);
  }, [emit, activeRide?.id]);

  // Handle online/offline GPS lifecycle
  useEffect(() => {
    if (isOnline) {
      startGPS();
    } else {
      stopGPS();
    }
    return () => stopGPS();
  }, [isOnline, startGPS, stopGPS]);

  // Build map markers
  const mapMarkers: MapMarker[] = [];
  if (myLocation) {
    mapMarkers.push({
      id: "my_location",
      lat: myLocation.lat,
      lng: myLocation.lng,
      label: "Você",
      color: "blue",
      popup: "<b>Sua localização</b>",
    });
  }
  if (activeRide) {
    mapMarkers.push({
      id: "pickup",
      lat: activeRide.pickupLat,
      lng: activeRide.pickupLng,
      label: "Coleta",
      color: "green",
      popup: `<b>Coleta</b><br/>${activeRide.pickupAddress}`,
    });
    mapMarkers.push({
      id: "delivery",
      lat: activeRide.deliveryLat,
      lng: activeRide.deliveryLng,
      label: "Entrega",
      color: "red",
      popup: `<b>Entrega</b><br/>${activeRide.deliveryAddress}`,
    });
  }

  const mapCenter: [number, number] = myLocation
    ? [myLocation.lat, myLocation.lng]
    : activeRide
    ? [activeRide.pickupLat, activeRide.pickupLng]
    : [-23.5505, -46.6333];

  const isApproved = user?.isApproved;
  const completedRides = myRides.filter((r) => r.status === "FINALIZADA");
  const totalEarnings = completedRides.reduce(
    (sum, r) => sum + parseFloat(String(r.motoboyEarnings || (typeof r.price === 'number' ? r.price * 0.8 : parseFloat(String(r.price)) * 0.8))),
    0
  );

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-lg mx-auto">
      {/* Header */}
      <header className="bg-sidebar text-sidebar-foreground px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Bike className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-base leading-none">MotoDelivery</h1>
            <p className="text-xs text-sidebar-foreground/60">Painel Motoboy</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <Button variant="ghost" size="icon" onClick={logout} className="text-sidebar-foreground hover:bg-sidebar-accent">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 p-4 space-y-4">
        {/* Not approved warning */}
        {!isApproved && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-orange-900 text-sm">Cadastro Pendente</p>
                <p className="text-xs text-orange-800 mt-1">Seu cadastro está aguardando aprovação do administrador. Você não pode ficar online ainda.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* User Card */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{user?.name ?? "Motoboy"}</p>
                <p className="text-xs text-muted-foreground">
                  {isOnline ? (
                    <span className="text-green-600 font-medium">● Online — recebendo corridas</span>
                  ) : (
                    <span className="text-gray-500">● Offline</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="online-toggle" className="text-sm">
                  {isOnline ? "Online" : "Offline"}
                </Label>
                <input
                  id="online-toggle"
                  type="checkbox"
                  checked={isOnline}
                  disabled={!isApproved || setOnlineMutation.isPending}
                  onChange={(e) => {
                    setOnlineMutation.mutate({ isOnline: e.target.checked });
                  }}
                  className="w-4 h-4 cursor-pointer"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">R$ {totalEarnings.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Ganhos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">{completedRides.length}</p>
              <p className="text-xs text-muted-foreground">Entregas</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b">
          <button
            onClick={() => setTab("corridas")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === "corridas"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Corridas ({pendingRides.length})
          </button>
          <button
            onClick={() => setTab("ativa")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === "ativa"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Ativa
          </button>
          <button
            onClick={() => setTab("historico")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === "historico"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Histórico
          </button>
        </div>

        {/* Content */}
        {tab === "corridas" && (
          <div className="space-y-3">
            {!isOnline ? (
              <Card className="border-dashed">
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">Fique online para receber corridas</p>
                </CardContent>
              </Card>
            ) : pendingRides.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">Nenhuma corrida disponível no momento</p>
                </CardContent>
              </Card>
            ) : (
              pendingRides.map((ride) => {
                const expiresAt = ride.expiresAt ? new Date(ride.expiresAt) : null;
                const timeLeft = expiresAt ? expiresAt.getTime() - now : null;
                const isExpired = timeLeft !== null && timeLeft <= 0;

                return (
                  <Card key={ride.id} className={isExpired ? "opacity-50" : ""}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">R$ {parseFloat(String(ride.price)).toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">{ride.distanceKm} km • {ride.durationMinutes} min</p>
                        </div>
                        {timeLeft !== null && (
                          <Badge variant={isExpired ? "destructive" : "secondary"}>
                            {isExpired ? "Expirou" : `${Math.ceil(timeLeft / 1000)}s`}
                          </Badge>
                        )}
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs text-muted-foreground">Coleta</p>
                            <p className="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded font-bold">Nº {ride.pickupNumber || "S/N"}</p>
                            <p className="text-xs">{ride.pickupStreet ? `${ride.pickupStreet}${ride.pickupNeighborhood ? `, ${ride.pickupNeighborhood}` : ''}` : ride.pickupAddress}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs text-muted-foreground">Entrega</p>
                            <p className="text-xs bg-red-100 text-red-800 px-1.5 py-0.5 rounded font-bold">Nº {ride.deliveryNumber || "S/N"}</p>
                            <p className="text-xs">{ride.deliveryStreet ? `${ride.deliveryStreet}${ride.deliveryNeighborhood ? `, ${ride.deliveryNeighborhood}` : ''}` : ride.deliveryAddress}</p>
                          </div>
                        </div>
                      </div>

                      {ride.notes && (
                        <p className="text-xs bg-blue-50 text-blue-900 p-2 rounded border border-blue-200">
                          <strong>Observação:</strong> {ride.notes}
                        </p>
                      )}

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1"
                          disabled={isExpired || acceptRide.isPending}
                          onClick={() => acceptRide.mutate({ rideId: ride.id })}
                        >
                          {acceptRide.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                          Aceitar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          disabled={isExpired || rejectRide.isPending}
                          onClick={() => rejectRide.mutate({ rideId: ride.id })}
                        >
                          {rejectRide.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                          Recusar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}

        {tab === "ativa" && (
          <div className="space-y-4">
            {!activeRide ? (
              <Card className="border-dashed">
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">Nenhuma corrida ativa</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <DeliveryMap center={mapCenter} markers={mapMarkers} routes={[]} zoom={15} />

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Corrida #{activeRide.id}</CardTitle>
                    <StatusBadge status={activeRide.status as RideStatus} />
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-2 text-center text-sm">
                      <div>
                        <p className="text-muted-foreground">Distância</p>
                        <p className="font-mono font-bold">{activeRide.distanceKm} km</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Tempo</p>
                        <p className="font-mono font-bold">{activeRide.durationMinutes} min</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Valor</p>
                        <p className="font-mono font-bold">R$ {parseFloat(String(activeRide.price)).toFixed(2)}</p>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Coleta</p>
                        <p className="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded font-bold inline-block mb-1">Nº {activeRide.pickupNumber || "S/N"}</p>
                        <p className="text-sm">{activeRide.pickupStreet ? `${activeRide.pickupStreet}${activeRide.pickupNeighborhood ? `, ${activeRide.pickupNeighborhood}` : ''}` : activeRide.pickupAddress}</p>
                        {activeRide.status !== "FINALIZADA" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full mt-2"
                            onClick={() => openWaze(activeRide.pickupLat, activeRide.pickupLng)}
                          >
                            <Navigation className="h-3 w-3 mr-1" />
                            Navegar para Coleta
                          </Button>
                        )}
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Entrega</p>
                        <p className="text-xs bg-red-100 text-red-800 px-1.5 py-0.5 rounded font-bold inline-block mb-1">Nº {activeRide.deliveryNumber || "S/N"}</p>
                        <p className="text-sm">{activeRide.deliveryStreet ? `${activeRide.deliveryStreet}${activeRide.deliveryNeighborhood ? `, ${activeRide.deliveryNeighborhood}` : ''}` : activeRide.deliveryAddress}</p>
                        {activeRide.status !== "FINALIZADA" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full mt-2"
                            onClick={() => openWaze(activeRide.deliveryLat, activeRide.deliveryLng)}
                          >
                            <Navigation className="h-3 w-3 mr-1" />
                            Navegar para Entrega
                          </Button>
                        )}
                      </div>
                    </div>

                    {activeRide.notes && (
                      <div className="bg-blue-50 text-blue-900 p-3 rounded border border-blue-200 text-sm">
                        <strong>Observação:</strong> {activeRide.notes}
                      </div>
                    )}

                    {/* Status progression */}
                    {activeRide.status !== "FINALIZADA" && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium">Progresso</p>
                        <Progress value={(Object.keys(STATUS_SEQUENCE).indexOf(activeRide.status) + 1) / Object.keys(STATUS_SEQUENCE).length * 100} />
                        <Button
                          className="w-full"
                          disabled={updateStatus.isPending || holdProgress > 0}
                          onMouseDown={() => handleHoldStart(STATUS_SEQUENCE[activeRide.status])}
                          onMouseUp={handleHoldEnd}
                          onMouseLeave={handleHoldEnd}
                          onTouchStart={() => handleHoldStart(STATUS_SEQUENCE[activeRide.status])}
                          onTouchEnd={handleHoldEnd}
                        >
                          {updateStatus.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              Atualizando...
                            </>
                          ) : (
                            <>
                              {holdProgress > 0 && <Progress value={holdProgress} className="absolute inset-0 h-full" />}
                              <span className="relative">
                                {STATUS_NEXT_LABEL[activeRide.status]}
                              </span>
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}

        {tab === "historico" && (
          <div className="space-y-3">
            {myRides.filter((r) => r.status === "FINALIZADA").length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">Nenhuma entrega concluída</p>
                </CardContent>
              </Card>
            ) : (
              myRides
                .filter((r) => r.status === "FINALIZADA")
                .map((ride) => {
                  const deliveryTime = ride.createdAt
                    ? formatDistanceToNow(new Date(ride.createdAt), { addSuffix: true, locale: ptBR })
                    : "N/A";

                  return (
                    <Card key={ride.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-medium">R$ {parseFloat(String(ride.motoboyEarnings || (typeof ride.price === 'number' ? ride.price * 0.8 : parseFloat(String(ride.price)) * 0.8))).toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground">{ride.distanceKm} km</p>
                          </div>
                          <Badge variant="outline">
                            <CheckCircle className="h-3 w-3 mr-1 text-green-600" />
                            Concluída
                          </Badge>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Coleta</p>
                          <p className="font-mono font-bold">{ride.pickupAddress} → {ride.deliveryAddress}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground truncate">
                            {ride.pickupAddress} → {ride.deliveryAddress}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
