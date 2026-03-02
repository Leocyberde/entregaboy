import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Bike, Package, Shield, Zap, MapPin, Clock } from "lucide-react";
import { Loader2 } from "lucide-react";

export default function Home() {
  const { loading } = useAuth();
  const [, navigate] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-sidebar via-sidebar to-sidebar/90" />
        <div className="relative container py-20 text-center">
          <div className="w-20 h-20 rounded-3xl bg-primary flex items-center justify-center mx-auto mb-6 shadow-lg">
            <Bike className="h-11 w-11 text-primary-foreground" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4">
            MotoDelivery
          </h1>
          <p className="text-lg text-white/70 max-w-xl mx-auto mb-8">
            Plataforma completa de entregas por motoboy com rastreamento em tempo real.
            Conectando clientes, motoboys e gestores.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              size="lg"
              className="text-base px-8 py-6 shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={() => navigate("/login")}
            >
              Entrar
            </Button>
            <Button
              size="lg"
              className="text-base px-8 py-6 shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={() => navigate("/cadastro")}
            >
              Cadastre-se
            </Button>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="container py-16">
        <h2 className="text-2xl font-bold text-center mb-10">
          Tudo que você precisa em um só lugar
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-xl border bg-card shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mb-4">
              <Package className="h-6 w-6 text-blue-700" />
            </div>
            <h3 className="font-bold text-lg mb-2">Para Clientes</h3>
            <p className="text-muted-foreground text-sm">
              Solicite entregas informando os endereços. Veja o preço antes de confirmar e
              acompanhe o motoboy em tempo real no mapa.
            </p>
          </div>
          <div className="p-6 rounded-xl border bg-card shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center mb-4">
              <Bike className="h-6 w-6 text-orange-700" />
            </div>
            <h3 className="font-bold text-lg mb-2">Para Motoboys</h3>
            <p className="text-muted-foreground text-sm">
              Receba notificações de novas corridas, aceite ou recuse, envie sua localização
              GPS e gerencie seu histórico de entregas.
            </p>
          </div>
          <div className="p-6 rounded-xl border bg-card shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-purple-700" />
            </div>
            <h3 className="font-bold text-lg mb-2">Para Admins</h3>
            <p className="text-muted-foreground text-sm">
              Visualize todas as corridas no mapa, aprove motoboys, configure regras de preço
              e acompanhe o faturamento em tempo real.
            </p>
          </div>
        </div>
      </div>

      {/* Highlights */}
      <div className="bg-muted/50 py-12">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <p className="font-bold">OpenStreetMap</p>
              <p className="text-xs text-muted-foreground">Mapas gratuitos</p>
            </div>
            <div>
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <p className="font-bold">Tempo Real</p>
              <p className="text-xs text-muted-foreground">WebSocket GPS</p>
            </div>
            <div>
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <p className="font-bold">OSRM</p>
              <p className="text-xs text-muted-foreground">Cálculo de rotas</p>
            </div>
            <div>
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <p className="font-bold">JWT + RBAC</p>
              <p className="text-xs text-muted-foreground">Segurança total</p>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div className="container py-12 text-center">
        <h2 className="text-xl font-bold mb-2">Tabela de Preços</h2>
        <p className="text-muted-foreground text-sm mb-6">
          Transparência total antes de confirmar a corrida
        </p>
        <div className="inline-flex flex-col gap-2 bg-card border rounded-xl p-6 shadow-sm text-left">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm">Até 5 km → <strong>R$ 10,00</strong> fixo</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-orange-500" />
            <span className="text-sm">Acima de 5 km → <strong>R$ 10,00 + R$ 2,00/km</strong> adicional</span>
          </div>
        </div>
      </div>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        MotoDelivery © {new Date().getFullYear()} — Plataforma de Entregas
      </footer>
    </div>
  );
}
