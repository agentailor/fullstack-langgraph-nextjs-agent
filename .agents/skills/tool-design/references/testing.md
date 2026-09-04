# Testing Tools: The Contract and the Behavior

A tool description is a **contract with a non-deterministic caller.** The rest of this skill is about writing that contract well. This file is about verifying that the implementation honors it — and that the agent actually acts on it.

Those are two different questions, and they split on whether a model is in the loop:

| | **Layer 1 — Deterministic tests** | **Layer 2 — Evals** |
| --- | --- | --- |
| Answers | Does the payload match what the description promised? | Does the agent select and interpret the tool correctly? |
| Needs | No model. I/O stubbed or real, as the tool warrants | A model in the loop |
| Cost | Fast and repeatable — same input, same verdict | Slow, non-deterministic, costs tokens |
| Catches | Broken contract | Mis-selection, mis-interpretation |
| Run | Always, on every change | Before shipping, on behavior-sensitive changes |

Layer 1 is a *category*, not a single test kind — unit, integration, contract, whatever the tool's logic warrants. The line that matters is the one in the table: no model, stable verdict.

Neither layer subsumes the other. A tool can pass every test in layer 1 and still be used wrongly; an agent can behave correctly in an eval run and regress the moment the payload shape changes underneath it.

**The floor: every tool gets a contract test, and an eval too where the budget allows.** Everything below is detail on what to assert and why. If you take one thing from this file, take that sentence.

