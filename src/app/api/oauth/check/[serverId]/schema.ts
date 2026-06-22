import { z } from "@/lib/api/openapi/zod";
import { registry } from "@/lib/api/openapi/registry";

// Mirrors CheckOAuthResponse in the route handler.
export const CheckOAuthResponse = z
  .object({
    serverId: z.string(),
    requiresAuth: z.boolean(),
    connected: z.boolean(),
    oauthStatus: z
      .string()
      .openapi({ description: "UNKNOWN | NOT_REQUIRED | REQUIRED | CONNECTED | EXPIRED" }),
    authorizationUrl: z
      .string()
      .optional()
      .openapi({ description: "Present when auth is required and not yet connected" }),
    error: z.string().optional(),
  })
  .openapi("CheckOAuthResponse");

registry.registerPath({
  method: "get",
  path: "/api/oauth/check/{serverId}",
  operationId: "checkOauthStatus",
  summary: "Check OAuth status for an MCP server",
  description:
    "Checks OAuth status for an HTTP MCP server. If OAuth is required and not connected, " +
    "generates the authorization URL to redirect to.",
  tags: ["OAuth"],
  request: {
    params: z.object({
      serverId: z.string().openapi({ description: "MCP server id (HTTP type)" }),
    }),
  },
  responses: {
    200: {
      description: "OAuth status",
      content: { "application/json": { schema: CheckOAuthResponse } },
    },
    404: {
      description: "HTTP server not found",
      content: { "application/json": { schema: CheckOAuthResponse } },
    },
  },
});
