---
name: tool-design
description: Design and verify tools that AI agents can actually use — for any framework or language (MCP servers, LangChain/LangGraph, function-calling, raw JSON schema; TypeScript, Python, or otherwise). Use when writing a new tool for an agent, reviewing or fixing an existing tool definition, deciding how to split capabilities into tools, writing tests or evals for a tool, checking that a tool's output matches what its description promised, or debugging why an agent misuses, mis-selects, misreads the output of, or floods its context with a tool. Applies equally to standalone tools and MCP-server tools — a tool is a tool.
---

# Tool Design

## Overview

A tool is a **contract between a deterministic system and a non-deterministic caller.** A normal API assumes a rational developer who reads the docs, handles error codes, and knows which endpoint to call. An agent breaks all of those assumptions: it may pick the wrong tool because two names look alike, pass malformed parameters despite a clear schema, pull back a dataset that blows its own context window, or misread a cryptic error and retry the same failing call.

So tools for agents are designed **defensively**: clear enough that the agent can't easily misuse them, informative enough to steer the agent toward a better next move, and lean enough to spend the context window carefully.

The payoff: **agent and human ergonomics align.** A tool that an agent uses well is almost always a tool a human finds intuitive too. Designing for a non-deterministic caller just produces a better API.

**None of this is framework- or language-specific.** The same five principles apply whether the tool is an MCP server tool, a LangChain/LangGraph tool, an OpenAI/Anthropic function-calling definition, or a plain function exposed to a model — and whether it's written in TypeScript, Python, or anything else. What varies is the syntax of `name` / `description` / `parameters` / `returns`; the design thinking does not. See [references/examples.md](references/examples.md) for the *same* tool proven across languages and surfaces.

## The Five Principles

Apply these when writing or reviewing any tool. The deep dive with worked schema shapes is in [references/principles.md](references/principles.md).

### 1. Strategic selection

Build tools around **user workflows, not database schemas or API endpoints.** Don't wrap every endpoint as its own tool — the agent then struggles to choose among near-duplicates and you spend prompt budget documenting all of them. Consolidate related operations into one well-parameterized tool when it maps to how a user thinks about the task.

> Prefer one `get_expenses(start_date, end_date, category?, ...)` over `get_expense_by_id` + `list_all_expenses` + `filter_by_category` + `search_expenses`.

Ask: does this map to how users think about the task? Would merging it with a sibling reduce the number of decisions the agent has to make?

**But don't consolidate on data alone.** Two tools touching the same table can still be two workflows. A bounded row listing ("show me my Dining transactions in June") and an aggregate query ("how much did I spend on Dining last quarter") look like prime merge candidates — same data, adjacent phrasing. Merging them into one tool with a mode flag satisfies the principle's letter and makes selection *harder*: the agent now reasons about which mode on every call, and the two have genuinely different return shapes and safety properties. Consolidate operations that share a **workflow**, not operations that merely share **data**.

### 2. Clear naming and namespacing

Names and descriptions decide whether the agent picks the right tool. Use descriptive, action-oriented names — never bare `search`, `fetch`, `process`. When an agent has tools from several sources, collisions cause mis-selection, so **namespace with a consistent prefix** — by service (`slack_search`, `notion_search`) or resource (`expenses_get`, `expenses_summarize`).

