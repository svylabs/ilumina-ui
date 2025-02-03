import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import ResultsPage from "@/pages/results-page";
import RootLayout from "@/components/layout/root-layout";

function Router() {
  return (
    <RootLayout>
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/results/:id" component={ResultsPage} />
        <Route component={NotFound} />
      </Switch>
    </RootLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;