import { OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import { registry } from "./registry";
// Side-effect import: registers every route's paths on the shared registry.
import "./routes";

/**
 * Builds the full OpenAPI 3.1 document from the shared registry. The single place
 * that knows the document-level metadata (info, servers). Called by the
 * `/api/openapi` route handler.
 */
export function buildOpenApiDocument() {
  const generator = new OpenApiGeneratorV31(registry.definitions);

  return generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "LangGraph Next.js Agent API",
      version: "0.1.0",
      description:
        "HTTP API for the fullstack LangGraph.js agent template: chat streaming, " +
        "thread management, MCP server configuration, file uploads, and OAuth.",
    },
    servers: [{ url: "/", description: "This deployment" }],
  });
}
