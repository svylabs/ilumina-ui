import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "./lib/auth";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import ResultsPage from "@/pages/results-page";
import AnalysisPage from "@/pages/analysis-page";
import ProjectsPage from "@/pages/projects-page";
import NewProjectPage from "@/pages/new-project";
import AuthPage from "@/pages/auth-page";
import ResetPasswordPage from "@/pages/reset-password";
import TeamsPage, { TeamDetailPage } from "@/pages/teams-page";
import RootLayout from "@/components/layout/root-layout";
import { ProtectedRoute } from "./lib/protected-route";

function Router() {
  return (
    <RootLayout>
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/auth" component={AuthPage} />
        <Route path="/reset-password" component={ResetPasswordPage} />
        <Route path="/forgot-password" component={ResetPasswordPage} />
        <ProtectedRoute path="/projects" component={ProjectsPage} />
        <ProtectedRoute path="/new-project" component={NewProjectPage} />
        <ProtectedRoute path="/results/:id" component={ResultsPage} />
        <ProtectedRoute path="/analysis/:id" component={AnalysisPage} />
        <ProtectedRoute path="/teams" component={TeamsPage} />
        <ProtectedRoute path="/teams/:id" component={TeamDetailPage} />
        <Route component={NotFound} />
      </Switch>
    </RootLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;