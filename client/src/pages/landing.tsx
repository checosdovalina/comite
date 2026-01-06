import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Calendar, Users, ClipboardCheck, Shield, Clock, Building2 } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 items-center justify-between gap-4 px-4 md:px-6">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <span className="text-lg font-semibold">Comités Distritales</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <a href="/api/login">
              <Button data-testid="button-login">Iniciar Sesión</Button>
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="container mx-auto px-4 py-16 md:py-24 lg:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
              Gestión de Roles y Asistencias para{" "}
              <span className="text-primary">Comités Distritales</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground md:text-xl">
              Organiza turnos, calendarios y asistencias de forma centralizada.
              Una plataforma multi-comité para gestionar roles internos y coordinar 
              la participación de todos los miembros.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <a href="/api/login">
                <Button size="lg" data-testid="button-get-started">
                  Comenzar Ahora
                </Button>
              </a>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-16">
          <h2 className="mb-12 text-center text-2xl font-bold md:text-3xl">
            Funcionalidades Principales
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <CardTitle>Multi-Comité</CardTitle>
                <CardDescription>
                  Gestiona múltiples comités distritales desde una sola plataforma 
                  con datos aislados y configuraciones independientes.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <CardTitle>Roles Internos</CardTitle>
                <CardDescription>
                  Define roles como Presidente, Secretario, Consejero y roles 
                  personalizados para cada comité.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <CardTitle>Calendario Visual</CardTitle>
                <CardDescription>
                  Visualiza turnos y roles por día, semana o mes con una 
                  interfaz clara y centralizada.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                  <ClipboardCheck className="h-5 w-5 text-primary" />
                </div>
                <CardTitle>Asistencias</CardTitle>
                <CardDescription>
                  Los usuarios pueden anotarse en turnos, ver cupos disponibles 
                  y cancelar con reglas configurables.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <CardTitle>Turnos Flexibles</CardTitle>
                <CardDescription>
                  Configura turnos de mañana, tarde o día completo con 
                  capacidad máxima y fechas bloqueadas.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <CardTitle>Control de Acceso</CardTitle>
                <CardDescription>
                  Permisos por rol para ver calendario, anotarse, editar roles 
                  y aprobar asistencias.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>

        <section className="bg-muted/50 py-16">
          <div className="container mx-auto px-4 text-center">
            <h2 className="mb-4 text-2xl font-bold md:text-3xl">
              Comienza a gestionar tu comité hoy
            </h2>
            <p className="mb-8 text-muted-foreground">
              Únete a los comités distritales que ya optimizan su organización.
            </p>
            <a href="/api/login">
              <Button size="lg" data-testid="button-cta-login">
                Iniciar Sesión
              </Button>
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Sistema de Gestión de Comités Distritales</p>
        </div>
      </footer>
    </div>
  );
}
