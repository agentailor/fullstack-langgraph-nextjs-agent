---
name: agent-prompt-engineering
description: "Comprehensive guide for designing, refining, and auditing system prompts for autonomous AI agents based on Anthropic's production practices. Use when creating or refining prompts for agents that operate in loops with tool access, including when asked to write agent instructions, system prompts, agent configurations, or when improving agent reliability and decision-making capabilities. Also use to audit a prompt that already exists — trimming one that has grown long, re-fitting it after upgrading or downgrading the model behind it, or debugging an agent that seems over-constrained."
---

# Agent Prompt Engineering

## Overview

Agent prompt engineering differs fundamentally from traditional prompt engineering. Agents operate autonomously in loops, making decisions and using tools without human intervention. This requires conceptual engineering: providing heuristics, principles, and decision-making frameworks rather than rigid templates.

This skill distills Anthropic's production experience building agents like Claude Code into actionable principles for creating reliable, production-ready agent prompts.

## Core Principles

### 1. Start Simple, Iterate Based on Reality

Begin with a straightforward prompt defining role and core task. Avoid premature optimization.

**Initial structure:**
```
<!-- Role -->
You are [Agent Name], a [domain] assistant.
Your task is to [primary objective].

<!-- Dynamic Content -->
You will be provided with [data sources].
<data_source>
{{VARIABLE}}
</data_source>

<!-- Instructions -->
When [handling requests], follow these steps:
1. [Step 1]
2. [Step 2]
3. [Step 3]

<!-- Repeat Critical Instructions — only in long prompts, see note below -->
Remember to [most important constraint].
```

**On repeating the critical instruction:** this earns its place in a long prompt, where the constraint would otherwise sit hundreds of lines from the decision it governs. On a frontier model with a short prompt it's unnecessary by default — the instruction was already read, and the restatement just spends tokens. Start without it and add it back if a constraint is actually being missed.

Perfect prompts emerge through iteration. Use AI to draft initial versions, then refine through testing.

### 2. Think Like Your Agent

**Critical rule: If a human cannot follow your instructions with only the tools provided, neither can the agent.**

Simulate being the agent: given only your prompt and tool descriptions, can you accomplish tasks?

**Common gaps to check:**
- Missing tool usage instructions: "To access [data], use the `tool_name(params)` tool"
- Unclear data locations: Specify where information lives and how to retrieve it
- Ambiguous decision criteria: Define when to use which approach
- Undefined success conditions: Clarify what "complete" means

### 3. Provide Reasonable Heuristics

Heuristics are decision-making shortcuts that guide behavior without rigid rules. They prevent common failures while preserving flexibility.

**Production-tested heuristics:**

**Irreversibility:**
```
Never take irreversible actions (delete, publish, send) without explicit confirmation.
For destructive operations, always present a summary and request approval.
```

**Search budgets:**
```
For simple factual questions: Use 1-2 searches maximum
For complex research tasks: Use 5-10 searches, prioritizing quality over quantity
If you cannot find good information after 10 searches, acknowledge limitations
```

**Quality thresholds:**
```
Prioritize original sources (official docs, papers, company blogs) over aggregators.
If sources conflict, search for 2-3 additional authoritative sources before concluding.
```

**Domain-specific heuristics examples:**
- Financial agents: "For investment advice, always include disclaimers and suggest consulting professionals"
- Code agents: "Run tests after significant changes to verify functionality"
- Content agents: "Maintain consistent brand voice; when uncertain, err toward conservative tone"

### 4. Master Tool Selection

With multiple tools, agents need explicit guidance on which tool to use when.

**Critical practices:**

**Avoid name collisions:**
```
❌ Bad: Multiple tools named "search" from different sources
✅ Good: slack_search, notion_search, web_search
```

**Provide selection guidance:**
```
Tool selection guidelines:
- Use get_expenses_by_date_range for spending analysis questions
- Use get_budget_status for budget progress tracking
- Use forecast_spending for predictive questions about future expenses
- When user intent is ambiguous, start with get_budget_status for overview
```

**Context-specific instructions:**
```
For questions about [specific domain]:
1. First check [primary tool] to get overview
2. If more detail needed, use [secondary tool] with parameters: [guidance]
3. Only use [expensive tool] when [specific condition]
```

