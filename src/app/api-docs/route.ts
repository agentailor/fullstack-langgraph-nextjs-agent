import { ApiReference } from "@scalar/nextjs-api-reference";

// Interactive API explorer at /api-docs, rendering the spec served by /api/openapi.
export const GET = ApiReference({
  url: "/api/openapi",
  pageTitle: "LangGraph Next.js Agent API",
});
