import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

// Adds the `.openapi()` method to all Zod schemas. Must run before any schema
// that calls `.openapi(...)` is defined, so every schema file imports `z` from here.
extendZodWithOpenApi(z);

export { z };
