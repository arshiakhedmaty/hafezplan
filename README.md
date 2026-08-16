# hafez plan

Build a polished, production-quality web application called HafezPlan.

HafezPlan is an intelligent university course-planning application designed primarily for university students. Its purpose is to analyze the courses a student is actually eligible to take, consider required courses, prerequisites, class sections, professors, class times, exam times, credit limits, and personal preferences, and then generate a small set of meaningful, valid semester plans.

The application must feel simple enough for a first-time university student, while the underlying scheduling engine must be robust and deterministic.

This is NOT a chatbot-only product and NOT a fake scheduling demo.

Build a real application with a real database, real validation, real scheduling logic, and a polished mobile-first interface.

==================================================

PRODUCT NAME AND IDENTITY
==================================================

Product name:

HafezPlan

The product should feel:

Intelligent

Reliable

Academic

Modern

Calm

Student-friendly

Professional

Create a simple, memorable visual identity and wordmark for HafezPlan.

Avoid an overly corporate or overly childish appearance.

==================================================
2. PRIMARY PRODUCT GOAL

A student should be able to use HafezPlan to answer:

"What is the best realistic semester schedule I can build from the courses I am actually allowed to take?"

The application must do the difficult work automatically.

The student should NOT have to manually inspect dozens of timetable combinations.

HafezPlan should:

Understand the student's academic status.

Understand what courses the university is offering.

Determine which offered courses the student is actually eligible to take.

Identify required courses.

Analyze possible sections and professors.

Respect all hard scheduling constraints.

Generate valid candidate schedules.

Analyze how those schedules differ.

Let the student choose what characteristics matter most.

Recalculate/refine the valid schedules.

Show a small number of meaningful alternatives.

Let the student select and export a final plan.

==================================================
3. IMPORTANT PRODUCT PRINCIPLE

Do NOT force the application to produce a fixed number of plans.

The number of plans must be dynamic.

Examples:

1 valid plan → show 1.

2 valid plans → show 2.

7 valid plans → show 7.

25 valid plans → analyze them and present the most meaningful alternatives.

100+ possible valid schedules → do not expose more than 100 candidate plans to the plan-analysis layer.

The absolute candidate limit is:

MAX_CANDIDATE_PLANS = 100

Never create fake plans simply to reach 100.

Never overwhelm the user with hundreds or thousands of nearly identical schedules.

==================================================
4. IMPORTANT PERFORMANCE REQUIREMENT

The mathematical solution space may be much larger than the number of plans we display.

Do NOT generate millions of complete schedules just to analyze them.

Use efficient scheduling techniques such as:

Constraint propagation

Early pruning

Backtracking

Branch-and-bound

Incremental scoring

Candidate limits

Diversity filtering

Search the solution space intelligently.

Keep at most 100 strong and meaningfully different candidate plans available to the refinement/analysis layer.

The UI must remain responsive.

==================================================
5. TARGET USERS

The primary users are university students, especially students who may not be technically sophisticated.

The interface should assume that a student may open the app for the first time and think:

"What do I do now?"

The application must answer that question immediately.

==================================================
6. FIRST-TIME USER EXPERIENCE

The homepage should be simple and focused.

Do NOT show a giant enterprise dashboard full of statistics.

The first screen should clearly communicate:

What HafezPlan does

What the student needs to provide

What the app will do

Use one obvious primary action such as:

"Start Planning"

or the Persian equivalent when Persian is selected.

The initial journey should feel like:

Academic Information
→ Available Courses
→ Preferences
→ Find Plans
→ Choose a Plan

Do not ask for every possible setting at the beginning.

Use progressive disclosure.

Only show more advanced settings when relevant.

==================================================
7. SIMPLE STUDENT-FRIENDLY LANGUAGE

Avoid technical terminology in the UI.

Do NOT show terms like:

"Constraint Satisfaction"
"Optimization Engine"
"Eligibility Resolver"
"Candidate Solution Space"

Instead use language such as:

"Which courses can you take?"
"What do you want to avoid?"
"Find my plans"
"Your valid plans"
"Why can't I take this course?"

