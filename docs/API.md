# API Documentation (OpenAPI)

The template ships a machine-readable **OpenAPI 3.1** spec and an interactive explorer so you
can see the full HTTP API surface at a glance — and so adopters can expose their own endpoints in
the same shape.

## Where to find it

| What                          | URL                                 |
| ----------------------------- | ----------------------------------- |
| Interactive explorer (Scalar) | `http://localhost:3000/api-docs`    |
| Raw OpenAPI 3.1 JSON          | `http://localhost:3000/api/openapi` |

The spec is generated at request time from the per-route Zod schemas — there is no build step and
no static file to keep in sync.

## How it works

- **`src/lib/api/openapi/zod.ts`** — re-exports `z` after `extendZodWithOpenApi(z)`, so every
  schema can call `.openapi(...)`. Always import `z` from here, not from `"zod"`.
- **`src/lib/api/openapi/registry.ts`** — the single shared `OpenAPIRegistry`.
- **`src/lib/api/openapi/routes.ts`** — a barrel that imports every route's `schema.ts` so their
  `registry.registerPath(...)` side effects run.
- **`src/lib/api/openapi/document.ts`** — `buildOpenApiDocument()` generates the final document
  (title, version, servers) from the registry.
- **`src/app/api/openapi/route.ts`** — serves the JSON.
- **`src/app/api-docs/route.ts`** — serves the Scalar viewer.

## Adding a documented route

1. Create a `schema.ts` **next to your `route.ts`** (co-located per route).
2. Define request/response Zod schemas with `.openapi("Name")` and register the path(s):

   ```ts
   import { z } from "@/lib/api/openapi/zod";
   import { registry } from "@/lib/api/openapi/registry";
   import { ErrorResponse } from "@/lib/api/openapi/common";

   export const WidgetBody = z.object({ name: z.string() }).openapi("WidgetBody");

   registry.registerPath({
     method: "post",
     path: "/api/widgets",
     operationId: "createWidget",
     summary: "Create a widget",
     tags: ["Widgets"],
     request: { body: { content: { "application/json": { schema: WidgetBody } } } },
     responses: {
       201: { description: "Created", content: { "application/json": { schema: WidgetBody } } },
       400: {
         description: "Bad request",
         content: { "application/json": { schema: ErrorResponse } },
       },
     },
   });
   ```

3. Validate input in the handler with the same schema:

   ```ts
   const parsed = WidgetBody.safeParse(await req.json());
   if (!parsed.success) return NextResponse.json({ error: "..." }, { status: 400 });
   ```

4. Add `import "@/app/api/widgets/schema";` to `src/lib/api/openapi/routes.ts`.

## Validating the spec

```bash
curl http://localhost:3000/api/openapi -o openapi.json
npx @redocly/cli lint openapi.json   # uses redocly.yaml at the repo root
```

`redocly.yaml` disables a few rules that reflect deliberate template choices (no API auth; the
OAuth callback returns only a 302 redirect).
