import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Bike, ArrowLeft, CheckCircle } from "lucide-react";

export default function ForgotPassword() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState<"request" | "reset">("request");
  const [cpf, setCpf] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const requestReset = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      // For testing, show the token
      if ((data as any).token) {
        toast.info(`Token: ${(data as any).token}`);
      }
      setStep("reset");
    },
    onError: (e) => toast.error(e.message),
  });

  const resetPassword = trpc.auth.resetPassword.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setTimeout(() => navigate("/"), 1500);
    },
    onError: (e) => toast.error(e.message),
  });

  const handleRequestReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cpf) {
      toast.error("Digite seu CPF");
      return;
    }
    requestReset.mutate({ cpf });
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !password || !confirmPassword) {
      toast.error("Preencha todos os campos");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    resetPassword.mutate({ token, password });
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
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-3 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto">
            <Bike className="h-9 w-9 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Recuperar Senha</CardTitle>
          <CardDescription>
            {step === "request"
              ? "Digite seu CPF para receber instruções"
              : "Digite o token e sua nova senha"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {step === "request" ? (
            <form onSubmit={handleRequestReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  placeholder="000.000.000-00"
                  value={formatCPF(cpf)}
                  onChange={(e) => setCpf(e.target.value.replace(/\D/g, ""))}
                  disabled={requestReset.isPending}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={requestReset.isPending || !cpf}
                size="lg"
              >
                {requestReset.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Enviar Instruções
              </Button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="token">Token de Recuperação</Label>
                <Input
                  id="token"
                  placeholder="Cole o token recebido"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  disabled={resetPassword.isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Nova Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={resetPassword.isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={resetPassword.isPending}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={resetPassword.isPending || !token || !password || !confirmPassword}
                size="lg"
              >
                {resetPassword.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Redefinir Senha
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setStep("request");
                  setCpf("");
                  setToken("");
                  setPassword("");
                  setConfirmPassword("");
                }}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
            </form>
          )}

          {/* Back to Login */}
          <div className="mt-6 text-center text-sm">
            <button
              onClick={() => navigate("/")}
              className="text-muted-foreground hover:text-foreground hover:underline inline-flex items-center gap-1"
            >
              <ArrowLeft className="h-3 w-3" />
              Voltar para login
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
