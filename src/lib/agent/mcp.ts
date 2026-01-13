import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import prisma from "@/lib/database/prisma";
import { ServerOAuthProvider } from "@/lib/mcp/oauth-provider";
import { OAuthStatus } from "../mcp/oauth-detection";
import { sanitizeTool } from "./util";

interface StdioMCPServerConfig {
  transport: "stdio";
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

interface HttpMCPServerConfig {
  transport: "http";
  url: string;
  headers?: Record<string, string>;
  authProvider?: OAuthClientProvider;
}

type MCPServerConfig = StdioMCPServerConfig | HttpMCPServerConfig;

/**
 * Fetches enabled MCP servers from the database and formats them for MultiServerMCPClient
 */
export async function getMCPServerConfigs(): Promise<Record<string, MCPServerConfig>> {
  try {
    const servers = await prisma.mCPServer.findMany({
      where: { enabled: true },
    });

    const configs: Record<string, MCPServerConfig> = {};

    for (const server of servers) {
      if (server.type === "stdio" && server.command) {
        const config: StdioMCPServerConfig = {
          transport: "stdio",
          command: server.command,
        };

        if (server.args && Array.isArray(server.args)) {
          config.args = server.args.filter((arg): arg is string => typeof arg === "string");
        }
        if (server.env && typeof server.env === "object" && server.env !== null) {
          config.env = server.env as Record<string, string>;
        }

        configs[server.name] = config;
      } else if (server.type === "http" && server.url) {
        const config: HttpMCPServerConfig = {
          transport: "http",
          url: server.url,
        };

        if (server.headers && typeof server.headers === "object" && server.headers !== null) {
          config.headers = server.headers as Record<string, string>;
        }

        // Add authProvider for servers that require OAuth and have connected
        if (server.requiresAuth && server.oauthStatus === OAuthStatus.CONNECTED) {
          config.authProvider = new ServerOAuthProvider(server.id, server.name);
        }

        configs[server.name] = config;
      }
    }

    return configs;
  } catch (error) {
    console.error("Failed to fetch MCP server configs:", error);
    return {};
  }
}

/**
 * Creates and initializes a MultiServerMCPClient with the current database configurations
 */
export async function createMCPClient(): Promise<MultiServerMCPClient | null> {
  try {
    const mcpServers = await getMCPServerConfigs();

    if (Object.keys(mcpServers).length === 0) {
      return null;
    }

    const client = new MultiServerMCPClient({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mcpServers: mcpServers as any, // Complex MCP server config types require type assertion
      throwOnLoadError: false, // Don't fail if some servers can't connect
      prefixToolNameWithServerName: true, // Prevent tool name conflicts
    });

    return client;
  } catch (error) {
    console.error("Failed to create MCP client:", error);
    return null;
  }
}

/**
 * Gets tools from the MCP client if available.
 * Sanitizes tool schemas to be compatible with Google Gemini's function calling API.
 */
export async function getMCPTools() {
  try {
    const client = await createMCPClient();
    if (!client) {
      return [];
    }

    const tools = await client.getTools();

    // Sanitize tool schemas to remove unsupported JSON Schema keywords
    // that would cause errors with Google Gemini
    const sanitizedTools = tools.map((tool) => sanitizeTool(tool));

    console.log(`Loaded ${sanitizedTools.length} tools from MCP servers`);
    return sanitizedTools;
  } catch (error) {
    console.error("Failed to get MCP tools:", error);
    return [];
  }
}
