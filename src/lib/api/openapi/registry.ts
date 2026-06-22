import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

// Single shared registry. Every route's `schema.ts` imports this and calls
// `registry.registerPath(...)` / `registry.register(...)` as a side effect on import.
export const registry = new OpenAPIRegistry();
