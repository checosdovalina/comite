import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Calendar,
  Users,
  FileSpreadsheet,
  Sun,
  Sunset,
  FileText,
  Table2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  format,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  parseISO,
} from "date-fns";
import { es } from "date-fns/locale";
import type { Committee } from "@shared/schema";

interface AttendanceReportItem {
  id: string;
  date: string;
  shift: string;
  userId: string;
  userName: string;
  userEmail: string;
  registeredAt: string;
}

interface MembershipWithCommittee {
  id: string;
  committeeId: string;
  isAdmin: boolean;
  committee?: Committee;
}

export default function AttendanceReportsPage() {
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  const [selectedCommittee, setSelectedCommittee] = useState<string>("");
  const { user } = useAuth();

  const { data: memberships } = useQuery<MembershipWithCommittee[]>({
    queryKey: ["/api/my-memberships"],
  });

  const { data: committees } = useQuery<Committee[]>({
    queryKey: ["/api/committees"],
  });

  const adminCommittees = useMemo(() => {
    if (user?.isSuperAdmin) {
      return committees || [];
    }
    return (
      memberships
        ?.filter((m) => m.isAdmin && m.committee)
        .map((m) => m.committee!) || []
    );
  }, [memberships, committees, user?.isSuperAdmin]);

  const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedWeek, { weekStartsOn: 1 });

  const { data: report, isLoading: reportLoading } = useQuery<AttendanceReportItem[]>({
    queryKey: [
      "/api/attendance-report",
      selectedCommittee,
      format(weekStart, "yyyy-MM-dd"),
      format(weekEnd, "yyyy-MM-dd"),
    ],
    enabled: !!selectedCommittee,
  });

  const shiftLabels: Record<string, string> = {
    morning: "Mañana",
    afternoon: "Tarde",
    full_day: "Día completo",
  };

  const handleDownloadCSV = () => {
    if (!report || report.length === 0) return;

    const selectedCommitteeData = adminCommittees.find(
      (c) => c.id === selectedCommittee
    );

    const headers = ["Fecha", "Turno", "Nombre", "Email", "Registrado"];
    const rows = report.map((item) => [
      format(parseISO(item.date), "dd/MM/yyyy"),
      shiftLabels[item.shift] || item.shift,
      item.userName,
      item.userEmail,
      format(parseISO(item.registeredAt), "dd/MM/yyyy HH:mm"),
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join(
      "\n"
    );

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `asistencias_${selectedCommitteeData?.name || "comite"}_${format(
        weekStart,
        "yyyy-MM-dd"
      )}_${format(weekEnd, "yyyy-MM-dd")}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadExcel = () => {
    if (!report || report.length === 0) return;

    const selectedCommitteeData = adminCommittees.find(
      (c) => c.id === selectedCommittee
    );

    const headers = ["Fecha", "Turno", "Nombre", "Email", "Registrado"];
    const rows = report.map((item) => [
      format(parseISO(item.date), "dd/MM/yyyy"),
      shiftLabels[item.shift] || item.shift,
      item.userName,
      item.userEmail,
      format(parseISO(item.registeredAt), "dd/MM/yyyy HH:mm"),
    ]);

    const excelContent = [headers.join("\t"), ...rows.map((r) => r.join("\t"))].join("\n");

    const blob = new Blob([excelContent], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `asistencias_${selectedCommitteeData?.name || "comite"}_${format(
        weekStart,
        "yyyy-MM-dd"
      )}_${format(weekEnd, "yyyy-MM-dd")}.xls`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const escapeHtml = (text: string): string => {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  };

  const handleDownloadPDF = () => {
    if (!report || report.length === 0) return;

    const selectedCommitteeData = adminCommittees.find(
      (c) => c.id === selectedCommittee
    );

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const committeeName = escapeHtml(selectedCommitteeData?.name || "Comite");
    const weekRange = `${format(weekStart, "d MMM", { locale: es })} - ${format(weekEnd, "d MMM yyyy", { locale: es })}`;

    const tableRows = report.map((item) => `
      <tr>
        <td>${format(parseISO(item.date), "dd/MM/yyyy")}</td>
        <td>${escapeHtml(shiftLabels[item.shift] || item.shift)}</td>
        <td>${escapeHtml(item.userName)}</td>
        <td>${escapeHtml(item.userEmail)}</td>
        <td>${format(parseISO(item.registeredAt), "dd/MM/yyyy HH:mm")}</td>
      </tr>
    `).join("");

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Reporte de Asistencias - ${committeeName}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { text-align: center; color: #333; }
            h2 { color: #666; margin-top: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #4f46e5; color: white; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .header-info { text-align: center; color: #666; margin-bottom: 20px; }
            @media print {
              body { margin: 0; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>Reporte de Asistencias</h1>
          <div class="header-info">
            <strong>${committeeName}</strong><br/>
            Semana: ${weekRange}
          </div>
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Turno</th>
                <th>Nombre</th>
                <th>Email</th>
                <th>Registrado</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const groupedByDate = useMemo(() => {
    if (!report) return {};
    return report.reduce((acc, item) => {
      if (!acc[item.date]) {
        acc[item.date] = [];
      }
      acc[item.date].push(item);
      return acc;
    }, {} as Record<string, AttendanceReportItem[]>);
  }, [report]);

  const isAdmin =
    user?.isSuperAdmin ||
    memberships?.some((m) => m.committeeId === selectedCommittee && m.isAdmin);

  if (!user?.isSuperAdmin && adminCommittees.length === 0) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            Reportes de Asistencia
          </h1>
          <p className="text-muted-foreground">
            Solo los administradores pueden ver los reportes de asistencia
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileSpreadsheet className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground text-center">
              No tienes permisos de administrador en ningún comité
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            Reportes de Asistencia
          </h1>
          <p className="text-muted-foreground">
            Ver y descargar las listas de asistencia por semana
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Comité</label>
              <Select value={selectedCommittee} onValueChange={setSelectedCommittee}>
                <SelectTrigger data-testid="select-report-committee">
                  <SelectValue placeholder="Seleccionar comité" />
                </SelectTrigger>
                <SelectContent>
                  {adminCommittees.map((committee) => (
                    <SelectItem key={committee.id} value={committee.id}>
                      {committee.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Semana</label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSelectedWeek(subWeeks(selectedWeek, 1))}
                  data-testid="button-prev-week"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1 text-center text-sm">
                  {format(weekStart, "d MMM", { locale: es })} -{" "}
                  {format(weekEnd, "d MMM yyyy", { locale: es })}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSelectedWeek(addWeeks(selectedWeek, 1))}
                  data-testid="button-next-week"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {!selectedCommittee ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileSpreadsheet className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground text-center">
              Selecciona un comité para ver el reporte de asistencias
            </p>
          </CardContent>
        </Card>
      ) : reportLoading ? (
        <Card>
          <CardContent className="py-6">
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Lista de Asistencias
              </CardTitle>
              <CardDescription>
                {report?.length || 0} registros en esta semana
              </CardDescription>
            </div>
            {report && report.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button data-testid="button-download">
                    <Download className="mr-2 h-4 w-4" />
                    Descargar
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleDownloadCSV} data-testid="menu-download-csv">
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Descargar CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDownloadExcel} data-testid="menu-download-excel">
                    <Table2 className="mr-2 h-4 w-4" />
                    Descargar Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDownloadPDF} data-testid="menu-download-pdf">
                    <FileText className="mr-2 h-4 w-4" />
                    Descargar PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </CardHeader>
          <CardContent>
            {!report || report.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Calendar className="h-10 w-10 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No hay asistencias registradas en esta semana
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedByDate)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([date, items]) => (
                    <div key={date} className="space-y-2">
                      <h3 className="font-medium capitalize">
                        {format(parseISO(date), "EEEE, d 'de' MMMM", {
                          locale: es,
                        })}
                      </h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Turno</TableHead>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Registrado</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items
                            .sort((a, b) =>
                              a.shift === "morning" && b.shift !== "morning"
                                ? -1
                                : 1
                            )
                            .map((item) => (
                              <TableRow
                                key={item.id}
                                data-testid={`row-report-${item.id}`}
                              >
                                <TableCell>
                                  <Badge
                                    variant={
                                      item.shift === "morning"
                                        ? "default"
                                        : "secondary"
                                    }
                                    className="flex items-center gap-1 w-fit"
                                  >
                                    {item.shift === "morning" ? (
                                      <Sun className="h-3 w-3" />
                                    ) : (
                                      <Sunset className="h-3 w-3" />
                                    )}
                                    {shiftLabels[item.shift] || item.shift}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-medium">
                                  {item.userName}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {item.userEmail}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                  {format(parseISO(item.registeredAt), "HH:mm")}
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
