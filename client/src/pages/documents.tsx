import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { Document, CounselorTeam } from "@shared/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  FileText,
  Trash2,
  Download,
  Upload,
  File,
  Image,
  FileSpreadsheet,
  FileCode,
  Search,
  X,
} from "lucide-react";
import type { Committee } from "@shared/schema";

type TeamWithDetails = CounselorTeam & {
  committee?: { id: string; name: string };
};

type TeamContext = {
  isGeneralCouncilMember: boolean;
  isTeamOwner?: boolean;
  isTeamAuxiliary: boolean;
  teamId: string | null;
  team: TeamWithDetails | null;
};

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) {
    return Image;
  } else if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType.includes("csv")) {
    return FileSpreadsheet;
  } else if (mimeType.includes("pdf")) {
    return FileText;
  } else if (mimeType.includes("code") || mimeType.includes("javascript") || mimeType.includes("json")) {
    return FileCode;
  }
  return File;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

const documentCategories = [
  { value: "actas", label: "Actas" },
  { value: "informes", label: "Informes" },
  { value: "oficios", label: "Oficios" },
  { value: "formatos", label: "Formatos" },
  { value: "manuales", label: "Manuales" },
  { value: "capacitacion", label: "Capacitación" },
  { value: "normatividad", label: "Normatividad" },
  { value: "otros", label: "Otros" },
];

export default function Documents() {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadCategory, setUploadCategory] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: memberships = [], isLoading: membershipsLoading } = useQuery<any[]>({
    queryKey: ["/api/memberships"],
  });

  const { data: teamData } = useQuery<TeamContext>({
    queryKey: ["/api/team-context"],
    queryFn: async () => {
      const teamQuery = await fetch("/api/team-context");
      if (!teamQuery.ok) {
        return {
          isGeneralCouncilMember: false,
          isTeamOwner: false,
          isTeamAuxiliary: false,
          teamId: null,
          team: null,
        };
      }
      return teamQuery.json();
    },
  });

  const activeTeamId = teamData?.teamId || null;

  const { data: documents = [], isLoading: documentsLoading, refetch: refetchDocuments } = useQuery<Document[]>({
    queryKey: ["/api/documents", { teamId: activeTeamId }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeTeamId) {
        params.set("teamId", activeTeamId);
      }
      const response = await fetch(`/api/documents?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch documents");
      }
      return response.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/documents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "Documento eliminado",
        description: "El documento ha sido eliminado exitosamente.",
      });
      setDeleteConfirmId(null);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "No se pudo eliminar el documento.",
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        toast({
          variant: "destructive",
          title: "Archivo muy grande",
          description: "El archivo no puede ser mayor a 50MB.",
        });
        return;
      }
      setSelectedFile(file);
      setIsUploadDialogOpen(true);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !user) return;

    setIsUploading(true);
    try {
      const objectKey = `.private/documents/${Date.now()}_${selectedFile.name}`;

      const urlResponse = await apiRequest("POST", "/api/storage/upload-url", {
        objectKey,
        contentType: selectedFile.type,
      });

      if (!urlResponse.ok) {
        throw new Error("Failed to get upload URL");
      }

      const { uploadUrl, publicUrl } = await urlResponse.json();

      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: selectedFile,
        headers: {
          "Content-Type": selectedFile.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file");
      }

      await apiRequest("POST", "/api/documents", {
        name: selectedFile.name,
        description: uploadDescription || null,
        category: uploadCategory || null,
        objectPath: objectKey,
        fileSize: selectedFile.size,
        mimeType: selectedFile.type,
        teamId: activeTeamId,
        committeeId: null,
      });

      toast({
        title: "Documento subido",
        description: "El documento ha sido subido exitosamente.",
      });

      setIsUploadDialogOpen(false);
      setSelectedFile(null);
      setUploadDescription("");
      setUploadCategory("");
      refetchDocuments();

    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        variant: "destructive",
        title: "Error al subir",
        description: error.message || "No se pudo subir el documento.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.description?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = categoryFilter === "all" || doc.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  if (membershipsLoading) {
    return (
      <div className="container mx-auto py-6 px-4 space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Documentos</h1>
          <p className="text-muted-foreground">
            Gestiona los documentos y archivos del equipo
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileSelect}
            accept="*/*"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            data-testid="button-upload-document"
          >
            <Upload className="mr-2 h-4 w-4" />
            Subir Documento
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar documentos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-documents"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setSearchQuery("")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-48" data-testid="select-category-filter">
            <SelectValue placeholder="Todas las categorías" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {documentCategories.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {documentsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : filteredDocuments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Sin documentos</h3>
            <p className="text-muted-foreground text-center mb-4">
              {searchQuery
                ? "No se encontraron documentos con ese criterio de búsqueda."
                : "No hay documentos subidos todavía. Sube tu primer documento."}
            </p>
            {!searchQuery && (
              <Button onClick={() => fileInputRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                Subir Documento
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocuments.map((doc) => {
            const FileIcon = getFileIcon(doc.mimeType || "");
            const isOwner = doc.uploadedByUserId === user?.id;
            const downloadUrl = `/api/storage/download/${encodeURIComponent(doc.objectPath)}`;
            return (
              <Card key={doc.id} className="hover-elevate" data-testid={`card-document-${doc.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-md bg-muted">
                      <FileIcon className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-sm font-medium truncate">
                        {doc.name}
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {formatFileSize(doc.fileSize || 0)} • {doc.createdAt ? format(new Date(doc.createdAt), "dd MMM yyyy", { locale: es }) : ""}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {doc.category && (
                    <Badge variant="secondary" className="mb-2">
                      {documentCategories.find(c => c.value === doc.category)?.label || doc.category}
                    </Badge>
                  )}
                  {doc.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {doc.description}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      asChild
                    >
                      <a
                        href={downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid={`button-download-${doc.id}`}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Descargar
                      </a>
                    </Button>
                    {isOwner && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteConfirmId(doc.id)}
                        data-testid={`button-delete-${doc.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Subir Documento</DialogTitle>
            <DialogDescription>
              Agrega una descripción opcional para el documento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedFile && (
              <div className="p-4 bg-muted rounded-md">
                <div className="flex items-center gap-3">
                  <File className="h-8 w-8 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="category">Categoría</Label>
              <Select value={uploadCategory} onValueChange={setUploadCategory}>
                <SelectTrigger data-testid="select-document-category">
                  <SelectValue placeholder="Selecciona una categoría" />
                </SelectTrigger>
                <SelectContent>
                  {documentCategories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descripción (opcional)</Label>
              <Textarea
                id="description"
                placeholder="Describe el contenido del documento..."
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                data-testid="input-document-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsUploadDialogOpen(false);
                setSelectedFile(null);
                setUploadDescription("");
                setUploadCategory("");
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpload}
              disabled={isUploading || !selectedFile}
              data-testid="button-confirm-upload"
            >
              {isUploading ? "Subiendo..." : "Subir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Documento</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar este documento? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