The interface should feel like a helpful university planning assistant, not engineering software.

==================================================
8. FULL BILINGUAL SUPPORT

The application must support EXACTLY TWO languages:

Persian (Farsi)

English

Do not add additional languages.

Add an easy-to-find language switcher:

فارسی | English

The selected language must persist after refresh and when the user returns later.

The selected language must affect the entire interface:

Navigation

Buttons

Forms

Headings

Help text

Validation messages

Errors

Loading states

Empty states

Plan explanations

Settings

Dialogs

Course details

Import screens

Export screens

Onboarding

Preference options

Do not leave random untranslated strings.

==================================================
9. ROBUST RTL / LTR ARCHITECTURE

This is a critical requirement.

Do NOT simply translate the text and change text-align.

Implement a proper direction-aware layout architecture.

Persian mode must use true RTL.

English mode must use true LTR.

When switching language:

English → Persian
and
Persian → English

the entire layout must switch correctly.

RTL/LTR must correctly affect:

Navigation

Flex layouts

Grid layouts

Sidebar placement

Cards

Forms

Breadcrumbs

Tables

Timetables

Tabs

Modals

Dialogs

Buttons

Icon positioning

Directional arrows

Spacing

Responsive behavior

Animations

Directional icons should be mirrored where appropriate.

Numbers, dates, times, course codes, instructor names, and technical identifiers must remain readable and logically ordered.

Do not manually hard-code dozens of separate RTL alignment rules.

Use a reusable direction-aware design system / layout architecture.

Test repeated switching between:

English → Persian → English → Persian

and fix any layout issues.

The Persian version should look intentionally designed for Persian users, not like a broken mirrored English version.

==================================================
10. MOBILE-FIRST DESIGN

Design primarily for smartphones.

The app should feel like a modern mobile product even when accessed from a desktop browser.

Prioritize:

Large touch targets

Simple navigation

One clear primary action per screen

Short readable text

Swipe-friendly plan browsing

Clear cards

Clean timetable

Good spacing

Sticky actions where useful

Do not make a desktop dashboard and simply squeeze it onto mobile.

==================================================
11. DESIGN DIRECTION

Use a modern, clean, academic design with strong hierarchy.

Prefer:

Clear typography

Simple cards

Moderate whitespace

Strong primary action

Minimal decoration

Consistent spacing

Calm visual hierarchy

Avoid:

Excessive gradients

Too many colors

Excessive animations

Giant dashboard sections

Huge numbers and metrics

Visual clutter

Overly complex enterprise-dashboard layouts

IMPORTANT:

Before committing to the final visual style, show several genuinely different design directions for the homepage/dashboard.

Preferably provide 5–8 distinct options if the environment supports visual exploration.

Examples:

Minimal academic

Modern productivity

Premium technology

Clean university style

Friendly student-focused

Calendar-first

Information-focused

Soft modern

These must be meaningfully different, not slight color variations.

Let the user choose the preferred direction before applying it across the product.

==================================================
12. MAIN USER FLOW

The primary flow should be:

Welcome

Student profile

Academic history

Required courses

Available courses

Review eligibility

Preferences

Generate plans

Analyze plans

Refine plans

Compare plans

Select final plan

View weekly timetable

View exam timetable

Export

==================================================
13. STUDENT PROFILE

Allow the student to store:

Major

Degree

Current semester

Maximum credits

Minimum credits

Preferred credit range

Passed courses

Courses currently being taken

Required next-semester courses

Courses to avoid

Preferred professors

Preferred days

Preferred class times

Personal hard-unavailable times

Do not require all fields.

Use sensible defaults.

==================================================
14. ACADEMIC HISTORY

Support:

Passed courses

Current courses

Previously failed courses

Courses that may be repeated

The student should be able to search and select courses easily.

==================================================
15. REQUIRED COURSES

Allow the student to mark courses as:

"Must take next semester"

Example:

Electromagnetism I

Quantum Mechanics I

Thermodynamics I

These should be treated as hard requirements unless the student explicitly removes them.

Required courses must still pass eligibility validation.

