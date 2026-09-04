---
name: agent-eval-cases
description: Decide which AI agent behaviors are worth an eval case, then write those cases — harness-, framework-, and language-agnostic. Use when writing a first eval suite for an agent, adding cases to an existing one, reviewing eval cases or scorers someone else wrote, choosing between a deterministic check and an LLM judge, deciding how many times to repeat a case, or reading a red run and working out whether the agent or the grader is wrong. Also use when a tool or prompt change "needs an eval" and it is not clear what to actually test, or when an agent misbehaves in a way no unit test can catch. Covers cases, tasks, scorers, graders, evaluators, judges, and pass@k. Does not build eval harnesses — it detects one and asks before anything gets built.
---

# Agent Eval Cases

## Overview

A case is **one task you give the agent, plus the graders that decide whether what came back was acceptable.**

That is the whole shape — and note what it is *not*. It is not an input paired with an expected output. There is no single correct answer string to compare against, which is why the right-hand side is a **list of graders** rather than a value. Many frameworks offer an `expected` / `expected_output` field; reaching for it by default is the most common way to write a suite that measures phrasing instead of behavior.

Three consequences shape everything below:

- **A grader can assert on what the agent *said* or on what the agent *did*** — which tools it called, what is in the store afterwards, whether a gate fired. The second kind is usually the stronger one.
- **Graders see only what the run recorded.** That record — the final answer, the tool calls, what each returned, what a guardrail stopped — is called the **capture** here; your harness may have no name for it at all. It bounds every assertion you can write, so find out what is in it before designing a case around one.
- **A case is not passed or failed by a person reading it**, so whatever you want to be true has to be expressible as code (or as a rubric a model can apply, or — occasionally — as a human's read).

The hard part is not the format. It is knowing which handful of tasks are worth paying a model to run, repeatedly, forever.

## The workflow

Steps 1–3 are the ones that decide whether a suite is worth having. Do not skip to step 5.

### Step 0 — Confirm where these will run

A case needs something to run it on. Before writing any, find out what exists.

**Look for an existing suite first.** Search for an `eval`/`evals`/`evaluation` directory, a case or dataset type, `*.eval.*` files, or a framework dependency. If one exists, **write cases in its idiom** — its case type, its grader catalog, its repeat convention — and stop looking. See [references/vocabulary.md](references/vocabulary.md).

**If there is none, do not build one unprompted.** Name the three options and let the builder choose:

| Option | When it fits |
| --- | --- |
| **Grade by hand** | A small suite. Run the agent, read the answer, decide if it is right. This is a real eval — a case, a run, and a human grader — and it is the correct starting point. |
| **Build a minimal harness** | Once run-count × case-count stops fitting in an afternoon. |
| **Adopt a framework** | When the plumbing (trace parsing, batching, CI reporting, dashboards) becomes the bottleneck rather than the point. |

**Never scaffold a harness without explicit confirmation.** Building one is a separate project with its own design decisions — what to capture, where it runs, how it resets. If the builder wants that, say so and get agreement first.

> Hand-grading is not a lesser option to be talked out of. For a small agent it is the right answer, and it stays right for longer than people expect.

### Step 1 — Elicit observed failures. Never invent them

**You cannot reason your way to a good case list from an empty page, and you must not try.** A suite invented at a desk tests the failures someone was able to imagine. That is the wrong set.

Three sources, best first:

- **Production traces.** Real failures, real phrasings, no imagination required. The best source there is — and the honest reason tracing comes before evals: you cannot distill cases from traffic you never recorded.
- **The builder, using their own agent.** What makes them wince. What they have caught and corrected by hand.
- **Someone who knows the domain.** A domain expert who has never seen the code can usually list the expensive edge cases within minutes, because they know which wrong answers cost money.

**Ask; do not guess.** If the builder cannot name a failure they have actually observed, say that plainly and offer a route to generate observations — a short hand-run probing session, or the domain-expert conversation — rather than inventing a suite that will look thorough and test nothing.

The question set, the triage, and what to do when there is nothing to go on are in [references/elicitation.md](references/elicitation.md).

### Step 2 — Push each failure down before it earns a case

This is the filter, and it is the step most likely to be skipped.

> **Observe a failure → push it to the cheapest layer that can catch it → let evals inherit only what will not fit.**

A failure that a unit test could have caught is a failure you will pay to re-detect on **every run, forever**. Work down the layers:

1. **Is the payload ambiguous?** The fix belongs in the payload. An empty result that means two different things — "this filter matched nothing" and "the thing you filtered on does not exist" — forces the agent to guess, and no eval case repairs that, because it was reasoning correctly over a misleading input. Same for a page that is silently capped rather than marked partial. This is [`tool-design`](https://github.com/agentailor/skills/tree/main/tool-design) territory.
2. **Is it mechanically checkable?** It belongs in the ordinary test suite — a unit test over the tool, or an integration test where real I/O decides correctness. Truncation signalled, errors structured, promised fields present, defaults applied: all provable without a model, in milliseconds.
3. **What is left is an eval case.** Typically: the agent had correct information and used it wrongly, or chose the wrong tool, or ignored an instruction — and only sometimes, which is the part no assertion over a return value can reach.

**This filter assumes layer 2 exists. Check that it does.** If the project has no tests over its tools, say so plainly — pushing a failure down to a layer that is not there means nothing catches it, and the case you were about to skip becomes the only guard. Two consequences worth stating to the builder:

- **Ordinary tests are the cheaper place to start**, and they are outside this skill's scope. A unit test over a tool runs in milliseconds, on every change, for free; an eval case costs a model call every run, forever. A project with neither should usually write those first.
- **Until they exist, some cases will duplicate them.** That is the right call in the moment — an eval that catches a payload bug beats nothing catching it — but flag those cases, because they are the first to retire once the cheaper layer lands.

Applying the fix and the case together is the honest sequence: a case has to be able to fail *for the right reason* before the defect underneath it is worth chasing.

**Report what belongs at layers 1 and 2; do not go and build it.** Those are changes to tool code and test suites, outside a request to write evals — and a payload fix changes the behavior every existing case was written against. Name the failure, say which layer should catch it and why, and let the builder decide whether to take it now, later, or not at all. Carry on writing cases for what is left.

### Step 3 — Group by defect class, not by feature

What survives step 2 is a **defect class** — a way the agent can be wrong — not a feature. Grouping by feature produces one case per capability: expensive, slow, and mostly redundant with tests that already exist.

Defect classes look like this (examples of the *shape*, not a checklist to fill):

| Defect class | The failure | From |
| --- | --- | --- |
| Tool mis-selection | Reaching for a listing tool to compute a total, when an aggregate was right there | analytics agent |
| Unnoticed truncation | Reporting a capped page as though it were the complete set | any paginated source |
| Unattributed currency | Repeating a dated source's snapshot as a fact about today | retrieval agent |
| Over-triggering | A caveat that was right once, now attached to every answer | retrieval agent |
| A guardrail or gate | A write reaching the store without the approval it required | human-in-the-loop agent |
| Prompt contracts | Instructions the prompt states in bold that nothing verifies | any agent |
| Silent bad data | A job that succeeds cleanly while writing the wrong thing | any agent that imports |

The right set for your agent is whatever step 2 left you, and it will not look like this one. A support agent groups around escalation and scope; a coding agent around destructive edits and test-passing-by-deletion. **The axis is the defect, whatever the domain.**

Keep the suite small. Five to ten cases is a normal, healthy first suite — start at the low end, since every case is one you pay for on every run. The anti-pattern is believing you need a big one before you start.

### Step 4 — Pair every case that pushes with one that bounds

A case asserting "flag old sources as dated" invites a prompt fix that over-rotates into caveating *everything* — every answer hedged, the agent measurably worse, and the suite still green.

So each case that pushes a behavior gets a partner that bounds it. Here, that partner asserts a **recent** source is answered with *no* hedge. Where one case asserts a total is computed by aggregating, its partner asserts a plain listing still uses the listing tool.

**Any rule that makes an agent do something needs a case proving it does not do it everywhere.** An agent that qualifies every answer is worse than one that occasionally misses — and without the bounding case, that regression looks like total success.

### Step 5 — Choose graders

**First ask whether you can assert on what the agent *did*** — a tool it called, a gate that fired, what the store holds afterwards. Those are structural facts with one spelling, and they often turn a judge-shaped target into a deterministic one: "asked before acting" needs a rubric, but *the gate fired and the store is unchanged* is two exact checks, and a stronger claim than any rubric would make.

For what is genuinely left, one question decides most of it:

> **Is the assertion target atomic?**

A number, a tool name, a record count, a URL, an identifier has **one spelling** → a deterministic check is exact. A claim — "flagged the source as dated", "answered without hedging" — has combinatorially many correct spellings → it needs a judge.

Reach for a judge when the target genuinely has many correct spellings, **and not before**. Every judge is a second model call, a second thing that can be wrong, and a second thing to debug when a case goes red for no reason.

Having decided you need one, **which judge is a second decision** — judge calls are usually the dominant cost of a run, and a judge too small for the question produces false reds that look exactly like agent regressions.

Grader shapes, vacuous passes, rubric design, choosing and tiering the judge, and when to stop automating a case are in [references/grading.md](references/grading.md).

### Step 6 — Decide repeats

Non-determinism means one green run is weak evidence. A case can run *n* times and require *k* of those to pass. The two are set by different things, and conflating them is the usual mistake.

**`k` follows grader stability.** A deterministic grader returns the same verdict on the same capture, so any failure is real — set `k = n`. A judge is itself non-deterministic and has a small irreducible flip rate, so a lone misfire should not fail the case — set `k = n - 1`. A case mixing both still catches a real defect: a genuine regression fails its deterministic grader on every run.

**`n` follows what a wrong answer costs.** This is a budget decision, not a technical one, and it is where two agents legitimately diverge. An agent answering questions about published articles can afford to be wrong occasionally; an agent that moves money, sends mail, or writes to a system of record cannot. Start `n` small and raise it where the consequence justifies the spend — not everywhere.

**Some cases get no tolerance at all.** A guardrail, an approval gate, anything whose failure is silent or unrecoverable: every run must pass. Two out of three is not a pass there — it is a bug that happened to be outvoted.

| Policy | Shape | When |
| --- | --- | --- |
| single | n=1, k=1 | Deterministic assertions on stable behavior; also the whole suite while iterating |
| majority | n=3, k=2 | Judge-graded cases, and behavior known to vary run to run |
| strict | n=3, k=3 | Deterministic graders you want repeated, guardrails, and outcomes that are silent or unrecoverable |

**`n` is also a per-run mode, not only a per-case constant.** While iterating on a case you *expect* to be red, confirming it red three times costs three times as much for no extra information. Run the suite at `n=1` during the inner loop, then at full `n` before trusting the result. If the harness supports it, let cases derive `n` from a run-level policy rather than hardcoding it — a baked-in count silently defeats the fast mode.

> **Green under a reduced-`n` run is not a verdict.** One run cannot distinguish a real pass from a lucky one. Re-run at full `n` before gating on it, and record which mode produced a report — an iteration run that is later mistaken for a gate run is a hard mistake to catch.

**Repeats are not noise reduction.** The instinct is to run a flaky case a few times and take the majority so noise stops deciding the result. That is backwards — **the flapping *is* the result.** Run once and you learn "broken" or "fine" depending on which run you caught. Run several times and you learn the *rate*, which is what belongs in the bug report: "sometimes reports an empty result as zero" and "always does" are different bugs with different priorities.

Repeats multiply the bill, so spend them where instability is the point. A suite that **gates merges** wants them, since an unrepeated green cannot be told apart from a lucky one. A suite that exists to be read does not.

### Step 7 — Run it red, and read the run before trusting it

Writing the cases is not the end of the job. Most of a first suite's value shows up here.

**Before the run:**

- **Write every case before fixing any of them** — not case, fix, case, fix. A case written after a fix is authored by someone who already believes that fix worked. And a fix applied mid-suite changes the system the remaining cases were measured against, so read the complete set of failures before acting on any one of them.
- **Expect red, and check each red is red for the reason you claimed.** A case failing for an unrelated reason is not evidence of the defect it was written for. The bar is not that every case fails — it is that every assertion has been **shown capable of failing**, which a case guarding an already-fixed bug satisfies by having been observed before the fix.

**Reading the run:**

- **Interrogate every green, starting with the ones that passed before you fixed anything.** Those are usually a weak test rather than a healthy agent — unless the case is a regression guard for a defect already fixed, which is *supposed* to pass. Ask what the cheapest way to satisfy this case without doing the right thing would be; that is the escape hatch to close.
- **A red case has four suspects: the agent, the grader, the case, and the judge.** Rule out the judge first — it is the cheapest to check, and a nuanced verdict from a small model flips in a way that reads exactly like an agent regression.
- **Check the premise before building any fix.** It is entirely normal for a first run to report that the bug you were about to fix does not exist, or that the real defect is the inverse of the one you assumed.
- **If a behavior ignores the prompt, suspect the model's priors.** Instructions and priors are different problems with different fixes; running across model variants makes the difference visible in minutes.

**Report the run; do not act unilaterally on it.** Say what each red means — which of the four suspects it points at, and what would have to change — then let the builder decide what gets fixed and in what order. As in step 2, prompt and tool changes sit outside a request to write evals, and a fix applied mid-suite changes the baseline every other case was written against.

The detail — including how to tell a legitimate grader fix from moving the goalposts — is in [references/first-run.md](references/first-run.md).

## Anti-patterns

**These make a suite worse than having none**, because each one produces confidence without information:

- **A vacuous pass — a negative grader standing alone.** "Did not call tool X" passes when the agent errors, refuses, or answers from thin air — and passes hardest when it does *nothing at all*. Every negative assertion needs a positive one proving the work actually happened.
- **Counting an unearned green as evidence.** The cases deserving most suspicion are the ones passing before anything was fixed — usually an escape hatch in the assertion rather than a healthy agent. Establish *why* one passed before it counts.
- **A hand-typed expected value.** Derive it from the corpus the case actually runs against — computed from the seed for a fixture, read at run time against live data. A figure typed in by hand goes red the day the data moves, for a reason that has nothing to do with the agent; against a live corpus it will not survive the week.
- **Acting on a red run unilaterally.** Editing the prompt, the tool, or the payload mid-suite moves the **baseline** every other case was written against — and those changes sit outside a request to write evals. Report what each red points at; let the builder decide.

**These make a suite cost more than it should**, or measure the wrong thing:

- **A case per feature.** Expensive, slow, and mostly re-testing what unit and integration tests already cover — or, where those do not exist, what they should cover instead. Group by **defect class**.
- **Over-fitting to one trajectory.** Naming a single tool path fails a run that reached the same correct outcome another legitimate way — the **trajectory** is evidence, not the contract. Assert the outcome, or accept any of several routes.
- **Reaching for LLM-as-judge before checking whether the behavior left a trace.** A gate that fired, a tool that ran, what the store holds afterwards — structural facts are cheaper, exact, and a stronger claim than any rubric.
- **A judge where an atomic check would do.** If the target has one spelling, a deterministic grader settles it — a judge is slower, costlier, non-deterministic, and no more correct.
- **A golden answer where an expected value would do.** An expected *value* — a figure, an identifier, a count — is exactly right, and most frameworks give you a field for it. A **golden answer**, matched as prose, fails on harmless rewording and passes an answer that is fluent and wrong. The question is not whether to use the field but what you put in it.
- **Loosening a grader because it is failing** rather than because it tests the wrong thing. Write down which it was, at the time.

**Worth checking in a harness you did not write** — report these rather than fixing them unasked:

- **The runner builds its own message shape.** If it wraps user turns differently from the application, the suite tests a system nobody ships.
- **The capture is thinner than the assertions need.** A case cannot assert what the run never recorded — no **trajectory** captured, no trajectory assertion. That is a harness change, not a case change.

## References

- [references/elicitation.md](references/elicitation.md) — the interview: what to ask to surface observed failures from traces, the builder, or a domain expert; how to triage each answer; and what to do when there is nothing to go on.
- [references/grading.md](references/grading.md) — picking graders: the atomicity rule, grader shapes and their failure modes, vacuous passes, rubric design, the human tier, and the rule for when loosening a grader is legitimate.
- [references/first-run.md](references/first-run.md) — reading the first red run: interrogating greens, checking premises before building fixes, and telling a broken grader from a broken agent.
- [references/vocabulary.md](references/vocabulary.md) — the five concepts every eval framework has and the names they go by; how to identify them in a harness you have not seen; how to write into an existing suite; and why what a case can assert is bounded by what the harness captured.
