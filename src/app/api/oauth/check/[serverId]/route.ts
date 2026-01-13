import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/database/prisma";
import {
  detectOAuthRequirement,
  updateServerOAuthStatus,
  isTokenExpired,
  OAuthStatus,
} from "@/lib/mcp/oauth-detection";
import type { OAuthStatus as OAuthStatusType } from "@/lib/mcp/oauth-detection";
import { ServerOAuthProvider } from "@/lib/mcp/oauth-provider";
import {
  discoverOAuthProtectedResourceMetadata,
  discoverAuthorizationServerMetadata,
  startAuthorization,
  registerClient,
} from "@modelcontextprotocol/sdk/client/auth.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface CheckOAuthResponse {
  serverId: string;
  requiresAuth: boolean;
  connected: boolean;
  oauthStatus: OAuthStatusType;
  authorizationUrl?: string;
  error?: string;
}

/**
 * GET /api/oauth/check/[serverId]
 *
 * Checks OAuth status for an MCP server. If OAuth is required and not connected,
 * generates the authorization URL for the client to redirect to.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ serverId: string }> },
): Promise<NextResponse<CheckOAuthResponse>> {
  const { serverId } = await params;

  // Fetch HTTP server from database (only HTTP servers can use OAuth)
  console.log(`[OAuth API] Fetching server with id: ${serverId} from database...`);
  const server = await prisma.mCPServer.findFirst({
    where: {
      id: serverId,
      type: "http",
      url: { not: null },
    },
  });

  if (!server) {
    return NextResponse.json(
      {
        serverId,
        requiresAuth: false,
        connected: false,
        oauthStatus: OAuthStatus.NOT_REQUIRED,
        error: "HTTP server not found",
      },
      { status: 404 },
    );
  }

  console.log(`[OAuth API] Server found: ${server?.name}`);

  // Check if already connected with valid tokens
  if (server.oauthStatus === OAuthStatus.CONNECTED && server.authTokens) {
    const tokens = server.authTokens as { expires_at?: number };
    if (!isTokenExpired(tokens)) {
      return NextResponse.json({
        serverId,
        requiresAuth: true,
        connected: true,
        oauthStatus: OAuthStatus.CONNECTED,
      });
    }
    await updateServerOAuthStatus(serverId, OAuthStatus.EXPIRED);
  }

  // Detect if server requires OAuth
  const serverUrl = server.url!;
  const detection = await detectOAuthRequirement(serverUrl);

  if (!detection.requiresAuth) {
    await updateServerOAuthStatus(serverId, OAuthStatus.NOT_REQUIRED);
    return NextResponse.json({
      serverId,
      requiresAuth: false,
      connected: false,
      oauthStatus: OAuthStatus.NOT_REQUIRED,
    });
  }

  // Server requires OAuth - generate authorization URL
  await updateServerOAuthStatus(serverId, OAuthStatus.REQUIRED);

  const authProvider = new ServerOAuthProvider(serverId, server.name);

  try {
    // Step 1: Discover protected resource metadata to find the authorization server
    const serverUrlObj = new URL(serverUrl);
    const resourceMetadata = await discoverOAuthProtectedResourceMetadata(
      serverUrlObj,
      detection.resourceMetadataUrl
        ? { resourceMetadataUrl: detection.resourceMetadataUrl }
        : undefined,
    );

    if (!resourceMetadata?.authorization_servers?.length) {
      return NextResponse.json({
        serverId,
        requiresAuth: true,
        connected: false,
        oauthStatus: OAuthStatus.REQUIRED,
        error: "Could not find authorization server in resource metadata",
      });
    }

    // Step 2: Get the authorization server URL and discover its metadata
    const authServerUrl = resourceMetadata.authorization_servers[0];

    const metadata = await discoverAuthorizationServerMetadata(authServerUrl);

    if (!metadata) {
      return NextResponse.json({
        serverId,
        requiresAuth: true,
        connected: false,
        oauthStatus: OAuthStatus.REQUIRED,
        error: "Could not discover authorization server metadata",
      });
    }

    // Get existing client info or register a new client
    let clientInfo = await authProvider.clientInformation();

    if (!clientInfo) {
      // Register client dynamically if not already registered
      if (metadata.registration_endpoint) {
        clientInfo = await registerClient(authServerUrl, {
          metadata,
          clientMetadata: authProvider.clientMetadata,
        });
        // Save the client info for future use
        await authProvider.saveClientInformation(clientInfo);
      } else {
        return NextResponse.json({
          serverId,
          requiresAuth: true,
          connected: false,
          oauthStatus: OAuthStatus.REQUIRED,
          error: "Server does not support dynamic client registration",
        });
      }
    }

    // Start authorization and get the URL
    const { authorizationUrl, codeVerifier } = await startAuthorization(authServerUrl, {
      metadata,
      clientInformation: clientInfo,
      redirectUrl: authProvider.redirectUrl,
    });

    // Save code verifier for the callback
    await authProvider.saveCodeVerifier(codeVerifier);

    return NextResponse.json({
      serverId,
      requiresAuth: true,
      connected: false,
      oauthStatus: OAuthStatus.REQUIRED,
      authorizationUrl: authorizationUrl.toString(),
    });
  } catch (error) {
    console.error("[OAuth API] Error:", error);
    return NextResponse.json({
      serverId,
      requiresAuth: true,
      connected: false,
      oauthStatus: OAuthStatus.REQUIRED,
      error: error instanceof Error ? error.message : "Failed to generate authorization URL",
    });
  }
}