If a required course is not eligible, explain why.

==================================================
16. UNIVERSITY COURSE DATA

The university may publish next-semester offerings shortly before registration.

HafezPlan should allow importing this information.

Support:

Screenshot/image upload

JSON

CSV

Manual entry

The architecture must allow future additional data providers.

==================================================
17. SCREENSHOT / IMAGE IMPORT

Allow students to upload screenshots of the university registration system.

Use available multimodal AI capabilities to extract:

Course code

Course name

Credits

Professor/instructor

Section

Class days

Class start time

Class end time

Exam date

Exam start time

Exam end time

Capacity

Location if visible

Support both Persian and English information.

IMPORTANT:

AI extraction is NOT automatically trusted.

The extraction flow must be:

Upload
→ Extract
→ Review
→ Edit
→ Validate
→ Confirm
→ Save

Show detected information in an editable review interface.

Clearly highlight uncertain fields.

Allow:

Edit

Delete

Add missing course

Add missing section

Confirm all data

Only confirmed and validated information may enter the scheduling engine.

==================================================
18. MULTIPLE SCREENSHOTS

Allow multiple screenshots to be uploaded.

Merge extracted data.

Detect duplicate or overlapping information.

If two screenshots contain contradictory data, show the conflict and ask the user to resolve it.

Do not silently overwrite data.

==================================================
19. COURSE DATA MODEL

Create structured entities for:

Course

Course fields should include:

Course ID

Course code

Name

Persian name

English name

Credits

Department

Course type

Repeatability

==================================================
20. COURSE SECTION DATA MODEL

Each course may have multiple sections.

A section should contain:

Section ID

Course ID

Section name/number

Professor

Capacity

Meetings

Exam information

Location if available

Treat each section as a separate scheduling choice.

Example:

Chemistry Section A
Professor A
Saturday 09:00–11:00
Monday 09:00–11:00

Chemistry Section B
Professor B
Sunday 13:00–15:00
Tuesday 13:00–15:00

==================================================
21. PREREQUISITE SYSTEM

Create a deterministic structured prerequisite engine.

Support:

Single prerequisites

AND conditions

OR conditions

Nested AND/OR conditions

Corequisites

Minimum grade requirements where available

Examples:

A

A AND B

A OR B

(A AND B) OR C

Do not depend on natural-language interpretation during scheduling.

Prerequisite rules must be stored structurally.

==================================================
22. COURSE ELIGIBILITY

The university may show courses that the student has already passed.

Therefore:

"Offered" does NOT mean "eligible".

For every offered course determine:

Offered

Already passed

Currently being taken

Prerequisites satisfied

Corequisites satisfied

Eligible

Not eligible

Uncertain

Required

Optional

Examples:

Chemistry I
✓ Offered
✕ Already passed

Quantum Mechanics I
✓ Offered
✓ Eligible
★ Required

Quantum Mechanics II
✓ Offered
✕ Prerequisite not completed

If information is missing, do not guess.

Show:

"Eligibility uncertain because prerequisite information is incomplete."

Allow explicit manual override for uncertain results.

Store the override separately from the underlying academic data.

==================================================
23. ELIGIBILITY REVIEW SCREEN

Create a simple student-friendly eligibility page.

Each course should clearly show:

Status

Reason

Required/optional

Credits

Use understandable labels.

Example:

✓ You can take this course.

✕ You cannot take this course because you already passed it.

⚠ We cannot verify this course because prerequisite information is missing.

==================================================
24. HARD CONSTRAINTS

The following are HARD constraints:

Maximum credits

Required course eligibility

Prerequisites

Corequisites

Class-time conflicts

Exam-time conflicts

Course availability

Personal hard-unavailable times

Mandatory university rules

Duplicate-course restrictions

A schedule violating a hard constraint is INVALID.

==================================================
25. CLASS CONFLICTS

Two selected classes must not overlap.

Example:

11:00–13:00
+
11:00–13:00
= INVALID

11:00–13:00
+
12:00–14:00
= INVALID

11:00–13:00
+
13:00–15:00
= VALID

