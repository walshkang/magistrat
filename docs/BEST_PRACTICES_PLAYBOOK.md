# Magistrat Best Practices Playbook (v1)
Purpose: Deterministic, auditable rules used for:
(1) Exemplar Health scoring, (2) optional Normalized Exemplar (virtual by default),
(3) Deck findings with Safe/Caution/Manual risk labels and typed, reversible patches.

playbook_id: "magistrat_default_v1"
playbook_version: 0.2.0
last_updated: 2026-02-17
default_profile: "consulting_generic"
rule_id_format: "BP-*"
language: "en-US"

# ------------------------------------------------------------
# A) Locked contracts (v1) — must match PRD
# ------------------------------------------------------------

## A0. Closed-world semantics
roles_v1_enum:
  - TITLE
  - SUBTITLE
  - BODY
  - BULLET_L1
  - BULLET_L2
  - FOOTER
  - CALLOUT
  - UNKNOWN

## A1. Evidence-first findings contract
# Every finding must include:
# - observed vs expected
# - evidence (why expected)
# - confidence
# - risk: safe|caution|manual
# - severity: info|warn|error
# - source: exemplar|playbook|continuity
# - coverage: ANALYZED | NOT_ANALYZED + reason_code (never silent)

evidence_types_v1:
  - EXEMPLAR_EVIDENCE        # derived from Role Style Map (original or normalized)
  - PLAYBOOK_EVIDENCE        # explicit rule id + rule text
  - TYPOGRAPHIC_EVIDENCE     # concrete mismatches in font tokens
  - STRUCTURAL_EVIDENCE      # bullets/indent/levels
  - GEOMETRIC_EVIDENCE       # conservative; detection-first
  - HYGIENE_EVIDENCE         # ghosts/invisible/placeholder/language tags
  - REFERENTIAL_EVIDENCE     # agenda/TOC/section header mapping

## A2. Patch safety allowlist (v1)
# Safe: allowed for bulk apply if gates pass
safe_patch_ops_v1:
  - SET_FONT_FAMILY
  - SET_FONT_COLOR
  - SET_FONT_STYLE           # bold/italic
  - SET_BULLET_INDENT        # includes hanging
  - DELETE_GHOST_OBJECT      # ONLY when "ghost" definition is met (see hygiene rules)

# Caution: requires explicit review + validation; never bulk by default
caution_patch_ops_v1:
  - SET_FONT_SIZE
  - SET_LINE_SPACING

# Manual: suggest-only (no auto apply)
manual_patch_ops_v1:
  - MOVE_GEOMETRY
  - RESIZE_GEOMETRY
  - DELETE_NON_GHOST_OBJECT
  - DEDUPE_DELETE
  - MASTER_LAYOUT_CHANGES     # report-only in v1 (no patch)
  - BREAK_GROUP               # forbidden in v1 (no patch)

## A3. Undo/Redo awareness (v1)
# Patches must be logged with:
# - target_fingerprint (slide_id, object_id, precondition_hash)
# - before snapshot
# - after snapshot
# - reconcile_state: applied|reverted_externally|drifted|missing_target

reconcile_states_v1:
  - applied
  - reverted_externally
  - drifted
  - missing_target

## A4. Never hide NOT_ANALYZED
not_analyzed_reason_codes_v1:
  - LOW_ROLE_CONFIDENCE
  - MISSING_STYLEMAP_ROLE
  - EXPECTED_CONFIDENCE_LOW
  - UNSUPPORTED_OBJECT_TYPE
  - GROUPED_OBJECT_UNSAFE
  - API_LIMITATION
  - AMBIGUOUS_TEXT_RUNS
  - AUTOFIT_PRESENT
  - VALIDATION_UNAVAILABLE

# ------------------------------------------------------------
# B) IR conventions (v1) — how rules interpret PPT objects
# ------------------------------------------------------------

ir_conventions:
  text_run_dominant_basis: "by_character_count"     # used for single-token comparisons
  paragraph_basis: "ppt_paragraph"                 # bullets/indent/level checks
  box_geometry_basis: "shape_bounds"               # x/y/w/h in points
  color_representation:
    primary: "rgb"
    secondary: "theme_token_if_available"
  group_policy:
    never_break_groups: true
    grouped_objects_analysis:
      allow_read: true
      allow_patch: "only_if_patch_does_not_change_geometry_and_is_safe_op"
  autofit_policy:
    if_autofit_detected:
      - prohibit: [SET_FONT_SIZE, SET_LINE_SPACING]
      - emit: NOT_ANALYZED unless rule is purely detect-only

