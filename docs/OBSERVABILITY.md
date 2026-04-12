# Observability with Langfuse

This document explains how LLM observability is implemented in this template using [Langfuse](https://langfuse.com), and how to configure it for cloud or self-hosted setups.

## What is Langfuse?

Langfuse is an open-source LLM observability platform. It captures traces of your agent runs, giving you visibility into:

- Every LLM call (model, prompt, completion, token usage, latency)
- Tool invocations and their inputs/outputs
- The full agent step sequence per conversation turn
- Costs and error rates over time

For a LangGraph agent like this one, a single user message typically produces a trace that shows the agent node → tool approval node → tools node chain, with nested LLM calls inside.

## Integration Architecture

Two mechanisms work together to provide full coverage:

```
Next.js process starts
  └─ instrumentation.ts register() called once (before any route)
       └─ (if LANGFUSE_ENABLED=true) NodeSDK.start() — OTel active globally

Request → /api/agent/stream
  └─ agentService.ts streamResponse()
       └─ agent.stream({ callbacks: [langfuseHandler] })
            ├─ LangGraph events → CallbackHandler → Langfuse
            └─ OTel spans (HTTP calls, etc.) → LangfuseSpanProcessor → Langfuse
```

**1. OpenTelemetry span processor** (`instrumentation.ts`)

- Initialized once at process startup via Next.js's built-in instrumentation hook
- Captures infrastructure-level spans: HTTP requests, database calls, anything OTel-instrumented
- Uses `@langfuse/otel` → `LangfuseSpanProcessor`

**2. LangChain CallbackHandler** (`src/services/agentService.ts`)

- Attached to each `agent.stream()` call
- Captures LangChain/LangGraph-specific semantic events: chain starts/ends, LLM calls with token counts, tool invocations, agent steps
- Uses `@langfuse/langchain` → `CallbackHandler`

Both are gated behind `LANGFUSE_ENABLED=true` — when disabled, there is zero overhead and no network calls to Langfuse.

## Setup

### Option A: Langfuse Cloud

1. Create a free account at [cloud.langfuse.com](https://cloud.langfuse.com) (EU region) or [us.cloud.langfuse.com](https://us.cloud.langfuse.com) (US region)
2. Create a project and navigate to **Settings → API Keys**
3. Copy your Secret Key and Public Key
4. Add to your `.env.local`:

```bash
LANGFUSE_ENABLED=true
LANGFUSE_SECRET_KEY="sk-lf-..."
LANGFUSE_PUBLIC_KEY="pk-lf-..."
LANGFUSE_BASE_URL="https://cloud.langfuse.com"
```

5. Restart the dev server — traces will appear in your Langfuse project immediately.

### Option B: Self-Hosted Langfuse

Langfuse ships its own Docker Compose file with all required services (web, worker, Postgres, MinIO, Redis, ClickHouse). The recommended approach is to clone the Langfuse repo and run it directly.

Full guide: [langfuse.com/self-hosting/deployment/docker-compose](https://langfuse.com/self-hosting/deployment/docker-compose)

**Quick start (local):**

```bash
# 1. Clone the Langfuse repository
git clone https://github.com/langfuse/langfuse.git
cd langfuse

# 2. Update secrets in docker-compose.yml (lines marked with # CHANGEME)

# 3. Start all services
docker compose up
```

After 2–3 minutes, `langfuse-web-1` will log "Ready". Open [http://localhost:3000](http://localhost:3000), create an account, and get your API keys from **Settings → API Keys**.

> **Note:** Langfuse runs on port 3000 by default. If your Next.js dev server also uses 3000, start it on a different port: `pnpm dev --port 3005`.

Add to `.env.local` (adjust the port if needed):

```bash
LANGFUSE_ENABLED=true
LANGFUSE_SECRET_KEY="sk-lf-..."
LANGFUSE_PUBLIC_KEY="pk-lf-..."
LANGFUSE_BASE_URL="http://localhost:3000"
```

## Disabling Tracing

Set `LANGFUSE_ENABLED=false` (or omit it entirely) in your `.env.local` and restart. No code changes required. There is zero performance overhead when disabled.

## What a Trace Looks Like

For a single user message that triggers a tool call, you will see a trace in Langfuse with roughly this structure:

```
Trace: user-message
  ├─ LangGraph: agent node
  │    └─ LLM call (model, input messages, output, token counts)
  ├─ LangGraph: tool_approval node
  │    └─ interrupt (human-in-the-loop pause)
  ├─ LangGraph: tools node
  │    └─ Tool execution (tool name, input args, output)
  └─ LangGraph: agent node (second pass)
       └─ LLM call (final response generation)
```

## Key Files

| File                           | Role                                                     |
| ------------------------------ | -------------------------------------------------------- |
| `instrumentation.ts`           | Next.js OTel init hook — runs once before any route      |
| `src/services/agentService.ts` | Attaches `CallbackHandler` to each `agent.stream()` call |
| `.env.example`                 | Documents all required environment variables             |
