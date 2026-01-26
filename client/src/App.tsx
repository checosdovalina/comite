import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/hooks/use-auth";
import { useSubdomain } from "@/hooks/use-subdomain";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

import LandingPage from "@/pages/landing";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import DashboardPage from "@/pages/dashboard";
import CommitteesPage from "@/pages/committees";
import CommitteeDetailPage from "@/pages/committee-detail";
import CalendarPage from "@/pages/calendar";
import AttendancesPage from "@/pages/attendances";
import AttendanceReportsPage from "@/pages/attendance-reports";
import MembersPage from "@/pages/members";
import ActivitiesPage from "@/pages/activities";
import DocumentsPage from "@/pages/documents";
import ProfilePage from "@/pages/profile";
import SettingsPage from "@/pages/settings";
import AdminPage from "@/pages/admin";
import TeamPage from "@/pages/team";
import NotFound from "@/pages/not-found";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";

function AuthenticatedRouter() {
  const { team: subdomainTeam, isSubdomainAccess } = useSubdomain();
  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex h-14 items-center justify-between gap-4 border-b px-4">
            <div className="flex items-center gap-3">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              {isSubdomainAccess && subdomainTeam && (
                <Badge variant="secondary" className="text-xs">
                  {subdomainTeam.name}
                </Badge>
              )}
            </div>
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto p-6">
            <Switch>
              <Route path="/" component={DashboardPage} />
              <Route path="/dashboard" component={DashboardPage} />
              <Route path="/committees" component={CommitteesPage} />
              <Route path="/committees/:id" component={CommitteeDetailPage} />
              <Route path="/calendar" component={CalendarPage} />
              <Route path="/attendances" component={AttendancesPage} />
              <Route path="/attendance-reports" component={AttendanceReportsPage} />
              <Route path="/members" component={MembersPage} />
              <Route path="/activities" component={ActivitiesPage} />
              <Route path="/documents" component={DocumentsPage} />
              <Route path="/profile" component={ProfilePage} />
              <Route path="/settings" component={SettingsPage} />
              <Route path="/admin" component={AdminPage} />
              <Route path="/team" component={TeamPage} />
              <Route path="/register" component={RegisterPage} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppContent() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="space-y-4 text-center">
          <Skeleton className="mx-auto h-12 w-12 rounded-full" />
          <Skeleton className="mx-auto h-4 w-32" />
          <p className="text-sm text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route path="/register" component={RegisterPage} />
        <Route component={LandingPage} />
      </Switch>
    );
  }

  return <AuthenticatedRouter />;
}

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="comites-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AppContent />
          <Toaster />
          <PWAInstallPrompt />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
