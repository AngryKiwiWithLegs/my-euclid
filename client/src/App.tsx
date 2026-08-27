/** 欧几里得档案室：应用外壳应保持纸张工作台的安静层次。 */
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Router as WouterRouter, Switch } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

function AppRoutes() {
  return <Switch><Route path="/" component={Home} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch>;
}

export default function App() {
  const isDesktop = typeof window !== "undefined" && Boolean(window.myEuclid);
  const routes = isDesktop ? <WouterRouter hook={useHashLocation}><AppRoutes /></WouterRouter> : <AppRoutes />;
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster />{routes}</TooltipProvider></ThemeProvider></ErrorBoundary>;
}
