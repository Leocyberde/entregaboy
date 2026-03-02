import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useWebSocket } from "@/hooks/useWebSocket";
import DeliveryMap, { MapMarker } from "@/components/DeliveryMap";
import StatusBadge, { RideStatus } from "@/components/StatusBadge";
import NotificationBell from "@/components/NotificationBell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Bike,
  DollarSign,
  MapPin,
  Package,
  Settings,
  TrendingUp,
  Users,
  CheckCircle,
  XCircle,
  LogOut,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const { on } = useWebSocket();
  const utils = trpc.useUtils();

  const [mapMarkers, setMapMarkers] = useState<MapMarker[]>([]);
  const [priceForm, setPriceForm] = useState({
    basePrice: "10.00",
    baseDistanceKm: "5.00",
    pricePerExtraKm: "2.00",
  });

  // Queries
  const { data: stats, refetch: refetchStats } = trpc.admin.revenueStats.useQuery();
  const { data: allRides = [], refetch: refetchRides } = trpc.admin.allRides.useQuery();
  const { data: allMotoboys = [], refetch: refetchMotoboys } = trpc.admin.allMotoboys.useQuery();
  const { data: pricing } = trpc.pricing.get.useQuery();
  const { data: onlineMotoboys = [] } = trpc.tracking.getOnlineMotoboys.useQuery(undefined, {
    refetchInterval: 10000,
  });

  // Mutations
  const approveMotoboy = trpc.motoboys.approve.useMutation({
    onSuccess: (data) => {
      toast.success(`Motoboy ${data.motoboy?.name ?? ""} aprovado!`);
      refetchMotoboys();
    },
    onError: (e) => toast.error(e.message),
  });

  const updatePricing = trpc.pricing.update.useMutation({
    onSuccess: () => {
      toast.success("Regras de preço atualizadas!");
      utils.pricing.get.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  // Sync pricing form with fetched data
  useEffect(() => {
    if (pricing) {
      setPriceForm({
        basePrice: String(pricing.basePrice),
        baseDistanceKm: String(pricing.baseDistanceKm),
        pricePerExtraKm: String(pricing.pricePerExtraKm),
      });
    }
  }, [pricing]);

  // Build map markers from online motoboys
  useEffect(() => {
    const markers: MapMarker[] = onlineMotoboys
      .filter((m) => m.lastLat && m.lastLng)
      .map((m) => ({
        id: `motoboy_${m.id}`,
        lat: m.lastLat!,
        lng: m.lastLng!,
        label: m.name ?? "Motoboy",
        color: "blue",
        popup: `<b>${m.name}</b><br/>Online`,
      }));

    // Add active ride markers
    const activeRides = allRides.filter(
      (r) => r.status !== "FINALIZADA" && r.status !== "CANCELADA"
    );
    for (const ride of activeRides) {
      markers.push({
        id: `pickup_${ride.id}`,
        lat: ride.pickupLat,
        lng: ride.pickupLng,
        label: "Coleta",
        color: "green",
        popup: `<b>Coleta #${ride.id}</b><br/>${ride.pickupAddress}`,
      });
      markers.push({
        id: `delivery_${ride.id}`,
        lat: ride.deliveryLat,
        lng: ride.deliveryLng,
        label: "Entrega",
        color: "red",
        popup: `<b>Entrega #${ride.id}</b><br/>${ride.deliveryAddress}`,
      });
    }

    setMapMarkers(markers);
  }, [onlineMotoboys, allRides]);

  // WebSocket: real-time updates
  useEffect(() => {
    const unsubLocation = on<{
      motoboyId: number;
      lat: number;
      lng: number;
    }>("motoboy_location", (data) => {
      setMapMarkers((prev) => {
        const idx = prev.findIndex((m) => m.id === `motoboy_${data.motoboyId}`);
        if (idx === -1) return prev;
        const updated = [...prev];
        updated[idx] = { ...updated[idx], lat: data.lat, lng: data.lng };
        return updated;
      });
    });

    const unsubStatus = on("motoboy_status", () => {
      refetchMotoboys();
      utils.tracking.getOnlineMotoboys.invalidate();
    });

    const unsubRide = on("corrida_atualizada", () => {
      refetchRides();
      refetchStats();
    });

    return () => {
      unsubLocation();
      unsubStatus();
      unsubRide();
    };
  }, [on]);

  const pendingMotoboys = allMotoboys.filter((m) => !m.isApproved);
  const approvedMotoboys = allMotoboys.filter((m) => m.isApproved);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-sidebar text-sidebar-foreground border-b border-sidebar-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Bike className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-none">MotoDelivery</h1>
            <p className="text-xs text-sidebar-foreground/60">Painel Administrativo</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <NotificationBell />
          <span className="text-sm text-sidebar-foreground/80">{user?.name}</span>
          <Button variant="ghost" size="icon" onClick={logout} className="text-sidebar-foreground hover:bg-sidebar-accent">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign className="h-5 w-5 text-green-700" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Faturamento Total</p>
                  <p className="text-xl font-bold">
                    R$ {(stats?.total ?? 0).toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-blue-700" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Hoje</p>
                  <p className="text-xl font-bold">
                    R$ {(stats?.today ?? 0).toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Package className="h-5 w-5 text-orange-700" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Corridas Totais</p>
                  <p className="text-xl font-bold">{stats?.totalRides ?? 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Users className="h-5 w-5 text-purple-700" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Motoboys Online</p>
                  <p className="text-xl font-bold">{onlineMotoboys.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4 text-primary" />
                Mapa em Tempo Real
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 h-[400px]">
              <DeliveryMap
                markers={mapMarkers}
                className="rounded-b-lg"
              />
            </CardContent>
          </Card>

          {/* Online Motoboys */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bike className="h-4 w-4 text-primary" />
                Motoboys Online ({onlineMotoboys.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[360px] overflow-y-auto">
              {onlineMotoboys.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum motoboy online
                </p>
              ) : (
                onlineMotoboys.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
                  >
                    <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.name ?? "Sem nome"}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.vehicleModel ?? "Veículo não informado"}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="rides">
          <TabsList>
            <TabsTrigger value="rides">
              Corridas ({allRides.length})
            </TabsTrigger>
            <TabsTrigger value="motoboys">
              Motoboys ({allMotoboys.length})
              {pendingMotoboys.length > 0 && (
                <Badge variant="destructive" className="ml-2 h-4 text-xs">
                  {pendingMotoboys.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="pricing">
              <Settings className="h-4 w-4 mr-1" />
              Preços
            </TabsTrigger>
          </TabsList>

          {/* Rides Tab */}
          <TabsContent value="rides">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium">Pedido #</th>
                        <th className="text-left p-3 font-medium">Coleta</th>
                        <th className="text-left p-3 font-medium">Entrega</th>
                        <th className="text-left p-3 font-medium">Distância</th>
                        <th className="text-left p-3 font-medium">Valor</th>
                        <th className="text-left p-3 font-medium">Status</th>
                        <th className="text-left p-3 font-medium">Criado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allRides.slice(0, 50).map((ride) => (
                        <tr key={ride.id} className="border-b hover:bg-muted/30">
                          <td className="p-3 font-mono text-xs">{ride.orderNumber || ride.id}</td>
                          <td className="p-3 max-w-[180px]">
                            <p className="truncate text-xs">{ride.pickupAddress}</p>
                          </td>
                          <td className="p-3 max-w-[180px]">
                            <p className="truncate text-xs">{ride.deliveryAddress}</p>
                          </td>
                          <td className="p-3 text-xs">
                            {parseFloat(String(ride.distanceKm)).toFixed(1)} km
                          </td>
                          <td className="p-3 font-medium text-green-700">
                            R$ {parseFloat(String(ride.price)).toFixed(2)}
                            {ride.motoboyEarnings && (
                              <p className="text-[10px] text-muted-foreground font-normal">
                                Motoboy: R$ {parseFloat(String(ride.motoboyEarnings)).toFixed(2)}
                              </p>
                            )}
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
                  {allRides.length === 0 && (
                    <p className="text-center text-muted-foreground py-8 text-sm">
                      Nenhuma corrida registrada
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Motoboys Tab */}
          <TabsContent value="motoboys">
            <div className="space-y-4">
              {pendingMotoboys.length > 0 && (
                <Card className="border-orange-200 bg-orange-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-orange-800">
                      Aguardando Aprovação ({pendingMotoboys.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {pendingMotoboys.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between p-3 bg-white rounded-lg border"
                      >
                        <div>
                          <p className="font-medium text-sm">{m.name ?? "Sem nome"}</p>
                          <p className="text-xs text-muted-foreground">
                            {m.email} · {m.vehiclePlate ?? "Placa não informada"}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => approveMotoboy.mutate({ motoboyId: m.id })}
                          disabled={approveMotoboy.isPending}
                          className="gap-1"
                        >
                          <CheckCircle className="h-3 w-3" />
                          Aprovar
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    Motoboys Aprovados ({approvedMotoboys.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left p-3 font-medium">Nome</th>
                          <th className="text-left p-3 font-medium">Email</th>
                          <th className="text-left p-3 font-medium">Veículo</th>
                          <th className="text-left p-3 font-medium">Placa</th>
                          <th className="text-left p-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {approvedMotoboys.map((m) => (
                          <tr key={m.id} className="border-b hover:bg-muted/30">
                            <td className="p-3 font-medium">{m.name ?? "—"}</td>
                            <td className="p-3 text-xs text-muted-foreground">{m.email ?? "—"}</td>
                            <td className="p-3 text-xs">{m.vehicleModel ?? "—"}</td>
                            <td className="p-3 text-xs font-mono">{m.vehiclePlate ?? "—"}</td>
                            <td className="p-3">
                              <span
                                className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                                  m.isOnline
                                    ? "bg-green-100 text-green-700"
                                    : "bg-gray-100 text-gray-600"
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    m.isOnline ? "bg-green-500" : "bg-gray-400"
                                  }`}
                                />
                                {m.isOnline ? "Online" : "Offline"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {approvedMotoboys.length === 0 && (
                      <p className="text-center text-muted-foreground py-6 text-sm">
                        Nenhum motoboy aprovado
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Pricing Tab */}
          <TabsContent value="pricing">
            <Card className="max-w-md">
              <CardHeader>
                <CardTitle className="text-base">Regras de Precificação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Fórmula atual:</p>
                  <p>
                    Até {priceForm.baseDistanceKm} km → R$ {priceForm.basePrice} fixo
                  </p>
                  <p>
                    Acima → R$ {priceForm.basePrice} + R$ {priceForm.pricePerExtraKm}/km extra
                  </p>
                </div>
                <div className="space-y-3">
                  <div>
                    <Label>Valor base (R$)</Label>
                    <Input
                      type="number"
                      step="0.50"
                      value={priceForm.basePrice}
                      onChange={(e) =>
                        setPriceForm((p) => ({ ...p, basePrice: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label>Distância base (km)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={priceForm.baseDistanceKm}
                      onChange={(e) =>
                        setPriceForm((p) => ({ ...p, baseDistanceKm: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label>Valor por km adicional (R$)</Label>
                    <Input
                      type="number"
                      step="0.50"
                      value={priceForm.pricePerExtraKm}
                      onChange={(e) =>
                        setPriceForm((p) => ({ ...p, pricePerExtraKm: e.target.value }))
                      }
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => updatePricing.mutate(priceForm)}
                    disabled={updatePricing.isPending}
                  >
                    Salvar Configurações
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
