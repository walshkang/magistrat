# Magistrat UX/UI Roadmap

This roadmap outlines the iterative path to evolve Magistrat from its current developer-focused, log-heavy MVP into a magical, professional consumer product. The goal is to build fast and consistently, ensuring we retain the powerful underlying diagnostic engine while progressively abstracting the complexity.

## Phase 1: Triage, Translate, and Declutter (The Foundation)
*Goal: Clean up the existing data presentation and hide the heavy machinery from the default user view.*

- **Developer Mode Toggle:** Introduce a UI toggle to hide/show advanced diagnostic panels (Session diagnostics, Coverage meter, Patch log, raw JSON states).
- **Human-Readable Translations:** Map abstract `ruleId`s and `objectId`s to plain English strings (e.g., translating `FONT_SIZE_MISMATCH` to "Title font should be 24pt").
- **Group Findings by Slide:** Restructure the UI state to group findings logically by their `slideId` rather than presenting a single flat list for the entire deck.

## Phase 2: The Professional Dashboard (Progress & Magic)
*Goal: Introduce positive, goal-oriented feedback mechanisms at the top of the Add-on.*

- **The "Alignment Score" Progress Bar:** Implement a sleek, prominent progress bar at the top of the sidebar. This shifts the focus from "Total Findings" to a rewarding percentage (e.g., "85% Aligned").
- **Rebranding Actions:** Rename the bulk "Apply Safe" action to something that implies intelligent automation (e.g., "Apply Recommended Fixes" or "Auto-Align").
- **Dynamic Score Recalculation:** Ensure the Alignment Score visibly fills up and animates towards 100% as patches are applied.

## Phase 3: The Interactive Minimap
*Goal: Provide contextual navigation and granular control over the deck.*

- **Minimap UI Component:** Build a vertical, scrollable list of all slides in the sidebar.
- **Slide-Level Status:** Add a status indicator (mini progress bar or percentage) next to each slide in the minimap.
- **Contextual Filtering:** Make the minimap interactive. Clicking a slide filters the findings list below to *only* show issues relevant to that specific slide.
- **Targeted Fixes:** Allow users to apply fixes on a per-slide or per-finding basis, rather than forcing a deck-wide bulk apply.

## Phase 4: The "Boss Override" (Handling Edge Cases)
*Goal: Give users the power to intentionally break rules without being penalized.*

- **Inline "Ignore" Action:** Add an "Ignore" or "Dismiss" button next to every individual finding in the UI.
- **Smart Score Adjustment:** When a finding is ignored, recalculate the Alignment Score to *exclude* the ignored item, allowing the user to reach 100% alignment.
- **State Persistence:** Update `DocumentStateV1` to persist ignored findings (e.g., by storing a hash of the rule and object) so they remain ignored across subsequent scans and sessions.
- **Exceptions Management:** Provide a way to view and "Un-ignore" findings later if needed.
