# OAuth Support for MCP HTTP Servers

Some MCP HTTP servers require OAuth 2.0/2.1 authentication. This document explains how OAuth is implemented in this template.

## Overview

OAuth support is implemented using a **lazy detection** approach:

1. When a user adds an HTTP MCP server, OAuth status is initially "UNKNOWN"
2. The user clicks "Connect" to check if OAuth is required
3. If required, the user is redirected to the authorization server
4. Upon successful authorization, tokens are stored and the server becomes usable

## OAuth Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  MCPServerList  │────►│  /api/oauth/     │────►│  Authorization      │
│  "Connect" btn  │     │  check/[serverId]│     │  Server             │
└─────────────────┘     └──────────────────┘     └─────────────────────┘
                               │                          │
                               │ 1. Detect OAuth          │ 2. User authorizes
                               │ 2. Register client       │
                               │ 3. Generate auth URL     │
                               ▼                          ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  OAuthToast     │◄────│  /api/oauth/     │◄────│  Redirect with      │
│  Success/Error  │     │  callback/[id]   │     │  authorization code │
└─────────────────┘     └──────────────────┘     └─────────────────────┘
                               │
                               │ Exchange code for tokens
                               │ Store tokens in database
                               ▼
                        ┌──────────────────┐
                        │  Server status:  │
                        │  CONNECTED       │
                        └──────────────────┘
```

## OAuth Statuses

| Status         | Description                                    | UI Indicator       |
| -------------- | ---------------------------------------------- | ------------------ |
| `UNKNOWN`      | OAuth requirement not yet checked              | None               |
| `NOT_REQUIRED` | Server does not require OAuth                  | None               |
| `REQUIRED`     | OAuth required, user needs to connect          | Yellow badge       |
| `CONNECTED`    | Successfully authenticated                     | Green badge        |
| `EXPIRED`      | Tokens have expired, reconnection needed       | Red badge          |

## Key Components

| File                                              | Purpose                                      |
| ------------------------------------------------- | -------------------------------------------- |
| `src/lib/mcp/oauth-detection.ts`                  | Detects OAuth requirements via 401 response  |
| `src/lib/mcp/oauth-provider.ts`                   | Implements `OAuthClientProvider` interface   |
| `src/app/api/oauth/check/[serverId]/route.ts`     | Initiates OAuth flow, returns auth URL       |
| `src/app/api/oauth/callback/[serverId]/route.ts`  | Handles OAuth callback, exchanges tokens     |
| `src/components/OAuthStatusBadge.tsx`             | Displays OAuth status in server list         |
| `src/components/OAuthToast.tsx`                   | Shows success/error notifications            |

## Database Fields

The `MCPServer` model includes these OAuth-related fields:

```prisma
model MCPServer {
  // ... other fields
  requiresAuth  Boolean?  @default(false)
  authTokens    Json?     // { access_token, refresh_token, expires_at, ... }
  clientInfo    Json?     // { client_id, client_secret, ... }
  codeVerifier  String?   // PKCE code verifier for ongoing flow
  oauthStatus   String?   @default("UNKNOWN")
}
```

## How It Works

### 1. OAuth Detection

When the user clicks "Connect", the app makes a request to the MCP server. If the server responds with:

- **401 Unauthorized** + `WWW-Authenticate: Bearer` header → OAuth is required
- **200 OK** or other status → OAuth is not required

### 2. Client Registration

If OAuth is required and no client is registered:

1. Discover protected resource metadata from the server
2. Discover authorization server metadata
3. Dynamically register a client (if supported)
4. Store `clientInfo` for future use

### 3. Authorization

1. Generate authorization URL with PKCE (`code_verifier` stored in database)
2. Redirect user to authorization server
3. User grants permission

### 4. Token Exchange

1. Authorization server redirects to `/api/oauth/callback/[serverId]`
2. Exchange authorization code for tokens
3. Store tokens in database
4. Update status to `CONNECTED`

## Environment Variables

```env
# Required for OAuth callback URLs
APP_URL=http://localhost:3000
```

The `APP_URL` is used to construct the OAuth redirect URI: `{APP_URL}/api/oauth/callback/{serverId}`

## Production Considerations

> **Important**: This implementation is a starter template. For production deployments, implement the following security enhancements.

### Token Storage Security

- **Encrypt tokens at rest**: Currently tokens are stored as plain JSON in the database. Use encryption (e.g., AES-256-GCM) before storing `authTokens` and `clientInfo`
- **Use a secrets manager**: Consider AWS Secrets Manager, HashiCorp Vault, or similar for sensitive OAuth credentials

### Additional Security Measures

| Concern                  | Recommendation                                                        |
| ------------------------ | --------------------------------------------------------------------- |
| Token refresh            | Implement automatic token refresh before expiration                   |
| CSRF protection          | Tie OAuth state parameter to user sessions                            |
| Audit logging            | Log OAuth events (connections, refreshes, failures)                   |
| Rate limiting            | Add rate limits to OAuth endpoints to prevent abuse                   |
| Transport security       | Ensure all OAuth callbacks use HTTPS in production                    |

### Multi-tenant Considerations

The current implementation stores tokens per-server. For multi-user applications:

- **Per-user tokens**: Associate OAuth tokens with specific user accounts
- **Token isolation**: Ensure users cannot access other users' OAuth tokens
- **Consent management**: Allow users to revoke OAuth connections

## Troubleshooting

### "Could not find authorization server"

The MCP server's OAuth metadata doesn't include authorization server information. Check that the server properly implements OAuth 2.0 Protected Resource Metadata.

### "Server does not support dynamic client registration"

The OAuth server doesn't have a registration endpoint. You'll need to manually register a client and configure `clientInfo` in the database.

### Tokens expire immediately

Check that server clocks are synchronized. The `expires_at` field uses Unix timestamps.
