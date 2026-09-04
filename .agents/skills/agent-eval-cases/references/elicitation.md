# Eliciting Cases: Where the First Ones Come From

Most eval advice assumes you already know what to test. This file assumes the opposite: an agent that works well enough to ship, a builder who has a rough sense that it sometimes misbehaves, and an empty suite.

**The one rule this file exists to enforce: cases come from failures somebody observed, not from failures somebody imagined.** A suite invented at a desk tests the failures you were able to think of, which is not the set that matters.

## Table of Contents

1. [If you are an agent running this for someone](#if-you-are-an-agent-running-this-for-someone)
2. [Source 1 — Production traces](#source-1-production-traces)
3. [Source 2 — The builder's own use](#source-2-the-builders-own-use)
4. [Source 3 — Someone who knows the domain](#source-3-someone-who-knows-the-domain)
5. [The silent-failure question](#the-silent-failure-question)
6. [Triage: what each answer becomes](#triage-what-each-answer-becomes)
7. [When there is nothing to go on](#when-there-is-nothing-to-go-on)

---

## If you are an agent running this for someone

The elicitation is a conversation, not a form. Practical guidance:

- **Ask, do not guess.** You do not have access to the failures — the builder does, or their traces do. Generating a plausible-looking suite without asking is the single worst outcome of this skill, because it looks like progress and tests nothing anyone has seen go wrong.
- **Do not ask everything at once.** Open with the two or three highest-value questions and follow up. A wall of questions gets a thin answer to each.
- **Prefer specifics over categories.** "What went wrong?" gets an abstraction. "What have you caught it doing that you had to fix by hand?" gets an incident.
- **Write down what you hear before filtering it.** The triage below discards most of it — but discard deliberately, not by forgetting.
- **You may propose candidates once you have observations**, extrapolating from a real failure to its neighbours. That is different from inventing a suite from nothing: the seed is still something that happened.

---

## Source 1 — Production traces

The best source there is, if the agent is instrumented. Real failures, real phrasings, no imagination required.

**This is the honest reason tracing comes before evals: you cannot distill cases from traffic you never recorded.** If the agent is in production and untraced, say so — instrumenting it is the higher-value next step, and it makes every future suite better.

### What to look for

Read for **repeating patterns**, not individual bad answers:

- Answers stated with confidence and no supporting tool call.
- The same wrong claim recurring across unrelated conversations — a strong signal it comes from the model or the prompt, not from one odd input.
- Users correcting the agent, rephrasing the same question, or abandoning the thread.
- Retries, loops, and handoffs to a human.
- Tool calls that fetched something, and an answer that ignored what came back.

### The two rules that make trace-sourcing work

**The pattern is the finding; the case is a minimized rewrite of it.** Do not replay a transcript. Find the smallest prompt that reproduces the pattern. A sprawling real conversation makes a slow, fragile case that fails for six possible reasons; a one-line reproduction fails for one.

**Your diagnosis of the trace is a hypothesis, not the defect.** This is where trace-sourcing goes wrong most often. Two patterns can look like one problem and turn out to be two — or turn out to be the inverse of what you assumed. Write the case so it can prove your diagnosis wrong; that is the whole point of running it red before fixing anything (see [first-run.md](first-run.md)).

### Questions to ask

- "Is the agent traced? Can you read real conversations?"
- "What keeps showing up that makes you uncomfortable?"
- "Where do users push back, rephrase, or give up?"
- "Has anyone reported a wrong answer? What was it, specifically?"

---

## Source 2 — The builder's own use

Where most first suites actually start. Run the agent and pay attention to what makes you wince.

### Questions to ask

- **"What makes you wince when you use it?"** The best opener. It asks for a reaction people already have, rather than an analysis they have to perform.
- **"What have you caught it doing that you had to correct by hand?"** Every hand-correction is a defect that shipped.
- **"What would be expensive if it got it wrong and you did not notice?"** Turns attention to consequences rather than symptoms.
- **"Is there anything you avoid asking it because you do not trust the answer?"** Surfaces known-weak areas that never generate complaints, because everyone has quietly routed around them.
- **"When it fails, does it fail the same way twice?"** Separates a deterministic defect (often fixable below the eval layer) from a flaky one (which is exactly what evals with repeats are for).

---

## Source 3 — Someone who knows the domain

A domain expert who has never seen the code can usually list the edge cases that matter within minutes, because they know **which wrong answers are expensive**.

This is the route to reach for when the builder is too close to the system, or when the agent is too new to have traces.

### Questions to ask

- "If this got one thing wrong badly enough to matter, what would it be?"
- "What does a competent human in this role double-check before answering?"
- "What do people new to this domain reliably get wrong?"
- "Which of these mistakes would a customer notice, and which would go unnoticed for months?"

That last one leads directly into the highest-value question in this file.

---

## The silent-failure question

Ask explicitly:

> **"Which wrong outcomes would be invisible? No error, no exception, a clean success that quietly did the wrong thing."**

Most failures are loud — an exception, a refusal, an obviously wrong number. Loud failures get noticed and reported without a suite. **Silent ones do not**, and they are where eval cases earn the most.

The shape to listen for is **an operation that reports success while having done the wrong thing.** A bulk import where an ambiguous input was interpreted one of two plausible ways: `05/07/2026` is a real date read as either 5 July or 7 May, so the import completes with no error and no bad rows — and the only evidence anything went wrong is which month the records landed on. Nothing throws, nothing alerts, and the data is wrong.

**Note what the correct behavior is here, because it shapes the case.** No amount of better reasoning resolves that date — both readings are valid, and the information needed is not in the input. The only right move is for the agent to **stop and ask** before writing. So the case is not testing whether the agent interprets well; it is testing whether it **recognizes that it cannot know**. That is true of silent failures generally: where the missing information is unrecoverable from the input, asking is the behavior, and a case for it usually needs a second turn supplying the answer.

Builders rarely volunteer these, because a failure nobody has seen fail does not come to mind. You have to ask.

When you find one, note two things:

- **Grade the consequence, not the report of it.** These failures come with a confident, accurate-sounding summary — that is what makes them silent — so asserting on what the agent said grades the very thing that is misleading you. Assert on what actually changed: the records written, the file produced, the request sent, the state afterwards.
- **The input may need designing** so a wrong answer stays visible. If both interpretations of an input produce a plausible-looking result, the case cannot tell them apart — a real constraint when you control the corpus, and a reason to hunt for the right real example when you do not.

---

## Triage: what each answer becomes

Every observation goes to exactly one of four places. Most do not become eval cases.

| The observation | Where it goes |
| --- | --- |
| The tool returned something ambiguous or misleading | **Belongs in the payload.** The agent reasoned correctly over a bad input. See [`tool-design`](https://github.com/agentailor/skills/tree/main/tool-design). |
| The contract is mechanically checkable — a field missing, a default misapplied, an error unstructured, truncation unsignalled | **Belongs in the ordinary test suite** — a unit test, or an integration test where real I/O decides it. Milliseconds, no model, runs on every change. |
| The agent had correct information and used it wrongly; chose the wrong tool among plausible siblings; ignored a stated instruction; behaves correctly only *sometimes* | **An eval case.** This is the residue nothing cheaper can catch. |
| A one-off with no pattern, no consequence, and no expense | **Nothing.** Write it down and move on. Not every wrinkle earns a permanent line item. |

Three notes on applying this:

- **Report the first two rows; do not go and build them.** Payload and test changes sit outside a request to write evals, and a payload fix changes the behavior every existing case was written against. Name the failure and the layer that should catch it, and let the builder decide.
- **Check the cheaper layer exists before routing anything to it.** If the project has no tests over its tools, rows one and two have nowhere to go — say so, note that those tests are the cheaper place to start, and keep a case in the meantime rather than letting the failure fall through uncaught.
- **The same incident can produce a payload fix *and* a case.** Once the payload is repaired, a case proving the agent acts on the corrected result is what catches a future prompt change that stops it reading the correction.
- **"Only sometimes" is a strong signal for the eval layer**, because no assertion over a return value reaches it. It is also the signal to spend repeats on that case.

---

## When there is nothing to go on

The builder has no traces, cannot name a failure, and the agent is too new to have a track record.

**Prefer observations, and try to get some first.** In rough order of value:

1. **Say plainly what is unverified.** "There are no observed failures to build cases from" is useful information, not a dead end.
2. **Offer the fastest route to observations.** A short hand-run probing session — ten or fifteen realistic requests, concentrated on the capabilities the builder would least like to be wrong — generates the raw material in an afternoon. This *is* eval work; the grader is a human.
3. **Offer the domain-expert conversation** if the builder cannot probe the domain themselves.
4. **Recommend tracing** if the agent is, or is about to be, in production — it makes every future suite better.

A suite built from fifteen minutes of real probing beats one built from an hour of imagination, so it is worth asking for that fifteen minutes.

### When none of that is available

Sometimes it genuinely is not — nothing is in production, the builder does not know the domain deeply, and there is no expert to ask. **Proposing cases anyway is the right call**, provided everyone understands what those cases are and are not.

Work with the builder rather than handing over a finished suite: you can reason about what this kind of agent tends to get wrong, and they know what would be expensive. Between the two of you the list is better than either alone. Then be explicit about the weaker claim:

- **An invented case is unproven, not worthless.** It has never been seen to fail, so it does not yet guard a known defect. What it *does* do is pin current behavior, so a later prompt, tool, or model change cannot alter it silently. That is regression protection, and it is worth having.
- **Mark them as provisional**, in the description, so a later reader knows which cases came from an observed failure and which from reasoning. Those two kinds deserve different amounts of trust when one goes red.
- **Expect some to be wrong.** An invented case can assert behavior nobody actually wants, or test a proxy rather than the behavior. The first honest run is where that surfaces — and a provisional case that turns out to assert the wrong thing should be deleted, not defended.
- **Replace them as evidence arrives.** The first real failure from use or traces beats any of them. Treat the invented set as scaffolding that comes down, not as the finished suite.

Then come back and run the elicitation properly once there is something to run it on.
