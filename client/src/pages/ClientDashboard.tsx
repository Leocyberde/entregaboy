import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useWebSocket } from "@/hooks/useWebSocket";
import DeliveryMap, { MapMarker, MapRoute } from "@/components/DeliveryMap";
import StatusBadge, { RideStatus } from "@/components/StatusBadge";
import NotificationBell from "@/components/NotificationBell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Bike,
  Clock,
  DollarSign,
  MapPin,
  Navigation,
  Package,
  Search,
  X,
  LogOut,
  Loader2,
  History,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AddressResult {
  lat: number;
  lng: number;
  displayName: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
}

interface RoutePreview {
  distanceKm: number;
  durationMinutes: number;
  price: number;
  motoboyEarnings: number; // 80% do valor
  geometry: [number, number][];
}

export default function ClientDashboard() {
  const { user, logout } = useAuth();
  const { on, joinRoom, leaveRoom } = useWebSocket();
  const utils = trpc.useUtils();

  const [tab, setTab] = useState("nova");
  const [pickupInput, setPickupInput] = useState("");
  const [deliveryInput, setDeliveryInput] = useState("");
  const [pickup, setPickup] = useState<AddressResult | null>(null);
  const [delivery, setDelivery] = useState<AddressResult | null>(null);
  const [routePreview, setRoutePreview] = useState<RoutePreview | null>(null);
  const [notes, setNotes] = useState("");
  const [motoboyLocation, setMotoboyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [activeRideId, setActiveRideId] = useState<number | null>(null);

  const pickupDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deliveryDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Queries
  const { data: myRides = [], refetch: refetchRides } = trpc.rides.myRides.useQuery();
  const { data: activeRide, refetch: refetchActive } = trpc.rides.activeRide.useQuery(undefined, {
    refetchInterval: activeRideId ? 5000 : false,
  });

  // Geocoding queries (manual trigger)
  const geocodePickup = trpc.routing.geocode.useQuery(
    { address: pickupInput },
    { enabled: false }
  );
  const geocodeDelivery = trpc.routing.geocode.useQuery(
    { address: deliveryInput },
    { enabled: false }
  );

  // Route calculation
  const routeQuery = trpc.routing.calculateRoute.useQuery(
    {
      fromLat: pickup?.lat ?? 0,
      fromLng: pickup?.lng ?? 0,
      toLat: delivery?.lat ?? 0,
      toLng: delivery?.lng ?? 0,
    },
    { enabled: !!(pickup && delivery) }
  );

  // Mutations
  const createRide = trpc.rides.create.useMutation({
    onSuccess: (data) => {
      toast.success("Corrida criada! Aguardando motoboy...");
      setActiveRideId(data.rideId);
      setTab("acompanhar");
      setPickup(null);
      setDelivery(null);
      setPickupInput("");
      setDeliveryInput("");
      setRoutePreview(null);
      setNotes("");
      refetchActive();
      refetchRides();
    },
    onError: (e) => toast.error(e.message),
  });

  const cancelRide = trpc.rides.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Corrida cancelada.");
      setActiveRideId(null);
      refetchActive();
      refetchRides();
    },
    onError: (e) => toast.error(e.message),
  });

  // Sync route preview
  useEffect(() => {
    if (routeQuery.data) {
      setRoutePreview({
        distanceKm: routeQuery.data.distanceKm,
        durationMinutes: routeQuery.data.durationMinutes,
        price: routeQuery.data.price,
        motoboyEarnings: routeQuery.data.motoboyEarnings,
        geometry: routeQuery.data.geometry as [number, number][],
      });
    }
  }, [routeQuery.data]);

  // Track active ride
  useEffect(() => {
    if (activeRide) {
      setActiveRideId(activeRide.id);
      joinRoom(String(activeRide.id));
    }
    return () => {
      if (activeRide) leaveRoom(String(activeRide.id));
    };
  }, [activeRide?.id]);

  // WebSocket: motoboy location update
  useEffect(() => {
    const unsub = on<{ motoboyId: number; lat: number; lng: number; rideId?: number }>(
      "motoboy_location",
      (data) => {
        if (data.rideId === activeRideId) {
          setMotoboyLocation({ lat: data.lat, lng: data.lng });
        }
      }
    );
    const unsubRide = on("corrida_atualizada", () => {
      refetchActive();
      refetchRides();
    });
    return () => {
      unsub();
      unsubRide();
    };
  }, [on, activeRideId]);

  // Geocode pickup with debounce
  const handlePickupSearch = () => {
    if (pickupInput.length < 5) return;
    geocodePickup.refetch().then((res) => {
      if (res.data) {
        setPickup(res.data);
        toast.success("Endereço de coleta encontrado");
      } else {
        toast.error("Endereço não encontrado");
      }
    });
  };

  const handleDeliverySearch = () => {
    if (deliveryInput.length < 5) return;
    geocodeDelivery.refetch().then((res) => {
      if (res.data) {
        setDelivery(res.data);
        toast.success("Endereço de entrega encontrado");
      } else {
        toast.error("Endereço não encontrado");
      }
    });
  };

  // Build map markers for active ride tracking
  const trackingMarkers: MapMarker[] = [];
  if (activeRide) {
    trackingMarkers.push({
      id: "pickup",
      lat: activeRide.pickupLat,
      lng: activeRide.pickupLng,
      label: "Coleta",
      color: "green",
      popup: `<b>Coleta</b><br/>${activeRide.pickupAddress}`,
    });
    trackingMarkers.push({
      id: "delivery",
      lat: activeRide.deliveryLat,
      lng: activeRide.deliveryLng,
      label: "Entrega",
      color: "red",
      popup: `<b>Entrega</b><br/>${activeRide.deliveryAddress}`,
    });
    if (motoboyLocation) {
      trackingMarkers.push({
        id: "motoboy",
        lat: motoboyLocation.lat,
        lng: motoboyLocation.lng,
        label: "Motoboy",
        color: "blue",
        popup: "<b>Motoboy</b><br/>Sua localização em tempo real",
        icon: "bike", // Adicionar ícone de moto
      });
    }
  }

  // Build map markers for new ride preview
  const previewMarkers: MapMarker[] = [];
  if (pickup) {
    previewMarkers.push({
      id: "pickup_preview",
      lat: pickup.lat,
      lng: pickup.lng,
      label: "Coleta",
      color: "green",
      popup: `<b>Coleta</b><br/>${pickup.displayName}`,
    });
  }
  if (delivery) {
    previewMarkers.push({
      id: "delivery_preview",
      lat: delivery.lat,
      lng: delivery.lng,
      label: "Entrega",
      color: "red",
      popup: `<b>Entrega</b><br/>${delivery.displayName}`,
    });
  }

  const previewRoute: MapRoute | undefined = routePreview
    ? { coordinates: routePreview.geometry, color: "#E85D04" }
    : undefined;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-sidebar text-sidebar-foreground border-b border-sidebar-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Package className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-none">MotoDelivery</h1>
            <p className="text-xs text-sidebar-foreground/60">Painel do Cliente</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {activeRide && (
            <span className="flex items-center gap-1.5 text-xs bg-primary/20 text-primary-foreground px-2 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Corrida ativa
            </span>
          )}
          <NotificationBell />
          <span className="text-sm text-sidebar-foreground/80">{user?.name}</span>
          <Button variant="ghost" size="icon" onClick={logout} className="text-sidebar-foreground hover:bg-sidebar-accent">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 p-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="nova">
              <Navigation className="h-4 w-4 mr-1" />
              Nova Corrida
            </TabsTrigger>
            <TabsTrigger value="acompanhar" disabled={!activeRide}>
              <Bike className="h-4 w-4 mr-1" />
              Acompanhar
              {activeRide && (
                <span className="ml-1.5 w-2 h-2 rounded-full bg-primary animate-pulse" />
              )}
            </TabsTrigger>
            <TabsTrigger value="historico">
              <History className="h-4 w-4 mr-1" />
              Histórico
            </TabsTrigger>
          </TabsList>

          {/* Nova Corrida */}
          <TabsContent value="nova">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Form */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Solicitar Entrega</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Pickup */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
                      Endereço de Coleta
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Ex: Rua das Flores, 123, São Paulo"
                        value={pickupInput}
                        onChange={(e) => {
                          setPickupInput(e.target.value);
                          setPickup(null);
                          setRoutePreview(null);
                        }}
                        onKeyDown={(e) => e.key === "Enter" && handlePickupSearch()}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handlePickupSearch}
                        disabled={geocodePickup.isFetching}
                      >
                        {geocodePickup.isFetching ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {pickup && (
                      <p className="text-xs text-green-700 bg-green-50 px-2 py-1 rounded flex items-center gap-1">
                        <MapPin className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{pickup.displayName}</span>
                      </p>
                    )}
                  </div>

                  {/* Delivery */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
                      Endereço de Entrega
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Ex: Av. Paulista, 1000, São Paulo"
                        value={deliveryInput}
                        onChange={(e) => {
                          setDeliveryInput(e.target.value);
                          setDelivery(null);
                          setRoutePreview(null);
                        }}
                        onKeyDown={(e) => e.key === "Enter" && handleDeliverySearch()}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleDeliverySearch}
                        disabled={geocodeDelivery.isFetching}
                      >
                        {geocodeDelivery.isFetching ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {delivery && (
                      <p className="text-xs text-red-700 bg-red-50 px-2 py-1 rounded flex items-center gap-1">
                        <MapPin className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{delivery.displayName}</span>
                      </p>
                    )}
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    <Label>Observações (opcional)</Label>
                    <Input
                      placeholder="Ex: Portaria B, ligar ao chegar..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>

                  {/* Route Preview */}
                  {routeQuery.isFetching && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Calculando rota...
                    </div>
                  )}

                  {routePreview && (
                    <>
                      <Separator />
                      <div className="grid grid-cols-3 gap-3">
                        <div className="text-center p-3 bg-muted rounded-lg">
                          <Navigation className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                          <p className="text-lg font-bold">
                            {routePreview.distanceKm.toFixed(1)}
                          </p>
                          <p className="text-xs text-muted-foreground">km</p>
                        </div>
                        <div className="text-center p-3 bg-muted rounded-lg">
                          <Clock className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                          <p className="text-lg font-bold">{routePreview.durationMinutes}</p>
                          <p className="text-xs text-muted-foreground">min</p>
                        </div>
                        <div className="text-center p-3 bg-primary/10 rounded-lg border border-primary/20">
                          <DollarSign className="h-4 w-4 mx-auto mb-1 text-primary" />
                          <p className="text-lg font-bold text-primary">
                            R$ {routePreview.price.toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">total</p>
                        </div>
                      </div>

                      <Button
                        className="w-full"
                        size="lg"
                        onClick={() => {
                          if (!pickup || !delivery || !routePreview) return;
        createRide.mutate({
          pickupAddress: pickup.displayName,
          pickupStreet: pickup.street,
          pickupNumber: pickup.number,
          pickupNeighborhood: pickup.neighborhood,
          pickupCity: pickup.city,
          pickupState: pickup.state,
          pickupLat: pickup.lat,
          pickupLng: pickup.lng,
          deliveryAddress: delivery.displayName,
          deliveryStreet: delivery.street,
          deliveryNumber: delivery.number,
          deliveryNeighborhood: delivery.neighborhood,
          deliveryCity: delivery.city,
          deliveryState: delivery.state,
          deliveryLat: delivery.lat,
          deliveryLng: delivery.lng,
          distanceKm: routePreview.distanceKm,
          durationMinutes: routePreview.durationMinutes,
          price: routePreview.price,
          notes,
        });
                        }}
                        disabled={createRide.isPending || !pickup || !delivery}
                      >
                        {createRide.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Bike className="h-4 w-4 mr-2" />
                        )}
                        Solicitar Corrida
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Map Preview */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Prévia da Rota</CardTitle>
                </CardHeader>
                <CardContent className="p-0 h-[400px]">
                  <DeliveryMap
                    markers={previewMarkers}
                    route={previewRoute}
                    className="rounded-b-lg"
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Acompanhar */}
          <TabsContent value="acompanhar">
            {activeRide ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Status Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Status da Corrida</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Pedido #</span>
                      <span className="font-mono font-bold text-primary">{activeRide.orderNumber || activeRide.id}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Status</span>
                      <StatusBadge status={activeRide.status as RideStatus} />
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="w-3 h-3 rounded-full bg-green-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Coleta</p>
                          <div className="flex items-baseline gap-2">
                            <p className="text-sm font-medium">{activeRide.pickupAddress}</p>
                            <p className="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded font-bold">Nº {extractAddressNumber(activeRide.pickupAddress)}</p>
                          </div>
                          {activeRide.pickupCode && (
                            <p className="text-xs font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded mt-1 inline-block">
                              CÓDIGO DE COLETA: {activeRide.pickupCode}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="w-3 h-3 rounded-full bg-red-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Entrega</p>
                          <div className="flex items-baseline gap-2">
                            <p className="text-sm">{activeRide.deliveryAddress}</p>
                            <p className="text-xs bg-red-100 text-red-800 px-1.5 py-0.5 rounded font-bold">Nº {extractAddressNumber(activeRide.deliveryAddress)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="p-2 bg-muted rounded">
                        <p className="text-xs text-muted-foreground">Distância</p>
                        <p className="font-bold">
                          {parseFloat(String(activeRide.distanceKm)).toFixed(1)} km
                        </p>
                      </div>
                      <div className="p-2 bg-primary/10 rounded">
                        <p className="text-xs text-muted-foreground">Valor</p>
                        <p className="font-bold text-primary">
                          R$ {parseFloat(String(activeRide.price)).toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {activeRide.status === "PENDENTE" && (
                      <Button
                        variant="destructive"
                        className="w-full"
                        onClick={() =>
                          cancelRide.mutate({
                            rideId: activeRide.id,
                            status: "CANCELADA",
                            cancelReason: "Cancelado pelo cliente",
                          })
                        }
                        disabled={cancelRide.isPending}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancelar Corrida
                      </Button>
                    )}

                    {activeRide.status === "PENDENTE" && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Aguardando motoboy...
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Map */}
                <Card className="lg:col-span-2">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Rastreamento em Tempo Real</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 h-[400px]">
                    <DeliveryMap
                      markers={trackingMarkers}
                      center={
                        motoboyLocation
                          ? [motoboyLocation.lat, motoboyLocation.lng]
                          : [activeRide.pickupLat, activeRide.pickupLng]
                      }
                      className="rounded-b-lg"
                    />
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-muted-foreground">Nenhuma corrida ativa no momento</p>
                  <Button
                    className="mt-4"
                    variant="outline"
                    onClick={() => setTab("nova")}
                  >
                    Solicitar uma corrida
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Histórico */}
          <TabsContent value="historico">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Histórico de Corridas</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium">Pedido #</th>
                        <th className="text-left p-3 font-medium">Coleta (Nº)</th>
                        <th className="text-left p-3 font-medium">Entrega (Nº)</th>
                        <th className="text-left p-3 font-medium">Distância</th>
                        <th className="text-left p-3 font-medium">Valor</th>
                        <th className="text-left p-3 font-medium">Status</th>
                        <th className="text-left p-3 font-medium">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myRides.map((ride) => (
                        <tr key={ride.id} className="border-b hover:bg-muted/30">
                          <td className="p-3 font-mono text-xs">{ride.orderNumber || ride.id}</td>
                          <td className="p-3 max-w-[160px]">
                            <p className="truncate text-xs">{ride.pickupAddress} <span className="font-bold">#{extractAddressNumber(ride.pickupAddress)}</span></p>
                          </td>
                          <td className="p-3 max-w-[160px]">
                            <p className="truncate text-xs">{ride.deliveryAddress} <span className="font-bold">#{extractAddressNumber(ride.deliveryAddress)}</span></p>
                          </td>
                          <td className="p-3 text-xs">
                            {parseFloat(String(ride.distanceKm)).toFixed(1)} km
                          </td>
                          <td className="p-3 font-medium text-green-700">
                            R$ {parseFloat(String(ride.price)).toFixed(2)}
                          </td>
                          <td className="p-3">
                            <StatusBadge status={ride.status as RideStatus} />
                          </td>
                          <td className="p-3 text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(ride.createdAt), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {myRides.length === 0 && (
                    <p className="text-center text-muted-foreground py-8 text-sm">
                      Nenhuma corrida realizada ainda
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