# ------------------------------------------------------------
# C) Exemplar Health (0–100) — deterministic scoring
# ------------------------------------------------------------

exemplar_health:
  categories:
    role_separability:
      points: 25
      definition: >
        For each role pair present on exemplar, compute distance between role centroids
        in feature space (fontSize, weight, color, top-band). Score rises when roles are
        separable above thresholds; penalize overlaps/collisions.
    token_stability:
      points: 25
      definition: >
        Within each role, compute dominant token coverage for key attributes
        (family, size, color, style). Score rises when dominant coverage >= 0.80
        and variance is low; penalize mixed-run paste artifacts.
    geometry_coherence:
      points: 25
      definition: >
        For roles with geometry signal (TITLE/SUBTITLE/FOOTER), compute band width
        using median absolute deviation of top/left. Score rises when MAD <= band_threshold.
    hygiene:
      points: 25
      definition: >
        Penalize ghost objects, invisible blockers, placeholder text, stray off-slide
        objects, and inconsistent language tags.

  thresholds:
    great: 80        # recommend "Use Normalized Exemplar"
    ok: 60           # warn: normalization recommended
    risky: 40        # strong warning; user must confirm to proceed
    block: 0         # <40 blocks by default unless user chooses "Use Original (unsafe)"

# ------------------------------------------------------------
# D) Normalized Exemplar (virtual by default)
# ------------------------------------------------------------

normalized_exemplar:
  default_mode: "virtual"     # affects style map only, not the slide
  apply_to_slide_requires_explicit_action: true

  allowlist_ops_v1:
    - REMOVE_GHOST_OBJECTS_STRICT
    - MICRO_SNAP_GEOMETRY
    - UNIFY_ROLE_FONT_FAMILY
    - UNIFY_ROLE_FONT_COLOR
    - NORMALIZE_BULLET_INDENT_AND_SPACING
    - NORMALIZE_LANGUAGE_TAGS

  guardrails:
    micro_snap:
      only_if_delta_leq_pt: 0.5
    unify_role_tokens:
      only_if_minor_deviations_leq_char_ratio: 0.10
      preserve_emphasis:
        keep_bold_italic_differences: true
    reject_if:
      - causes_overflow
      - changes_geometry_large
      - touches_masters_or_layouts
      - breaks_groups

# ------------------------------------------------------------
# E) Rule schema (v1)
# ------------------------------------------------------------

rule_schema_v1:
  required_fields:
    - id
    - title
    - source                         # exemplar|playbook|continuity
    - applies_to                     # roles or SLIDE/DECK/ALL_OBJECTS
    - detect                         # deterministic predicate on inspectable properties
    - expected                        # where expected comes from (styleMap/palette/etc.)
    - evidence_types
    - confidence_gates               # role_conf, expected_conf, inspectability_conf
    - severity                       # info|warn|error
    - risk                           # safe|caution|manual
    - suggested_patch_ops            # typed ops OR none
    - not_analyzed_behavior          # emit NOT_ANALYZED + reason when gates fail

confidence_model:
  combine: "min"                     # conservative: confidence = min(gates)
  gates:
    role_confidence_min:
      safe: 0.90
      caution: 0.90
      manual: 0.70
    expected_confidence_min:
      safe: 0.85
      caution: 0.85
      manual: 0.70
    inspectability_confidence_min:
      safe: 0.90
      caution: 0.90
      manual: 0.70

validation_hooks_v1:
  - no_overflow_after_change
  - no_reflow_material_change        # conservative; if unavailable -> VALIDATION_UNAVAILABLE
  - target_precondition_matches

# ------------------------------------------------------------
# F) Rules (v1)
# ------------------------------------------------------------

rules:

