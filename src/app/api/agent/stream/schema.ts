import { z } from "@/lib/api/openapi/zod";
import { registry } from "@/lib/api/openapi/registry";

const StreamQuery = z.object({
  content: z.string().openapi({ description: "User message text", example: "Hello" }),
  threadId: z.string().optional().openapi({ description: "Thread identifier" }),
  model: z.string().optional().openapi({ description: "LLM model name" }),
  provider: z
    .string()
    .optional()
    .openapi({ description: "Model provider (openai/google/anthropic)" }),
  allowTool: z
    .enum(["allow", "deny"])
    .optional()
    .openapi({ description: "Tool approval decision" }),
  tools: z
    .string()
    .optional()
    .openapi({ description: "Comma-separated list of enabled tool names" }),
  approveAllTools: z
    .enum(["true", "false"])
    .optional()
    .openapi({ description: "Skip per-tool approval prompts" }),
  attachments: z
    .string()
    .optional()
    .openapi({ description: "JSON-encoded array of FileAttachment objects" }),
});

registry.registerPath({
  method: "get",
  path: "/api/agent/stream",
  operationId: "streamAgentResponse",
  summary: "Stream an agent response (SSE)",
  description:
    "Server-Sent Events stream of incremental AI/tool message chunks from the LangGraph agent.\n\n" +
    "Event format:\n" +
    "- `data: <MessageResponse JSON>` — incremental ai/tool chunks\n" +
    "- `event: done` / `data: {}` — completion\n" +
    "- `event: error` / `data: { message, threadId }` — stream error",
  tags: ["Agent"],
  request: { query: StreamQuery },
  responses: {
    200: {
      description: "SSE stream of message chunks",
      content: {
        "text/event-stream": {
          schema: z.string().openapi({ description: "Server-Sent Events stream" }),
        },
      },
    },
  },
});
