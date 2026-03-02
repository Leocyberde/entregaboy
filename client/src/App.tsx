import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import RegisterCliente from "./pages/RegisterCliente";
import RegisterMotoboy from "./pages/RegisterMotoboy";
import ForgotPassword from "./pages/ForgotPassword";
import AdminDashboard from "./pages/AdminDashboard";
import ClientDashboard from "./pages/ClientDashboard";
import MotoboyDashboard from "./pages/MotoboyDashboard";
import SelectRole from "./pages/SelectRole";
import { useAuth } from "./_core/hooks/useAuth";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { getLoginUrl } from "./const";

// ─── Role-based redirect guard ────────────────────────────────────────────────

function AuthRouter() {
  const { user, loading, isAuthenticated } = useAuth();
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (loading) return;

    // Allow access to auth routes without authentication
    const authRoutes = ["/login", "/cadastro", "/recuperar-senha"];
    const isAuthRoute = authRoutes.some(route => location.startsWith(route));

    if (!isAuthenticated) {
      // Not logged in — allow auth routes, otherwise stay on home
      if (!isAuthRoute && location !== "/") navigate("/");
      return;
    }

    // Logged in: redirect based on role
    const role = user?.role;

    if (!role || role === "cliente" && location === "/") {
      // New user with no role set, or cliente on home
      if (!role) {
        navigate("/selecionar-perfil");
      } else if (role === "cliente" && location !== "/cliente") {
        navigate("/cliente");
      }
      return;
    }

    if (role === "admin" && !location.startsWith("/admin")) {
      navigate("/admin");
      return;
    }

    if (role === "motoboy" && !location.startsWith("/motoboy")) {
      navigate("/motoboy");
      return;
    }

    if (role === "cliente" && !location.startsWith("/cliente") && location !== "/selecionar-perfil") {
      navigate("/cliente");
      return;
    }
  }, [loading, isAuthenticated, user?.role, location]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/cadastro" component={Register} />
      <Route path="/cadastro/cliente" component={RegisterCliente} />
      <Route path="/cadastro/motoboy" component={RegisterMotoboy} />
      <Route path="/recuperar-senha" component={ForgotPassword} />
      <Route path="/selecionar-perfil">
        {isAuthenticated ? (
          <SelectRole onComplete={() => {
            const role = user?.role;
            if (role === "motoboy") window.location.href = "/motoboy";
            else window.location.href = "/cliente";
          }} />
        ) : (
          <Home />
        )}
      </Route>
      <Route path="/admin">
        {isAuthenticated && user?.role === "admin" ? <AdminDashboard /> : <Home />}
      </Route>
      <Route path="/cliente">
        {isAuthenticated && (user?.role === "cliente" || user?.role === "admin") ? (
          <ClientDashboard />
        ) : (
          <Home />
        )}
      </Route>
      <Route path="/motoboy">
        {isAuthenticated && (user?.role === "motoboy" || user?.role === "admin") ? (
          <MotoboyDashboard />
        ) : (
          <Home />
        )}
      </Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <AuthRouter />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
