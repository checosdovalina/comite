import type { Express, RequestHandler } from "express";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { LocalFileStorageService } from "./localFileStorage";
import { isAuthenticated } from "../../auth";
import multer from "multer";
import { randomUUID } from "crypto";
import * as path from "path";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

function isReplitEnvironment(): boolean {
  return !!(process.env.REPL_ID || process.env.REPLIT_DEPLOYMENT);
}

/**
 * Register object storage routes for file uploads.
 * Supports both Replit Object Storage (presigned URLs) and local file storage (VPS).
 */
export function registerObjectStorageRoutes(app: Express): void {
  const objectStorageService = new ObjectStorageService();
  const localFileStorage = new LocalFileStorageService();
  const useReplit = isReplitEnvironment();

  console.log(`[Storage] Using ${useReplit ? "Replit Object Storage" : "Local File Storage"}`);

  /**
   * Request a presigned URL for file upload (Replit only)
   * or get upload endpoint info for direct upload (VPS).
   */
  app.post("/api/uploads/request-url", async (req, res) => {
    try {
      const { name, size, contentType } = req.body;

      if (!name) {
        return res.status(400).json({
          error: "Missing required field: name",
        });
      }

      if (useReplit) {
        const uploadURL = await objectStorageService.getObjectEntityUploadURL();
        const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

        res.json({
          uploadURL,
          objectPath,
          metadata: { name, size, contentType },
        });
      } else {
        res.json({
          useDirectUpload: true,
          uploadEndpoint: "/api/storage/upload-direct",
          metadata: { name, size, contentType },
        });
      }
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  /**
   * Serve uploaded objects (Replit only).
   */
  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      if (useReplit) {
        const objectFile = await objectStorageService.getObjectEntityFile(req.path);
        await objectStorageService.downloadObject(objectFile, res);
      } else {
        const objectPath = req.params.objectPath;
        await localFileStorage.downloadFile(objectPath, res);
      }
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Object not found" });
      }
      return res.status(500).json({ error: "Failed to serve object" });
    }
  });

  /**
   * Get presigned upload URL for file upload.
   * For VPS, returns info for direct upload endpoint.
   */
  app.post("/api/storage/upload-url", isAuthenticated, async (req, res) => {
    try {
      const { objectKey, contentType, filename } = req.body;

      if (!objectKey && !filename) {
        return res.status(400).json({
          error: "Missing required field: objectKey or filename",
        });
      }

      if (useReplit) {
        const uploadUrl = await objectStorageService.getObjectEntityUploadURL();
        const generatedObjectPath = objectStorageService.normalizeObjectEntityPath(uploadUrl);
        res.json({
          uploadUrl,
          objectPath: generatedObjectPath,
          publicUrl: `/api/storage/download/${encodeURIComponent(generatedObjectPath)}`,
          usePresignedUrl: true,
        });
      } else {
        const generatedKey = localFileStorage.generateObjectKey(filename || objectKey);
        res.json({
          useDirectUpload: true,
          uploadEndpoint: "/api/storage/upload-direct",
          objectKey: generatedKey,
          publicUrl: `/api/storage/download/${encodeURIComponent(generatedKey)}`,
          usePresignedUrl: false,
        });
      }
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  /**
   * Direct file upload endpoint (for VPS and fallback).
   * Uses multipart form data.
   */
  app.post(
    "/api/storage/upload-direct",
    isAuthenticated,
    upload.single("file"),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No file uploaded" });
        }

        const objectKey = req.body.objectKey || localFileStorage.generateObjectKey(req.file.originalname);
        
        await localFileStorage.saveFile(req.file.buffer, objectKey);

        res.json({
          success: true,
          objectPath: objectKey,
          publicUrl: `/api/storage/download/${encodeURIComponent(objectKey)}`,
        });
      } catch (error) {
        console.error("Error uploading file:", error);
        res.status(500).json({ error: "Failed to upload file" });
      }
    }
  );

  /**
   * Download a file from storage.
   * Requires authentication for private files.
   */
  app.get("/api/storage/download/:objectPath(*)", isAuthenticated, async (req, res) => {
    try {
      const objectPath = decodeURIComponent(req.params.objectPath);
      
      if (useReplit) {
        const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
        await objectStorageService.downloadObject(objectFile, res);
      } else {
        await localFileStorage.downloadFile(objectPath, res);
      }
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError || (error as Error).message === "File not found") {
        return res.status(404).json({ error: "Object not found" });
      }
      return res.status(500).json({ error: "Failed to serve object" });
    }
  });

  /**
   * Delete a file from storage.
   * Requires authentication.
   */
  app.delete("/api/storage/delete/:objectPath(*)", isAuthenticated, async (req, res) => {
    try {
      const objectPath = decodeURIComponent(req.params.objectPath);
      
      if (!useReplit) {
        await localFileStorage.deleteFile(objectPath);
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting file:", error);
      res.status(500).json({ error: "Failed to delete file" });
    }
  });
}
