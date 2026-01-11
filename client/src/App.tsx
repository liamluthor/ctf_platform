import { Suspense, lazy } from "react";
import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { AuthProvider } from "./hooks/use-auth";
import { PlatformSettingsProvider } from "./hooks/use-platform-settings";
import { ProtectedRoute } from "./lib/protected-route";
import { Toaster } from "./components/ui/toaster";
import { Loader2 } from "lucide-react";

// Lazy load pages
const HomePage = lazy(() => import("./pages/home"));
const AuthPage = lazy(() => import("./pages/auth-page"));
const CtfListPage = lazy(() => import("./pages/ctf-list"));
const CtfDetailPage = lazy(() => import("./pages/ctf-detail"));
const LeaderboardPage = lazy(() => import("./pages/leaderboard"));
const ProfilePage = lazy(() => import("./pages/profile"));
const TeamPage = lazy(() => import("./pages/team"));
const TeamsListPage = lazy(() => import("./pages/teams-list"));
const AdminPage = lazy(() => import("./pages/admin"));
const NetworksPage = lazy(() => import("./pages/networks"));
const AccountSettingsPage = lazy(() => import("./pages/account-settings"));
const ForgotPasswordPage = lazy(() => import("./pages/forgot-password"));
const ResetPasswordPage = lazy(() => import("./pages/reset-password"));
const VerifyEmailPage = lazy(() => import("./pages/verify-email"));
const NotFoundPage = lazy(() => import("./pages/not-found"));

function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/auth" component={AuthPage} />
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route path="/reset-password" component={ResetPasswordPage} />
        <Route path="/verify-email" component={VerifyEmailPage} />
        <Route path="/ctfs" component={CtfListPage} />
        <Route path="/ctfs/:id" component={CtfDetailPage} />
        <Route path="/leaderboard" component={LeaderboardPage} />
        <Route path="/leaderboard/:ctfId" component={LeaderboardPage} />
        <Route path="/profile/:id" component={ProfilePage} />
        <Route path="/team" component={TeamPage} />
        <Route path="/teams" component={TeamsListPage} />
        <Route path="/teams/:id" component={TeamsListPage} />
        <Route path="/settings">
          <ProtectedRoute>
            <AccountSettingsPage />
          </ProtectedRoute>
        </Route>
        <Route path="/admin">
          <ProtectedRoute adminOnly>
            <AdminPage />
          </ProtectedRoute>
        </Route>
        <Route path="/networks">
          <ProtectedRoute adminOnly>
            <NetworksPage />
          </ProtectedRoute>
        </Route>
        <Route component={NotFoundPage} />
      </Switch>
    </Suspense>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PlatformSettingsProvider>
          <Router />
          <Toaster />
        </PlatformSettingsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