# =========================
# F1) Typography (role map)
# =========================

  - id: BP-TYPO-001
    title: Role font family must match Role Style Map
    source: exemplar
    applies_to: [TITLE, SUBTITLE, BODY, BULLET_L1, BULLET_L2, FOOTER, CALLOUT]
    detect: token.dominantRun.fontFamily != expected.styleMap[role].fontFamily
    expected:
      from: style_map
      key: fontFamily
    evidence_types: [EXEMPLAR_EVIDENCE, TYPOGRAPHIC_EVIDENCE]
    confidence_gates:
      role_confidence: ">=0.90"
      expected_confidence: ">=0.85"
      inspectability_confidence: ">=0.90"
      additional:
        - "expected.styleMap[role].exists"
    severity: error
    risk: safe
    suggested_patch_ops:
      - op: SET_FONT_FAMILY
        fields: { fontFamily: "expected.styleMap[role].fontFamily" }
    not_analyzed_behavior:
      when:
        - "role_confidence < 0.90"
        - "!expected.styleMap[role].exists"
        - "inspectability_confidence < 0.90"
      emit: { state: NOT_ANALYZED, reason_code: MISSING_STYLEMAP_ROLE }

  - id: BP-TYPO-002
    title: Role font style (bold/italic) must match Role Style Map
    source: exemplar
    applies_to: [TITLE, SUBTITLE, BODY, BULLET_L1, BULLET_L2, FOOTER, CALLOUT]
    detect: token.dominantRun.bold != expected.styleMap[role].bold OR token.dominantRun.italic != expected.styleMap[role].italic
    expected: { from: style_map, key: "fontStyle" }
    evidence_types: [EXEMPLAR_EVIDENCE, TYPOGRAPHIC_EVIDENCE]
    confidence_gates: { role_confidence: ">=0.90", expected_confidence: ">=0.85", inspectability_confidence: ">=0.90" }
    severity: warn
    risk: safe
    suggested_patch_ops:
      - op: SET_FONT_STYLE
        fields: { bold: "expected.styleMap[role].bold", italic: "expected.styleMap[role].italic" }
    not_analyzed_behavior:
      when: ["role_confidence < 0.90", "inspectability_confidence < 0.90"]
      emit: { state: NOT_ANALYZED, reason_code: LOW_ROLE_CONFIDENCE }

  - id: BP-TYPO-003
    title: Role font size must match within tolerance (validated)
    source: exemplar
    applies_to: [TITLE, SUBTITLE, BODY, BULLET_L1, BULLET_L2, FOOTER, CALLOUT]
    defaults:
      tolerancePt_by_role:
        TITLE: 0.5
        SUBTITLE: 0.5
        BODY: 1.0
        BULLET_L1: 1.0
        BULLET_L2: 1.0
        FOOTER: 0.5
        CALLOUT: 1.0
    detect: abs(token.dominantRun.fontSizePt - expected.styleMap[role].fontSizePt) > tolerancePt_by_role[role]
    expected: { from: style_map, key: fontSizePt }
    evidence_types: [EXEMPLAR_EVIDENCE, TYPOGRAPHIC_EVIDENCE]
    confidence_gates:
      role_confidence: ">=0.90"
      expected_confidence: ">=0.85"
      inspectability_confidence: ">=0.90"
      additional:
        - "!token.autofit.enabled"
    severity: warn
    risk: caution
    suggested_patch_ops:
      - op: SET_FONT_SIZE
        fields: { fontSizePt: "expected.styleMap[role].fontSizePt" }
        validations: [no_overflow_after_change]
    not_analyzed_behavior:
      when:
        - "token.autofit.enabled"
      emit: { state: NOT_ANALYZED, reason_code: AUTOFIT_PRESENT }

  - id: BP-TYPO-004
    title: No mixed font families inside a single role-assigned text box (paste artifact)
    source: playbook
    applies_to: [TITLE, SUBTITLE, BODY, BULLET_L1, BULLET_L2, FOOTER, CALLOUT]
    detect: count(distinct(token.textRuns.fontFamily)) > 1
    expected: { from: playbook, key: "single_family_per_role_box" }
    evidence_types: [PLAYBOOK_EVIDENCE, TYPOGRAPHIC_EVIDENCE]
    confidence_gates: { role_confidence: ">=0.80", expected_confidence: ">=0.70", inspectability_confidence: ">=0.85" }
    severity: warn
    risk: manual
    suggested_patch_ops: []
    assistive_suggestion:
      offer_patch_if:
        - "minority_family_char_ratio <= 0.10"
      patch:
        - op: SET_FONT_FAMILY
          scope: "minority_runs_only"
          fields: { fontFamily: "expected.styleMap[role].fontFamily" }

  - id: BP-TYPO-005
    title: Body and bullets line spacing must match Role Style Map (validated)
    source: exemplar
    applies_to: [BODY, BULLET_L1, BULLET_L2]
    defaults:
      toleranceRelative: 0.02
    detect: abs(token.paragraph.lineSpacing - expected.styleMap[role].lineSpacing) / expected.styleMap[role].lineSpacing > toleranceRelative
    expected: { from: style_map, key: lineSpacing }
    evidence_types: [EXEMPLAR_EVIDENCE, TYPOGRAPHIC_EVIDENCE]
    confidence_gates:
      role_confidence: ">=0.90"
      expected_confidence: ">=0.85"
      inspectability_confidence: ">=0.90"
      additional:
        - "!token.autofit.enabled"
    severity: info
    risk: caution
    suggested_patch_ops:
      - op: SET_LINE_SPACING
        fields: { lineSpacing: "expected.styleMap[role].lineSpacing" }
        validations: [no_overflow_after_change]
    not_analyzed_behavior:
      when: ["token.autofit.enabled"]
      emit: { state: NOT_ANALYZED, reason_code: AUTOFIT_PRESENT }

