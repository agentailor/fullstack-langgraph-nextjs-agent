# Agent Prompting Anti-Patterns

Common mistakes when prompting agents and how to fix them.

## Anti-Pattern 1: Over-Prescriptive Few-Shot Examples

### ❌ What NOT to do:

```
Here's how you should reason through financial questions:

Example 1:
User: "How much did I spend on groceries?"
Thinking: First, I need to identify this is a spending query. Then I need to determine the time period - since none was specified, I'll assume the current month. Next, I need to use the get_expenses_by_date_range tool with the category filter set to 'groceries'. After retrieving the data, I'll sum the amounts and present a clear answer.
Action: [calls get_expenses_by_date_range(start_date='2024-01-01', end_date='2024-01-31', category='groceries')]
Result: [data returned]
Response: "You spent $427.34 on groceries this month."

Always follow this exact reasoning pattern for all queries.
```

**Why this fails:**
- Limits the agent's reasoning capabilities
- Doesn't generalize to different scenarios
- Agent may try to match the example even when inappropriate
- Wastes context window tokens

### ✅ Better approach:

```
When analyzing spending queries:
1. Determine the time period (default to current month if unspecified)
2. Use get_expenses_by_date_range with appropriate parameters
3. Present clear summaries with relevant context

Adapt your approach based on query complexity and available data.
```

## Anti-Pattern 2: The Perfectionism Loop

### ❌ What NOT to do:

```
Always ensure all data is completely accurate and verified before responding.
Continue searching and cross-checking until you have perfect information.
Never settle for incomplete or uncertain data.
```

**Real-world consequence:**
Agent searches indefinitely until hitting context window limit, even when perfect data doesn't exist.

### ✅ Better approach:

```
Strive for accuracy while being pragmatic:
- For simple queries: 2-3 tool calls typically sufficient
- For complex analysis: Use up to 7-10 tool calls
- If you haven't found reliable information after 10 searches, acknowledge limitations
- Incomplete data is acceptable with appropriate disclaimers
```

## Anti-Pattern 3: Ambiguous Tool Selection

### ❌ What NOT to do:

```
Available tools:
- search_slack
- search_notion  
- search_github
- search_drive

Use the appropriate search tool based on the context.
```

**Why this fails:**
- Agent doesn't know which tool to use when
- May randomly pick or always default to one tool
- Wastes tool calls trying multiple options

### ✅ Better approach:

```
Available tools and when to use them:
- search_slack: For team communications, decisions, discussions
- search_notion: For documented processes, project specs, meeting notes
- search_github: For code examples, technical discussions, PR context
- search_drive: For formal documents, presentations, spreadsheets

Decision strategy:
- "How did we decide...": Start with search_slack
- "What's the process for...": Start with search_notion
- "How is X implemented...": Start with search_github
- "Where's the Q3 report...": Start with search_drive
```

## Anti-Pattern 4: Tool Name Collisions

### ❌ What NOT to do:

```
<!-- Multiple MCP servers all exposing "search" tool -->
Tools:
- search (from Slack server)
- search (from Notion server)
- search (from GitHub server)
```

**Why this fails:**
- Agent can't distinguish between tools
- May call wrong tool repeatedly
- Creates confusion in tool selection logic

### ✅ Better approach:

```
Tools with clear, unique names:
- slack_search
- notion_search  
- github_search

Always prefix tools with their domain/source when multiple servers provide similar functionality.
```

## Anti-Pattern 5: Missing Thinking Guidance

### ❌ What NOT to do:

```
You are a research assistant. Find information and provide answers.

[No guidance on planning, reflection, or decision-making]
```

**Why this fails:**
- Agent doesn't know when to stop searching
- May not verify information quality
- Misses opportunities to use reasoning capabilities effectively

### ✅ Better approach:

```
Before searching:
1. Plan: What type of question is this? What quality sources do I need?
2. Estimate: How many searches will this likely require?

After each search:
1. Reflect: Is this information relevant and high-quality?
2. Assess: Do I have enough to answer, or should I continue?
3. Verify: Should I cross-check this with another source?
```

