import { z } from "@/lib/api/openapi/zod";
import { registry } from "@/lib/api/openapi/registry";
import { ErrorResponse } from "@/lib/api/openapi/common";

// Mirrors MCPToolsData / MCPServerTools in src/types/mcp.ts.
const MCPTool = z
  .object({
    name: z.string().openapi({ example: "search" }),
    description: z.string().optional(),
  })
  .openapi("MCPTool");

const MCPServerTools = z
  .object({
    tools: z.array(MCPTool),
    count: z.number().int(),
  })
  .openapi("MCPServerTools");

export const MCPToolsData = z
  .object({
    serverGroups: z.record(z.string(), MCPServerTools),
    totalCount: z.number().int(),
  })
  .openapi("MCPToolsData");

registry.registerPath({
  method: "get",
  path: "/api/mcp-tools",
  operationId: "listMcpTools",
  summary: "List available MCP tools",
  description:
    "Returns tools grouped by MCP server. Tool names are returned without the server-name prefix.",
  tags: ["MCP Tools"],
  responses: {
    200: {
      description: "Grouped tools",
      content: { "application/json": { schema: MCPToolsData } },
    },
    500: {
      description: "Failed to load tools",
      content: { "application/json": { schema: ErrorResponse } },
    },
  },
});
