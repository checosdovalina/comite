import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Building2, Plus, Search, Users, Calendar, Settings, UserPlus } from "lucide-react";
import type { Committee, CommitteeMember } from "@shared/schema";

const createCommitteeSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  code: z.string().min(2, "El código debe tener al menos 2 caracteres").max(20, "El código debe tener máximo 20 caracteres"),
  description: z.string().optional(),
});

type CreateCommitteeForm = z.infer<typeof createCommitteeSchema>;

export default function CommitteesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const isSuperAdmin = user?.isSuperAdmin === true;

  const { data: committees, isLoading } = useQuery<Committee[]>({
    queryKey: ["/api/committees"],
  });

  const { data: availableCommittees, isLoading: isLoadingAvailable } = useQuery<Committee[]>({
    queryKey: ["/api/available-committees"],
  });

  const { data: myMemberships } = useQuery<CommitteeMember[]>({
    queryKey: ["/api/my-memberships"],
  });

  const joinMutation = useMutation({
    mutationFn: async (committeeId: string) => {
      const response = await apiRequest("POST", `/api/committees/${committeeId}/join`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/committees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-memberships"] });
      queryClient.invalidateQueries({ queryKey: ["/api/available-committees"] });
      toast({
        title: "Te has unido al comité",
        description: "Ahora eres miembro de este comité",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo unir al comité",
        variant: "destructive",
      });
    },
  });

  const form = useForm<CreateCommitteeForm>({
    resolver: zodResolver(createCommitteeSchema),
    defaultValues: {
      name: "",
      code: "",
      description: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateCommitteeForm) => {
      const response = await apiRequest("POST", "/api/committees", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/committees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-memberships"] });
      toast({
        title: "Comité creado",
        description: "El comité se ha creado correctamente",
      });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo crear el comité",
        variant: "destructive",
      });
    },
  });

  const filteredCommittees = committees?.filter(
    (committee) =>
      committee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      committee.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const roleLabels: Record<string, string> = {
    admin: "Administrador",
    president: "Presidente",
    secretary: "Secretario",
    counselor: "Consejero",
    member: "Miembro",
  };

  const notJoinedCommittees = availableCommittees?.filter(
    (c) => !myMemberships?.some((m) => m.committeeId === c.id)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Comités</h1>
          <p className="text-muted-foreground">
            {isSuperAdmin 
              ? "Gestiona los comités distritales de tu organización" 
              : "Únete a un comité para ver el calendario y registrar asistencias"}
          </p>
        </div>
        {isSuperAdmin && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-committee">
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Comité
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Nuevo Comité</DialogTitle>
              <DialogDescription>
                Ingresa los datos del nuevo comité distrital
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((data) => createMutation.mutate(data))}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del Comité</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ej: Comité 09 Torreón"
                          data-testid="input-committee-name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ej: COM-09"
                          data-testid="input-committee-code"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción (opcional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Descripción breve del comité..."
                          data-testid="input-committee-description"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    data-testid="button-cancel"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                    data-testid="button-submit-committee"
                  >
                    {createMutation.isPending ? "Creando..." : "Crear Comité"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      <Tabs defaultValue="my-committees" className="w-full">
        <TabsList>
          <TabsTrigger value="my-committees" data-testid="tab-my-committees">Mis Comités</TabsTrigger>
          <TabsTrigger value="available" data-testid="tab-available">Disponibles</TabsTrigger>
        </TabsList>

        <TabsContent value="my-committees" className="mt-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar comités..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-committees"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-12 w-12 rounded-md" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-4 w-full" />
                    <div className="mt-4 flex gap-2">
                      <Skeleton className="h-8 w-24" />
                      <Skeleton className="h-8 w-24" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredCommittees && filteredCommittees.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredCommittees.map((committee) => {
                const membership = myMemberships?.find(
                  (m) => m.committeeId === committee.id
                );
                return (
                  <Card key={committee.id} data-testid={`card-committee-${committee.id}`}>
                    <CardHeader>
                      <div className="flex items-start gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10">
                          <Building2 className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg truncate">
                            {committee.name}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-2">
                            <span>{committee.code}</span>
                            {membership && (
                              <Badge variant="secondary" className="text-xs">
                                {roleLabels[membership.role] || membership.role}
                              </Badge>
                            )}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {committee.description && (
                        <p className="mb-4 text-sm text-muted-foreground line-clamp-2">
                          {committee.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/committees/${committee.id}`}>
                          <Button variant="outline" size="sm" data-testid={`button-view-${committee.id}`}>
                            <Users className="mr-1 h-3 w-3" />
                            Ver Detalles
                          </Button>
                        </Link>
                        <Link href={`/calendar?committee=${committee.id}`}>
                          <Button variant="ghost" size="sm" data-testid={`button-calendar-${committee.id}`}>
                            <Calendar className="mr-1 h-3 w-3" />
                            Calendario
                          </Button>
                        </Link>
                        {membership?.role === "admin" && (
                          <Link href={`/committees/${committee.id}/settings`}>
                            <Button variant="ghost" size="sm" data-testid={`button-settings-${committee.id}`}>
                              <Settings className="mr-1 h-3 w-3" />
                              Configurar
                            </Button>
                          </Link>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Building2 className="h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-medium">No estás en ningún comité</h3>
                <p className="mt-2 text-center text-sm text-muted-foreground">
                  {searchQuery
                    ? "No se encontraron comités con ese término de búsqueda"
                    : "Ve a la pestaña 'Disponibles' para unirte a un comité"}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="available" className="mt-4">
          {isLoadingAvailable ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-12 w-12 rounded-md" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-4 w-full" />
                    <div className="mt-4 flex gap-2">
                      <Skeleton className="h-8 w-24" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : notJoinedCommittees && notJoinedCommittees.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {notJoinedCommittees.map((committee) => (
                <Card key={committee.id} data-testid={`card-available-${committee.id}`}>
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted">
                        <Building2 className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg truncate">
                          {committee.name}
                        </CardTitle>
                        <CardDescription>{committee.code}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {committee.description && (
                      <p className="mb-4 text-sm text-muted-foreground line-clamp-2">
                        {committee.description}
                      </p>
                    )}
                    <Button
                      onClick={() => joinMutation.mutate(committee.id)}
                      disabled={joinMutation.isPending}
                      data-testid={`button-join-${committee.id}`}
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      {joinMutation.isPending ? "Uniéndose..." : "Unirse"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Building2 className="h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-medium">
                  {availableCommittees?.length === 0 
                    ? "No hay comités disponibles" 
                    : "Ya estás en todos los comités"}
                </h3>
                <p className="mt-2 text-center text-sm text-muted-foreground">
                  {availableCommittees?.length === 0 
                    ? isSuperAdmin 
                      ? "Crea tu primer comité para comenzar" 
                      : "El administrador debe crear comités primero"
                    : "Ya eres miembro de todos los comités disponibles"}
                </p>
                {isSuperAdmin && availableCommittees?.length === 0 && (
                  <Button
                    className="mt-4"
                    onClick={() => setIsDialogOpen(true)}
                    data-testid="button-create-first"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Crear Primer Comité
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