### 5. Guide the Thinking Process

Modern models can reason, but explicit guidance improves results dramatically.

**Planning before action:**
```
Before responding to requests:

1. Use your thinking process to plan:
   - Assess the complexity of the task
   - Determine which tools and data you'll need
   - Estimate how many tool calls will be necessary
   - Define what success looks like for this query

2. After retrieving data from tools, use interleaved thinking to:
   - Reflect on data quality and completeness
   - Verify if information is sufficient or if more data is needed
   - Consider if additional verification is required
   - Evaluate if disclaimers about data accuracy are needed
```

**Key thinking patterns:**
- **Plan upfront:** Think through approach before tool calls
- **Reflect on results:** Evaluate tool outputs before proceeding
- **Verify quality:** Assess whether information meets standards
- **Decide when to stop:** Recognize when you have enough information

**For models without native interleaved thinking:**
Create a `pause_and_reflect` tool or explicit thinking checkpoints:
```
After each tool call, pause to consider:
- Did this tool return what I expected?
- Is the data quality sufficient?
- Should I verify with another tool?
- Am I ready to provide the answer, or do I need more information?
```

### 6. Prepare for Side Effects

Every prompt change has unintended consequences in autonomous loops. Agents interpret instructions literally and persistently.

**Real production example:**
```
❌ "Keep searching until you find the highest quality possible source"
Result: Agent searches indefinitely until context window limit

✅ "Search for high-quality sources. If you don't find an ideal source after 
    5-7 searches, that's acceptable. Proceed with the best available information."
```

**Common side effects:**

**Perfectionism loops:**
```
❌ "Always verify all data is correct before proceeding"
✅ "Verify critical data points. If minor inconsistencies exist, proceed with appropriate disclaimers"
```

**Excessive tool usage:**
```
❌ "Check for updates regularly"
✅ "Check for updates once per session unless user explicitly requests refresh"
```

**Over-qualification:**
```
❌ "Consider all possible edge cases"
✅ "Consider common edge cases. For rare scenarios, ask user for clarification"
```

**Mitigation strategies:**
1. Start simple, add constraints incrementally as you discover issues
2. Test with edge cases where goals cannot be perfectly achieved
3. Give agents permission to be "good enough" rather than perfect
4. Set clear boundaries (max tool calls, time limits, quality thresholds)
5. Monitor production behavior for unexpected patterns

## Why Traditional Few-Shot Examples Don't Work for Agents

**Anti-pattern:** Providing step-by-step examples showing exact reasoning chains

Modern frontier models have reasoning trained in. Prescriptive examples limit their capabilities.

**What works better:**

**Guide HOW to think, not WHAT to think:**
```
✅ Use your thinking process to plan your approach before taking action.
✅ After getting tool results, reflect on whether the information is sufficient.

❌ [Example showing exact step-by-step reasoning chain]
```

**Provide principles over patterns:**
```
✅ For simple queries, typically 2-3 tool calls are sufficient.
✅ For complex analysis, you may need 5-10 tool calls.

❌ [Example: Step 1: Call tool A, Step 2: Analyze result, Step 3: Call tool B...]
```

**Use examples sparingly for behavior types, not processes:**
When examples are necessary, show the TYPE of behavior desired, not exact steps:
```
Example interaction style:
User: "What's my spending this month?"
Agent: Retrieves data, provides clear summary with key insights highlighted.

Example error handling:
User: "Show me transactions for next month"
Agent: Acknowledges request, explains data is only available up to current date, 
       offers relevant alternative (current month trends, projections).
```

## Testing and Evaluation Strategy

Start small, expand systematically. You don't need 100 test cases to validate improvements.

### The 3-Test Rule

**Key principle from scientific research:** Larger effect sizes require smaller sample sizes.

If your prompt change significantly improves the agent, you'll see it with just 3-5 tests.

**Starting approach:**
1. Create 3-5 manual test cases using realistic user requests
2. Keep test cases consistent across iterations
3. Run tests manually, observe behavior
4. Look for obvious improvements
5. Add more test cases as you discover edge cases

**Example test cases for a financial agent:**
```
1. "What's my total spending this month?"
2. "Am I on track to meet my savings goal?"
3. "Should I adjust my budget based on last month's expenses?"
4. [Edge case discovered in production]
5. [Another real user scenario that failed]
```

