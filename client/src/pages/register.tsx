import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation, useSearch } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Users, UserPlus, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useEffect } from "react";

interface PublicCommittee {
  id: string;
  name: string;
  code: string;
}

interface InviteDetails {
  email: string;
  role: string;
  teamName: string;
  expiresAt: string;
}

const registerSchema = z.object({
  firstName: z.string().min(1, "El nombre es requerido"),
  lastName: z.string().min(1, "El apellido es requerido"),
  email: z.string().email("Correo electrónico inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  confirmPassword: z.string(),
  committeeId: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const inviteToken = searchParams.get("invite");

  const { data: inviteDetails, isLoading: inviteLoading, error: inviteError } = useQuery<InviteDetails>({
    queryKey: ["/api/invites", inviteToken],
    queryFn: async () => {
      if (!inviteToken) return null;
      const response = await fetch(`/api/invites/${inviteToken}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Invitación inválida");
      }
      return response.json();
    },
    enabled: !!inviteToken,
    retry: false,
  });

  const { data: committees, isLoading: committeesLoading } = useQuery<PublicCommittee[]>({
    queryKey: ["/api/public/committees"],
    enabled: !inviteToken,
  });

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
      committeeId: "",
    },
  });

  useEffect(() => {
    if (inviteDetails?.email) {
      form.setValue("email", inviteDetails.email);
    }
  }, [inviteDetails, form]);

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterForm) => {
      const { confirmPassword, ...registerData } = data;
      const payload: any = { ...registerData };
      if (inviteToken) {
        payload.inviteToken = inviteToken;
      }
      const res = await apiRequest("POST", "/api/auth/register", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Cuenta creada",
        description: inviteToken 
          ? "Tu cuenta ha sido creada y has sido agregado al equipo"
          : "Tu cuenta ha sido creada exitosamente",
      });
      setLocation("/dashboard");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear la cuenta",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: RegisterForm) => {
    if (!inviteToken && !data.committeeId) {
      toast({
        title: "Error",
        description: "Debes seleccionar un comité",
        variant: "destructive",
      });
      return;
    }
    registerMutation.mutate(data);
  };

  if (inviteToken && inviteLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Verificando invitación...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (inviteToken && inviteError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-8 text-center">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Invitación inválida</h2>
            <p className="text-muted-foreground mb-4">
              {(inviteError as Error).message || "Esta invitación no es válida o ha expirado"}
            </p>
            <Link href="/register">
              <Button variant="outline" data-testid="button-register-without-invite">
                Registrarse sin invitación
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-md bg-primary/10">
              {inviteToken ? (
                <UserPlus className="h-8 w-8 text-primary" />
              ) : (
                <Users className="h-8 w-8 text-primary" />
              )}
            </div>
          </div>
          <CardTitle className="text-2xl">
            {inviteToken ? "Únete al Equipo" : "Crear Cuenta"}
          </CardTitle>
          <CardDescription>
            {inviteToken && inviteDetails ? (
              <span className="space-y-2">
                <span className="block">Has sido invitado a unirte al equipo</span>
                <Badge variant="secondary" className="mt-2">
                  {inviteDetails.teamName}
                </Badge>
              </span>
            ) : (
              "Regístrate para gestionar tus comités"
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Juan"
                          data-testid="input-firstname"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Apellido</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Pérez"
                          data-testid="input-lastname"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Correo Electrónico</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="tu@correo.com"
                        data-testid="input-email"
                        disabled={!!inviteToken && !!inviteDetails?.email}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contraseña</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        data-testid="input-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmar Contraseña</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        data-testid="input-confirm-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {!inviteToken && (
                <FormField
                  control={form.control}
                  name="committeeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Comité</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-committee">
                            <SelectValue placeholder={committeesLoading ? "Cargando..." : "Selecciona tu comité"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {committees?.map((committee) => (
                            <SelectItem 
                              key={committee.id} 
                              value={committee.id}
                              data-testid={`select-committee-${committee.id}`}
                            >
                              {committee.name} ({committee.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={registerMutation.isPending}
                data-testid="button-register"
              >
                {registerMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {inviteToken ? "Unirse al Equipo" : "Crear Cuenta"}
              </Button>
            </form>
          </Form>
          <div className="mt-6 text-center text-sm text-muted-foreground">
            ¿Ya tienes cuenta?{" "}
            <Link href="/login" className="text-primary hover:underline" data-testid="link-login">
              Inicia sesión
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