> The worked example below comes from [Cameron](https://github.com/agentailor/cameron), a public personal-finance agent, and is reproduced as-is from shipped code. It's TypeScript with `vitest` because that's what that project uses — **you are expected to adapt it, not copy it.** Nothing about the runner, the mocking API, or the assertion syntax is part of the guidance; see [What transfers, what doesn't](#what-transfers-what-doesnt).

## Table of Contents

1. [Layer 1 — Deterministic tests](#layer-1--deterministic-tests)
2. [Worked example: truncation that lies](#worked-example-truncation-that-lies)
3. [Layer 2 — Evals](#layer-2--evals)
4. [Where each layer lives](#where-each-layer-lives)

---

## Layer 1 — Deterministic tests

Whatever runs without a model and gives a stable answer. **Unit tests are the floor** — every tool gets them. Add integration tests when correctness depends on real I/O: a multi-step write, a transaction boundary, an external API's actual behavior. Cameron's tools are thin wrappers over repositories, so unit tests sufficed; a tool that moves money or spans tables won't be so lucky.

Whichever kinds you write, the target is the same. Most of this skill's [Validation Checklist](../SKILL.md#validation-checklist) is **mechanically testable.** The checklist tells you what a good tool does; these are the assertions that prove it still does:

| Checklist item | What the test asserts |
| --- | --- |
| **Efficient** | Truncation is *signalled*, not merely applied — and the payload says how to continue. |
| **Helpful on failure** | Errors come back as structured, actionable objects rather than throwing or returning a bare code. |
| **Contextual** | The payload actually contains the fields the description promised. |
| **Parameterized** | Defaults apply as documented; optional-vs-required behaves as documented; filters reach the data layer. |

Plus one that isn't on the checklist but belongs here: **a "no results" payload must mean what the agent will read it to mean.** An unknown category and a real category with zero rows both produce an empty list. If the payload doesn't distinguish them, the agent reports "you have no transactions" when the truth is "you typoed the category name."

### Assert on the returned payload

Assert against the **tool's returned payload** — parse the JSON, assert on fields — rather than on internal function calls or the data layer.

That is the same surface an eval grades against later, so the assertions survive the move instead of being rewritten. It's also the surface the *agent* sees, which is the thing you actually care about: an internal function can be perfectly correct while the payload the agent reads is misleading.

**For the unit-test tier, isolate the tool from I/O.** Those tests should need no database, no network, and no API key — that's what makes them cheap enough to run on every change. *How* you isolate is your ecosystem's business: a mocking library, a hand-written fake, an injected interface, a trait implementation. The requirement is the isolation, not the technique. (Integration tests deliberately give this up in exchange for exercising the real thing — run them too, just not on every keystroke.)

### What transfers, what doesn't

The worked example that follows is one project's code in one language. Read it for the **assertions**, not the syntax:

| Transfers to every stack | Doesn't transfer |
| --- | --- |
| *Which* properties of the payload you assert on | The test runner and its `describe`/`it` shape |
| Asserting on the parsed payload, not internals | The mocking API (`vi.mocked`, `patch`, a hand-rolled fake, an injected interface) |
| Pairing a positive case with its inverse | The assertion syntax (`expect(...).toBe`, `assert ==`, `require.Equal`) |
| Isolating the tool from I/O | The file naming and directory convention |

So: take the *list of things worth asserting*, and express it however your language and framework do it. A Python project writing these with `pytest` and a Go project writing them with table-driven tests are both following this skill correctly. If your stack has no mocking library at all, hand-write a fake — the point is that the test runs in milliseconds without touching a database.

---

## Worked example: truncation that lies

Cameron's `query_transactions` promised the agent a bounded list of transactions. The implementation returned:

```ts
return JSON.stringify({ count: items.length, transactions: items });
```

…while the repository silently capped rows (default 50, max 200). So a filter matching **262** transactions came back as `count: 50`, with nothing indicating anything was missing.

The agent cannot distinguish that from a complete result — and it had been told to reason over those rows. In a finance agent, that is a confidently-stated wrong total.

This is exactly [Principle 4](principles.md#4-token-efficiency)'s failure mode — *when you truncate, say so and say how to continue* — present in the checklist, absent from anything that could **detect** it.

### The fix: make truncation visible

```ts
const truncated = total > items.length;
return JSON.stringify({
  returned: items.length,
  matched: total,
  truncated,
  transactions: items,
  ...(truncated
    ? {
        hint:
          `Showing the ${items.length} most recent of ${total} matching transactions. ` +
          "Narrow the date range, add a category/account filter, or raise `limit` (max 200). " +
          "For a total or a ranking across ALL matches, use run_sql instead — do not add up " +
          "these rows.",
      }
    : {}),
});
```

`returned` vs `matched` is the whole repair: the agent can now see that it's holding 50 of 262. The `hint` does the Principle 5 work — it names the next move *and* routes the agent away from the mistake it would otherwise make (summing a partial page).

### The test that catches it

Stub a full page against a larger total and assert the signal is present:

```ts
it("tells the agent when results were truncated, and how to narrow them", async () => {
  vi.mocked(transactionRepo.list).mockResolvedValue({
    rows: makeTransactions(200),
    total: 847,
  });

  const result = await callTool(queryTransactions, { from: "2026-01-01" });

  expect(result.returned).toBe(200);
  expect(result.matched).toBe(847);
  expect(result.truncated).toBe(true);
  // "truncated" alone isn't enough — the hint must give the next move.
  expect(result.hint).toEqual(expect.stringContaining("847"));
  expect(result.hint).toEqual(expect.stringMatching(/narrow|filter|run_sql/i));
});
```

Milliseconds, no model, no database. Note the last two assertions: they test the *guidance*, not just the flag. A `truncated: true` with no usable hint satisfies the letter of Principle 4 and none of its intent.

Stripped of the language, that test is four steps — this is the part to carry into your own stack:

1. **Arrange** — make the data layer report a page smaller than the true total (200 rows, 847 matched).
2. **Act** — call the tool and parse its returned payload.
3. **Assert the signal** — `returned`, `matched`, and the truncation flag all say the result is partial.
4. **Assert the guidance** — the hint names the real total and points at a next move (narrow, filter, or switch tools).

Write those four steps in whatever your project already uses. The value is in step 4 especially: it's the assertion most test suites omit, and it's the one that encodes Principle 4's intent rather than its letter.

Pair it with the inverse, or the flag is meaningless:

```ts
it("does not claim truncation when the result is complete", async () => {
  vi.mocked(transactionRepo.list).mockResolvedValue({ rows: makeTransactions(12), total: 12 });

  const result = await callTool(queryTransactions, {});

  expect(result).toMatchObject({ returned: 12, matched: 12, truncated: false });
  expect(result.hint).toBeUndefined();
});
```

The same shape covers the ambiguous-empty case — assert that an unknown category comes back *named as unknown*, with a pointer to the tool that lists valid ones, and that the data layer was never queried at all.

---

## Layer 2 — Evals

Layer 1 verifies the payload. No amount of it — unit, integration, or otherwise — can verify two things:

- **Mis-selection between plausible siblings.** Nothing in a unit test decides whether the agent reached for `query_transactions` or `run_sql`. That choice is made by the model, from the descriptions — so only a model can test it.
- **Mis-interpretation.** A unit test proves `truncated: true` is *present*. Only an eval proves the agent **noticed** it and didn't report a capped page's sum as the year's total.

An eval runs the real agent against a seeded fixture and grades the transcript — typically on *which tools were called* and *what the agent finally said*. The specifics of the harness don't matter here and this skill deliberately doesn't prescribe one; what matters is that the layer exists and that you know what it's for.

### Live evidence that the layer is necessary

Driving Cameron's real agent against a seeded database — 262 Dining transactions, true total **$2,752.25**:

| Prompt | What happened | |
| --- | --- | --- |
| "Show me my Dining transactions" | Payload `{"returned":50,"matched":262,"truncated":true}`; the agent reported **262** and flagged the partial view. | ✅ |
| "How much did I spend on Dining?" | Routed to SQL `SUM()` → **$2,752.25**. | ✅ |
| "List my Dining transactions **and then add them up** for me" | Pulled raw rows and summed them **in prose**: **$2,812.25** — off by $60. | ❌ |

The third case is the point. **The payload was correct and every layer-1 test passed.** The agent simply interpreted it badly — and it was non-deterministic: a re-run used `SUM()` and got the right answer.

No test in layer 1 can catch that, however many you write. It needs a model in the loop.

### Deferring evals is a resource decision

It is not evidence the risk is absent. Cameron's truncation bug was found by *reading the code*, not by a failing signal — nothing in the project was watching for it, because there were no tests at all.

If you defer this layer, defer it knowingly: write down which behaviors are unverified, and treat "we've never seen it misbehave" as the absence of evidence it is.

---

## Where each layer lives

The two layers have opposite locality, and it's worth being deliberate about it:

- **Unit tests belong beside the tool** — `finance.test.ts` next to `finance.ts`. The tool and its contract tests then lift into any project as one unit. This skill is framework- and layout-agnostic and doesn't imply a directory structure; "beside" is about keeping the pair together, whatever your conventions call it.
- **Evals are cross-cutting and centralized** — they exercise the agent, not a tool, and a single case routinely spans several tools. They belong in their own top-level location, not scattered next to individual tools.

Don't assume both layers live in the same place. They answer different questions at different granularities.