No travel-time buffer is required.

==================================================
26. IMPORTANT: NO TRAVEL-TIME OPTIMIZATION

Do NOT model:

Walking time

Building travel time

Campus navigation time

5-minute buffer

10-minute buffer

15-minute buffer

20-minute buffer

Distance between classes

The target environment is a compact university campus where moving between classes is not considered a scheduling problem.

Back-to-back classes are acceptable.

==================================================
27. EXAM CONFLICTS

Two selected courses must not have overlapping exams.

However, do NOT optimize for:

Exam fatigue

Recovery time

Mandatory rest periods

Emotional fatigue

Preferred exam spacing

The important exam information is:

Exam date

Exam start time

Exam end time

Professor if relevant

Location if available

Exam schedule should be accurate and clearly displayed.

==================================================
28. CAPACITY

Display course capacity when available.

Example:

Professor A
Capacity: 35

However, do NOT implement waitlists.

Do not implement:

Waitlist management

Seat reservation

Waitlist optimization

Probability of getting a seat

The student will choose among available plans.

Keep capacity data modular so future versions can add more advanced registration features.

==================================================
29. IMPORTANT: NO WAITLIST IN THIS VERSION

Do not include waitlists anywhere in the current product.

Design the architecture so it can be added in a future update, but do not implement it now.

==================================================
30. SOFT PREFERENCES

Support optional preferences such as:

Preferred professor

Preferred section

Preferred day

Preferred time

Preferred free day

Preferred number of class days

Preferred credit range

Avoiding a specific day

Avoiding early classes

Avoiding late classes

These preferences affect ranking or refinement.

They must never override hard constraints.

==================================================
31. NATURAL PREFERENCE INPUT

Allow the student to optionally write natural-language preferences.

Examples:

"I want Chemistry on Wednesday."

"I definitely want Professor X for Quantum Mechanics."

"I don't want classes on Saturday."

Gemini may interpret this into structured preferences.

But the resulting preference must be validated and converted into a deterministic rule before the scheduling engine uses it.

==================================================
32. PROFESSOR PREFERENCE

Professor selection is a high-value preference.

The system should be able to identify cases where candidate plans differ because of professor selection.

Example:

"Your plans mainly differ because of the Chemistry professor."

Show:

[Professor A]
[Professor B]

The student can choose a preference.

Do not automatically assume that one professor is better than another unless the user explicitly indicates it.

==================================================
33. DYNAMIC PLAN GENERATION

Build a deterministic scheduling engine.

The engine should:

Load student data.

Load university data.

Remove already-passed courses.

Evaluate prerequisites.

Evaluate corequisites.

Identify required courses.

Generate eligible section choices.

Apply hard constraints.

Reject class conflicts.

Reject exam conflicts.

Reject credit violations.

Apply hard personal restrictions.

Score soft preferences.

Search efficiently.

Keep at most 100 strong candidates.

Remove near-duplicates.

Rank them.

Analyze meaningful differences.

Do NOT ask Gemini to invent schedules.

Scheduling correctness must come from deterministic code.

==================================================
34. PLAN LIMIT AND DIVERSITY

Expose no more than 100 candidate plans.

If more than 100 mathematically valid schedules exist:

Keep only strong candidates.

Remove near-duplicates.

Prefer meaningful diversity.

Rank the remaining candidates.

Two plans that are almost identical should not be treated as two highly distinct plans.

Meaningful differences include:

Professor

Section

Course day

Course time

Free day

Number of class days

Course distribution

Credit load

==================================================
35. PLAN ANALYSIS

When multiple valid plans exist, automatically analyze how they differ.

Example:

"18 valid plans found."

"These plans mainly differ in:"

[ Chemistry professor ]
[ Chemistry day ]
[ Wednesday free ]
[ Fewer class days ]
[ Physics section ]

Only show differences that actually exist among the current candidate plans.

Do NOT show irrelevant preference choices.

If every plan already has Wednesday free, do not offer "Wednesday free" as a refinement option.

==================================================
36. ITERATIVE PLAN REFINEMENT

The student should be able to progressively refine the results.

