import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Bike, Eye, EyeOff, ArrowLeft } from "lucide-react";

export default function RegisterCliente() {
  const [, navigate] = useLocation();
  const [personType, setPersonType] = useState<"fisica" | "juridica">("fisica");
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  // Pessoa Física
  const [pf, setPf] = useState({ name: "", cpf: "", password: "", email: "", phone: "" });

  // Pessoa Jurídica
  const [pj, setPj] = useState({ name: "", cnpj: "", password: "", email: "", phone: "" });

  const registerFisica = trpc.auth.registerClienteFisica.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setTimeout(() => navigate("/"), 1500);
    },
    onError: (e) => toast.error(e.message),
  });

  const registerJuridica = trpc.auth.registerClienteJuridica.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setTimeout(() => navigate("/"), 1500);
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmitFisica = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreeTerms) {
      toast.error("Você precisa aceitar os termos");
      return;
    }
    registerFisica.mutate({
      name: pf.name,
      cpf: pf.cpf,
      password: pf.password,
      email: pf.email,
      phone: pf.phone,
    });
  };

  const handleSubmitJuridica = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreeTerms) {
      toast.error("Você precisa aceitar os termos");
      return;
    }
    registerJuridica.mutate({
      name: pj.name,
      cnpj: pj.cnpj,
      password: pj.password,
      email: pj.email,
      phone: pj.phone,
    });
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

  const formatCNPJ = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length <= 14) {
      return cleaned
        .replace(/(\d{2})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1/$2")
        .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
    }
    return value;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sidebar via-sidebar to-sidebar/90 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Cadastro Cliente</CardTitle>
              <CardDescription>Crie sua conta e comece a usar</CardDescription>
            </div>
            <Bike className="h-8 w-8 text-primary" />
          </div>
        </CardHeader>

        <CardContent>
          <Tabs value={personType} onValueChange={(v) => setPersonType(v as "fisica" | "juridica")}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="fisica">Pessoa Física</TabsTrigger>
              <TabsTrigger value="juridica">Pessoa Jurídica</TabsTrigger>
            </TabsList>

            {/* Pessoa Física */}
            <TabsContent value="fisica">
              <form onSubmit={handleSubmitFisica} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pf-name">Nome Completo</Label>
                  <Input
                    id="pf-name"
                    placeholder="João Silva"
                    value={pf.name}
                    onChange={(e) => setPf({ ...pf, name: e.target.value })}
                    disabled={registerFisica.isPending}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pf-cpf">CPF</Label>
                  <Input
                    id="pf-cpf"
                    placeholder="000.000.000-00"
                    value={formatCPF(pf.cpf)}
                    onChange={(e) => setPf({ ...pf, cpf: e.target.value.replace(/\D/g, "") })}
                    disabled={registerFisica.isPending}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pf-email">Email</Label>
                  <Input
                    id="pf-email"
                    type="email"
                    placeholder="joao@example.com"
                    value={pf.email}
                    onChange={(e) => setPf({ ...pf, email: e.target.value })}
                    disabled={registerFisica.isPending}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pf-phone">Telefone</Label>
                  <Input
                    id="pf-phone"
                    placeholder="(11) 99999-9999"
                    value={pf.phone}
                    onChange={(e) => setPf({ ...pf, phone: e.target.value })}
                    disabled={registerFisica.isPending}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pf-password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="pf-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={pf.password}
                      onChange={(e) => setPf({ ...pf, password: e.target.value })}
                      disabled={registerFisica.isPending}
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

                <div className="flex items-start space-x-2 pt-2">
                  <Checkbox
                    id="pf-terms"
                    checked={agreeTerms}
                    onCheckedChange={(checked) => setAgreeTerms(checked as boolean)}
                    disabled={registerFisica.isPending}
                  />
                  <Label htmlFor="pf-terms" className="text-xs font-normal cursor-pointer">
                    Concordo com os termos de serviço e política de privacidade
                  </Label>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={registerFisica.isPending || !agreeTerms}
                  size="lg"
                >
                  {registerFisica.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Cadastrar
                </Button>
              </form>
            </TabsContent>

            {/* Pessoa Jurídica */}
            <TabsContent value="juridica">
              <form onSubmit={handleSubmitJuridica} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pj-name">Razão Social</Label>
                  <Input
                    id="pj-name"
                    placeholder="Empresa LTDA"
                    value={pj.name}
                    onChange={(e) => setPj({ ...pj, name: e.target.value })}
                    disabled={registerJuridica.isPending}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pj-cnpj">CNPJ</Label>
                  <Input
                    id="pj-cnpj"
                    placeholder="00.000.000/0000-00"
                    value={formatCNPJ(pj.cnpj)}
                    onChange={(e) => setPj({ ...pj, cnpj: e.target.value.replace(/\D/g, "") })}
                    disabled={registerJuridica.isPending}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pj-email">Email</Label>
                  <Input
                    id="pj-email"
                    type="email"
                    placeholder="contato@empresa.com"
                    value={pj.email}
                    onChange={(e) => setPj({ ...pj, email: e.target.value })}
                    disabled={registerJuridica.isPending}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pj-phone">Telefone</Label>
                  <Input
                    id="pj-phone"
                    placeholder="(11) 3000-0000"
                    value={pj.phone}
                    onChange={(e) => setPj({ ...pj, phone: e.target.value })}
                    disabled={registerJuridica.isPending}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pj-password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="pj-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={pj.password}
                      onChange={(e) => setPj({ ...pj, password: e.target.value })}
                      disabled={registerJuridica.isPending}
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

                <div className="flex items-start space-x-2 pt-2">
                  <Checkbox
                    id="pj-terms"
                    checked={agreeTerms}
                    onCheckedChange={(checked) => setAgreeTerms(checked as boolean)}
                    disabled={registerJuridica.isPending}
                  />
                  <Label htmlFor="pj-terms" className="text-xs font-normal cursor-pointer">
                    Concordo com os termos de serviço e política de privacidade
                  </Label>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={registerJuridica.isPending || !agreeTerms}
                  size="lg"
                >
                  {registerJuridica.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Cadastrar
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {/* Back Link */}
          <div className="mt-6 text-center text-sm">
            <button
              onClick={() => navigate("/cadastro")}
              className="text-muted-foreground hover:text-foreground hover:underline inline-flex items-center gap-1"
            >
              <ArrowLeft className="h-3 w-3" />
              Voltar
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