# ==========
# F2) Color
# ==========

  - id: BP-COLOR-001
    title: Role font color must match Role Style Map (palette-mapped)
    source: exemplar
    applies_to: [TITLE, SUBTITLE, BODY, BULLET_L1, BULLET_L2, FOOTER, CALLOUT]
    detect: !color_equivalent(token.dominantRun.fontColor, expected.styleMap[role].fontColor, palette)
    expected: { from: style_map, key: fontColor }
    evidence_types: [EXEMPLAR_EVIDENCE, TYPOGRAPHIC_EVIDENCE]
    confidence_gates: { role_confidence: ">=0.90", expected_confidence: ">=0.85", inspectability_confidence: ">=0.90" }
    severity: warn
    risk: safe
    suggested_patch_ops:
      - op: SET_FONT_COLOR
        fields: { fontColor: "expected.styleMap[role].fontColor" }

  - id: BP-COLOR-002
    title: Avoid semi-transparent text (alpha < 1.0)
    source: playbook
    applies_to: [TITLE, SUBTITLE, BODY, BULLET_L1, BULLET_L2, FOOTER, CALLOUT]
    detect: token.dominantRun.fontAlpha < 1.0
    expected: { from: playbook, key: "fontAlpha == 1.0" }
    evidence_types: [PLAYBOOK_EVIDENCE, HYGIENE_EVIDENCE]
    confidence_gates: { role_confidence: ">=0.80", expected_confidence: ">=0.70", inspectability_confidence: ">=0.85" }
    severity: info
    risk: manual
    suggested_patch_ops: []
    exemplar_normalization_override:
      exemplar_only_patch:
        - op: SET_FONT_COLOR
          fields: { fontColor: "expected.styleMap[role].fontColor", fontAlpha: 1.0 }

  - id: BP-COLOR-003
    title: Restrict CALLOUT shape fills to derived palette (if defined)
    source: playbook
    applies_to: [CALLOUT]
    detect: palette.isDefined AND !palette.contains(shape.fillColor)
    expected: { from: palette, key: "shape.fillColor in palette" }
    evidence_types: [PLAYBOOK_EVIDENCE]
    confidence_gates: { role_confidence: ">=0.70", expected_confidence: ">=0.70", inspectability_confidence: ">=0.85" }
    severity: info
    risk: manual
    suggested_patch_ops: []