Example:

18 plans
→ Select Chemistry with Professor A
→ 9 plans

→ Select Wednesday free
→ 4 plans

→ Prefer no classes before 10:00
→ 2 plans

Always show the current number of matching plans.

The preference must actually modify the scheduling problem or ranking.

Do not merely hide old plans from the UI.

The user should be able to undo any preference.

==================================================
37. FEW-PLAN EXPERIENCE

If there are only 1–3 valid plans:

Do not force a complicated refinement workflow.

Simply show the available plans clearly.

Examples:

"1 valid plan found."

"2 valid plans found."

"3 valid plans found."

If only one valid plan exists, explain why it is the only valid solution.

==================================================
38. ZERO-PLAN EXPERIENCE

If no valid schedule exists, do not show an empty page.

Show the actual blocking reason.

Examples:

"No valid schedule can include all three required courses because their class times conflict."

"Your required courses already use 21 credits, but your maximum is 20."

"Quantum Mechanics II requires Quantum Mechanics I, which has not been completed."

Do not silently change the user's hard constraints.

Provide a clear option to return to the previous refinement state.

==================================================
39. PLAN CARDS

Each plan should have a concise summary.

Display:

Plan number/name

Total credits

Number of class days

Free days

Key professor choices

Preference match

Important differences

Overall score/rank if useful

Example:

PLAN 1 — Best Match

20 credits
4 class days
Wednesday free
Chemistry with Professor A

PLAN 2 — Professor Preference

20 credits
4 class days
Chemistry with Professor B
Monday free

PLAN 3 — Lighter Week

18 credits
3 class days
Wednesday and Friday free

The summaries must be generated from real plan data.

==================================================
40. WEEKLY TIMETABLE

Create a clean weekly timetable.

Support:

Saturday

Sunday

Monday

Tuesday

Wednesday

Thursday

Friday if required

Each class card should show:

Course name

Course code

Professor

Section

Start/end time

Location if available

The timetable must work correctly in both:

Persian RTL

English LTR

Be careful with day ordering, directional navigation, and time display.

==================================================
41. EXAM TIMETABLE

Provide a separate exam timetable.

Show:

Course

Professor

Date

Start time

End time

Location

Do not include fatigue/rest recommendations.

==================================================
42. PLAN COMPARISON

Create a clear comparison experience.

Compare:

Total credits

Class days

Free days

Professors

Sections

Important time differences

Early/late classes

Gaps

Exam schedule

Preference match

Highlight only meaningful differences.

Avoid overwhelming the student.

==================================================
43. FINAL PLAN

Allow the student to choose one plan as:

"My Final Plan"

Then show:

Weekly timetable

Course list

Professors

Sections

Class locations

Exam timetable

Total credits

Important warnings

==================================================
44. EXPORT

Allow the student to export the selected plan.

Support:

Screenshot-friendly image

CSV

Excel-compatible format

ICS calendar

Print-friendly version

If multiple plans exist, allow the student to select multiple plans for export.

Example:

✓ Plan 1
✓ Plan 2
✓ Plan 3

[Export Selected]

The export must use confirmed plan data.

Do not export AI guesses.

==================================================
45. GOOGLE CALENDAR

Provide Google Calendar integration as a future-ready integration and, where the available stack supports it cleanly, allow the selected final plan to be added to Google Calendar.

Calendar events should include:

Course name

Professor

Time

Day/date

Location if available

Also support exam events.

Never invent dates or times.

==================================================
46. GOOGLE DRIVE

Design the data architecture so Google Drive can later be used for:

Course-data files

Imported CSV/JSON files

Uploaded screenshots

Exported plans

Do not use Google Drive as the primary application database.

==================================================
47. GOOGLE SHEETS

Design the architecture so Google Sheets can later be used as an optional data source for university course offerings.

Example:

Admin/course manager maintains:

Course
Professor
Section
Capacity
Day
Start
End
Exam

The application may later synchronize or import this structured data.

Do not make Google Sheets mandatory for the first version.

==================================================
48. DATABASE AND AUTHENTICATION

