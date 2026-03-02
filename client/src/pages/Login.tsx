import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Bike, Eye, EyeOff } from "lucide-react";

export default function Login() {
  const [, navigate] = useLocation();
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const login = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      // Redirect based on role
      if (data.role === "admin") {
        navigate("/admin");
      } else if (data.role === "cliente") {
        navigate("/cliente");
      } else if (data.role === "motoboy") {
        if (!data.isApproved) {
          toast.info("Seu cadastro está pendente de aprovação");
        }
        navigate("/motoboy");
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cpf || !password) {
      toast.error("Preencha todos os campos");
      return;
    }
    login.mutate({ cpf, password, rememberMe });
  };

  const formatCPF = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length <= 11) {
      return cleaned
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    }
    return value;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sidebar via-sidebar to-sidebar/90 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl border-0 bg-white/95 backdrop-blur">
        <CardHeader className="space-y-3 text-center pb-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center mx-auto shadow-lg">
            <Bike className="h-9 w-9 text-primary-foreground" />
          </div>
          <CardTitle className="text-3xl font-bold">MotoDelivery</CardTitle>
          <CardDescription className="text-base">Faça login na sua conta</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* CPF */}
            <div className="space-y-2">
              <Label htmlFor="cpf" className="font-semibold">CPF</Label>
              <Input
                id="cpf"
                placeholder="000.000.000-00"
                value={formatCPF(cpf)}
                onChange={(e) => setCpf(e.target.value.replace(/\D/g, ""))}
                disabled={login.isPending}
                className="rounded-xl border-2 border-gray-200 focus:border-primary h-11"
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password" className="font-semibold">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={login.isPending}
                  className="rounded-xl border-2 border-gray-200 focus:border-primary h-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="rememberMe"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                disabled={login.isPending}
              />
              <Label htmlFor="rememberMe" className="text-sm font-normal cursor-pointer">
                Lembrar de mim
              </Label>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full rounded-full py-6 text-base font-semibold shadow-lg hover:shadow-xl transition-all"
              disabled={login.isPending || !cpf || !password}
              size="lg"
            >
              {login.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Entrar
            </Button>
          </form>

          {/* Links */}
          <div className="mt-6 space-y-3 text-center text-sm">
            <div>
              Não tem conta?{" "}
              <button
                onClick={() => navigate("/cadastro")}
                className="text-primary hover:underline font-semibold transition-colors"
              >
                Cadastre-se
              </button>
            </div>
            <div>
              <button
                onClick={() => navigate("/recuperar-senha")}
                className="text-muted-foreground hover:text-foreground hover:underline transition-colors"
              >
                Esqueceu a senha?
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
