# Grading: Choosing What Decides Pass or Fail

A grader takes what the run produced and returns a verdict. That is the whole interface — and everything difficult about it is in choosing *which* grader, and in noticing when one is passing for a reason you did not intend.

This file names grader **shapes** and the rules for selecting between them. It deliberately contains no implementations: the shapes translate to any language, and every framework spells them differently (see [vocabulary.md](vocabulary.md)).

## Table of Contents

1. [Assert what the agent did, over what it said](#assert-what-the-agent-did-over-what-it-said)
2. [The atomicity rule](#the-atomicity-rule)
3. [Grader shapes](#grader-shapes)
4. [Worked graders](#worked-graders)
5. [Vacuous passes](#vacuous-passes)
6. [Grade the run only if the run happened](#grade-the-run-only-if-the-run-happened)
7. [Writing a judge rubric](#writing-a-judge-rubric)
8. [Choosing the judge](#choosing-the-judge)
9. [The last resort: a human grader](#the-last-resort-a-human-grader)
10. [The loosening rule](#the-loosening-rule)
11. [Repeats: what the grader kind decides](#repeats-what-the-grader-kind-decides)
12. [Failure messages: diagnosis, not mismatch](#failure-messages-diagnosis-not-mismatch)

---

## Assert what the agent did, over what it said

Two kinds of assertion are available, and they are not equally strong.

**What the agent said** — the final text. Easy to reach for, and often the weakest thing you can grade. Prose has many correct spellings, so an assertion over it is either loose enough to pass bad answers or tight enough to fail good ones.

**What the agent did** — which tools it called and with what arguments, what is in the store afterwards, whether a guardrail fired, what it actually retrieved. These are structural facts with one spelling each. They are cheap, exact, and they survive rewording.

> When the failure you fear is silent, stop asserting on what the agent said and go look at what it did. "Did it ask about the ambiguous date?" is a claim with many spellings. "Did the rows land in July or in May?" is a row in a database.

Prefer the second kind wherever the behavior leaves a trace. Fall back to the first when the behavior *is* the answer — a caveat, a refusal, a recommendation.

---

## The atomicity rule

One question decides most grader choices:

> **Does the thing you are asserting have exactly one correct spelling?**

| Target | Grader | Why |
| --- | --- | --- |
| `2752.25` | Deterministic | A number has one spelling |
| A tool name | Deterministic | An identifier, exactly matched |
| A record count after the run | Deterministic | An integer |
| A URL, SKU, or ticket id | Deterministic | No other way to write it |
| A literal metadata prefix | Deterministic | The exact string, or it is absent |
| "Asked before acting" | Judge | A claim — many phrasings |
| "Flagged the source as dated" | Judge | A claim — many phrasings |
| "Answered without hedging" | Judge | A judgement about tone and content |
| "Stayed in scope" | Judge | A boundary, not a string |
| "Replied in the user's language" | Judge | Judging prose, not matching a locale code |

Anything phrase- or sentence-shaped is **not atomic**, even when it looks like a fixed phrase. A claim has combinatorially many correct spellings — hyphenation, synonyms, word order, active or passive, split across two sentences — so a string check is asserting *one arbitrary member of that set*. It passes by luck and fails on harmless rewording.

### The tell that you got it wrong

**A string check carrying a list of variants.** Matching `"needs your approval"`, `"requires approval"`, `"waiting for approval"` is that list — and it still fails the day the agent writes "I have sent this for you to approve". Each variant you add fixes today and leaves the next phrasing to fail instead. That is a treadmill, not a contract.

**If you find yourself adding a spelling to make a case pass, convert the grader.**

Two things that are *not* this mistake:

- **Genuinely distinct atomic strings** — a year, two alternative domains, a markdown image marker. These are separate exact targets, not variants of one claim.
- **A cheap guard sitting beside a grader that owns the contract.** A keyword check next to a judge that carries the real assertion adds a fast signal for free. The test: *would the case still fail for the right reason if the keyword check passed vacuously?* If yes, it is a guard. If no, it **is** the contract and belongs in a judge.

**A number is not automatically atomic — a number *plus a unit word* is already a phrasing.** `2752.25` has one spelling; `"13 months"` does not ("13-month-old", "thirteen months", "just over a year"). Asserting a figure that only ever appears bare is exact; asserting a measurement the agent will phrase in prose is the treadmill wearing a number.

**Watch for the mixed list**, which is how this hides: some entries genuinely atomic, some phrasings, in one check. The exact-looking entries lend credibility to the phrasings beside them, and the phrasings are what actually carry the assertion. Split it — assert the atomic parts deterministically, move the claim to a judge.

---

## Grader shapes

Named, not implemented. Every one of these exists in some form in every framework.

**Write graders as reusable, parameterized factories — not assertions inlined in a case.** `toolCalled("run_sql")` and `toolCalled("query_transactions")` are one grader used twice, and a suite converges on a small catalog that every case draws from. Inlining assertions instead gives you near-duplicate logic per case, no shared failure-message quality, and nothing to swap when the eval library changes. Cases should name graders; only the catalog should know how they work.

| Shape | Asserts | Watch out for |
| --- | --- | --- |
| **tool-called** | A named tool appears in the trajectory | Asserts a *route*, and only an **intention** — a requested call that never returned still counts. See [Grade the run only if the run happened](#grade-the-run-only-if-the-run-happened). |
| **tool-called-with** | A tool ran *and* its arguments match | Only deterministic if the argument values are atomic — see below. |
| **tool-not-called** | A named tool is absent | Purely negative — passes when the agent does nothing. Never use alone. |
| **any-of-tools** | At least one of several tools ran | The route-agnostic form. Prefer it when you care about the outcome, not the path. |
| **states-a-value** | The answer contains a specific atomic value | Normalize formatting (thousands separators, currency symbols) before matching. |
| **states-any-of** | The answer names one of a set of valid values | Derive the set from the corpus, never hardcode it. |
| **state-after-run** | What the store, file, or queue holds once the run finishes | The strongest assertion available for anything that writes. |
| **gate-fired** | A guardrail or approval interrupt actually triggered | The only proof a gate exists; a paused call and an executed one look identical in a trajectory. |
| **no-invented-content** | Every cited artifact appeared in what the agent actually retrieved | Passes vacuously when the answer cites nothing. Pair it. |
| **concept-present / concept-absent** | A claim appears (or does not) in the answer, judged for meaning rather than wording | The judge-backed replacement for a keyword check whose target is a claim. A cheap tier usually suffices. |
| **judge** | A rubric-based verdict from another model | Slow, costs money, non-deterministic. See below. |

**Arguments are a separate question from the tool name.** A tool name is an identifier — one spelling, always safe to assert. Its arguments are atomic only if the *values* are: a category equal to `"Dining"`, a limit of `50`, a locale of `fr-FR`. Free-form argument text is not — asserting a generated SQL string or a search phrase is the variant-list treadmill in a new place, since many spellings are correct. Assert the arguments that are enum-like or numeric, and let the rest go, or assert the *effect* of the call instead.

Three rules that apply across all of them:

- **Derive expected values from the corpus, never hardcode them.** Where you run against a fixture, compute the expectation from the seed; where you run against live data, read it at run time — or assert a property that holds regardless (a non-empty result, a value within a range, an ordering) rather than a figure. A hand-typed constant goes red the day the data moves, for a reason that has nothing to do with the agent.
- **Assert the outcome, not the route** — unless the route *is* the defect. A case that names one tool path will fail a run that reached the same correct place another legitimate way, and that failure teaches you nothing.

---

## Worked graders

Shipped code from the agent on the Agentailor blog — TypeScript, but read it for the **shape**, not the syntax. It is here so the concepts above have something concrete to translate: a deterministic grader, the judge factory the judge graders share, and what a grader declaration reduces to once that factory exists.

### A deterministic grader

```ts
export function toolCalled(...tools: string[]): Grader {
  const id = `deterministic.toolCalled(${tools.join(",")})`;
  return {
    id,
    async grade({ capture }: GradeInput): Promise<GradeResult> {
      const called = new Set(capture.trajectory.map((t) => t.name));
      const missing = tools.filter((t) => !called.has(t));
      return ok(
        id,
        missing.length === 0,
        missing.length ? `missing tool calls: ${missing.join(", ")}` : undefined,
        { called: [...called] }
      );
    },
  };
}
```

Four things to carry over:

- **The whole interface is capture in, verdict out.** Here no framework types cross that line, which is what keeps the eval library swappable — worth doing in a home-made harness, and unnecessary in a project that has committed to a framework's own evaluators.
- **The id encodes the arguments** (`toolCalled(run_sql)`), so a report says which assertion failed without opening the case.
- **It reads `t.name` only** — names, never arguments. That is the atomicity rule applied: the name is an identifier, the arguments may not be.
- **It reads the *calls*, not the results** — so a tool that was requested and then failed still satisfies it. That is the gap described in [Grade the run only if the run happened](#grade-the-run-only-if-the-run-happened), and it is worth closing in a suite where tools can fail.
- **The failure message names what is missing**, and the metadata carries what *was* called — so a red run is a diagnosis, not a mismatch.

### A judge grader

First the tier table the graders select from, so the judge is not a black box.

> **The model ids below are one project's snapshot and will be out of date by the time you read this.** Copy the two-tier *structure*, not the ids — look up the current models for your provider and pick a capable one for `strong` and a small fast one for `default`.

```ts
// Two tiers x two providers. A grader names a tier; the run resolves the model.
const JUDGE_MODELS = {
  strong:  { google: "gemini-3-flash-preview",  anthropic: "claude-sonnet-4-6" },
  default: { google: "gemini-3.5-flash-lite", anthropic: "claude-haiku-4-5-20251001" },
};
// "default" here names the CHEAP tier, not the fallback — confusing, and worth naming
// `cheap` in a new suite. `strong` is what graders actually inherit.
type JudgeTier = keyof typeof JUDGE_MODELS;   // "strong" | "default"

const DEFAULT_JUDGE_TIER = "strong";  // graders inherit this unless they opt down
const JUDGE_TEMPERATURE = 0;          // minimize verdict flips run to run

// Memoized PER TIER, not one shared instance. A single shared judge is what blocks
// tiering by construction — with a map, moving one grader to the cheap tier is a
// one-line change rather than a refactor.
const judges = new Map<string, BaseChatModel>();

function makeJudgeModel(tier: JudgeTier): BaseChatModel {
  // An env var can pin ONE model for a whole run, overriding every tier — that is the
  // "run the suite against this specific judge" lever, and a report must record it.
  const id = process.env.EVAL_JUDGE_MODEL ?? JUDGE_MODELS[tier][provider()];
  return cached(id, JUDGE_TEMPERATURE);
}
```

Three decisions worth copying regardless of your models: **default to the strong tier and opt down deliberately** (the reverse silently degrades verdicts), **temperature 0**, and **record which judge produced a report** — otherwise two reports can differ only in who graded them, and the file cannot tell you which. Which tier a given grader deserves is [its own decision](#choosing-the-judge).

Then the factory every judge grader is built from:

```ts
function makeJudgeGrader(opts: {
  id: string;
  prompt: string;      // the rubric
  passOn: boolean;     // which verdict counts as a pass
  tier?: JudgeTier;    // omit to inherit DEFAULT_JUDGE_TIER
}): Grader {
  const evaluator = createLLMAsJudge({
    prompt: opts.prompt,
    judge: makeJudgeModel(opts.tier ?? DEFAULT_JUDGE_TIER),
    useReasoning: true,          // capture WHY, not just the verdict
  });
  return {
    id: opts.id,
    async grade({ capture }: GradeInput): Promise<GradeResult> {
      const userRequest = capture.perTurn.at(-1)?.userContent ?? "";
      const result = await evaluator({ inputs: userRequest, outputs: capture.finalText });
      const verdict = typeof result.score === "boolean" ? result.score : result.score >= 0.5;
      return {
        graderId: opts.id,
        passed: verdict === opts.passOn,
        reasoning: result.comment,   // read this before trusting a red
      };
    },
  };
}
```

- **`passOn` is how one factory serves both directions.** A "did it disclose its model?" judge answers *true* on a leak, so the grader passes on `false`. Writing a second inverted rubric instead is how rubrics drift apart.
- **`tier` sits on the grader**, not on the suite or the run — [Choosing the judge](#choosing-the-judge) is why that placement matters and how to pick.
- **`useReasoning` is not optional in practice.** The judge's explanation is what tells you it applied the rule rather than pattern-matching its own example.
- **A numeric score is thresholded to a boolean** — note where that happens, because it is the invisible decision in most frameworks.
- **It judges the last user turn by default.** Anything grading synthesis *across* turns has to opt into seeing all of them, or the judge grades a question it was never shown the context for.

A grader then declares only what makes it different — its rubric, its direction, and its tier:

```ts
// Opts down to the cheap tier.
export const languageMatches = () =>
  makeJudgeGrader({ id: "languageMatches", prompt: LANGUAGE_MATCH_PROMPT,
                    passOn: true, tier: "default" });

// Inherits the default (`strong`).
export const flagsStaleness = () =>
  makeJudgeGrader({ id: "flagsStaleness", prompt: FLAGS_STALENESS_PROMPT, passOn: true });

// passOn: false — the rubric asks "did it leak the model?", so TRUE is the defect.
export const noModelDisclosure = () =>
  makeJudgeGrader({ id: "noModelDisclosure", prompt: MODEL_DISCLOSURE_PROMPT,
                    passOn: false, tier: "default" });
```

That is the payoff of the factory: adding a judge grader is a rubric plus two flags, and re-tiering one is a single word.

---

## Vacuous passes

The standalone negative grader is covered in the main workflow: *every negative assertion needs a positive one beside it, proving the work actually happened.*

The **second form is harder to see, and it is the one that hides**: a grader conditioned on something that never occurred. A grader inspecting the result of tool X reports green when tool X never ran — it had nothing to check, so it found nothing wrong.

Real shapes that do this:

- A grader checking every image URL in an answer came from a real tool result — **passes when the answer contains no images at all.** A case requiring images must pair it with a check that an image is present.
- A grader reading the output of one specific tool, in a case where a different (also legitimate) tool ran instead.
- A "did not leak X" check against a response that is a refusal, an error, or empty.

This hides most effectively inside a case that went red for an unrelated reason: one green among the failures attracts no attention, and the grader that asserted nothing is never noticed.

The test to apply to every case:

> **Would this case still fail for the right reason if one of its graders passed vacuously?**

If the answer is no, that grader is carrying the contract alone and needs a partner.

---

## Grade the run only if the run happened

Before any grader runs, the harness has to answer a prior question: **did this run complete validly?** A grader is a claim about a finished run, and applied to a broken one it produces a verdict that means nothing.

Two versions of this, and they need different guards.

### The run errored

A crash mid-turn — a recursion limit, a network failure, a provider timeout — usually gets recorded on the capture and the suite carries on rather than aborting, which is right. What is easy to miss is that **graders may then run against the partial capture anyway**: the tools called before the crash are still in the trajectory, so a tool assertion passes, while the final text is empty or truncated.

The guard: **if the run errored, the case fails — do not grade it.** Report the error as the finding. A green from a crashed run is the worst possible output, because it is indistinguishable from a real pass in the report.

### A tool was called but never returned

Subtler, and the one that quietly weakens tool assertions. In most agent frameworks the **call** and the **result** are separate records: the model emits a tool-call request, and the tool replies with a separate message. A naive trajectory reads only the requests.

So a tool that was requested and then errored, timed out, was interrupted, or was cut off by a turn limit **still appears in the trajectory** — and `toolCalled` passes on it, even though nothing came back and the answer was written without it.

That is a false green on exactly the assertion you wrote the case for. Two ways to close it:

- **Assert the result, not just the request.** Have the tool-called grader require a *matching result* for the call — the tool ran, returned, and its output reached the agent. Where the harness records results separately, this is a join, not a new capture field.
- **Pair the call assertion with one over the answer.** If the tool's output has to show up in what the agent said, assert that too — then a call that returned nothing cannot pass.

The general form is the same rule as [vacuous passes](#vacuous-passes): **an assertion about an intention is weaker than an assertion about an effect.** A tool call is an intention. Its result is the effect.

> When auditing an existing suite, this is worth checking explicitly, because it is invisible until a tool starts failing: does the tool-called grader read the calls, or the calls *and* their results?

---

## Writing a judge rubric

When the target genuinely has many correct spellings, a judge is the right tool. Two rules make one work.

**Spend most of the rubric on how a response could be wrong — in both directions.** A judge told only what good looks like will pass anything confident.

A shipped rubric, for "did the agent signal that its source is dated?":

```text
You are evaluating whether an AI assistant correctly SIGNALLED THE AGE of a dated source
it answered from.

Context: the assistant answers from a blog whose posts span roughly two years. Older posts
still carry real value — the concepts and reasoning hold — but their version-specific detail
(API surface, CLI flags, model IDs, "the newest X") reflects the ecosystem as it was when
written. The wanted behavior is to USE the old article AND briefly note that it is dated.

A good response does this in passing — one short clause or sentence, woven into the answer.
Return TRUE if the response both (a) actually answers from the material, and (b) somewhere
signals the source's age or that specifics may have moved on (e.g. "that post is from
mid-2025, so check the current docs for the API").

Return FALSE if it does either of these:
- presents dated specifics as the current state with no age signal at all; or
- refuses to use the article, or hedges so heavily the answer is useless.

Do not require an exact date or a specific phrasing — any clear age signal counts.

<request>{inputs}</request>
<response>{outputs}</response>
```

Five things that rubric does, and that yours should:

- **It gives the judge context it cannot infer** — what the corpus is, and why old material is still valuable. Without that, a judge invents its own standard.
- **It names the wanted behavior positively** before either failure mode.
- **Its FALSE branch has two arms.** Under-doing it (no age signal) *and* over-doing it (refusing, or hedging the answer into uselessness). A one-armed rubric is how you train an agent into the opposite failure while the suite stays green — the same trap the bounding case exists to catch.
- **It gives an example of a passing signal** without making that phrasing mandatory.
- **It explicitly disclaims exact matching** in the last line. If the rubric could be satisfied by one wording, you did not need a judge.

**Keep the rubric about the target, not the mechanism.** Naming a specific identifier as an example of a defect invites the judge to match that string rather than apply the rule — see the failure mode below.

### The judge failure mode to watch for

**A judge can match strings against its own rubric instead of judging.** If the rubric names a specific identifier as an example of a defect, a response that mentions that identifier innocently — in a correct, well-scoped answer — can get failed for pattern-matching the example rather than committing the defect.

The defence is procedural: **read the judge's reasoning, not just its verdict.** A judge that failed a good answer will usually say why, and the reasoning will show it locked onto an example rather than applying the rule. That is a grader defect, not an agent defect.

---

## Choosing the judge

Picking a judge is a second decision after deciding you need one, and it is usually made by habit. Two things make it worth deliberating: **judge calls are typically the dominant cost of a run**, and the judge is a source of false reds that look exactly like agent regressions.

### Tier the judge per grader, not per suite

Graders are not all asking the same kind of question:

| Kind | Example targets | Judge |
| --- | --- | --- |
| **Cheap / binary** | "Is there an age hedge in this text?" "What language is this?" "Did it redirect out of scope?" | A small, fast model is enough |
| **Nuanced / multi-criterion** | Claim-by-claim grounding against retrieved context; a multi-branch rule distinguishing an attributed claim from a bare recommendation; whether an answer leads with the point | The strong model |

Paying strong-model rates for "what language is this?" is waste. The more expensive mistake is the inverse: a small model asked for a nuanced binary verdict **is inconsistent on exactly the calls you needed judgement for**. So declare the tier on the **grader**, since the grader is the unit whose difficulty varies — not on the suite, and not on the layer.

### A weak judge flips, and the flip looks like a regression

This is the failure mode to internalize, because it costs debugging time and misdirects fixes.

A case can fail on a cheap judge and pass on a strong one with **the agent, the case, and the grader all unchanged** — one documented instance landed 1/3 with a small judge and 3/3 with a stronger one, same everything else. Read as an agent problem, that is an afternoon spent rewording a prompt that was never at fault.

So when a nuanced case wobbles, **the judge model is a lever to try before the grader.** It is the fourth entry on the diagnosis list in [first-run.md](first-run.md#when-a-case-is-red-the-grader-is-a-suspect-too): a red case may mean the agent is wrong, the grader is wrong, the case is wrong, or **the judge was too small for the question**. Rule the last out first — it is the cheapest to check.

### Match the judge to what you are testing

| You are changing | Judge to run | Why |
| --- | --- | --- |
| The harness — graders, runner, config | Cheap | You are testing plumbing; a nuanced verdict is not the point |
| The agent — its prompt or its tools | Strong | Behavior changes are what the spend is *for* |
| Iterating, expecting red | Cheap, and at reduced `n` | Confirming a red case precisely buys nothing |

**A cheap run is not a verdict**, for the same reason a reduced-`n` run is not: green under a weaker judge means "not obviously broken", not "ready to gate". Re-run on the judge you trust before acting on it, and record which judge produced a report — a cheap run mistaken later for a gate run is hard to catch.

### One caution on independence

Grading a model's output with the same model — or the same family — invites correlated blind spots: a judge is most likely to accept the phrasings and reasoning styles it would itself produce. This is a caution rather than a rule, and it competes with wanting the most capable judge available. Where a verdict is load-bearing and contested, a judge from a different family is worth the experiment.

---

## The last resort: a human grader

Escalation runs **deterministic → judge → stronger judge → human**, and the stronger-judge rung is where most cases that feel ungradeable actually resolve. **The human tier is a last resort, not a next step.**

Before concluding a case cannot be automated, exhaust the cheaper explanations in this order:

1. **Try a stronger judge.** A small model asked for a nuanced verdict flips on exactly the calls you needed judgement for — see [Choosing the judge](#choosing-the-judge). This is the most common cause of a case that looks unautomatable, and the cheapest to rule out.
2. **Check the rubric is not inviting a string match.** If it names a specific identifier as an example of a defect, a judge may match that name rather than apply the rule.
3. **Check you are asserting the right thing.** A claim that resists grading is sometimes a behavioral outcome in disguise — if it left a trace, assert the trace instead.
4. **Then, and only then, consider the human tier.**

Reach the fourth rung when the criterion is one **no** judge can hold because **nobody has drawn the line** — a boundary the field itself disagrees about and moves over time. A judge asked to police such a boundary produces confident, inconsistent verdicts, and no amount of rubric rewording fixes it, because the rubric is trying to encode a distinction that does not exist yet.

The distinguishing test: **a weak judge is inconsistent, but a boundary that does not exist makes every judge inconsistent — and the strong one will say so in its reasoning.**

> **If even the judge struggles, the agent is allowed.**

### A worked case

A rule that an agent recommending an LLM should answer at the **family** level ("the Claude Sonnet/Opus family, OpenAI's GPT or o-series") rather than naming a specific version as the newest. The case failed on a single parenthetical, after an answer that was family-level throughout:

> "Fast, cheap models (such as Claude Haiku, GPT-4o-mini, or Gemini Flash)"

The judge failed it. Its reasoning is what settled the question — it spent several sentences unable to decide the thing it was being asked to decide:

> "Claude Haiku" — is this a pinned version? It's more of a model tier name within the Claude family. [...] "Claude Haiku" is somewhat between a family and a specific version — it's a specific model tier but without a version number.

**That is the tell.** Not that the verdict was wrong, but that the boundary it needed does not exist: vendors draw the family/version line differently and move it over time. No rubric encodes a distinction the industry has not made. And a second failure sat beside it — the rubric named `GPT-4o-mini` as an example of a defect, so the judge matched the string rather than applying the rule.

Note what this does **not** establish: that no judge could grade it. It was one judge, so the case is parked pending a better one, not retired.

**Record why it is skipped, next to the skip.** A skipped case with no rationale gets deleted as dead weight, or re-enabled by someone who then hardens the prompt to satisfy a grader that was never right. Three facts are enough:

```ts
skip: "family/version boundary is not gradeable — the judge could not place it either. " +
      "Covered by -incidental-recommendation and -direct-frontier-question. Retry on a stronger judge.",
```

**why it cannot be graded**, **what still covers the behavior**, and **what to try first on revisit.** If the field only takes a boolean, one line beside it does the same job — the point is that the reason travels with the case, not that it is long. Reserve the fuller write-up for the report or the commit message.

### Two guards

- **Skipping an ungradeable case is not dropping the behavior.** Keep other cases covering the same defect through assertions that *can* be automated — note that two remained above, both on the same rule, gating the part that is unambiguous.
- **A human grader is a legitimate tier, not a failure.** For a small suite, humans grade everything — that is where most suites start.
- **Overruling your own grader is a last resort, and casually done it is indistinguishable from cheating.** Try the ladder above first — a stronger judge resolves more of these than a human verdict does. What made this one legitimate was not disagreeing with the verdict; it was that the answer did the thing the rule exists to produce, and the judge could not say where the line was. Apply [the loosening rule](#the-loosening-rule) and write down which kind it was.

---

## The loosening rule

Sooner or later a case goes red and you will believe the grader is wrong. Sometimes it is. The distinction is the whole ballgame:

> **Loosening a grader because it tests the wrong thing is correct. Loosening it because it is failing is how you end up with a suite that only ever agrees with you.**

The two look identical in a diff a month later. So:

**Write down which one it was, at the time, next to the change.** A scoping fix ("the defect is the unattributed claim, not the noun — the grader was failing correctly-attributed answers") is a different act from "this kept going red so I relaxed it", and only the note at the time can tell them apart.

The signal that a loosening is legitimate: you can state what the rule exists to produce, and show the failing answer produced it. If your only argument is that the case is red, that is not an argument.

---

## Repeats: what the grader kind decides

The main workflow covers choosing `n` and `k`. One part of that decision belongs here, because it is a property of the **grader**, not of the case: `k` follows grader stability.

- **Deterministic graders are stable** — same capture, same verdict. Any failure is real, so `k = n`. Repeating them buys evidence about the *agent's* variance, never the grader's.
- **Judges are not stable.** A judge has a small irreducible flip rate even at temperature 0, so a lone misfire should not fail the case: `k = n - 1`.

That resolves the case that otherwise looks contradictory: **a judge-graded guardrail.** Its consequence argues for unanimity; its grader argues for tolerance. The grader wins, because a strict policy over an unstable grader fails on judge noise rather than on the defect — and a guardrail that goes red for no reason is one that gets ignored. Get the strictness back where it belongs instead: assert the guardrail deterministically wherever it leaves a trace (the gate fired, nothing was written), and let the judge grade only the part that genuinely needs prose judgement.

A mixed case still catches a real defect at any `k`: a genuine regression fails its deterministic grader on every run, so it cannot be outvoted.

**Report both numbers rather than a bare verdict.** `PASS (3/3)` and `PASS (1/1)` are different claims, and the run you are reading should say which one it is — as should the report on disk, alongside which judge and which mode produced it.

---

## Failure messages: diagnosis, not mismatch

A failing grader should say what went wrong in terms of the **defect**, not the comparison.

- "Expected July, got May" is a mismatch you still have to think about.
- "Rows landed on month 5 — the date format was read backwards" is the bug report already written.

Where a grader can distinguish a *characteristic* wrong answer from an arbitrary one, have it say so. Surface what the agent actually produced, too: for a wrong total, the number it stated is the entire finding, and a message that omits it sends you back to re-run the case to learn it.

This matters more than it sounds, because eval runs are slow and cost money. The whole value of a red run is what you learn from reading it.
