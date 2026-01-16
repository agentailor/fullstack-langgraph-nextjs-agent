import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/database/prisma";
import { ServerOAuthProvider } from "@/lib/mcp/oauth-provider";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { OAuthStatus } from "@/lib/mcp/oauth-detection";
import { getAppUrl } from "@/lib/config/app-url";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/oauth/callback/[serverId]
 *
 * OAuth callback handler. Receives the authorization code from the OAuth provider
 * and exchanges it for access tokens using the MCP SDK's transport.finishAuth().
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ serverId: string }> },
): Promise<NextResponse> {
  const { serverId } = await params;
  const { searchParams } = new URL(request.url);
  const appUrl = getAppUrl();

  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Handle OAuth errors
  if (error) {
    console.error("OAuth error:", error, errorDescription);
    return NextResponse.redirect(
      new URL(`/?oauth_error=${encodeURIComponent(errorDescription || error)}`, appUrl),
    );
  }

  if (!code) {
    return NextResponse.redirect(new URL("/?oauth_error=missing_code", appUrl));
  }

  // Fetch server from database
  const server = await prisma.mCPServer.findUnique({
    where: { id: serverId },
  });

  if (!server || !server.url) {
    return NextResponse.redirect(new URL("/?oauth_error=server_not_found", appUrl));
  }

  const authProvider = new ServerOAuthProvider(serverId, server.name);

  try {
    // Create transport and complete OAuth flow
    const transport = new StreamableHTTPClientTransport(new URL(server.url), {
      authProvider,
    });

    // Exchange authorization code for tokens
    await transport.finishAuth(code);

    // Update server status to connected
    await prisma.mCPServer.update({
      where: { id: serverId },
      data: {
        oauthStatus: OAuthStatus.CONNECTED,
        requiresAuth: true,
        codeVerifier: null, // Clear code verifier after successful auth
      },
    });

    // Redirect back to app with success
    return NextResponse.redirect(
      new URL(`/?oauth_success=true&server=${encodeURIComponent(server.name)}`, appUrl),
    );
  } catch (err) {
    console.error("OAuth callback error:", err);

    // Update server status to indicate auth failed
    await prisma.mCPServer.update({
      where: { id: serverId },
      data: { oauthStatus: "REQUIRED" },
    });

    return NextResponse.redirect(
      new URL(
        `/?oauth_error=${encodeURIComponent(
          err instanceof Error ? err.message : "Token exchange failed",
        )}`,
        appUrl,
      ),
    );
  }
}