Use a proper persistent database and authentication system.

Store:

User profile

Academic history

Passed courses

Required courses

Preferences

Imported university data

Saved plans

Final selected plan

Language preference

Do not rely only on browser memory/local state.

Keep user data isolated between accounts.

The architecture must make it easy to add more university data later.

==================================================
49. GEMINI CHAT / AI ASSISTANT

Include an optional Gemini-powered assistant inside HafezPlan.

IMPORTANT:

Gemini is the assistant, NOT the scheduling authority.

Gemini may help with:

Understanding natural-language preferences

Explaining why a course is unavailable

Explaining why a plan is good

Summarizing plan differences

Cleaning or structuring imported information

Reading screenshots

Answering questions about the user's existing plans

Example:

Student:
"I want Chemistry with Professor A and I don't want Saturday classes."

Gemini:
Convert this into structured preferences.

Scheduling Engine:
Evaluate the preferences deterministically.

Student:
"Why can't I take Quantum Mechanics II?"

Gemini:
Explain using real eligibility/prerequisite data.

Do not allow Gemini to invent schedules or override hard constraints.

==================================================
50. AI FAILURE RESILIENCE

The core application must still work if Gemini is unavailable.

Without AI:

Course data works

Eligibility works

Prerequisites work

Scheduling works

Plan comparison works

Export works

AI is an enhancement, not a dependency for core correctness.

==================================================
51. NO SOCIAL SCHEDULING

Do not optimize for:

Friends

Friend groups

Being with classmates

Social activities

However, the student may explicitly choose normal preferences such as:

"I want Chemistry on Wednesday."

Just apply the preference without asking for a reason.

==================================================
52. NO TRAVEL-TIME OR BUILDING OPTIMIZATION

Do not include:

Walking distance

Building distance

Travel-time buffers

Campus navigation

Geographic optimization

Back-to-back classes are allowed.

==================================================
53. NO EXAM FATIGUE MODEL

Do not include:

Required rest periods

Exam recovery time

Fatigue scoring

Automatic exam spacing preferences

Only actual exam conflicts matter.

==================================================
54. NO WAITLIST

Do not implement waitlists in this version.

Capacity is informational.

Prepare the architecture so waitlist functionality could be added later.

==================================================
55. IMPORTANT PRODUCT ARCHITECTURE

Keep these areas modular and separate:

UI

Localization

RTL/LTR system

Authentication

Database

Student Profile

Course Database

Import System

Screenshot Analyzer

Data Validation

Eligibility Engine

Prerequisite Engine

Scheduling Engine

Constraint Validator

Preference Engine

Plan Analyzer

Plan Ranking

Plan Comparison

Export System

Calendar Integration

Gemini Integration

The scheduling engine must be independent from the UI.

==================================================
56. SAMPLE DATA

Include fictional sample data for a Physics student.

Required:

Electromagnetism I

Quantum Mechanics I

Thermodynamics I

Optional:

Mathematical Physics

Physics Laboratory

General Education

Provide multiple professors and sections so the app can demonstrate:

Different professors

Different class times

Different class days

Different schedule combinations

Valid and invalid combinations

Plan refinement

Use fictional university data only.

==================================================
57. TESTING

Create automated tests for:

Class conflicts

Non-overlapping classes

Adjacent classes

Exam conflicts

Credit limits

Required courses

Passed courses

Prerequisites

AND prerequisites

OR prerequisites

Nested prerequisites

Corequisites

Multiple weekly meetings

Professor preferences

Day preferences

Time preferences

Free-day preferences

Zero valid plans

One valid plan

Few valid plans

Many valid plans

100-plan maximum

Near-duplicate removal

Iterative preference refinement

Preference undo

Import validation

Also test:

Persian RTL

English LTR

Repeated language switching

Mobile responsiveness

==================================================
58. DATA VALIDATION

Validate all imported and AI-extracted data.

Detect:

Duplicate courses

Duplicate sections

Missing IDs

Invalid credits

Invalid times

Invalid dates

Missing professor

Missing section

Unknown prerequisite references

Contradictory data

Uncertain screenshot extraction

