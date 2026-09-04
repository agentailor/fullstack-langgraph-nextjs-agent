# Reading the First Red Run

Writing the cases is not the end of the job. The first honest run is where most of a new suite's value shows up — and where the most common mistakes get made, because a red report invites you to start fixing immediately.

**Expect red** on the cases written for defects you have not fixed yet. The bar is not that every case fails — it is that every assertion has been **shown capable of failing**. See [Cases that legitimately pass on day one](#cases-that-legitimately-pass-on-day-one).

## Table of Contents

1. [Write them all before fixing any](#write-them-all-before-fixing-any)
2. [Interrogate the greens](#interrogate-the-greens)
3. [Cases that legitimately pass on day one](#cases-that-legitimately-pass-on-day-one)
4. [Check the premise before you build the fix](#check-the-premise-before-you-build-the-fix)
5. [When a case is red, the grader is a suspect too](#when-a-case-is-red-the-grader-is-a-suspect-too)
6. [When the prompt will not move the behavior](#when-the-prompt-will-not-move-the-behavior)
7. [Attribution: split suites so red points somewhere](#attribution-split-suites-so-red-points-somewhere)

---

## Write them all before fixing any

Write every case, run the whole suite, and read the **complete** set of failures before changing anything.

Not case, fix, case, fix. Two distinct reasons, and both survive without the other:

**Later cases inherit earlier assumptions.** A case written after a fix is written by someone who already believes that fix worked — so the assumption gets baked into what the next case bothers to assert. Write them all first and every case is authored against the same, unfixed system.

**The failures have to be compared, not just read.** A single red tells you one thing is broken. The full set tells you whether two of them contradict each other, whether three share one cause, or whether one contradicts the diagnosis you started from. That comparison is the highest-value output of a first run and it does not exist one case at a time — acting on the first red destroys it, because the fix changes the system the remaining cases were measured against.

This is about having the whole picture before acting on any part of it, not about doing the reading in one go.

---

## Interrogate the greens

**Green is not the same as correct. A passing case is evidence only if you can name the mechanism that produced the pass.**

An agent running a suite and reporting "all green" has reported nothing until that question is answered for each case that matters.

### A worked example

**What we were testing.** Whether the agent knew the current date. It answers from a corpus of dated documents and has no clock, so the worry was that it would fall back on its training cutoff.

**What we expected.** A red run. The case asked how current the material on a particular topic was, and asserted the answer mentioned the right year.

**What happened.** It passed, 3/3, before anything was fixed — while the agent had no access to the date at all.

**Why, on inspection.** It had read a publication date off one document, then anchored its sense of "now" against a *different* document's title, which happened to contain a year. The reasoning was impressive and the case was worthless: it would keep passing on a corpus full of recent titles no matter how time-blind the agent was.

**The rewrite.** Ask for something the corpus cannot supply — an age in months, which is arithmetic against a real anchor rather than a string that can be copied:

```ts
turns: [{
  content: "Roughly how many months old is your material on the OpenAI Agents SDK for TypeScript?",
}],
graders: [
  // conceptPresent is an LLM judge: the target is a claim ("an age in this range"),
  // and "13 months" / "thirteen months" / "just over a year" are all correct spellings
  // of it. One judge call covers the whole claim.
  conceptPresent("states the material is roughly a year to fifteen months old"),
],
```

The case went red immediately, which is what a correct test does when the bug is present.

### What generalizes

The case tested a **proxy** for the behavior — *does the answer mention a year* — rather than the behavior itself, *does the agent know what "now" is*. Any proxy the corpus can satisfy on its own will pass without the agent doing the work.

That is the general shape of an inert case: **the assertion is satisfiable by a route that does not require the behavior.** The date incident is one instance; the same thing happens whenever an assertion can be met by copying something already present in the input.

### The diagnostic questions

For each green worth checking:

- **Why did this pass?** Name the mechanism, not the outcome.
- **Would it still pass if the defect were present?** If yes, the case is inert.
- **What is the cheapest way the agent could satisfy this without doing the right thing?** That is the route to close.

### Which greens to check

"Every green" does not scale past a small suite. Three are worth the time:

- **Cases green before you fixed anything** — unless they are [regression guards for an already-fixed defect](#cases-that-legitimately-pass-on-day-one), which are supposed to pass.
- **Cases whose assertion could plausibly be met another way** — anything asserting a value that also appears somewhere in the input.
- **Cases that have never been red**, in a suite that has run more than a few times.

### What to do with the answer

An inert case is a **finding, not a silent repair**. Report it: name the case, the route that satisfies it without the behavior, and what the assertion would have to become. Rewriting someone's case unasked changes what their suite claims to guarantee — the same boundary that applies to prompt and tool changes.

If a case's name describes what it happens to do rather than what it is meant to prove, say so too. A misleading name outlives everyone who remembers the intent.

## Cases that legitimately pass on day one

The previous section says to distrust a green. That needs one important exception, or you will delete good cases.

**A regression guard for a bug you already fixed is supposed to pass.** The failure was observed — in production, in a trace, or by hand — and the fix shipped before the suite existed. Writing the case afterwards encodes a known defect so it cannot come back. It is green on the first run, and it is one of the most valuable cases you can have.

That looks identical in a report to the worthless kind: both are green. The pass/fail result cannot tell them apart. **Provenance can:**

| The case came from | Passes day one | Verdict |
| --- | --- | --- |
| An observed failure, already fixed | yes | **Regression guard.** Keep it. |
| An observed failure, not yet fixed | no | The normal red-first case. |
| Imagination — never seen to fail | yes | **Suspect.** The assertion is unproven. |

So the question is not *did this case fail?* but **has this assertion been shown capable of failing?** A regression guard clears that bar, because the failure was demonstrated before the fix.

Two ways to keep the evidence:

- **Say so in the description** — that the case guards a fixed defect, and what the defect was. Without it, a later reader applying "interrogate every green" has no way to tell this case from an inert one.
- **Where the fix is cheap to toggle, confirm the case fails without it.** Revert the fix locally, watch the case go red, restore. That converts "this passed on day one" into "this assertion is proven", and it takes a minute. Not always practical — but when it is, it is the strongest evidence a case can carry.

The distinction matters most for the **prompt-contract** defect class, where cases are routinely written *after* the instruction they verify was added. Those are guards by construction, and a rule that treats every day-one green as suspect would retire all of them.

---

## Check the premise before you build the fix

**The premises that feel too obvious to verify are exactly the ones worth verifying.**

A red run is a falsification instrument, and it works on your beliefs about the system as much as on the system. It is entirely normal for a first run to report that:

- The bug you were about to fix **does not exist** — the behavior was already correct.
- The real defect is the **inverse** of the one you assumed, or a different problem wearing the same coat.
- Two failures you filed as one issue are two, with different fixes.

Without the red run, a wrong fix and a missing fix cancel into a satisfying green checkmark: you ship a well-written change for a bug you did not have, watch the suite go green, and conclude it worked.

So: **write the case, run it red, and confirm it fails for the reason you claimed** before writing the fix. A case has to be able to fail for the right reason before the defect underneath it is worth chasing.

---

## When a case is red, the grader is a suspect too

A red case has at least four possible causes, and jumping to the first is how suites go wrong:

1. **The agent is wrong** — the defect is real and present.
2. **The grader is wrong** — it is asserting something other than what you care about (a route instead of an outcome, one phrasing of a claim, an example from its own rubric).
3. **The case is wrong** — it asserts a path when it cares about a result, or it depends on a fixture detail that changed.
4. **The judge was too small for the question** — a nuanced verdict from a cheap model flips in a way that reads exactly like an agent regression. Cheapest to rule out: re-run on a stronger judge before changing anything. See [grading.md](grading.md#choosing-the-judge).

Work out which before changing anything. For judge-graded cases, **read the reasoning, not just the verdict** — a judge that failed a good answer will usually explain itself, and the explanation shows whether it applied the rule or pattern-matched an example.

Then apply the loosening rule from [grading.md](grading.md#the-loosening-rule): loosen a grader that tests the wrong thing; never one that is merely failing — and write down which it was, at the time.

### A grader that cannot be fixed

Sometimes the criterion is one no automated grader can hold, because the distinction it needs does not exist yet in the field — but try a stronger judge before concluding that, since it resolves more of these than a human verdict does. If it genuinely cannot be graded, skip the case with the reasoning beside it and keep other cases on the same defect. See [grading.md](grading.md#the-last-resort-a-human-grader).

---

## When the prompt will not move the behavior

A behavior that ignores repeated prompt changes is usually not a prompting problem.

> **When a behavior will not respond to prompt changes, check whether you are fighting the model's priors rather than its instructions.**

Those are different problems with different fixes. Instructions are a rewrite. Priors are a model change or a structural guard — feeding the fact in per request, constraining the output shape, or routing around the model's belief entirely.

**Running the suite across model variants makes the difference visible in minutes.** Hold the prompt fixed and change the model: if the failure moves, it was never a prompt gap. A single-model suite hides this completely, and you spend the afternoon rewording a prompt that was never the problem.

What you are looking for is the failure **changing character** across models, not a count moving. The clearest version is a model volunteering the wrong answer unprompted, in its own voice, while another does not — but priors show up in other shapes too: a refusal reflex, a formatting habit, a default that reasserts itself however the instruction is worded.

One caveat on reading those comparisons: with a small `n` and a non-deterministic judge, **treat variant results as a direction, not a measurement** — especially if the prompt was still moving between runs.

---

## Attribution: split suites so red points somewhere

Group cases so that a red run attributes to a **specific slice** of the prompt or the system, rather than to "something regressed".

One combined suite covering several rules tells you that something is broken. Several small suites — one per rule, per capability, or per defect class — tell you *which* one, which is the difference between a debugging session and a fix. This is the same instinct as the defect-class grouping in the main workflow, applied to how runs get read.

Finally, **persist the run somewhere you can re-read it.** Console output scrolls away, and a slow, paid run deserves an artifact you can diff, re-read, and attach to a bug report — when a case goes red, "which grader failed" is rarely the whole story, and you want its trajectory and the agent's actual answer beside the verdict.

If the harness already writes a report, read that rather than the console. If it does not, **raise it with the builder rather than building it** — what to persist is a harness decision with real consequences (it is also where the judge, the model, and the run mode get recorded, without which two reports cannot be told apart). In the meantime, capture what a red run showed in whatever you hand back, so the finding survives the terminal.
