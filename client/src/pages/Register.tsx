import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Bike, Package, ArrowRight } from "lucide-react";

export default function Register() {
  const [, navigate] = useLocation();
  const [selected, setSelected] = useState<"cliente" | "motoboy" | null>(null);

  const handleContinue = () => {
    if (selected === "cliente") {
      navigate("/cadastro/cliente");
    } else if (selected === "motoboy") {
      navigate("/cadastro/motoboy");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sidebar via-sidebar to-sidebar/90 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Bike className="h-9 w-9 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-white">MotoDelivery</h1>
          <p className="text-white/70 mt-2">Escolha como você quer usar a plataforma</p>
        </div>

        {/* Role Cards */}
        <div className="grid grid-cols-2 gap-4">
          {/* Cliente Card */}
          <div
            className={`cursor-pointer transition-all duration-300 rounded-3xl p-6 text-center border-2 ${
              selected === "cliente"
                ? "border-white bg-gradient-to-br from-primary to-primary/80 shadow-xl scale-105"
                : "border-white/30 bg-gradient-to-br from-white/10 to-white/5 hover:border-white/50 hover:shadow-lg"
            }`}
            onClick={() => setSelected("cliente")}
          >
            <div className="flex justify-center mb-3">
              <div className={`p-3 rounded-full ${selected === "cliente" ? "bg-white/20" : "bg-white/10"}`}>
                <Package
                  className={`h-8 w-8 ${
                    selected === "cliente" ? "text-white" : "text-white/70"
                  }`}
                />
              </div>
            </div>
            <p className="font-bold text-white text-lg">Cliente</p>
            <p className="text-sm text-white/80 mt-2">Solicitar entregas</p>
          </div>

          {/* Motoboy Card */}
          <div
            className={`cursor-pointer transition-all duration-300 rounded-3xl p-6 text-center border-2 ${
              selected === "motoboy"
                ? "border-white bg-gradient-to-br from-primary to-primary/80 shadow-xl scale-105"
                : "border-white/30 bg-gradient-to-br from-white/10 to-white/5 hover:border-white/50 hover:shadow-lg"
            }`}
            onClick={() => setSelected("motoboy")}
          >
            <div className="flex justify-center mb-3">
              <div className={`p-3 rounded-full ${selected === "motoboy" ? "bg-white/20" : "bg-white/10"}`}>
                <Bike
                  className={`h-8 w-8 ${
                    selected === "motoboy" ? "text-white" : "text-white/70"
                  }`}
                />
              </div>
            </div>
            <p className="font-bold text-white text-lg">Motoboy</p>
            <p className="text-sm text-white/80 mt-2">Realizar entregas</p>
          </div>
        </div>

        {/* Continue Button */}
        <Button
          className="w-full rounded-full py-6 text-base font-semibold shadow-lg hover:shadow-xl transition-all"
          size="lg"
          disabled={!selected}
          onClick={handleContinue}
        >
          Continuar
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>

        {/* Back Link */}
        <div className="text-center text-sm">
          <button
            onClick={() => navigate("/")}
            className="text-white/70 hover:text-white hover:underline transition-colors"
          >
            Voltar para login
          </button>
        </div>
      </div>
    </div>
  );
}
