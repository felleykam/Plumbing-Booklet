# Utah Plumbers Digital Handbook: rules for Claude

Read this before every change. These are the owner's (Deklan's) standing rules for this repo.

## What this app is
An offline jobsite reference for **Utah residential new-construction plumbing**: field math, code, mech room, trim, inspections, Utah city info, contacts, and a personal Jobs tracker. It runs on iPhone, iPad and PC as an installable web app from GitHub Pages: https://felleykam.github.io/Plumbing-Booklet/

**This GitHub repo is the single source of truth.** The old claude.ai artifact is retired and out of date. Never copy content back from it.

## Priorities (when they conflict, go in this order)
1. **Accuracy over features.** Fixing or verifying existing content comes before adding anything new.
2. **Fast and offline.** It has to work with no signal (basements, new subdivisions). Nothing can need the network to show core content.
3. **Lightweight.** Push back on bloat. Prefer folding or cutting over adding.
4. Readable on a jobsite (hi-vis safety yellow/black is the default look, with big tap targets).

## Accuracy rules (most important)
- **Which code applies (verified Nov 2026 from Utah Code 15A-2-103, effective 7/1/2026):**
  - **Houses (one- and two-family, townhouses): 2021 IRC** plumbing, gas and mechanical chapters, plus Utah's amendments in Utah Code Title 15A ch. 3 (15A-3-2xx). This is the main code for the owner's residential new-construction work.
  - **Everything else (commercial, multifamily beyond IRC scope): 2024 IPC, 2024 IMC, 2024 IFGC.**
  - **2021 IPC**: older permits, plus the owner's MTECH schooling. Keep the "Code I work under" setting (2021 IPC / 2021 IRC / 2024 IPC) and label every code card with its edition. Never mix editions silently.
  - The Jan 1, 2027 change (HB 41, 2026) only swaps the wildfire code (2006 Utah WUI → 2024 IWUIC). Houses stay on the 2021 IRC. Recheck 15A-2-103 at le.utah.gov before any code work in case later bills change it.
- **Every fact needs a source and a checked date.** That covers code sections, sizing tables, phone numbers, addresses, city and utility info, product specs, and license rules. Show it on the card (for example "IPC 2021 §P3005.4.2 · checked Nov 2026") and use primary sources: ICC, Utah Legislature, DOPL, city or utility sites, and manufacturer pages.
- **If you can't verify something from a primary source, leave it out and tell the owner** in your report, so he can ask a journeyman or an inspector. Never guess to fill a gap, and never write something because it "fits."
- **Calculators:** when you touch any calculator, check its math against hand-worked examples, and say what you checked. A wrong offset, grade or sizing answer costs real money on a job.
- **MSP (employer) work rules stay out of the app.** Only code and public Utah info go in.
- Keep the disclaimers (the app is not the code and not legal advice) and the copyright notices. Don't weaken them.

## Units and input
- Measurements run in **inches with tape-style input**: in a length box a plain number means inches, and `'` means feet (`5'6`, `66`).
- **Exception (since build Nov 15):** a box whose label explicitly asks for **feet** (a run, height or length in ft, such as the gas sizer or pressure-at-far-fixture) takes a plain number as feet, and `"` marks inches. Keep this behavior consistent, and make the box label say which unit it expects.
- **Answers show the nearest ⅛" by default**, because that's how most plumbers read a tape. The user can pick 1/16" or 1/32" in Settings → Behavior. Round only the answer that's displayed, never the math in between. When rounding to ⅛" could hide something that matters (like a total drop on a short run), show the finer value or a note.

## How the code is laid out
- `index.html`: almost the whole app (about 11k lines). Cards are `<section data-sec="...">` and belong to pages listed in `const GROUPS` (tabs: home, calc, rough=Build, mech=Service, trim, inspect, contacts, site=Jobsite, learn, mine). Search keywords live in `data-kw`.
- `jobs.js`: the My jobs tracker (jobs, checklists, photos, hours, backups).
- `sw.js`: the offline cache. It is keyed on `BUILD`.
- `manifest.webmanifest` and `icon-*.png`: the install info and icons.
- Saved data uses `localStorage` and IndexedDB keys that start with `jpb-`. **Never rename or drop a saved key without a migration.** People's jobs and photos live there.
- A crash catcher at the top of index.html shows script errors in the footer. Keep it.

## Every change must
1. **Bump `var BUILD`** in index.html (`handbook-YYYY-MM-DD` plus a letter). Without this, phones won't pick up the update.
2. Add a row to **What's new** (newest first, in plain words, fixes included).
3. Pass the checks: run `python3 tests/run.py` (scripts parse, every page opens, calculators match hand-worked answers, jump links land, typed text never runs as code). When you add or change a calculator, add its hand-worked case to `CALCS` in that file.
4. Make small, targeted edits. Don't reformat or rewrite unrelated parts of the giant file.

## Themes
- Hi-vis is the default. The novelty themes (Neon Sign, Glow Stick, Rubber Ducky, Blacklight, Patina, Chrome, etc.) stay, but they **need a short disclaimer in Settings** saying they're for fun and not tuned for bright sun or rain.
- **Remove a theme only if it breaks something:** unreadable answers or warnings (text contrast below 4.5:1), or code that errors. Say which one and why.
- The accuracy pass is done (Nov 2026). Add a new theme only when the owner asks for one. Every new theme goes in the "Just for fun" group (or the right group), gets named in the Settings disclaimer if it's a novelty theme, and must pass the contrast check (4.5:1 text, 3:1 UI parts) in light and dark.

## Shipping
- **Never push straight to `main`.** Work on a branch, open a PR, and send the owner the short report (below).
- **Claude merges only after the owner says so in chat** ("ship it", "merge it", or something just as clear). Then Claude merges the PR itself so he never has to click through GitHub. Merging is what makes it live.
- No approval, no merge. Never take silence, or approval of an earlier change, as approval of this one.
- Commit messages are plain English (what changed, then the build number).

## Reporting back to the owner
Keep it short:
- **What changed** (a few lines)
- **What to test on the phone** (a tap-through checklist)
- **What couldn't be verified** (left out, needs a journeyman or an inspector)

He's a plumbing apprentice, not a developer, so skip the jargon.
