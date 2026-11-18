# Fill Bookmark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A fill bookmark that fetches rides from the app, with a once-per-site permission, and fills ERPx through a Pedal Pay-styled review panel.

**Architecture:**
- **Bookmark code:** the bookmark is one script assembled from `src/dates.js`, `src/fill-logic.js` and `fill/panel.js`. `src/bookmark.js` strips their `import`/`export` lines and wraps the result in an IIFE as a `javascript:` URL, with the app's address filled in.
- **Handoff:** the bookmark opens `handoff.html` on the app's site. That window asks once per site for permission, then posts the rides back to the ERPx page.
- **ERPx automation:** reused from the colleague's script, through ExtJS `Ext.ComponentQuery`.

**Tech Stack:** as for the App. Node `node:test` and Playwright, with no dependencies.

**Spec:** `docs/roadmap/fill-bookmark.md`, bound by `docs/adr/erpx-fill.md`, `docs/adr/storage.md` and `docs/adr/look.md`.

## Global Constraints

- **No build step.** The bookmark link is built at runtime by the app.
- **No ERPx address anywhere in the repository.** Allowed sites live only in the stored state, as `allowedSites: string[]` of origins.
- **Messages carry only** ride date keys, `kmPerRide` and the app's today key.
- **ERPx calls exactly as the colleague's script makes them:**
  - `[data-u4id="addExpenseLine"]` click
  - combobox `expenseType` select `FIETSVG`
  - datefield `expenseDate`
  - numberfield `quantity`
  - `grid.editingPlugin.completeEdit()`
  - textfield `u4Id === 'travelPurpose'` set to `Fietsvergoeding <Dutch month> <year>`
  - waits of 300 ms between steps and 600 ms between lines
- **Panel colours** come from `docs/adr/look.md`, with dark mode through `prefers-color-scheme`.

## Review Focus

1. **The popup is blocked, or ERPx cuts the window's link back (`opener` null).** The panel must still open, ticking every workday, with a note. This is covered by Task 3's refused-test path, which uses the same fallback.
2. **Another site asks for the rides.** It is refused unless allowed, and a refusal is never remembered as allowed. Covered in Task 2.
3. **The app isn't set up in this browser.** The window says so and the panel falls back. Covered in Task 2.
4. **A month across the year boundary.** On 3 January the panel opens December of the previous year. Covered in Task 1.
5. **Days already in ERPx** are locked and never generated twice. Covered in Task 3.

---

### Task 1: Fill logic and the bookmark builder

**Files:**
- Create: `src/fill-logic.js` and `src/bookmark.js`
- Test: `tests/fill-logic.test.js` and `tests/bookmark.test.js`

**Interfaces:**
- **Produces in `src/fill-logic.js`:**
  - `defaultMonth(todayKey) -> { year, month0 }`. Before the 15th it returns the previous month.
  - `initialTicks(rides: string[]|null, year, month0, existing: Set<string>) -> Set<string>`. With `null`, it ticks every workday of the month; otherwise the rides of the month. Either way, days in `existing` are left out.
  - `travelPurpose(year, month0) -> string`, e.g. `'Fietsvergoeding november 2026'`.
- **Produces in `src/bookmark.js`:**
  - `bundle(sources: string[]) -> string`. It drops `import` lines and leading `export ` keywords, then joins the sources.
  - `bookmarkUrl(sources, appUrl) -> string`. It returns `'javascript:' + encodeURIComponent('(()=>{const PEDAL_PAY_URL=' + JSON.stringify(appUrl) + ';\n' + bundle + '\n})()')`.

**Tests:**
- `defaultMonth('2026-11-14')` → `{2026, 9}`
- `defaultMonth('2026-11-15')` → `{2026, 10}`
- `defaultMonth('2027-01-03')` → `{2026, 11}`
- `initialTicks` with rides `['2026-10-30', '2026-11-02', '2026-11-03']`, Nov 2026, and existing `{'2026-11-03'}` → `{'2026-11-02'}`
- `initialTicks(null, 2026, 10, new Set())` has size 20
- `travelPurpose(2026, 10)` → `'Fietsvergoeding november 2026'`
- `bookmarkUrl` round-trips through `decodeURIComponent`, has no `export` or `import` left, and the decoded code parses as a function body (check with `new Function`).

### Task 2: The handoff window and allowed sites

**Files:**
- Create: `handoff.html` and `src/handoff.js`
- Modify: `src/store.js` (adds `allowedSites: []` to `emptyState` and `allowSite(state, origin)`), `sw.js` (adds the new files to `FILES`)
- Test: `tests/store.test.js`. Browser coverage comes in Task 3.

**Protocol:**
1. The handoff window posts `{type:'pedal-pay-ready'}` to `window.opener` with target `*`.
2. The bookmark replies `{type:'pedal-pay-request'}`.
3. The window reads `event.origin`:
   - **Allowed site:** it posts `{type:'pedal-pay-rides', rides, kmPerRide, today}` to that origin only, then closes.
   - **Unknown site:** it shows "Share your rides with <host>?" with **Allow** and **Don't allow**. Allow saves the site and sends the rides. Don't allow posts `{type:'pedal-pay-refused'}` and saves nothing.
   - **App not set up:** it shows "Open Pedal Pay first to set it up" and posts `{type:'pedal-pay-refused'}`.
4. Without `window.opener`, the window says "Open this from the fill bookmark on the ERPx page."

### Task 3: The review panel

**Files:**
- Create: `fill/panel.js`, `e2e/fake-erpx.html` and `e2e/fill.test.js`

**Panel behaviour:**
- It toggles: clicking the bookmark again closes the panel.
- It opens the handoff window, then waits up to 20 s for rides or a refusal. On a refusal or a timeout it falls back to every workday and shows the note "No rides from Pedal Pay: all workdays are ticked."
- **Panel contents:**
  - the month, with ‹ ›
  - km per ride
  - circles for the days: ticked rides; existing days with a ✓, disabled; weekends and holidays muted but tickable
  - "Add N days"
- **Generate:**
  - adds each line, showing "Adding 3 of 12…" as it goes
  - then shows "✅ N lines added" and closes after 4 s
  - sets the travel purpose when the month changes and before generating
- **Today:** the panel uses `window.__pedalPayToday` if set (a test seam), otherwise the today key from the app's message, otherwise the real date.

**Fake ERPx:** a minimal `Ext.ComponentQuery` stub. It has a grid store with records holding `expenseDate`, the add-line button, the combobox, the datefield, the numberfield, the travel purpose field, and a completeEdit that pushes the edited record.

**Browser tests:** the app and the fake ERPx run on two ports, so they are two different sites.
1. **Unknown site, Allow:** the panel ticks the app's rides, but not the existing ones. Generate adds 2 lines with the right dates, `quantity` 18 and type `FIETSVG`, and the panel closes.
2. **Remembered site:** the second time there is no question.
3. **Don't allow:** every workday is ticked, with the note, and nothing is saved as allowed.

### Task 4: Offer the bookmark in Settings, README, close the entry

**Files:**
- Modify: `index.html`, `src/app.js`, `README.md`, the docs status lines and `AGENTS.md` if commands change.

**Settings:** a "Fill bookmark" section with a link `#fill-bookmark-link`, labelled "🚲 Pedal Pay fill". Its href is built by fetching the three sources and calling `bookmarkUrl(sources, new URL('./', location).href)`. Next to it: "Drag this to your favourites bar, then click it on the ERPx expense page."

**Browser test:** the link's href starts with `javascript:` and its decoded code contains the app's URL.

**Closing:** the roadmap status goes to `done`, the README describes the bookmark, and the docs check runs.
