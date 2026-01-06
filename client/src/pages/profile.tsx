import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  User,
  Mail,
  Building2,
  Calendar,
  Shield,
  Clock,
} from "lucide-react";
import type { CommitteeMember, Committee } from "@shared/schema";

interface MembershipWithCommittee extends CommitteeMember {
  committee?: Committee;
}

export default function ProfilePage() {
  const { user, isLoading: authLoading } = useAuth();

  const { data: memberships, isLoading: membershipsLoading } = useQuery<MembershipWithCommittee[]>({
    queryKey: ["/api/my-memberships"],
  });

  const roleLabels: Record<string, string> = {
    admin: "Administrador",
    president: "Presidente",
    secretary: "Secretario",
    counselor: "Consejero",
    member: "Miembro",
  };

  const roleBadgeVariants: Record<string, "default" | "secondary" | "outline"> = {
    admin: "default",
    president: "default",
    secretary: "secondary",
    counselor: "secondary",
    member: "outline",
  };

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.charAt(0) || "";
    const last = lastName?.charAt(0) || "";
    return (first + last).toUpperCase() || "U";
  };

  const isLoading = authLoading || membershipsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-64" />
          <Skeleton className="col-span-2 h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Mi Perfil</h1>
        <p className="text-muted-foreground">
          Información de tu cuenta y membresías
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader className="text-center">
            <Avatar className="mx-auto h-24 w-24">
              <AvatarImage src={user?.profileImageUrl || undefined} />
              <AvatarFallback className="text-2xl">
                {getInitials(user?.firstName, user?.lastName)}
              </AvatarFallback>
            </Avatar>
            <CardTitle className="mt-4" data-testid="text-user-name">
              {user?.firstName} {user?.lastName}
            </CardTitle>
            <CardDescription>{user?.email}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {user?.email || "No especificado"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Miembro desde</p>
                  <p className="text-sm text-muted-foreground">
                    {user?.createdAt
                      ? format(parseISO(user.createdAt as unknown as string), "d 'de' MMMM, yyyy", {
                          locale: es,
                        })
                      : "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Comités</p>
                  <p className="text-sm text-muted-foreground">
                    {memberships?.length || 0} membresías activas
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Mis Membresías</CardTitle>
            <CardDescription>
              Comités donde participas y tus roles asignados
            </CardDescription>
          </CardHeader>
          <CardContent>
            {memberships && memberships.length > 0 ? (
              <div className="space-y-4">
                {memberships.map((membership) => (
                  <div
                    key={membership.id}
                    className="flex items-center gap-4 rounded-md border p-4"
                    data-testid={`card-membership-${membership.id}`}
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium">
                          {membership.committee?.name || "Comité"}
                        </h4>
                        <Badge
                          variant={roleBadgeVariants[membership.role]}
                          className="text-xs"
                        >
                          {roleLabels[membership.role] || membership.role}
                        </Badge>
                      </div>
                      <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Shield className="h-3 w-3" />
                          <span>{membership.committee?.code}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>
                            Desde{" "}
                            {membership.joinedAt
                              ? format(
                                  parseISO(membership.joinedAt as unknown as string),
                                  "MMM yyyy",
                                  { locale: es }
                                )
                              : "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Badge variant={membership.isActive ? "default" : "secondary"}>
                      {membership.isActive ? "Activo" : "Inactivo"}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Building2 className="h-10 w-10 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-medium">Sin membresías</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  No perteneces a ningún comité actualmente
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