# ============
# F3) Bullets
# ============

  - id: BP-BULLET-001
    title: Bullet indent and hanging must match Role Style Map (validated if tight box)
    source: exemplar
    applies_to: [BULLET_L1, BULLET_L2]
    detect: paragraph.bulletIndent != expected.styleMap[role].bulletIndent OR paragraph.bulletHanging != expected.styleMap[role].bulletHanging
    expected: { from: style_map, key: bulletIndentAndHanging }
    evidence_types: [EXEMPLAR_EVIDENCE, STRUCTURAL_EVIDENCE]
    confidence_gates: { role_confidence: ">=0.90", expected_confidence: ">=0.85", inspectability_confidence: ">=0.90" }
    severity: warn
    risk: safe
    suggested_patch_ops:
      - op: SET_BULLET_INDENT
        fields: { indent: "expected.styleMap[role].bulletIndent", hanging: "expected.styleMap[role].bulletHanging" }
        validations_optional:
          - no_overflow_after_change   # run when box has low slack (implementation detail)

  - id: BP-BULLET-002
    title: Bullet glyph must match Role Style Map (or be NOT_ANALYZED)
    source: exemplar
    applies_to: [BULLET_L1, BULLET_L2]
    detect: bulletGlyph.detectable AND paragraph.bulletGlyph != expected.styleMap[role].bulletGlyph
    expected: { from: style_map, key: bulletGlyph }
    evidence_types: [EXEMPLAR_EVIDENCE, STRUCTURAL_EVIDENCE]
    confidence_gates: { role_confidence: ">=0.90", expected_confidence: ">=0.85", inspectability_confidence: ">=0.90" }
    severity: info
    risk: safe
    suggested_patch_ops:
      - op: SET_BULLET_INDENT
        fields: { glyph: "expected.styleMap[role].bulletGlyph" }
    not_analyzed_behavior:
      when: ["!bulletGlyph.detectable"]
      emit: { state: NOT_ANALYZED, reason_code: API_LIMITATION }

# =========================
# F4) Layout (detection-first)
# =========================

  - id: BP-LAYOUT-001
    title: Titles should live in the exemplar title band (detection-only)
    source: exemplar
    applies_to: [TITLE]
    defaults: { tolerancePt: 6 }
    detect: expected.styleMap[TITLE].hasGeometryCluster AND distance(box, expected.styleMap[TITLE].geometryCentroid) > tolerancePt
    expected: { from: style_map, key: geometryBand }
    evidence_types: [EXEMPLAR_EVIDENCE, GEOMETRIC_EVIDENCE]
    confidence_gates: { role_confidence: ">=0.90", expected_confidence: ">=0.85", inspectability_confidence: ">=0.90" }
    severity: info
    risk: manual
    suggested_patch_ops: []   # no geometry nudges in v1

  - id: BP-LAYOUT-002
    title: Footer should live in the exemplar footer band (detection-only)
    source: exemplar
    applies_to: [FOOTER]
    defaults: { tolerancePt: 6 }
    detect: expected.styleMap[FOOTER].hasGeometryCluster AND abs(box.top - expected.styleMap[FOOTER].topMedian) > tolerancePt
    expected: { from: style_map, key: geometryBand }
    evidence_types: [EXEMPLAR_EVIDENCE, GEOMETRIC_EVIDENCE]
    confidence_gates: { role_confidence: ">=0.90", expected_confidence: ">=0.85", inspectability_confidence: ">=0.90" }
    severity: info
    risk: manual
    suggested_patch_ops: []

  - id: BP-LAYOUT-003
    title: Micro-snap geometry fractions on exemplar (normalization-only)
    source: playbook
    applies_to: [TITLE, SUBTITLE, BODY, BULLET_L1, BULLET_L2, FOOTER, CALLOUT]
    detect: exemplar_only AND has_micro_fractions(box) AND micro_snap_delta_pt <= 0.5
    expected: { from: playbook, key: "whole_point_geometry" }
    evidence_types: [PLAYBOOK_EVIDENCE]
    confidence_gates: { role_confidence: ">=0.80", expected_confidence: ">=0.70", inspectability_confidence: ">=0.90" }
    severity: info
    risk: safe
    suggested_patch_ops:
      - op: MOVE_GEOMETRY
        mode: "micro_snap"
        guardrail: "delta<=0.5pt"
    not_analyzed_behavior:
      when: ["!exemplar_only"]
      emit: { state: NOT_ANALYZED, reason_code: EXPECTED_CONFIDENCE_LOW }

