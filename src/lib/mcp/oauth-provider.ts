import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import type {
  OAuthClientInformation,
  OAuthClientMetadata,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import prisma from "@/lib/database/prisma";
import { OAuthStatus } from "./oauth-detection";
import { getAppUrl } from "@/lib/config/app-url";

/**
 * Server-side OAuth provider that implements the OAuthClientProvider interface
 * from @modelcontextprotocol/sdk. Stores OAuth data in the database.
 */
export class ServerOAuthProvider implements OAuthClientProvider {
  private serverId: string;
  private serverName: string;

  constructor(serverId: string, serverName: string) {
    this.serverId = serverId;
    this.serverName = serverName;
  }

  get redirectUrl(): string {
    return `${getAppUrl()}/api/oauth/callback/${this.serverId}`;
  }

  get clientMetadata(): OAuthClientMetadata {
    const appUrl = getAppUrl();
    return {
      client_name: `LangGraph Agent - ${this.serverName}`,
      client_uri: appUrl,
      redirect_uris: [this.redirectUrl],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope: "read write",
      token_endpoint_auth_method: "none",
    };
  }

  async clientInformation(): Promise<OAuthClientInformation | undefined> {
    const server = await prisma.mCPServer.findUnique({
      where: { id: this.serverId },
      select: { clientInfo: true },
    });
    return server?.clientInfo as OAuthClientInformation | undefined;
  }

  async saveClientInformation(info: OAuthClientInformation): Promise<void> {
    await prisma.mCPServer.update({
      where: { id: this.serverId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { clientInfo: info as any },
    });
  }

  async tokens(): Promise<OAuthTokens | undefined> {
    const server = await prisma.mCPServer.findUnique({
      where: { id: this.serverId },
      select: { authTokens: true },
    });
    const tokens = server?.authTokens as OAuthTokens | undefined;
    return tokens;
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    await prisma.mCPServer.update({
      where: { id: this.serverId },
      data: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        authTokens: tokens as any,
        oauthStatus: OAuthStatus.CONNECTED,
      },
    });
  }

  async redirectToAuthorization(url: URL): Promise<void> {
    // This method is called by the SDK when it needs to redirect to the auth server.
    // In a server-side context, we can't redirect directly - we throw an error
    // and handle the URL generation separately in the API route.
    throw new Error(`REDIRECT_REQUIRED:${url.toString()}`);
  }

  async saveCodeVerifier(verifier: string): Promise<void> {
    await prisma.mCPServer.update({
      where: { id: this.serverId },
      data: { codeVerifier: verifier },
    });
  }

  async codeVerifier(): Promise<string> {
    const server = await prisma.mCPServer.findUnique({
      where: { id: this.serverId },
      select: { codeVerifier: true },
    });
    if (!server?.codeVerifier) {
      throw new Error("No code verifier stored");
    }
    return server.codeVerifier;
  }
}
