import { NextResponse } from "next/server";
import { buildOpenApiDocument } from "@/lib/api/openapi/document";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Serves the generated OpenAPI 3.1 spec as JSON. Consumed by the /api-docs viewer
// and by any external tooling (Postman, codegen, etc.).
export async function GET() {
  return NextResponse.json(buildOpenApiDocument(), { status: 200 });
}
