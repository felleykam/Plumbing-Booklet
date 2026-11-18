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
- **Code base: 2021 IPC + Utah amendments** (Utah Code Title 15A) for residential work, since that's what the owner's work runs under. When 2024 IPC or another edition differs and matters, label it clearly as a different edition. Never mix them up silently.
- Before changing code content, **check Utah's current adoption status**. The app says Utah code law changes Jan 1, 2027, so recheck that date and what changes before trusting either edition.
- **Every fact needs a source and a checked date.** That covers code sections, sizing tables, phone numbers, addresses, city and utility info, product specs, and license rules. Show it on the card (for example "IPC 2021 §P3005.4.2 · checked Nov 2026") and use primary sources: ICC, Utah Legislature, DOPL, city or utility sites, and manufacturer pages.
- **If you can't verify something from a primary source, leave it out and tell the owner** in your report, so he can ask a journeyman or an inspector. Never guess to fill a gap, and never write something because it "fits."
- **Calculators:** when you touch any calculator, check its math against hand-worked examples, and say what you checked. A wrong offset, grade or sizing answer costs real money on a job.
- **MSP (employer) work rules stay out of the app.** Only code and public Utah info go in.
- Keep the disclaimers (the app is not the code and not legal advice) and the copyright notices. Don't weaken them.

## Units and input
- Measurements run in **inches with tape-style input**: in a length box a plain number means inches, and `'` means feet (`5'6`, `66`).
- **Exception (since build Nov 15):** a box whose label explicitly asks for **feet** (a run, height or length in ft, such as the gas sizer or pressure-at-far-fixture) takes a plain number as feet, and `"` marks inches. Keep this behavior consistent, and make the box label say which unit it expects.
- Fractions follow the user's setting (default 1/16).

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
3. Pass the checks: every inline `<script>` and `jobs.js` must parse (`node` `new Function(...)` check), and any calculator tests must pass.
4. Make small, targeted edits. Don't reformat or rewrite unrelated parts of the giant file.

## Themes
- Hi-vis is the default. The novelty themes (Neon Sign, Glow Stick, Rubber Ducky, Blacklight, Patina, Chrome, etc.) stay, but they **need a short disclaimer in Settings** saying they're for fun and not tuned for bright sun or rain.
- **Remove a theme only if it breaks something:** unreadable answers or warnings (text contrast below 4.5:1), or code that errors. Say which one and why.
- No new themes until the accuracy pass is done.

## Shipping
- **Never push straight to `main`.** Work on a branch and open a PR. The owner tests it on his phone and merges it, and merging is what makes it live.
- Commit messages are plain English (what changed, then the build number).

## Reporting back to the owner
Keep it short:
- **What changed** (a few lines)
- **What to test on the phone** (a tap-through checklist)
- **What couldn't be verified** (left out, needs a journeyman or an inspector)

He's a plumbing apprentice, not a developer, so skip the jargon.