> Check whether your surface prefixes for you: many MCP clients auto-prepend the server name, so hardcoding the prefix too yields `agentailor_agentailor_search`. Let the surface prefix, or prefix yourself — not both. See [references/principles.md](references/principles.md#2-clear-naming-and-namespacing).

A description should answer three questions:
- **What** does it do? (1–2 sentences)
- **When** should the agent reach for it? (a few example queries)
- **How** is it used? (key parameters, constraints, what it returns)

Every parameter gets a description with its **format, an example, and constraints** — `"Start date in ISO format (YYYY-MM-DD). Example: '2025-01-01'"`, not `start_date: string`.

### 3. Meaningful context return

Return information the agent can **reason about directly**, not identifiers it must resolve with another call. Include the expense's description and category, not just a UUID. Attach lightweight metadata (totals, the date range, which filters were applied) so the agent knows what it's looking at.

Make verbosity **configurable**: a `response_format` of `concise` (essential fields) vs `detailed` (full metadata) lets the agent trade detail against tokens per task. When a result feeds the next tool call, return the exact value that next call needs (e.g. the canonical URL/id to pass along), so the agent can chain without a lookup.

### 4. Token efficiency

Every token in a tool response is a token unavailable for reasoning. Give collection-returning tools **sensible default limits** (e.g. 50) plus pagination and filter parameters. When you truncate, **say so and say how to continue** — "Found 847, returning 50; narrow the date range or add a category filter" beats silently dropping rows. Validate inputs that would produce huge responses (e.g. reject a >1-year range) *before* running the query.

### 5. Descriptions are prompts

The tool's name, description, and parameter docs **are prompt engineering** — every word shapes how the agent uses the tool. Be explicit about when to use it, required vs optional parameters, and the shape of the output. Refine this text iteratively against real agent behavior: unclear wording is the most common reason an agent mis-selects or mis-calls a tool.

## Validation Checklist

When writing or reviewing a tool, confirm:

- [ ] **Strategic** — consolidates a real workflow; not one-tool-per-endpoint, not overlapping near-duplicates.
- [ ] **Named** — descriptive, action-oriented, namespaced to avoid collisions; not a bare verb.
- [ ] **Described** — the description says what / when / how, with example queries.
- [ ] **Parameterized** — every parameter documents format + example + constraints; required vs optional is intentional; optionals have sensible defaults.
- [ ] **Contextual** — returns human-readable info and metadata, not just IDs; verbosity is configurable when responses can be large.
- [ ] **Efficient** — default limits, pagination/filters, truncation messages that guide the next query; guards against responses that would blow the context window.
- [ ] **Helpful on failure** — errors explain what went wrong and what to do next, with an example; no cryptic codes.
- [ ] **Tested** — the checklist items above that are mechanically checkable have deterministic tests (unit at minimum, integration where real I/O decides correctness); the behaviors only a model can exercise have evals (or are knowingly deferred).

## Testing

The checklist above says what a good tool does. Nothing so far says how you know it still does — and **a tool description is a contract with a non-deterministic caller, so an unverified contract is the default failure.** The implementation drifts from what the description promised, and the agent, which has no way to check, believes the description.

Two layers, split on whether a model is in the loop, and neither subsumes the other:

**Deterministic tests — cheap, repeatable, always.** Whatever runs without a model and gives a stable verdict: unit tests as the floor, plus integration tests when correctness depends on real I/O (a multi-step write, a transaction boundary, a third-party API). Most of the checklist is mechanically testable this way: that truncation is *signalled* rather than merely applied, that errors return structured actionable objects, that the payload really contains the fields the description promised, that defaults behave as documented. Assert on the **tool's returned payload** — the surface the agent sees, and the same surface an eval grades later, so the assertions survive.

> A tool that silently caps rows at 50 while its description promises a bounded list will report 262 matches as `count: 50`. A test that stubs a full page against a larger total and asserts `truncated === true` catches that in milliseconds. See [references/testing.md](references/testing.md).

**Evals — needed, harness-agnostic.** No deterministic test can catch **mis-selection** (nothing in a unit test decides whether the agent reached for `query_transactions` or `run_sql` — the model chooses, from your descriptions) or **mis-interpretation** (a unit test proves `truncated: true` is present; only an eval proves the agent *noticed* it and didn't sum a partial page into a confident wrong total). Run the real agent against a seeded fixture and grade the transcript on tools called and final answer. Deferring this layer is a resource decision, **not evidence the risk is absent.**

**Layout:** keep a tool's deterministic tests **beside the tool**, so tool + tests lift into any project as one unit. Evals are the opposite — cross-cutting, spanning several tools, and centralized. The two layers don't live in the same place.

## Workflows

**Writing a new tool** — Start from the workflow the user cares about (Principle 1), not the data model. Draft the name + description + parameters as if they were prompt text (Principles 2 & 5). Decide the return shape and metadata (Principle 3), then add limits, filters, and guard rails (Principle 4). Run the checklist. Then test both layers (see [Testing](#testing)): unit-test the contract — truncation signalled, errors structured, promised fields present — and give the agent 3–5 realistic requests to watch whether it selects, calls, *and interprets* the tool correctly; refine the description where it stumbles.

**Reviewing an existing tool** — Walk the checklist top to bottom. For each miss, name the severity, quote the exact line, explain why it trips an agent, and show the fixed version. The most common real failures: bare/colliding names, `param: type` with no description, returning IDs the agent then has to resolve, unbounded responses, and cryptic error codes.

## Failure Modes to Avoid

- **One tool per endpoint** — fragments the decision and burns prompt budget. Consolidate.
- **Bare or colliding names** (`search`, `get`, `fetch`) — the agent can't tell yours apart from another server's. Namespace and be specific.
- **Undocumented parameters** — `start_date: string` tells the agent nothing about format or bounds. Add format + example + constraints.
- **Returning IDs instead of context** — forces an extra lookup call and wastes tokens. Return what the agent can reason about.
- **Unbounded responses** — no limit, no pagination; one call floods the context window. Cap and paginate by default.
- **Cryptic errors** (`ERR_INVALID_DATE`, `TOO_MANY_RESULTS`) — the agent can't self-correct. Say what happened and what to try next.
- **Framework tunnel vision** — assuming these ideas only apply to MCP, or only to your language. They apply to every tool surface; see [references/examples.md](references/examples.md).
- **An unverified contract** — the description promises one thing, the implementation returns another, and nothing notices. Unit-test the checklist items that are mechanically checkable; eval the ones that aren't.

## References

- [references/principles.md](references/principles.md) — the five principles in depth, each illustrated with a neutral `name`/`description`/`parameters`/`returns` schema shape (no framework assumed).
- [references/examples.md](references/examples.md) — the same tool proven across surfaces and languages: one tool in TypeScript (Zod) and Python (Pydantic) side by side, one standalone (non-MCP) tool, and one real MCP-server tool annotated principle by principle.
- [references/testing.md](references/testing.md) — verifying the contract: which checklist items are mechanically testable and what each assertion looks like, a worked truncation bug (found in real shipped code) with the test that catches it, and what evals catch that no deterministic test can.