## Anti-Pattern 6: Ignoring the Human-in-the-Loop

### ❌ What NOT to do:

```
When user requests budget changes, update the budget using update_budget() tool.
Process refunds when requested using process_refund() tool.
```

**Why this fails:**
- Takes irreversible actions without confirmation
- User loses control over important decisions
- Potential for costly mistakes

### ✅ Better approach:

```
For irreversible actions (budget changes, refunds, deletions):

1. Present a clear summary of the proposed action:
   - What will change
   - The impact/consequences
   - Any relevant context

2. Request explicit confirmation:
   "I can update your grocery budget from $500 to $600/month. This will affect 
    your monthly savings by $100. Should I proceed?"

3. Wait for clear "yes", "confirm", or "proceed" before executing

4. If response is unclear, ask clarifying questions
```

## Anti-Pattern 7: Vague Heuristics

### ❌ What NOT to do:

```
Be careful with sensitive information.
Don't make too many tool calls.
Try to provide good answers.
```

**Why this fails:**
- No actionable guidance
- Agent doesn't know what "careful" or "too many" means
- Vague instructions provide no decision-making framework

### ✅ Better approach:

```
Heuristics with specific thresholds:

Sensitive information:
- Never include passwords, API keys, or tokens in responses
- For PII requests, verify user identity first
- Redact credit card numbers except last 4 digits

Tool call budgets:
- Simple queries: 2-3 tool calls maximum
- Medium complexity: 5-7 tool calls
- Complex research: 10-15 tool calls, then assess if more needed

Quality standards:
- Prefer official documentation over blog posts
- Cross-reference controversial claims with 2-3 sources
- Acknowledge when information is uncertain or outdated
```

## Anti-Pattern 8: No Edge Case Handling

### ❌ What NOT to do:

```
Answer user questions about their expenses using the get_expenses tool.
Provide financial advice based on their data.
```

**Why this fails:**
- Doesn't address missing data scenarios
- No guidance for ambiguous requests
- Agent doesn't know how to handle failures

### ✅ Better approach:

```
When providing financial advice:

Normal flow:
1. Retrieve expense data
2. Analyze patterns
3. Provide recommendations

Edge cases:
- If expense data is missing: Acknowledge gap, provide advice with disclaimers
- If date range is ambiguous: Default to current month, mention the assumption
- If tool returns error: Try alternative approach or explain limitation
- If user asks about investments: Acknowledge this is outside scope, recommend professional advice
- If insufficient data for reliable advice: Clearly state limitations, offer to help gather more information
```

## Anti-Pattern 9: Assuming Context That Doesn't Exist

### ❌ What NOT to do:

```
Review the code for bugs and security issues.
Analyze the financial data and provide insights.
```

**Why this fails:**
- Agent doesn't know WHERE the code or data is
- No instructions on HOW to access it
- Missing tool usage guidance

### ✅ Better approach:

```
Review code for bugs and security issues:

1. Access the code using analyze_file(file_path) for each changed file
2. Run static analysis using run_linter(file_path) 
3. Check for common security patterns using security_scan(file_path)
4. Search for similar issues in codebase using search_codebase(pattern)

Financial data access:
1. User expense data: Use get_expenses_by_date_range(start, end, category)
2. Budget information: Use get_budget_status(category)
3. Historical trends: Use get_spending_trends(months_back)
```

## Anti-Pattern 10: Rigid Workflows for Variable Tasks

### ❌ What NOT to do:

```
For EVERY user question, follow these exact steps:
1. Search the knowledge base
2. Verify with web search
3. Cross-reference with documentation
4. Generate summary
5. Request user confirmation
6. Provide final answer

Never skip any step.
```

**Why this fails:**
- Wastes time on simple questions ("What's my account balance?")
- Creates frustrating user experience
- Inflexible workflow doesn't adapt to context

### ✅ Better approach:

