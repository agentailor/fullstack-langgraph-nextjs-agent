// Importing each route's `schema.ts` runs its `registry.registerPath(...)` side
// effects. `buildOpenApiDocument()` imports this barrel so every path is registered
// before the document is generated. Add new routes here when documenting them.
import "@/app/api/agent/threads/schema";
import "@/app/api/agent/stream/schema";
import "@/app/api/agent/upload/schema";
import "@/app/api/agent/history/[threadId]/schema";
import "@/app/api/mcp-servers/schema";
import "@/app/api/mcp-tools/schema";
import "@/app/api/oauth/check/[serverId]/schema";
import "@/app/api/oauth/callback/[serverId]/schema";
