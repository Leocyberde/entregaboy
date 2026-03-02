import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Bike, Package, Shield, Loader2 } from "lucide-react";

interface SelectRoleProps {
  onComplete: () => void;
}

export default function SelectRole({ onComplete }: SelectRoleProps) {
  const [selected, setSelected] = useState<"cliente" | "motoboy" | null>(null);
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const utils = trpc.useUtils();

  const setRole = trpc.auth.setRole.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
      onComplete();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
      onComplete();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleConfirm = async () => {
    if (!selected) return;
    await setRole.mutateAsync({ role: selected });
    if (selected === "motoboy" && (vehiclePlate || vehicleModel)) {
      await updateProfile.mutateAsync({ vehiclePlate, vehicleModel });
    }
  };

  const isPending = setRole.isPending || updateProfile.isPending;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4">
            <Bike className="h-9 w-9 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">MotoDelivery</h1>
          <p className="text-muted-foreground mt-1">Como você vai usar a plataforma?</p>
        </div>

        {/* Role Cards */}
        <div className="grid grid-cols-2 gap-4">
          <Card
            className={`cursor-pointer transition-all border-2 ${
              selected === "cliente"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            }`}
            onClick={() => setSelected("cliente")}
          >
            <CardContent className="p-4 text-center">
              <Package
                className={`h-10 w-10 mx-auto mb-2 ${
                  selected === "cliente" ? "text-primary" : "text-muted-foreground"
                }`}
              />
              <p className="font-semibold">Cliente</p>
              <p className="text-xs text-muted-foreground mt-1">
                Solicitar entregas
              </p>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all border-2 ${
              selected === "motoboy"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            }`}
            onClick={() => setSelected("motoboy")}
          >
            <CardContent className="p-4 text-center">
              <Bike
                className={`h-10 w-10 mx-auto mb-2 ${
                  selected === "motoboy" ? "text-primary" : "text-muted-foreground"
                }`}
              />
              <p className="font-semibold">Motoboy</p>
              <p className="text-xs text-muted-foreground mt-1">
                Realizar entregas
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Motoboy extra fields */}
        {selected === "motoboy" && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-medium text-muted-foreground">
                Informações do veículo (opcional)
              </p>
              <div>
                <Label>Modelo do veículo</Label>
                <Input
                  placeholder="Ex: Honda CG 160"
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                />
              </div>
              <div>
                <Label>Placa</Label>
                <Input
                  placeholder="Ex: ABC-1234"
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                  maxLength={8}
                />
              </div>
              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted p-2 rounded">
                <Shield className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <p>
                  Seu cadastro será analisado por um administrador antes de você poder
                  receber corridas.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Button
          className="w-full"
          size="lg"
          disabled={!selected || isPending}
          onClick={handleConfirm}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : null}
          Continuar como {selected === "cliente" ? "Cliente" : selected === "motoboy" ? "Motoboy" : "..."}
        </Button>
      </div>
    </div>
  );
}
