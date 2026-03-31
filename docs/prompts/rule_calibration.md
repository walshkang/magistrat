# Prompt: Rule Catalog Calibration Session

> Paste this prompt into a new Claude conversation. Attach `docs/RULE_CATALOG.md` as context.

---

## The Prompt

```
I'm calibrating the rule catalog for Magistrat, a deterministic compliance checker for Google Slides / PowerPoint. The tool scans presentations against style standards for Fortune 100 executive teams — C-suite, board decks, investor presentations, strategy reviews.

I've spent years building these decks for F100 leadership. I know what actually gets flagged in real reviews, what partners and execs notice, and what's noise. You're helping me refine this catalog based on my experience.

The attached RULE_CATALOG.md has two sections:
1. **Active rules** (23) — already implemented and shipping
2. **Proposed rules** (13) — researched but not yet built, organized into tiers

**How this conversation works:**

Walk me through the catalog in passes. For each pass, show me a batch of 3–5 rules and ask me:
- Is the severity right? (error / warn / info)
- Does this actually matter in F100 exec decks, or is it theoretical?
- Should auto-fix be on or off? (I'll tell you when auto-fix is dangerous)
- Any edge cases from my experience that should be in the Notes?
- Should this rule be cut entirely?

After we go through everything, I may also:
- Propose new rules from my experience that research missed
- Merge or split rules that overlap or are too broad
- Change tiers for proposed rules
- Promote proposed rules to active or demote active rules

**When we're done:**

Output the complete, updated RULE_CATALOG.md file — same schema, same format. Every rule should reflect our discussion. Include:
- Any severity/tier/auto-fix changes we agreed on
- New rules I proposed (status: proposed)
- Removed rules should be gone entirely (don't keep them as deprecated unless I say so)
- Updated Notes fields with edge cases I shared
- A changelog section at the very bottom summarizing what changed and why

**Constraints to keep in mind:**
- No LLM/OCR in the runtime pipeline — rules must be deterministic or heuristic
- Available data: text content, font properties, colors, geometry (position/size), bullet styles, grouping, slide structure, master/layout metadata
- NOT available: embedded image content, animations, transitions, speaker notes

**Start with the first batch of rules. Let's go.**
```

---

## After the session

Copy the final RULE_CATALOG.md output back into `docs/RULE_CATALOG.md` in this repo. Then bring it to Claude Code — it can diff against the current implementation and plan what to build next.