# =============
# F5) Hygiene
# =============

  - id: BP-HYGIENE-001
    title: Ghost objects (invisible blockers) must not exist
    source: playbook
    applies_to: [ALL_OBJECTS]
    # Strict ghost definition (safe delete):
    # - visually invisible (fillAlpha==0 AND lineAlpha==0 AND textAlpha==0) OR visible==false
    # - AND has non-trivial bounds
    # - AND sits above at least one visible object (z-order) OR overlaps key content area
    detect: is_invisible(shape) AND box.area > minArea AND overlaps_visible_content AND zIndex_high
    expected: { from: playbook, key: "no_invisible_blockers" }
    evidence_types: [PLAYBOOK_EVIDENCE, HYGIENE_EVIDENCE]
    confidence_gates: { role_confidence: ">=0.70", expected_confidence: ">=0.70", inspectability_confidence: ">=0.90" }
    severity: warn
    risk: safe
    suggested_patch_ops:
      - op: DELETE_GHOST_OBJECT
        fields: { delete: true }
    not_analyzed_behavior:
      when: ["inspectability_confidence < 0.90"]
      emit: { state: NOT_ANALYZED, reason_code: API_LIMITATION }

  - id: BP-HYGIENE-002
    title: Stray off-slide objects should be reviewed (not auto-deleted)
    source: playbook
    applies_to: [ALL_OBJECTS]
    detect: box.right < 0 OR box.bottom < 0 OR box.left > slide.width OR box.top > slide.height
    expected: { from: playbook, key: "no_stray_offslide" }
    evidence_types: [PLAYBOOK_EVIDENCE, HYGIENE_EVIDENCE]
    confidence_gates: { role_confidence: ">=0.70", expected_confidence: ">=0.70", inspectability_confidence: ">=0.90" }
    severity: info
    risk: manual
    suggested_patch_ops: []
    notes: "Off-slide can be intentional parking; never auto-delete in v1."

  - id: BP-HYGIENE-003
    title: No overlapping duplicate text boxes with identical normalized content
    source: playbook
    applies_to: [TITLE, SUBTITLE, BODY, BULLET_L1, BULLET_L2, FOOTER, CALLOUT]
    detect: exists otherBox where iou(box, otherBox) > 0.90 AND normalize(text)==normalize(otherText)
    expected: { from: playbook, key: "no_duplicate_overlap" }
    evidence_types: [PLAYBOOK_EVIDENCE, HYGIENE_EVIDENCE]
    confidence_gates: { role_confidence: ">=0.80", expected_confidence: ">=0.70", inspectability_confidence: ">=0.85" }
    severity: warn
    risk: manual
    suggested_patch_ops: []

  - id: BP-HYGIENE-004
    title: No leftover placeholder text
    source: playbook
    applies_to: [ALL_TEXT]
    detect: matches_any(text, ["Click to add", "Lorem ipsum", "Insert", "Subtitle"])
    expected: { from: playbook, key: "no_placeholder_text" }
    evidence_types: [PLAYBOOK_EVIDENCE, HYGIENE_EVIDENCE]
    confidence_gates: { role_confidence: ">=0.70", expected_confidence: ">=0.70", inspectability_confidence: ">=0.90" }
    severity: error
    risk: manual
    suggested_patch_ops: []

  - id: BP-HYGIENE-005
    title: Proofing language tags should be consistent (deck-level)
    source: playbook
    applies_to: [DECK]
    detect: count(distinct(textRuns.proofingLanguage)) > 1
    expected: { from: playbook, key: "single_proofing_language" }
    evidence_types: [PLAYBOOK_EVIDENCE, HYGIENE_EVIDENCE]
    confidence_gates: { role_confidence: ">=0.70", expected_confidence: ">=0.70", inspectability_confidence: ">=0.85" }
    severity: info
    risk: safe
    suggested_patch_ops:
      - op: NORMALIZE_LANGUAGE_TAGS
        fields: { proofingLanguage: "deck.dominantProofingLanguage" }

