import { Response } from "express";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { Readable } from "stream";

const UPLOADS_DIR = process.env.LOCAL_UPLOADS_DIR || "./uploads";

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  const privateDir = path.join(UPLOADS_DIR, ".private", "documents");
  if (!fs.existsSync(privateDir)) {
    fs.mkdirSync(privateDir, { recursive: true });
  }
}

export class LocalFileStorageService {
  constructor() {
    ensureUploadsDir();
  }

  async saveFile(fileBuffer: Buffer, objectKey: string): Promise<string> {
    const fullPath = path.join(UPLOADS_DIR, objectKey);
    const dir = path.dirname(fullPath);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(fullPath, fileBuffer);
    return objectKey;
  }

  async getFile(objectKey: string): Promise<Buffer> {
    const fullPath = path.join(UPLOADS_DIR, objectKey);
    if (!fs.existsSync(fullPath)) {
      throw new Error("File not found");
    }
    return fs.readFileSync(fullPath);
  }

  async deleteFile(objectKey: string): Promise<void> {
    const fullPath = path.join(UPLOADS_DIR, objectKey);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }

  async downloadFile(objectKey: string, res: Response): Promise<void> {
    const fullPath = path.join(UPLOADS_DIR, objectKey);
    
    if (!fs.existsSync(fullPath)) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const stat = fs.statSync(fullPath);
    const ext = path.extname(objectKey).toLowerCase();
    const contentType = getContentType(ext);

    res.set({
      "Content-Type": contentType,
      "Content-Length": stat.size,
      "Cache-Control": "private, max-age=3600",
    });

    const stream = fs.createReadStream(fullPath);
    stream.pipe(res);
  }

  generateObjectKey(filename: string): string {
    const ext = path.extname(filename);
    const uuid = randomUUID();
    return `.private/documents/${uuid}${ext}`;
  }
}

function getContentType(ext: string): string {
  const types: Record<string, string> = {
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".txt": "text/plain",
    ".csv": "text/csv",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".mp4": "video/mp4",
    ".mp3": "audio/mpeg",
    ".zip": "application/zip",
    ".rar": "application/x-rar-compressed",
  };
  return types[ext] || "application/octet-stream";
}

export function isReplitEnvironment(): boolean {
  return !!(process.env.REPL_ID && process.env.REPLIT_SIDECAR);
}
