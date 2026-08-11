# HafezPlan — Phase 1

An intelligent semester course planner for university students. Phase 1 delivers the full working core: accounts, course data, eligibility, a real deterministic scheduling engine, iterative plan refinement, timetables, and exports — in Persian (default) and English with true RTL/LTR.

## Step 0 — Design directions

Before building, I'll generate several genuinely different rendered homepage directions (minimal academic, calendar-first, friendly student-focused, etc.) for you to pick from. The chosen direction's colors, type, spacing, and composition become the design system for the whole product.

## What gets built

**Accounts and data**
Sign in with email/password or Google. Every student's profile, academic history, imported course data, preferences, saved plans, and language choice are stored in the cloud database, isolated per account.

**Student profile and history**
Major, degree, semester, min/max credits, passed courses, current courses, must-take courses, courses to avoid, preferred professors/days/times, and personal blocked times. Nothing is mandatory; sensible defaults everywhere.

**Course data**
Courses, sections (professor, capacity, meetings, exam slot, location), and structured prerequisites supporting AND / OR / nested rules plus corequisites. Import via manual entry, JSON, and CSV in phase 1, with validation (duplicates, bad times/dates, unknown prerequisite references, missing fields) and a review-and-confirm step before anything reaches the engine. The importer is built as a pluggable provider layer so screenshot/AI import and Google Sheets slot in later without rework.

**Eligibility**
For every offered course: offered / already passed / currently taking / prerequisites met or not / eligible / uncertain / required. Plain-language reasons ("You already passed this course"), never guesses. Manual override allowed and stored separately from academic data.

**Scheduling engine (the core)**
Deterministic, independent of the UI, fully unit-tested. Hard constraints: credit limits, eligibility, prerequisites/corequisites, class-time overlaps, exam overlaps, blocked personal times, required courses, no duplicate courses. Back-to-back classes are fine — no travel buffers, no exam-fatigue logic, no waitlists. The search uses constraint propagation, pruning and backtracking with a hard cap of 100 candidate plans, near-duplicate removal, and diversity filtering. Plan count is always the real count: 0, 1, 3, 27 — never padded.

**Plan analysis and refinement**
After generation the app explains how the plans actually differ (professor, day, free day, section, class-day count, credit load) and offers only refinements that exist among the current candidates. Each choice re-solves and shows the new matching count; every choice is undoable. Zero-plan results explain the real blocking reason instead of showing an empty page.

**Results**
Plan cards with credits, class days, free days, key professor choices and match quality; side-by-side comparison of meaningful differences only; weekly timetable and separate exam timetable; a chosen "My Final Plan"; export to image-friendly view, CSV/Excel, ICS calendar, and print.

**Bilingual + RTL**
Persian by default with true RTL, English LTR, switchable anywhere and remembered across sessions. Direction handled by a shared layout system (logical properties, mirrored icons and arrows, direction-aware timetable and day ordering) rather than scattered alignment overrides — so repeated switching stays stable. Numbers, times, dates and course codes stay readable in both.

**Mobile-first**
Designed for phones first: one clear action per screen, big touch targets, swipeable plan browsing, sticky primary actions, progressive disclosure. Accessible contrast, labels, keyboard support, and status never conveyed by color alone.

**Sample data**
A fictional physics program seeded in the database: Electromagnetism I, Quantum Mechanics I, Thermodynamics I as required, plus Mathematical Physics, Physics Lab and general education — multiple professors, sections, days and exam slots so refinement and conflicts are demonstrable immediately.

## Deferred to phase 2 (architecture prepared, not built)

Screenshot/image import with AI extraction and conflict merging, the Gemini assistant and natural-language preferences, Google Calendar push, Google Drive and Google Sheets sources. The core app never depends on AI for correctness.

## Technical notes

- Lovable Cloud (Postgres + auth) with row-level security per user; grants and policies written per table.
- Scheduling engine as pure TypeScript modules under `src/lib/scheduling/` (eligibility, prerequisites, constraints, search, scoring, diversity, analysis) with no UI imports, exercised by a vitest suite covering conflicts, adjacency, credit limits, AND/OR/nested prerequisites, corequisites, multi-meeting courses, preference scoring, and the 0 / 1 / few / many / 100-cap cases.
- Plan generation runs client-side against confirmed data so refinement stays instant; heavy imports and privileged writes go through server functions.
- TanStack Start routes per step; i18n and direction context in a single provider driving `dir` on the document.

## Verification before completion

Run the whole flow end-to-end, check the engine tests pass, confirm the 100-plan cap and duplicate filtering, exercise zero/one/few/many-plan cases, switch Persian↔English repeatedly on every screen looking for layout breakage, test phone and desktop widths, and test each export.
