# The Five Principles, In Depth

The five principles for designing tools an agent can actually use, with a worked schema shape for each. The shapes here are deliberately **framework-neutral** — a tool is described by four things regardless of your stack:

```
name         → the identifier the agent selects by
description  → prose the agent reads to decide what/when/how
parameters   → the inputs, each with type, description, constraints
returns      → the shape and content the agent gets back
```

Map these onto whatever you use: an MCP tool (`name` / `description` / `parameters` / `execute`), a LangChain/LangGraph tool (`name` / `description` / `schema` / `func`), an OpenAI or Anthropic function definition (`name` / `description` / `input_schema`), or a plain function exposed to a model. The design decisions are identical; only the syntax changes. Running example throughout: an expense-retrieval tool for a personal-finance agent (`get_expenses`).

## Table of Contents

1. [Strategic selection](#1-strategic-selection)
2. [Clear naming and namespacing](#2-clear-naming-and-namespacing)
3. [Meaningful context return](#3-meaningful-context-return)
4. [Token efficiency](#4-token-efficiency)
5. [Descriptions are prompts](#5-descriptions-are-prompts)

---

## 1. Strategic selection

**Build tools around user workflows, not database schemas or API endpoints.**

The instinct carried over from API design is to expose one operation per endpoint. For an agent this backfires: near-duplicate tools force the agent to choose among them on every turn, and each one costs prompt budget to document.

**Anti-pattern — fragmented:**

```
name: get_expense_by_id          parameters: { id }
name: list_all_expenses          parameters: { }
name: filter_expenses_by_category parameters: { category }
name: search_expenses            parameters: { query }
```

The agent has to know which of four tools answers "what did I spend on groceries last month?" — and often guesses wrong.

**Better — one workflow tool:**

```
name: get_expenses
parameters:
  start_date  (required)  — date, ISO YYYY-MM-DD
  end_date    (required)  — date, ISO YYYY-MM-DD
  category    (optional)  — enum filter
  limit       (optional)  — default 50
  offset      (optional)  — default 0
```

One tool handles search, filter, and pagination — the operations that co-occur in the real workflow.

**Decide with these questions:**
- Does this tool map to how a user thinks about the task, or to how the data is stored?
- Would combining it with a sibling reduce the number of decisions the agent must make?
- Are these operations frequently used together? If so, they may want to be one tool.

Consolidate where it clarifies — but don't overload a single tool with unrelated modes. The test is whether the combined tool still maps to *one* thing the user wants.

### When *not* to consolidate

The principle has a real limit, and it's easy to overshoot. Shared data is not shared workflow.

Consider two sibling read tools over the same transactions table:

```
name: query_transactions   → bounded row listing   "show me my Dining transactions in June"
name: run_sql              → aggregates            "how much did I spend on Dining last quarter?"
```

They look like prime merge candidates — same table, adjacent phrasing, both read-only. But they return different shapes (rows plus truncation metadata vs. a scalar), and they need different safety envelopes (arbitrary SQL runs `READ ONLY`; a filtered listing needs no such guard). A merged tool with a mode flag doesn't remove the agent's decision — it hides it inside a parameter, where the description can no longer state plainly what the tool returns.

Keeping them separate also lets each description **route away from the other** — `query_transactions` telling the agent "for a total or a ranking across ALL matches, use `run_sql` instead" is a boundary you can only draw between two tools.

> **The test:** consolidate operations that share a **workflow**, not operations that merely touch the same **data**.

---

## 2. Clear naming and namespacing

**Names and descriptions are the primary signal the agent uses to select a tool.**

### Names

Descriptive and action-oriented. Bare verbs are the enemy — they're ambiguous and they collide.

```
✅ get_expenses, calculate_budget_variance, send_notification
❌ search (of what?), fetch (what?), process (process what?)
```

### Namespacing

When the agent has tools from multiple sources, two tools named `search` are indistinguishable in the moment of selection. Prefix consistently — by service or by resource:

```
slack_search, notion_search            (by service)
expenses_get, expenses_summarize       (by resource)
```

> **Know whether your surface prefixes for you.** Many MCP clients and adapters automatically prepend the server name to every tool (a server registered as `agentailor` turns `search` into `agentailor_search`). Some make it optional; some don't do it at all. If the surface already prefixes, don't hardcode the prefix too — a tool named `agentailor_search` on the `agentailor` server surfaces as `agentailor_agentailor_search`. That's not broken (the agent can still call it), just redundant and noisy. So: on an auto-prefixing surface, name the tool `search_articles` and let the server make it `agentailor_search_articles`; on a surface that doesn't prefix, add the namespace yourself. Either way the *goal* is the same — no two selectable tools share a name.

### Descriptions answer what / when / how

```
name: get_expenses
description: |
  Retrieves user expenses within a date range, with optional category filtering.

  When to use:
  - "What did I spend on groceries last month?"
  - "Show me expenses from January to March"
  - "How much am I spending on dining out?"

  Supports pagination and configurable verbosity. Returns human-readable
  descriptions and category, not just IDs.
```

### Every parameter is documented

Format, an example, and constraints — never a bare type.

```
parameters:
  start_date:
    type: string
    description: "Start date, ISO format (YYYY-MM-DD). Required. Example: '2025-01-01'"
  category:
    type: string (enum)
    description: "Optional. One of: groceries, dining, transport, utilities, healthcare, other. Omit for all categories."
  response_format:
    type: string (enum: concise | detailed)
    description: "Optional. 'concise' = essential fields only; 'detailed' = full metadata. Default 'concise' for token efficiency."
```

---

## 3. Meaningful context return

**Return information the agent can reason about, not identifiers it must resolve with another call.**

**Anti-pattern — IDs only:**

```
returns:
  expenses:
    - { id: "uuid-1234", amount: 42.50 }
    - { id: "uuid-5678", amount: 15.00 }
```

To do anything useful the agent needs a second tool call per row to learn what each expense *was*. That's extra latency and wasted tokens.

**Better — semantic context plus metadata:**

```
returns:
  query:   { date_range: {start, end}, category: "all", filters_applied: [] }
  summary: { total_expenses: 2, total_amount: 57.50, currency: "USD" }
  expenses:
    - { date: "2025-01-14", amount: 42.50, category: "groceries", description: "Whole Foods" }
    - { date: "2025-01-15", amount: 15.00, category: "dining",    description: "Corner Café" }
```

The agent can answer immediately, and the `query`/`summary` metadata tells it exactly what it's holding (which range, which filters, totals).

### Configurable verbosity

Let the agent trade detail against tokens per task:

```
concise  → date, amount, category, description
detailed → + merchant, payment_method, tags, notes, recurring
```

### Return what the next call needs

When a tool's output feeds another tool, hand back the exact value that next call takes — a canonical URL or id — so the agent can chain without a lookup. (A search tool returning each result's readable identifier, so a read tool can consume it directly, is the canonical case; see [examples.md](examples.md).)

---

## 4. Token efficiency

**Every token in a tool response is a token unavailable for reasoning or further tool calls.**

### Sensible defaults

```
parameters:
  limit:  { type: number, default: 50,  description: "Max items to return. Default 50. Lower = fewer tokens." }
  offset: { type: number, default: 0,   description: "Items to skip, for pagination." }
```

### Filter parameters

Give the agent ways to narrow *before* data comes back — `category`, `min_amount`, `search_term`. Every filter is a chance to avoid spending tokens on rows the agent didn't need.

### Truncate loudly, and guide the next query

Never silently drop rows. Say what happened and how to get the rest:

```
returns (when results exceed limit):
  notice: "Found 847 expenses; returning the first 50 to preserve tokens."
  guidance: "Narrow the date range or add a category filter. Use offset=50 to continue."
  summary: { total_found: 847, returned: 50 }
  expenses: [ ...50 items... ]
```

### Guard inputs that would blow up the response

Validate *before* running the query:

```
if (days_between(start_date, end_date) > 365):
  return error:
    message: "Date range too large (>365 days). Large ranges consume excessive tokens and may hit context limits."
    suggestion: "Use a smaller range (e.g. monthly) or add a category filter."
```

---

## 5. Descriptions are prompts

**The name, description, and parameter docs are prompt engineering — treat them as such.**

Everything the agent knows about a tool before calling it comes from this text. Vague wording here is the single most common cause of mis-selection and malformed calls.

- Be explicit about **when** to use the tool (and when *not* to — "prefer `expenses_summarize` for totals").
- State **required vs optional** clearly, and what each optional defaults to.
- Describe the **output shape** so the agent knows what it's getting before it calls.
- **Iterate against real behavior.** Run realistic requests, watch where the agent stumbles, and sharpen the wording. Description quality is not a one-shot — it's refined the way you'd refine any prompt.

### Helpful errors are part of the prompt too

An error message is the tool teaching the agent how to succeed on the retry. Cryptic codes teach nothing:

```
❌ { error: "ERR_INVALID_DATE" }

✅ {
     error: "Invalid date format. Use YYYY-MM-DD. Example: '2025-01-15'.",
     received: { start_date: "01/15/2025" }
   }
```

For failures the agent can't fix by reformatting (auth, rate limit, upstream down), say which it is and what to do:

```
✅ {
     error: "Upstream request failed: HTTP 429.",
     meaning: "Rate limited. Wait and retry, or reduce request frequency."
   }
```

---

## Putting it together

A single tool that honors all five: a **strategically-chosen** workflow tool, with a **clearly named** and **well-described** interface, that returns **meaningful context** with configurable verbosity, stays **token-efficient** through limits and guards, and whose descriptions and errors are written as **prompts** that steer the agent. See [examples.md](examples.md) for this realized in TypeScript and Python, as a standalone tool, and as a real MCP-server tool.