**Expansion strategy:**
- Start with 3-5 core happy-path scenarios
- Add 2-3 edge cases as discovered
- Include 1-2 error/failure scenarios
- Gradually build to 10-15 representative cases
- Only build automated eval infrastructure when patterns stabilize

### What to Test

**Core functionality:**
- Can the agent complete its primary task?
- Does it use tools correctly?
- Does it handle missing data gracefully?

**Decision making:**
- Does it choose the right tools?
- Does it know when to stop searching?
- Does it escalate appropriately when stuck?

**Edge cases:**
- Incomplete data
- Conflicting information
- Impossible requests
- Ambiguous queries

**Failure modes:**
- Infinite loops
- Excessive tool usage
- Wrong tool selection
- Premature conclusions

## Maintaining an Existing Prompt

Everything above is about getting a prompt right. A prompt that has been in production for months has a different problem: it grew one incident at a time, and much of it now compensates for behavior the model you run today produces on its own. That prompt isn't badly written — it's **over-fitted to a model that no longer exists.**

Run a maintenance pass when you change the model — in **either** direction, since a downgrade re-fits density as much as an upgrade does — when the prompt has grown past the point anyone reads it end to end, or when the agent behaves as if over-constrained: looping, over-qualifying, refusing reasonable requests. The reflex is to add a line correcting that; often the fix is deleting the line that caused it.

Two rules govern the pass. **Audit freely, delete carefully:** marking what looks stale needs no test infrastructure, but deleting needs some way to notice a regression — an eval suite, a handful of hand-run cases, or inspection for duplication — matched to the stakes. And **delete what the model can infer, keep what only you know.**

The six patterns that find candidates, the tests that protect the load-bearing lines, and how to verify a deletion are in [references/audit.md](references/audit.md).

## Common Prompt Structure for Agents

While structure varies by use case, most production agent prompts follow this pattern:

```
<!-- Role & Core Identity -->
You are [Agent Name], [brief role description].

<!-- Dynamic Context -->
<context_type>
{{DYNAMIC_DATA}}
</context_type>

<!-- Available Tools -->
You have access to these tools:
- tool_name_1: [when to use]
- tool_name_2: [when to use]

<!-- Core Heuristics -->
General principles:
- [Heuristic 1]
- [Heuristic 2]

<!-- Thinking Guidance -->
Before taking action:
1. [Planning instruction]
2. [Reflection instruction]

<!-- Specific Instructions -->
When handling [task type]:
1. [Step 1]
2. [Step 2]

<!-- Edge Cases & Boundaries -->
Important boundaries:
- [Limitation 1]
- [Limitation 2]

<!-- Critical Constraints (Repeated) — long prompts only; see the note in Core Principle 1 -->
Remember: [Most important constraint repeated for emphasis]
```

## Advanced Patterns

### Multi-Agent Coordination

For systems with multiple specialized agents:

```
You are part of a multi-agent system. Your specific role is [specialized function].

Coordination protocol:
- When you encounter [condition], delegate to [other agent]
- Share context by [method]
- Await confirmation before [action type]
```

### Human-in-the-Loop Integration

For agents requiring human approval:

```
For actions requiring approval:
1. Present a clear summary of what you plan to do
2. List any assumptions you're making
3. Highlight any risks or uncertainties
4. Wait for explicit confirmation before proceeding
5. If denied, ask clarifying questions to understand concerns
```

### Adaptive Complexity

For agents serving users with varying expertise:

```
Assess user expertise level from their questions:
- Novice indicators: [patterns]
- Expert indicators: [patterns]

Adjust response detail accordingly:
- For novices: Provide more context, explain technical terms
- For experts: Skip basics, focus on nuanced details
```

## Resources

### references/examples.md
Complete agent prompt examples including the Cameron AI financial assistant and production patterns from real-world deployments.

### references/anti-patterns.md
Common mistakes in agent prompting with explanations of why they fail and how to fix them, including the over-constraint patterns that accumulate in a prompt over time.

### references/audit.md
The maintenance pass for a prompt that already exists: the six patterns that identify deletion candidates, the model-tier rule, how to verify a deletion when there's no eval harness, and — the half that matters more — what must never be deleted.

See references for detailed examples and patterns.