```
Adapt workflow to question complexity:

Simple factual queries (account balance, order status):
- Single tool call, direct answer
- Skip verification steps

Medium complexity (troubleshooting, recommendations):
- 2-4 tool calls as needed
- Basic verification if information conflicts
- Provide answer with brief reasoning

Complex analysis (deep research, multi-step problems):
- Plan multi-step approach
- Use 5-10 tool calls strategically
- Verify critical information
- Provide comprehensive analysis
```

## Anti-Pattern 11: Ignoring Model Capabilities

### ❌ What NOT to do:

```
You must always respond in this format:
<thinking>
[Your detailed reasoning here]
</thinking>
<answer>
[Your response here]
</answer>

Follow this format exactly for all responses.
```

**Why this fails:**
- Modern models have native thinking capabilities
- Forced format may conflict with model's natural reasoning
- Wastes tokens on unnecessary structure

### ✅ Better approach:

```
Use your thinking process to plan before responding.
After retrieving information, reflect on completeness and quality.

[Let the model use its native reasoning capabilities naturally]
```

## Anti-Pattern 12: Excessive Repetition

### ❌ What NOT to do:

```
<!-- Repeated throughout prompt -->
Always verify information before responding.
Remember to always verify information before responding.
When answering questions, always verify information.
Never forget to verify information.
Verification of information is critical.
```

**Why this fails:**
- Wastes context window
- Doesn't improve reliability beyond first mention
- May confuse rather than reinforce

### ✅ Better approach:

```
<!-- State once clearly -->
Before responding:
1. Verify information quality
2. Cross-reference if claims seem uncertain
3. Acknowledge when information cannot be verified

<!-- Optional: Repeat ONLY most critical constraint at end -->
Remember: Verify information quality before responding.
```

---

## Anti-patterns that accumulate over time

The patterns above mostly appear when a prompt is written. The four below appear as it *ages* — they accumulate through maintenance, as instructions are added for reasons that later expire, copied between agents, or left behind when the enforcement moved elsewhere. Finding and removing them is a maintenance pass; see [audit.md](audit.md).

## Anti-Pattern 13: The Same Rule in the Prompt and the Tool Description

### ❌ What NOT to do:

```
<!-- In the system prompt -->
Never call process_refund for amounts over $500 without explicit user confirmation.
Refunds are irreversible, so always summarize the refund before executing it.
```

```
<!-- In the tool description for process_refund -->
Issues a refund to the customer's original payment method. Irreversible.
Requires explicit user confirmation for amounts over $500.
```

**Why this fails:**
- Two copies drift. One gets updated, the other becomes a contradiction the agent has to resolve.
- The prompt copy is loaded on every request, including the ones that never touch refunds.
- It reads as emphasis, so nobody deletes it — the duplication is self-protecting.

### ✅ Better approach:

Keep the constraint in the **tool description**, and delete the prompt copy. The tool description sits closest to the decision it governs, is in context exactly when the tool is a candidate, and travels with the tool if it's reused by another agent.

```
<!-- Tool description only -->
Issues a refund to the customer's original payment method. Irreversible.
For amounts over $500, present a summary and obtain explicit user confirmation
before calling this tool.
```

The system prompt keeps only what generalizes across tools: "For irreversible actions, summarize and confirm before proceeding."

## Anti-Pattern 14: Formatting Instructions the Model Already Follows

### ❌ What NOT to do:

```
Format your responses using markdown. Use headers to separate sections.
Use bullet points for lists of three or more items. Bold key terms.
Do not write walls of text — break long responses into paragraphs.
Use a table when comparing more than two options.
Always end with a brief summary of what you said.
```

**Why this fails:**
- Describes what the model already does. Every line is pure token cost.
- The rigid ones actively hurt: "always end with a summary" produces a redundant paragraph on two-sentence answers.
- It crowds out the formatting guidance that *is* load-bearing — your actual product constraints.

### ✅ Better approach:

State only what's specific to your surface, and only where the default would be wrong:

```
Responses render in a narrow terminal panel — avoid tables wider than 80 characters.
Never use headers; the panel strips them.
```