Do not silently accept invalid data.

==================================================
59. LOADING AND EMPTY STATES

Do not show blank screens.

During schedule generation show friendly status messages such as:

"Checking which courses you can take..."

"Finding valid combinations..."

"Comparing your possible schedules..."

"Preparing your plans..."

For no-data states:

"Let's add your available courses."

For no-valid-plan states:

"0 valid plans found."

Then explain why.

==================================================
60. ACCESSIBILITY

Use:

Accessible contrast

Readable typography

Large touch targets

Keyboard accessibility

Proper labels

Screen-reader-friendly controls

Do not rely solely on color for status

==================================================
61. FINAL USER EXPERIENCE EXAMPLE

The intended experience should feel approximately like this:

Student opens HafezPlan.

↓

"Let's build your semester plan."

[Start Planning]

↓

Enter academic information.

↓

Select passed courses.

↓

Select required courses.

↓

Upload screenshots from the university registration system.

↓

HafezPlan extracts the course information.

↓

Student verifies the extracted information.

↓

HafezPlan determines actual course eligibility.

↓

Student sets:

Maximum credits: 20

↓

HafezPlan finds valid schedules.

Example:

"27 valid plans found."

↓

HafezPlan analyzes them:

"These plans mainly differ in:"

[Chemistry Professor]
[Chemistry Day]
[Wednesday Free]
[Fewer Class Days]
[Physics Section]

↓

Student chooses:

Chemistry with Professor A

↓

"12 plans match your preference."

↓

Student chooses:

Wednesday free

↓

"5 plans match your preferences."

↓

Student compares the 5 plans.

↓

Student chooses one.

↓

HafezPlan shows:

Weekly Schedule
+
Exam Schedule

↓

Student exports the plan or adds it to Google Calendar.

==================================================
62. DESIGN QUALITY REQUIREMENT

The finished application must not look like a generic AI-generated dashboard.

It should have a coherent design system:

Consistent spacing

Consistent typography

Consistent component behavior

Clear hierarchy

Intentional mobile design

Proper Persian typography

Proper RTL architecture

Proper English LTR architecture

Do not over-design it.

The goal is clarity first.

==================================================
63. IMPLEMENTATION PRIORITY

Prioritize correctness in this order:

Scheduling correctness

Course eligibility

Prerequisites

Hard constraints

Plan refinement

Data reliability

Mobile usability

Persian/English support

Visual polish

Optional integrations

Do not sacrifice scheduling correctness for visual effects.

==================================================
64. FINAL REQUIREMENT

Build HafezPlan as a real working product.

Do NOT:

Create fake schedules

Hard-code one example plan

Use Gemini as the scheduling engine

Assume there are always 20 plans

Expose more than 100 candidate plans

Add travel-time constraints

Add exam-fatigue logic

Add waitlists

Add unnecessary social scheduling features

Create a giant intimidating dashboard

Treat Persian as simply translated English

Break the layout when switching RTL/LTR

DO:

Build a real deterministic scheduling engine

Validate all imported data

Support screenshot-based course import

Support real prerequisite logic

Support required courses

Support professor/section preferences

Analyze meaningful plan differences

Allow iterative plan refinement

Keep plans diverse

Support Persian and English properly

Make RTL/LTR switching robust

Keep the interface simple

Make the experience mobile-first

Use a real persistent database and authentication

Keep the architecture modular and extensible

Before declaring the project complete:

Run the application.

Verify the main user flow end-to-end.

Test the scheduling engine.

Test zero/one/few/many-plan cases.

Verify the 100-plan candidate limit.

Verify prerequisite logic.

Verify class and exam conflicts.

Verify screenshot extraction and confirmation.

Verify Persian RTL.

Verify English LTR.

Repeatedly switch languages and fix layout problems.

Test mobile and desktop.

Test exports.

Fix all build/runtime errors.

Remove fake or placeholder functionality.

The final product should feel like a real, polished university planning assistant rather than a technical prototype.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://hafezplan.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/54b2eb78-ca1d-4df8-98d5-a9382d9eb9e1).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
