import prisma from "@/lib/database/prisma";

/**
 * OAuth status constants for MCP servers
 */
export const OAuthStatus = {
  UNKNOWN: "UNKNOWN",
  NOT_REQUIRED: "NOT_REQUIRED",
  REQUIRED: "REQUIRED",
  CONNECTED: "CONNECTED",
  EXPIRED: "EXPIRED",
} as const;

export type OAuthStatus = (typeof OAuthStatus)[keyof typeof OAuthStatus];

export interface OAuthDetectionResult {
  requiresAuth: boolean;
  resourceMetadataUrl?: string;
  error?: string;
}

/**
 * Detects if an MCP HTTP server requires OAuth authentication
 * by making a request and checking for 401 + WWW-Authenticate header
 */
export async function detectOAuthRequirement(url: string): Promise<OAuthDetectionResult> {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (response.status === 401) {
      const wwwAuth = response.headers.get("WWW-Authenticate");
      // Check for OAuth 2.0 Bearer token requirement
      if (wwwAuth && wwwAuth.toLowerCase().includes("bearer")) {
        return {
          requiresAuth: true,
          resourceMetadataUrl: extractResourceMetadataUrl(wwwAuth),
        };
      }
      // 401 without Bearer header - still requires auth but unknown type
      return { requiresAuth: true };
    }

    // Server responded without auth requirement
    return { requiresAuth: false };
  } catch (error) {
    return {
      requiresAuth: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Extracts the resource_metadata URL from WWW-Authenticate header
 * Example: Bearer resource_metadata="https://example.com/.well-known/oauth-protected-resource"
 */
function extractResourceMetadataUrl(wwwAuthHeader: string): string | undefined {
  const resourceMetadataMatch = wwwAuthHeader.match(/resource_metadata="([^"]+)"/);
  if (resourceMetadataMatch) {
    return resourceMetadataMatch[1];
  }

  // Fallback: try to extract realm
  const realmMatch = wwwAuthHeader.match(/realm="([^"]+)"/);
  return realmMatch?.[1];
}

/**
 * Updates server OAuth status in database
 */
export async function updateServerOAuthStatus(
  serverId: string,
  status: OAuthStatus,
): Promise<void> {
  await prisma.mCPServer.update({
    where: { id: serverId },
    data: { oauthStatus: status },
  });
}

/**
 * Checks if stored tokens are expired
 */
export function isTokenExpired(tokens: { expires_at?: number } | null | undefined): boolean {
  if (!tokens || !tokens.expires_at) {
    return false; // No expiry info, assume valid
  }
  // Add 60 second buffer before actual expiry
  return Date.now() / 1000 > tokens.expires_at - 60;
}
