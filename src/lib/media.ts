import fs from "fs/promises";
import path from "path";
import { downloadMedia } from "./meta-api";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/3gpp": "3gp",
  "audio/aac": "aac",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/octet-stream": "bin",
};

function getExtension(contentType: string): string {
  return MIME_TO_EXT[contentType] || contentType.split("/")[1] || "bin";
}

export async function downloadAndStoreMedia(
  mediaId: string,
  accessToken: string,
  accountId: string
): Promise<{ localPath: string; publicUrl: string }> {
  const { buffer, contentType } = await downloadMedia(mediaId, accessToken);
  const ext = getExtension(contentType);

  const accountDir = path.join(UPLOADS_DIR, accountId);
  await fs.mkdir(accountDir, { recursive: true });

  const filename = `${mediaId}.${ext}`;
  const localPath = path.join(accountDir, filename);
  await fs.writeFile(localPath, buffer);

  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const publicUrl = `${appUrl}/api/media/${accountId}/${filename}`;

  return { localPath, publicUrl };
}
