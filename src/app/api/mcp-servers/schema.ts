import { z } from "@/lib/api/openapi/zod";
import { registry } from "@/lib/api/openapi/registry";
import { ErrorResponse, SuccessResponse } from "@/lib/api/openapi/common";

const ServerType = z.enum(["stdio", "http"]);

// Response shape mirrors the Prisma MCPServer model returned by the handlers.
export const MCPServerResponse = z
  .object({
    id: z.string(),
    name: z.string(),
    type: ServerType,
    enabled: z.boolean(),
    command: z.string().nullable().optional(),
    args: z.array(z.string()).nullable().optional(),
    env: z.record(z.string(), z.string()).nullable().optional(),
    url: z.string().nullable().optional(),
    headers: z.record(z.string(), z.string()).nullable().optional(),
    requiresAuth: z.boolean().nullable().optional(),
    oauthStatus: z.string().nullable().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("MCPServer");

// stdio servers require `command`; http servers require `url`. Modeled as a
// discriminated union so the docs show the conditional fields per type.
export const CreateMCPServerBody = z
  .discriminatedUnion("type", [
    z.object({
      name: z.string(),
      type: z.literal("stdio"),
      command: z.string(),
      args: z.array(z.string()).optional(),
      env: z.record(z.string(), z.string()).optional(),
    }),
    z.object({
      name: z.string(),
      type: z.literal("http"),
      url: z.string().url(),
      headers: z.record(z.string(), z.string()).optional(),
    }),
  ])
  .openapi("CreateMCPServerBody");

export const UpdateMCPServerBody = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    type: ServerType.optional(),
    enabled: z.boolean().optional(),
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    env: z.record(z.string(), z.string()).optional(),
    url: z.string().url().optional(),
    headers: z.record(z.string(), z.string()).optional(),
  })
  .openapi("UpdateMCPServerBody");

const tags = ["MCP Servers"];
const jsonBody = (schema: z.ZodTypeAny) => ({ content: { "application/json": { schema } } });

registry.registerPath({
  method: "get",
  path: "/api/mcp-servers",
  operationId: "listMcpServers",
  summary: "List MCP servers",
  description: "Returns all configured MCP servers, ordered by creation date descending.",
  tags,
  responses: {
    200: {
      description: "Array of MCP servers",
      content: { "application/json": { schema: z.array(MCPServerResponse) } },
    },
    500: { description: "Failed to fetch MCP servers", ...jsonBody(ErrorResponse) },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/mcp-servers",
  operationId: "createMcpServer",
  summary: "Create an MCP server",
  tags,
  request: { body: { ...jsonBody(CreateMCPServerBody) } },
  responses: {
    201: { description: "Created server", ...jsonBody(MCPServerResponse) },
    400: { description: "Missing required fields", ...jsonBody(ErrorResponse) },
    409: { description: "Server name already exists", ...jsonBody(ErrorResponse) },
    500: { description: "Failed to create MCP server", ...jsonBody(ErrorResponse) },
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/mcp-servers",
  operationId: "updateMcpServer",
  summary: "Update an MCP server",
  description:
    "Updates a server. Switching type clears the fields that no longer apply (stdio vs http).",
  tags,
  request: { body: { ...jsonBody(UpdateMCPServerBody) } },
  responses: {
    200: { description: "Updated server", ...jsonBody(MCPServerResponse) },
    400: { description: "ID is required", ...jsonBody(ErrorResponse) },
    404: { description: "Server not found", ...jsonBody(ErrorResponse) },
    500: { description: "Failed to update MCP server", ...jsonBody(ErrorResponse) },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/mcp-servers",
  operationId: "deleteMcpServer",
  summary: "Delete an MCP server",
  tags,
  request: {
    query: z.object({ id: z.string().openapi({ description: "MCP server id to delete" }) }),
  },
  responses: {
    200: { description: "Deleted", ...jsonBody(SuccessResponse) },
    400: { description: "ID is required", ...jsonBody(ErrorResponse) },
    404: { description: "Server not found", ...jsonBody(ErrorResponse) },
    500: { description: "Failed to delete MCP server", ...jsonBody(ErrorResponse) },
  },
});
