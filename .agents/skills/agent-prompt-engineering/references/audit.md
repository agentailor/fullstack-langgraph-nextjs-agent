# Auditing an Existing Prompt

Most prompt engineering advice assumes a blank page. This file assumes the opposite: a prompt that already works, has been in production for months, and grew a paragraph at a time — one incident, one edge case, one "just add a line telling it not to do that."

That prompt is not badly written. It is **over-fitted to a model that no longer exists.** Some of it compensates for behavior the model you run today produces on its own, and every one of those lines still costs tokens, still constrains reasoning, and can still contradict the lines added after it.

The pass is not "delete instructions." It is **re-fitting instruction density to the model you actually run** — which means a model *downgrade* triggers it as much as an upgrade.

How much a pass can find: reductions on the order of half a mature prompt are common, and published cases have gone considerably further. Anthropic, for one, [reported removing over 80%](https://claude.com/blog/the-new-rules-of-context-engineering-for-claude-5-generation-models) of Claude Code's system prompt when moving to a newer model generation, with no measurable loss on their coding evals. Two things make that number mean anything, and they apply to any such claim: it was **measured**, and it was measured **on a specific model**. Both caveats run through this file.

## Table of Contents

1. [Audit freely; delete carefully](#audit-freely-delete-carefully)
2. [When to run a pass](#when-to-run-a-pass)
3. [Finding candidates](#finding-candidates)
4. [What not to delete](#what-not-to-delete)
5. [Verifying a deletion](#verifying-a-deletion)
6. [Running the pass](#running-the-pass)


---

## Audit freely; delete carefully

**The audit needs no test infrastructure.** Reading a prompt and marking what looks stale is textual work — you can do the whole of [Finding candidates](#finding-candidates) with nothing but the prompt, the tool definitions, and knowledge of the product. Never withhold an audit because there's no eval harness.

Deletion is the part that needs care, because it's invisible work. The prompt gets shorter, nothing obviously breaks, and the failure — if there is one — surfaces weeks later on the specific input the deleted line existed to handle. Without something to compare against, you cannot tell "I removed 60% and quality held" from "I removed 60% and quality dropped on the 8% of traffic I don't look at."

So the rule is not *have an eval harness*. It is:

> **Know how you'll notice a regression before you delete, and be honest about how strong that check is.**

That admits a range of answers, and for many agents the light ones are appropriate — see [Verifying a deletion](#verifying-a-deletion). What it doesn't admit is deleting and assuming.

### If you're an agent running this audit for someone

Do the audit and report the findings regardless. Then say plainly what verification the deletions would need, rather than either demanding a harness or quietly implying the cuts are safe:

- **Ask whether an eval suite exists.** If it does, that's the instrument — baseline, cut, re-run.
- **If there isn't one, say so explicitly** and offer the alternatives in the table below rather than stopping. For a simple agent, a handful of hand-run cases is genuinely enough.
- **Grade your findings by how much verification each needs.** Duplication between a prompt and a tool description can be confirmed by inspection. Removing a hard cap, a bound, or anything near a product invariant cannot.
- **Let the person decide** what risk to accept. Present the options; don't pick for them.

---

## When to run a pass

- **You changed the model** — either direction. See [the model-tier rule](#the-model-tier-rule).
- **The prompt has grown past the point anyone reads it end to end.** If nobody can say what's in it, nobody can tell whether a new line contradicts an old one.
- **You're about to add another instruction.** The cheapest moment to remove three stale lines is while you're already in the file.
- **The agent behaves as if over-constrained** — looping, over-qualifying, refusing reasonable requests, applying a rule where it was never meant to apply. The reflex is to add a correcting line; often the fix is deleting the line that caused it.

---

## Finding candidates

Six patterns worth looking for. Each surfaces a *candidate*, never a verdict — every hit goes through [What not to delete](#what-not-to-delete) before it's cut, and the ones that survive still need [verification](#verifying-a-deletion).

### 1. Instructions stated twice

The same rule in the system prompt *and* in a tool description. Someone adds a constraint to the prompt, someone later writes it into the tool where it belongs, neither deletes the other.

**Keep the tool-description copy.** It sits closest to the decision it governs, loads exactly when that tool is in play, and stays correct if the tool moves to another agent. The prompt copy is a second source of truth that ages independently.

The same logic applies within a prompt — a constraint in the role section, restated in a "critical reminders" block at the end. See [Anti-Pattern 12](anti-patterns.md#anti-pattern-12-excessive-repetition).

This is the safest category to act on: duplication is verifiable by reading, and deleting one of two identical rules rarely changes behavior.

### 2. Rules that are now judgment calls

Hard caps and absolute prohibitions written to stop a behavior the current model may no longer exhibit. A published example of the swap, from Anthropic's own coding-agent prompt — the old instruction:

> In code: default to writing no comments. Never write multi-paragraph docstrings or multi-line comment blocks, one short line max.

…and its replacement:

> Write code that reads like the surrounding code: match its comment density, naming, and idiom.

The first is a **rule**, and it existed because a weaker model wrote too many comments; the cap worked. The second is **judgment** — it assumes the model can read a file and match the local convention. Not "we were wrong," but *the model got good enough that the workaround costs more than it returns.*

The same applies to enumerated decisions:

```
❌ If the user asks about billing, respond formally. If the user asks about a bug,
   respond casually. If the user seems frustrated, apologize first and skip the
   pleasantries. If the user is a returning customer, reference their history.
```

Four rules encoding one instruction — *match the register to the situation* — which a capable model does unprompted, and better, because it handles the fifth case nobody wrote a rule for.

The tell: a hard cap aimed at a behavior you haven't actually seen recently, or a list of `if <situation>, do <obvious thing>` clauses where a reader would say "well, obviously."

### 3. Examples a better schema would replace

Few-shot examples teaching an output format that a **structured output schema, an enum, or a typed tool parameter** could enforce directly.

If 40 lines show the model what a valid category string looks like and the tool could take `category: "dining" | "groceries" | "transport"`, the examples are doing a job the type system does better and for free. An enum of `pending | in_progress | completed` teaches the usage pattern without a single example — and unlike an example, it cannot drift out of sync with the code.

The constructive half of [Anti-Pattern 1](anti-patterns.md#anti-pattern-1-over-prescriptive-few-shot-examples): don't just delete the prescriptive examples, ask what mechanism should carry the constraint instead.

### 4. Situational detail that belongs elsewhere

Long passages covering one workflow, an occasional integration, or a rare task type — loaded into every request, relevant to a fraction of them.

This is what skills and reference files are for. Move the passage out, leave a one-line pointer, let it load when needed. If the prompt has section headers, the sections nobody's request ever touches are the candidates.

### 5. Over-constrained heuristics

Bounds tightened past usefulness, and unbounded instructions with no exit condition:

```
❌ Keep searching until you find the highest quality possible source
```

No state satisfies that, so the agent searches until it runs out of context. See [Prepare for Side Effects](../SKILL.md#6-prepare-for-side-effects) and [Anti-Pattern 2](anti-patterns.md#anti-pattern-2-the-perfectionism-loop).

Look for **superlatives with no stopping rule** (`best`, `all possible`, `completely`, `every`) and **numeric bounds set for a weaker model** — a 3-tool-call cap added when the agent used to thrash is now a ceiling on a model that would have planned its way there in five.

### 6. Density mismatched to the model tier

The catch-all: instruction compensating for a capability the current model already has. Formatting scaffolds, forced reasoning structures, explicit "think step by step" framing, restatements of default behavior. If you can't articulate what would go wrong without a line, that's the signal.

### The model-tier rule

**Instruction density should track capability headroom.** How much scaffolding a prompt needs is a property of the model underneath it — how much judgment it can be trusted to supply on its own. Every provider ships a range, and the range is what matters, not the brand: a large flagship model infers convention, resolves ambiguity, and stops on its own; a small fast one has less headroom to do any of that and leans harder on what the prompt spells out.

Two consequences follow, and the second is the one people miss.

**Guidance written for the top of a lineup does not transfer down.** Advice to delete scaffolding is almost always demonstrated on the largest models available, because that is where the headroom is. Smaller models are usually not mentioned — **absent, not exempted.** Plenty of production agents run small models deliberately: classification, routing, extraction, anything high-volume where cost and latency dominate. There, the instruction you are about to cut as an over-constraint may be the only thing keeping the task on rails. Terseness that reads as trust on a large model reads as ambiguity to one with less room to resolve it.

**A downgrade triggers the pass as much as an upgrade.** Moving a step to a smaller or cheaper model to cut costs changes how much judgment you can assume, and a prompt trimmed to the bone for a flagship may need some of that scaffolding back. The pass re-fits density in whichever direction the model moved.

The same holds across *generations*, not just tiers: a newer model in the same slot may need less scaffolding than its predecessor, and occasionally more of some particular behavior requested explicitly.

**Treat prompt and model as a versioned pair.** Changing either invalidates the fit. If you serve several tiers, expect their prompts to diverge rather than maintaining one that serves all of them.

Because this is a claim about *your* model and *your* task, no external result settles it. Whatever the density turns out to be, it is decided by [checking against the model you actually run](#verifying-a-deletion) — not by a published percentage, and not by this file.

---

## What not to delete

**This half matters more than the deletions.** The failure mode of the exercise isn't "I didn't trim enough" — it's removing something load-bearing and finding out in production.

The rule that resolves most cases:

> **Delete what the model can infer. Keep what only you know.**

A model can infer conventions, formats, reasonable defaults, tone, and how to break down a task. It cannot infer facts about *your* product, *your* environment, or *your* domain that exist nowhere in its training data.

**Product invariants.** Rules true because you decided they are, not because they're generally sensible: never move money without explicit human approval; every capability through the same gate; never quote a price without checking the live rate. The ones reading as *obviously good practice* are the most dangerous to cut — obviousness is what makes them look redundant.

**Non-obvious facts about the harness or environment.** Which tool returns stale data. Which API is rate-limited and how to back off. That one integration returns `200` with an error in the body. That the deploy tool is irreversible.

**Domain conventions.** How your industry or your customers use a term that means something else elsewhere — what your users mean by "closed," "settled," "active." Local convention is exactly what a general-purpose model gets plausibly and confidently wrong.

### The test to apply

For each candidate, ask both:

1. **Could a competent new hire, given the tools and no other context, infer this?** If yes, the model probably can. If they'd have to be *told*, it stays.
2. **What specific input breaks if this line is gone?** If you can name one, that's your verification case. If you genuinely can't, that's evidence for deletion — not proof.

When both are ambiguous, keep the line. An unnecessary instruction costs tokens; a missing invariant costs an incident.

---

## Verifying a deletion

Match the instrument to the stakes. All of these are legitimate; what matters is knowing which one you used.

| Check | Good for | Weakness |
| --- | --- | --- |
| **Inspection** — confirm the rule survives elsewhere (e.g. in the tool description) | Duplication only | Proves nothing about behavior |
| **Hand-run cases** — 5–15 realistic requests, before and after, judged by you | Simple agents, narrow scope, low blast radius | Subjective; small sample; easy to grade generously |
| **Eval suite** — automated, scored, repeatable | Anything complex, high-volume, or high-stakes | Costs time to build |

Hand-running is a real baseline, not a consolation prize. For an agent with one workflow and a handful of tools, someone who knows the product can often judge a before/after better than a thin automated scorer. Two things make it honest:

- **Record the before.** Actual outputs, not an impression. Grade before and after in the same sitting — a week apart, your standards will have moved.
- **Include the inputs that motivated the instructions you're deleting.** Those are precisely what a deletion would regress. If you can't remember them, that's information too.

Whichever instrument you use: **a passing case is evidence only if you know why it passed.** A case can pass for reasons unrelated to the line you removed, which makes it useless as protection for that deletion.

And scale the instrument to the category. Removing a duplicated rule and removing a bound on an irreversible action are not the same risk, and shouldn't get the same level of check. The [3-Test Rule](../SKILL.md#the-3-test-rule) applies here as elsewhere: large effects show up in small samples, so a handful of cases catches the deletions that badly matter.

---

## Running the pass

1. **Read the prompt end to end,** marking candidates against the [six patterns](#finding-candidates). Don't edit yet — reading first is what surfaces the duplicates and the contradictions.
2. **Screen every candidate** through [what not to delete](#what-not-to-delete). Anything that survives both tests goes back.
3. **Decide how you'll verify,** and record the before. On a model change, capture that baseline *on the new model with the prompt unchanged* — that's what the deletions are measured against, not the old model's results.
4. **Delete in batches**, checking between them. Not all at once (a regression becomes impossible to attribute) and not line by line (slow, and it hides the cases where two stale instructions were cancelling out).
5. **Keep whatever the check says to keep**, whatever your instinct said. The instinct that added the line is the same one that will defend it.
6. **On a regression, restore narrowly.** Find the case that broke and restore the instruction that handled it — usually rewritten tighter, since the original was often a broad rule aimed at a narrow problem. Don't revert the whole pass.
7. **Record the model and date at the top of the prompt.** A prompt whose target model is unknown is a prompt nobody dares to trim.

Then treat it as recurring maintenance, not a one-off cleanup: the fit starts drifting again the moment either side of the pair changes.

---

The reasoning behind this checklist, with a worked audit of a real 100-line production prompt, is in [Your System Prompt Has a Shelf Life](https://blog.agentailor.com/blog/system-prompt-shelf-life).
