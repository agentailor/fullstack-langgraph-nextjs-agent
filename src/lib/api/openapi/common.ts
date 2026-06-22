import { z } from "./zod";

// Standard error body used by most routes: `{ error: string }`.
export const ErrorResponse = z
  .object({
    error: z.string().openapi({ example: "Thread not found" }),
  })
  .openapi("ErrorResponse");

// Upload routes return an extra `field` indicating which input failed validation.
export const UploadErrorResponse = z
  .object({
    error: z.string().openapi({ example: "File too large" }),
    field: z.string().openapi({ example: "file" }),
  })
  .openapi("UploadErrorResponse");

// Simple success acknowledgement: `{ success: true }`.
export const SuccessResponse = z
  .object({
    success: z.literal(true),
  })
  .openapi("SuccessResponse");