Everything else, let the model handle. If the default formatting is genuinely wrong for your product, that's a real instruction; if it's merely conventional, delete it.

**This one is tier-dependent.** Formatting scaffolds are among the first things a capable model stops needing and among the last a small one can do without — so check against the model you actually run rather than assuming. See [audit.md](audit.md#the-model-tier-rule).

## Anti-Pattern 15: Generic Tool-Use Advice That Describes Default Behavior

### ❌ What NOT to do:

```
- Only use tools when you genuinely need current, specific, or specialized information
- Do NOT use tools for information you already know with confidence
- Use tools efficiently — don't make unnecessary calls
- Follow the exact function signatures provided
```

**Why this fails:**
- None of it is specific to *your* agent. It describes how tool-using models already behave.
- It creates a false sense of coverage — the prompt *looks* like it addresses tool use while saying nothing actionable.
- It displaces the guidance that would help: which tool for which situation, and what the budget is.
- The last line is worse than inert: "follow the exact function signatures" instructs the model not to do something it structurally cannot do (see [Anti-Pattern 16](#anti-pattern-16-instructing-the-model-not-to-do-something-it-structurally-cannot-do)).

### ✅ Better approach:

Replace generic advice with the decisions the model genuinely cannot make on its own — selection between plausible siblings, and where to stop:

```
search_docs returns individual matching passages (capped at 20). summarize_corpus
works across the whole document set. For "how many" or "which documents mention",
use summarize_corpus — the passages from search_docs are a sample, not a census.

Budget: 1-2 calls for a lookup, up to 6 when synthesizing across sources.
```

The test for any tool-use line: **would the agent behave differently without it?** If not, delete it.

## Anti-Pattern 16: Instructing the Model Not to Do Something It Structurally Cannot Do

### ❌ What NOT to do:

```
Do not access the user's database directly.
Never send emails on the user's behalf without permission.
Do not modify files outside the working directory.
Never make purchases with the stored payment method.
```

…in an agent whose only tools are `search_docs` and `summarize_page`.

**Why this fails:**
- The capability doesn't exist, so the instruction cannot change any outcome. It is a comment, not a constraint.
- It misrepresents the agent's surface to the model — telling it not to send emails implies email is somehow reachable.
- It substitutes for real enforcement. A constraint that matters belongs in the harness — a permission gate, an approval step, a tool that isn't registered — not in a sentence the model is asked to honor.
- These accumulate the fastest, because they're copied between agents that have different tools.

### ✅ Better approach:

Audit the prohibition list against the actual tool list, and delete every line whose capability isn't there. For the ones that *are* reachable, enforce them structurally and let the prompt explain the gate rather than pretend to be it:

```
send_email requires explicit user approval before it executes — the harness will
surface a confirmation. Present the recipient, subject, and body in your summary
so the user can approve on an informed basis.
```

The prompt now describes a real mechanism instead of asking the model to be the mechanism.

Distinct from [Anti-Pattern 13](#anti-pattern-13-the-same-rule-in-the-prompt-and-the-tool-description), which is about a real constraint stated in two places. This one is about a constraint that isn't enforced anywhere — the prompt is the only thing standing between the agent and the action, and a sentence is not an enforcement mechanism.

## Summary: Key Principles to Remember

**DO:**
- Provide clear heuristics with specific thresholds
- Guide HOW to think, not WHAT to think
- Give explicit tool selection criteria
- Define clear boundaries and edge cases
- Use adaptive complexity based on task
- Request confirmation for irreversible actions
- Keep a constraint in one place — the tool description, when it governs a tool
- Enforce hard constraints in the harness, and let the prompt explain the gate

**DON'T:**
- Show prescriptive few-shot examples
- Create perfectionism loops
- Use ambiguous guidance
- Ignore edge cases
- Force rigid workflows
- Assume context that doesn't exist
- Repeat instructions excessively
- State the same rule in both the prompt and the tool description
- Specify formatting the model already handles correctly
- Give generic tool-use advice that describes default behavior
- Prohibit actions the agent has no tool to perform
