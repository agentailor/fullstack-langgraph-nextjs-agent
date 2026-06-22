import { z } from "@/lib/api/openapi/zod";
import { registry } from "@/lib/api/openapi/registry";
import { ErrorResponse, SuccessResponse } from "@/lib/api/openapi/common";

// Mirrors `Thread` in src/types/message.ts (dates serialized as ISO strings).
export const ThreadResponse = z
  .object({
    id: z.string().openapi({ example: "clx123abc" }),
    title: z.string().openapi({ example: "New thread" }),
    createdAt: z.string().datetime().openapi({ example: "2026-06-19T12:00:00.000Z" }),
    updatedAt: z.string().datetime().openapi({ example: "2026-06-19T12:00:00.000Z" }),
  })
  .openapi("Thread");

export const UpdateThreadBody = z
  .object({
    id: z.string(),
    title: z.string(),
  })
  .openapi("UpdateThreadBody");

export const DeleteThreadBody = z
  .object({
    id: z.string(),
  })
  .openapi("DeleteThreadBody");

const tags = ["Threads"];
const jsonBody = (schema: z.ZodTypeAny) => ({ content: { "application/json": { schema } } });

registry.registerPath({
  method: "get",
  path: "/api/agent/threads",
  operationId: "listThreads",
  summary: "List threads",
  description: "Returns up to 50 threads ordered by most recently updated.",
  tags,
  responses: {
    200: {
      description: "Array of threads",
      content: { "application/json": { schema: z.array(ThreadResponse) } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/agent/threads",
  operationId: "createThread",
  summary: "Create a thread",
  description: 'Creates a new thread with the default title "New thread".',
  tags,
  responses: {
    201: { description: "Created thread", ...jsonBody(ThreadResponse) },
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/agent/threads",
  operationId: "renameThread",
  summary: "Rename a thread",
  tags,
  request: { body: { ...jsonBody(UpdateThreadBody) } },
  responses: {
    200: { description: "Updated thread", ...jsonBody(ThreadResponse) },
    400: { description: "id and title required", ...jsonBody(ErrorResponse) },
    500: { description: "Update failed", ...jsonBody(ErrorResponse) },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/agent/threads",
  operationId: "deleteThread",
  summary: "Delete a thread",
  description:
    "Deletes thread metadata. LangGraph checkpoint data becomes orphaned but does not affect functionality.",
  tags,
  request: { body: { ...jsonBody(DeleteThreadBody) } },
  responses: {
    200: { description: "Deleted", ...jsonBody(SuccessResponse) },
    400: { description: "Thread id required", ...jsonBody(ErrorResponse) },
    404: { description: "Thread not found", ...jsonBody(ErrorResponse) },
    500: { description: "Delete failed", ...jsonBody(ErrorResponse) },
  },
});