# ==================================
# F6) Continuity / reference integrity
# ==================================

  - id: BP-CONT-001
    title: Every slide must have a non-empty title OR be explicitly marked titleless
    source: continuity
    applies_to: [SLIDE]
    detect: title_text == "" AND !slide.markedTitleless
    expected: { from: continuity, key: "title_or_titleless_marker" }
    evidence_types: [REFERENTIAL_EVIDENCE]
    confidence_gates: { role_confidence: ">=0.70", expected_confidence: ">=0.80", inspectability_confidence: ">=0.90" }
    severity: warn
    risk: manual
    suggested_patch_ops: []
    ui_action: "Mark titleless (explicit exception)"

  - id: BP-CONT-002
    title: Agenda items must map to at least one slide title (definitions ↔ references)
    source: continuity
    applies_to: [DECK]
    detect: agenda.present AND exists agendaItem where !agendaItem.hasSlideMatch
    expected: { from: continuity, key: "agenda_maps_to_titles" }
    evidence_types: [REFERENTIAL_EVIDENCE]
    confidence_gates: { role_confidence: ">=0.70", expected_confidence: ">=0.80", inspectability_confidence: ">=0.90" }
    severity: warn
    risk: manual
    suggested_patch_ops: []
    notes: "Offer suggestions; do not auto-rename slides in v1."

  - id: BP-CONT-003
    title: Section header slides should use a consistent archetype (detection-only)
    source: continuity
    applies_to: [SLIDE]
    detect: slide.isSectionHeader AND slide.archetype != continuity.expectedSectionHeaderArchetype
    expected: { from: continuity, key: "section_header_archetype" }
    evidence_types: [REFERENTIAL_EVIDENCE]
    confidence_gates: { role_confidence: ">=0.70", expected_confidence: ">=0.70", inspectability_confidence: ">=0.85" }
    severity: info
    risk: manual
    suggested_patch_ops: []

# ==================================
# F7) Group / master safety (v1 rules)
# ==================================

  - id: BP-SAFETY-001
    title: Never break groups (v1)
    source: playbook
    applies_to: [ALL_OBJECTS]
    detect: object.isGrouped AND patch_would_break_group
    expected: { from: playbook, key: "never_break_groups" }
    evidence_types: [PLAYBOOK_EVIDENCE]
    confidence_gates: { role_confidence: ">=0.70", expected_confidence: ">=0.90", inspectability_confidence: ">=0.90" }
    severity: info
    risk: manual
    suggested_patch_ops: []
    not_analyzed_behavior:
      when: ["object.isGrouped AND requested_patch in [MOVE_GEOMETRY, RESIZE_GEOMETRY]"]
      emit: { state: NOT_ANALYZED, reason_code: GROUPED_OBJECT_UNSAFE }

  - id: BP-MASTERS-001
    title: Masters/layout hygiene is report-only in v1
    source: playbook
    applies_to: [DECK]
    detect: masters_or_layout_issues_detected
    expected: { from: playbook, key: "report_only_masters" }
    evidence_types: [PLAYBOOK_EVIDENCE, HYGIENE_EVIDENCE]
    confidence_gates: { role_confidence: ">=0.70", expected_confidence: ">=0.90", inspectability_confidence: ">=0.85" }
    severity: info
    risk: manual
    suggested_patch_ops: []
    notes: "Surface as findings; apply only via explicit command in a later version."

# ------------------------------------------------------------
# G) Exceptions + suppressions (audited)
# ------------------------------------------------------------

exceptions_model_v1:
  per_finding_actions:
    - ACCEPT_ONCE            # apply patch now
    - DISMISS_ONCE           # mark wrong; does not suppress rule globally
    - IGNORE_ONCE            # keep finding but ignore for this object/slide once
    - SUPPRESS_RULE          # deck-level suppression; rationale required

  suppression_record_required_fields:
    - rule_id
    - scope: "deck|slide_id|object_id"
    - author
    - timestamp
    - rationale

# ------------------------------------------------------------
# H) Default tolerances (v1)
# ------------------------------------------------------------

tolerances_v1:
  fontSizePt:
    TITLE: 0.5
    SUBTITLE: 0.5
    BODY: 1.0
    BULLET_L1: 1.0
    BULLET_L2: 1.0
    FOOTER: 0.5
    CALLOUT: 1.0
  positionPt: 6
  geometryMicroSnapDeltaPt: 0.5
  color_equivalence:
    mode: "theme_or_palette_or_exact_rgb"
    rgbExactFallback: true
