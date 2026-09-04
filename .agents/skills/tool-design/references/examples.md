# Worked Examples: The Same Design Across Surfaces and Languages

The point of this file is to *demonstrate* — not just assert — that tool design is framework- and language-agnostic. Each example varies exactly one axis:

1. **[Same tool, two languages](#1-same-tool-two-languages-typescript--python)** — `get_expenses` in TypeScript (Zod) and Python (Pydantic). Varies: language.
2. **[A standalone (non-MCP) tool](#2-a-standalone-non-mcp-tool)** — the same tool as a plain function-calling handler, no MCP anywhere. Varies: surface (no server).
3. **[A real MCP-server tool](#3-a-real-mcp-server-tool)** — `agentailor_search_articles` from the public `agentailor-mcp` server, annotated principle by principle. Varies: surface (MCP) + it's real shipped code.

Read them together: the `name` / `description` / `parameters` / `returns` thinking is identical everywhere; only syntax and registration change.

> Sources are all public: the `get_expenses` example is from the published guide **[Writing Effective Tools for AI Agents](https://blog.agentailor.com/blog/writing-tools-for-ai-agents)**; the MCP example is from the public **[agentailor-mcp](https://github.com/agentailor/agentailor-mcp)** server (`src/tools/blog.ts`).

---

## 1. Same tool, two languages (TypeScript + Python)

One tool — `get_expenses` — expressed with two different schema libraries. Note that the descriptions, the required/optional split, the defaults, and the return shape are **the same design**; only the binding syntax differs.

### TypeScript (Zod)

```typescript
import { z } from "zod";

const getExpensesSchema = z.object({
  start_date: z
    .string()
    .describe("Start date, ISO format (YYYY-MM-DD). Required. Example: '2025-01-01'"),
  end_date: z
    .string()
    .describe("End date, ISO format (YYYY-MM-DD). Required. Example: '2025-01-31'"),
  category: z
    .enum(["groceries", "dining", "transport", "utilities", "healthcare", "other"])
    .optional()
    .describe("Optional. Filter by category. Omit for all categories."),
  response_format: z
    .enum(["concise", "detailed"])
    .default("concise")
    .describe("'concise' = essential fields; 'detailed' = full metadata. Default 'concise' for token efficiency."),
  limit: z
    .number()
    .int()
    .default(50)
    .describe("Max items to return. Default 50. Lower = fewer tokens."),
});

// description registered alongside the schema (exact binding depends on your framework):
const description = `Retrieves user expenses within a date range, with optional category filtering.

When to use:
- "What did I spend on groceries last month?"
- "Show me expenses from January to March"

Supports pagination and configurable verbosity. Returns human-readable descriptions and category, not just IDs.`;
```

### Python (Pydantic)

```python
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class Category(str, Enum):
    groceries = "groceries"
    dining = "dining"
    transport = "transport"
    utilities = "utilities"
    healthcare = "healthcare"
    other = "other"


class ResponseFormat(str, Enum):
    concise = "concise"
    detailed = "detailed"


class GetExpensesParams(BaseModel):
    start_date: str = Field(
        ..., description="Start date, ISO format (YYYY-MM-DD). Required. Example: '2025-01-01'"
    )
    end_date: str = Field(
        ..., description="End date, ISO format (YYYY-MM-DD). Required. Example: '2025-01-31'"
    )
    category: Optional[Category] = Field(
        None, description="Optional. Filter by category. Omit for all categories."
    )
    response_format: ResponseFormat = Field(
        ResponseFormat.concise,
        description="'concise' = essential fields; 'detailed' = full metadata. Default 'concise' for token efficiency.",
    )
    limit: int = Field(
        50, description="Max items to return. Default 50. Lower = fewer tokens."
    )


# Same description text as the TS version — the prose is the design, not the language.
DESCRIPTION = """Retrieves user expenses within a date range, with optional category filtering.

When to use:
- "What did I spend on groceries last month?"
- "Show me expenses from January to March"

Supports pagination and configurable verbosity. Returns human-readable descriptions and category, not just IDs."""
```

**What's identical (the design) vs. what changed (the syntax):**

| Design decision | TS (Zod) | Python (Pydantic) |
| --- | --- | --- |
| required `start_date` / `end_date` with format + example | `.describe(...)` | `Field(..., description=...)` |
| optional `category` enum, omit = all | `.optional()` | `Optional[...] = Field(None, ...)` |
| `response_format` default `concise` (token efficiency) | `.default("concise")` | `Field(ResponseFormat.concise, ...)` |
| `limit` default 50 | `.default(50)` | `Field(50, ...)` |
| what/when/how description | string literal | string literal |

The five principles live in the left column. The right two columns are just bindings.

---

## 2. A standalone (non-MCP) tool

The same tool as a plain handler a model calls directly (OpenAI/Anthropic-style function calling, or any in-process agent framework). **No MCP, no server** — proof that the principles aren't MCP-bound. This mirrors the handler from the published guide.

```typescript
// Function-calling definition (framework-neutral JSON schema shape)
const getExpensesTool = {
  name: "get_expenses",
  description: `Retrieves user expenses within a date range. Use for spending analysis or budget tracking.
  When to use: "What did I spend on groceries last month?", "Show me expenses from January to March".`,
  parameters: {
    type: "object",
    properties: {
      start_date: { type: "string", description: "Start date, ISO (YYYY-MM-DD). Required. Example: '2025-01-01'" },
      end_date:   { type: "string", description: "End date, ISO (YYYY-MM-DD). Required. Example: '2025-01-31'" },
      category:   { type: "string", enum: ["groceries","dining","transport","utilities","healthcare","other"],
                    description: "Optional. Filter by category. Omit for all." },
      response_format: { type: "string", enum: ["concise","detailed"], default: "concise",
                    description: "'concise' = essentials; 'detailed' = full metadata. Default 'concise'." },
      limit:      { type: "number", default: 50, description: "Max items. Default 50. Lower = fewer tokens." },
    },
    required: ["start_date", "end_date"],
  },
};

// Handler — defensive design in the body: validate, guard, truncate loudly, return context.
async function handleGetExpenses(p) {
  const { start_date, end_date, category, response_format = "concise", limit = 50 } = p;

  // Principle 5: helpful errors the agent can act on
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!iso.test(start_date) || !iso.test(end_date)) {
    return { error: "Invalid date format. Use YYYY-MM-DD. Example: '2025-01-15'.",
             received: { start_date, end_date } };
  }
  const start = new Date(start_date), end = new Date(end_date);
  if (start > end) return { error: "start_date must be before end_date.", received: { start_date, end_date } };

  // Principle 4: guard responses that would blow the context window
  const days = Math.ceil((+end - +start) / 86_400_000);
  if (days > 365) {
    return { error: "Date range too large (>365 days). Consumes excessive tokens.",
             suggestion: "Use a smaller range (e.g. monthly) or add a category filter." };
  }

  let expenses = await db.getExpenses({ start, end, category });

  // Principle 4: truncate loudly, guide the next query
  if (expenses.length > limit) {
    const total = expenses.length;
    expenses = expenses.slice(0, limit);
    return {
      notice: `Found ${total} expenses; returning the first ${limit} to preserve tokens.`,
      guidance: category ? "Narrow the date range." : "Add a category filter to focus results.",
      summary: { total_found: total, returned: limit },
      expenses: format(expenses, response_format),
    };
  }

  // Principle 3: meaningful context + metadata, not bare IDs
  return {
    query: { start_date, end_date, category: category ?? "all categories" },
    summary: { total_expenses: expenses.length,
               total_amount: expenses.reduce((s, e) => s + e.amount, 0), currency: "USD" },
    expenses: format(expenses, response_format),
  };
}

// Principle 3: concise vs detailed — configurable verbosity
function format(expenses, mode) {
  return expenses.map((e) =>
    mode === "concise"
      ? { date: e.date, amount: e.amount, category: e.category, description: e.description }
      : { date: e.date, amount: e.amount, category: e.category, description: e.description,
          merchant: e.merchant, payment_method: e.paymentMethod, tags: e.tags, notes: e.notes });
}
```

Every principle is present, and MCP never appears. The exact same handler drops into an MCP server's tool executor unchanged — which is the whole point.

---

## 3. A real MCP-server tool

`agentailor_search_articles`, shipped in the public [agentailor-mcp](https://github.com/agentailor/agentailor-mcp) server (`src/tools/blog.ts`, FastMCP). This is real code, and it independently lands all five principles — evidence the standard holds up in production, not just in illustrations.

```typescript
server.addTool({
  // Principle 2: namespaced, descriptive name — no collision with any other server's "search"
  name: "agentailor_search_articles",
  // Principles 2 & 5: what / when / how, with example queries and the return contract
  description: `Searches the Agentailor blog and returns a ranked shortlist of matching articles as JSON. One tool for all discovery: free-text, by tag, and guides-only.

**When to use:**
- "What articles cover MCP?" with query: "mcp"
- "Show me everything tagged langgraph and tools" with tags: ["langgraph", "tools"]
- "Which complete guides do you have?" with guidesOnly: true
- Combine them: query + tags + guidesOnly all narrow together.

Returns JSON: { results, total, shown, hint? }. Each result carries the article's .md URL in results[].url; pass that to agentailor_read_article to read one in full.`,
  parameters: z.object({
    // Principle 1: one discovery tool that consolidates free-text + tag + guides filtering,
    // instead of search_by_text / search_by_tag / list_guides as three separate tools
    query: z.string().optional().describe(
      'Free-text terms matched against title, summary, and tags. Multiple words matched individually and ranked. Example: "memory". Omit to list everything.'
    ),
    tags: z.array(z.string()).optional().describe(
      'Filter to articles carrying ALL of these tags. Example: ["mcp", "security"].'
    ),
    guidesOnly: z.boolean().optional().describe("If true, return only complete guides. Default: false."),
    // Principle 4: token efficiency — limit with an explicit "lower saves tokens" note
    limit: z.number().int().min(1).max(100).optional().describe(
      "Max results to return. Lower values save tokens."
    ),
    // Principle 3: configurable verbosity
    response_format: z.enum(["concise", "detailed"]).optional().describe(
      'Output verbosity. "concise" (default) returns title, url, and guide per result; "detailed" adds date, tags, and summary.'
    ),
  }),
  execute: async ({ query, tags, guidesOnly, limit, response_format }) => {
    const posts = await getPosts();
    const matches = searchPosts(posts, { query, tags, guidesOnly });
    const cap = limit ?? SEARCH_LIMIT_DEFAULT;
    const shown = matches.slice(0, cap);
    // Principle 3: returns total + shown metadata and each result's .md URL —
    // meaningful context the agent chains straight into agentailor_read_article, no lookup
    const response = buildSearchResponse(shown, matches.length, cap, response_format ?? "concise");
    return JSON.stringify(response, null, 2);
  },
});
```

Its sibling `agentailor_read_article` closes the loop with **Principle 5** error handling — when the agent passes a bad URL it doesn't get a cryptic code, it gets told how to recover:

```typescript
throw new UserError(
  `No article found at ${url}. Check the URL against agentailor_search_articles results.`
);
```

**Principle-by-principle scorecard for this real tool:**

- **Strategic** — one `search_articles` covering free-text, tags, and guides, rather than three fragmented tools.
- **Named** — `agentailor_` prefix guarantees no collision with another server's `search`.
- **Contextual** — returns `results/total/shown` plus each article's `.md` URL, so the agent reasons and chains without a second lookup.
- **Efficient** — bounded `limit` (max 100) with a token note, plus `response_format` for verbosity.
- **Prompt-shaped** — the description gives example queries and states the exact return contract; the companion tool's errors guide recovery.

---

## The takeaway

Three surfaces, two languages, one design. When you write your next tool — in any framework, in any language — you're filling in the same four slots (`name`, `description`, `parameters`, `returns`) against the same five principles. Start from [SKILL.md](../SKILL.md)'s checklist; reach for [principles.md](principles.md) when you need the reasoning behind a decision.
