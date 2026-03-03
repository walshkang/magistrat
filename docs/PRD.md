# Magistrat Product Requirements Document (PRD)

## Vision
Magistrat should feel like magic—like reading your boss's mind with edits and always ensuring that things work. It provides an automated, trust-first workflow to ensure presentation decks (starting with Google Slides) adhere perfectly to an established "exemplar" style, while offering a professional, rewarding, and highly contextual user experience.

## Target Audience
Professionals (consultants, executives, marketers) who spend significant time formatting slides and ensuring brand/style consistency across massive decks, but do not have the time or desire to debug raw layout properties.

## Core Problem
The current MVP is a powerful but highly technical, log-heavy tool geared towards developers. Users are presented with abstract diagnostic data, raw rule IDs, and a flat list of deck-wide findings. There is no sense of "active slide" context, and resolving issues feels like a bulk debugging operation rather than a guided, rewarding checklist.

## UI/UX Objectives
1. **Abstract the Complexity:** Hide raw JSON logs, IDs, and complex patch histories from the default view. Keep them accessible for developers, but invisible to the primary user.
2. **Contextual Awareness:** The UI must respond to what the user is currently looking at. If they are on Slide 5, the tool should tell them the status of Slide 5.
3. **Professional Motivation:** Replace punitive "error" lists with positive, goal-oriented visuals (like a percentage "Alignment Score" or a progress bar).
4. **Iterative Control (The "Boss Override"):** Users must have the power to easily dismiss or ignore suggestions for edge cases (e.g., shrinking a font to fit a required long quote) without being permanently penalized in their alignment score.

## Key Features

### 1. The Alignment Score
A prominent, top-level progress bar or percentage indicating how closely the current deck (or slide) matches the exemplar. It provides immediate feedback and a gamified sense of progression as issues are resolved.

### 2. Human-Readable Linter
Findings are translated from raw technical IDs (`FONT_SIZE_MISMATCH on text_123`) into plain, actionable English ("Title font should be 24pt, currently 18pt").

### 3. The Interactive Minimap
A scrollable, visual checklist in the sidebar representing every slide in the deck. 
- Each slide has a status indicator (e.g., green checkmark, percentage circle).
- Clicking a slide filters the visible findings to *only* that slide.

### 4. Smart Exceptions ("Ignore" Workflow)
Users can dismiss individual findings. Ignored findings are persisted in the document state and excluded from the Alignment Score, allowing a deck with intentional layout deviations to still achieve a 100% "boss-approved" rating.

### 5. Developer Mode
A simple toggle in the settings that unhides the diagnostic data, coverage meters, and raw patch logs for power users or debugging purposes.
