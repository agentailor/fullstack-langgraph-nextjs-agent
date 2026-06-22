import { z } from "@/lib/api/openapi/zod";
import { registry } from "@/lib/api/openapi/registry";
import { UploadErrorResponse } from "@/lib/api/openapi/common";

// Response metadata returned after a successful upload to S3/MinIO.
export const UploadResponse = z
  .object({
    success: z.literal(true),
    url: z.string().openapi({ description: "Download URL" }),
    key: z.string().openapi({ description: "Object key (uuid + extension)" }),
    name: z.string().openapi({ description: "Original filename" }),
    type: z.string().openapi({ example: "image/png" }),
    size: z.number().int().openapi({ description: "File size in bytes" }),
  })
  .openapi("UploadResponse");

const UploadFormBody = z
  .object({
    file: z.string().openapi({ type: "string", format: "binary", description: "File to upload" }),
  })
  .openapi("UploadFormBody");

registry.registerPath({
  method: "post",
  path: "/api/agent/upload",
  operationId: "uploadFile",
  summary: "Upload a file",
  description:
    "Accepts multipart/form-data with a `file` field. Allowed: PNG/JPEG (5MB), PDF (10MB), " +
    "Markdown/plain text (2MB). Uploads to S3/MinIO and returns file metadata.",
  tags: ["Files"],
  request: {
    body: { content: { "multipart/form-data": { schema: UploadFormBody } } },
  },
  responses: {
    200: {
      description: "Upload metadata",
      content: { "application/json": { schema: UploadResponse } },
    },
    400: {
      description: "Validation failed (no file, bad type/size, or non-text content)",
      content: { "application/json": { schema: UploadErrorResponse } },
    },
    500: {
      description: "Upload failed",
      content: { "application/json": { schema: UploadErrorResponse } },
    },
  },
});
