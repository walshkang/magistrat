# Prompt: Magistrat Rule Brainstorm

> Copy-paste this prompt into any Claude conversation (Claude.ai, Claude Code, Cursor, etc.) to iterate on the rule catalog.

---

## The Prompt

```
You are helping me expand the compliance rule catalog for Magistrat, a tool that checks Google Slides / PowerPoint presentations against style standards. The audience is Fortune 100 executive teams — C-suite, board decks, investor presentations, and strategy reviews.

I have deep experience building these decks for F100 leadership. You bring research on presentation best practices from sources like:
- McKinsey, BCG, Bain slide standards (the "consulting deck" canon)
- Nancy Duarte / Duarte Design principles
- Garr Reynolds (Presentation Zen)
- Edward Tufte (data visualization clarity)
- Corporate brand compliance guides (Fortune 100 brand teams)
- WCAG / accessibility standards for presentations
- Common QA checklists from design agencies

**My current rules are in `docs/RULE_CATALOG.md`.** Read that file first.

**Your job:**
1. Research and propose new rules I'm missing. For each, fill in the full schema from RULE_CATALOG.md (status: proposed).
2. Flag any existing rules that seem mis-calibrated (wrong severity, missing auto-fix opportunity, too noisy for exec decks).
3. Organize proposals into tiers:
   - **Tier 1 — High signal:** Would catch real issues in 80%+ of exec decks
   - **Tier 2 — Good to have:** Catches real issues but less frequent
   - **Tier 3 — Nice to have:** Edge cases, accessibility, future-proofing
4. For each proposed rule, note whether it's **deterministic** (can check with geometry/text/style data alone) or **needs heuristics** (requires fuzzy matching, ML, or judgment calls).

**Rules I'm especially curious about (but don't limit yourself to these):**
- Text overflow / text truncation detection
- Aspect ratio consistency for images/logos
- Whitespace / margin consistency
- Chart/table formatting standards
- Slide count / density heuristics
- Orphan/widow text lines
- Capitalization consistency (title case vs sentence case)
- Date/number format consistency
- Confidentiality / classification label presence
- Page numbering gaps or inconsistencies

**Constraints:**
- No LLM inference in the runtime pipeline — rules must be deterministic or heuristic-based
- We can read: text content, font properties, colors, geometry (position/size), bullet styles, grouping, slide structure, master/layout metadata
- We cannot currently read: embedded images (no OCR), animations, transitions, speaker notes content (may add later)

**Format:** Add your proposals directly into the "Proposed Rules" section at the bottom of RULE_CATALOG.md, following the existing schema. Group them by tier.

After proposing, let's discuss. I'll share what I've seen work (and fail) in real exec deck reviews, and we'll refine together.
```

---

## Tips for using this prompt

- **In Claude Code:** Just say "read docs/RULE_CATALOG.md and use the prompt in docs/prompts/rule_brainstorm.md" — it'll do the rest
- **In Claude.ai / Cursor:** Copy the prompt above, attach `docs/RULE_CATALOG.md` as context
- **Iterate:** After the first pass, push back on rules that are too noisy or not relevant to your deck style. The goal is high-signal rules, not maximum coverage
- **Re-import:** When you're happy with the proposed rules, change their status from `proposed` to `active` and bring the file back to Claude Code for implementation
