import { z } from "@/lib/api/openapi/zod";
import { registry } from "@/lib/api/openapi/registry";

// LangGraph checkpoint messages are loosely typed; documented as an open object
// array so the docs convey the shape without over-constraining it.
const HistoryMessage = z
  .looseObject({
    id: z.string().optional(),
    type: z.string().optional(),
    content: z.unknown().optional(),
  })
  .openapi("HistoryMessage");

registry.registerPath({
  method: "get",
  path: "/api/agent/history/{threadId}",
  operationId: "getThreadHistory",
  summary: "Get thread message history",
  description: "Returns the message history for a thread from LangGraph checkpoints.",
  tags: ["Threads"],
  request: {
    params: z.object({
      threadId: z.string().openapi({ description: "Thread identifier" }),
    }),
  },
  responses: {
    200: {
      description: "Array of messages",
      content: { "application/json": { schema: z.array(HistoryMessage) } },
    },
  },
});
