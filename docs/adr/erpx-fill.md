# ERPx fill

The fill bookmark runs on the ERPx page. A page cannot read another site's
browser storage, so the bookmark opens a small window on the app's site,
which reads the rides and km per ride and posts them back to the ERPx page,
then closes. A hidden frame was rejected because browsers partition its
storage away from the installed app.

The app shares rides only with sites the user allowed. The first time a site
asks, the small window asks "Share your rides with <site>?"; the answer is
kept in the user's own browser and every other site is refused. The ERPx
address is never written into the repository or the public site, because it
names the employer; a GitHub secret was rejected for the same reason, since
anything it put into the published files would be public. Only ride dates
and the km per ride are shared.

The bookmark carries the whole review panel, because ERPx may refuse to load
scripts from elsewhere. The app builds the bookmark link from its own source
files when it is offered, so there is still no build step.

The panel ticks the rides of the chosen month. Allowance lines are created
only after the user clicks generate, and days that already have a bike
allowance line are shown as done and skipped. A train or parking line on the
same day does not count; a line whose type cannot be read does, so an
unexpected ERPx field never causes duplicates. If the lines in ERPx cannot be
read at all, nothing can be added.

A day already in ERPx can be unticked to remove its bike allowance line: the
panel selects only that row, presses "Kosten verwijderen" and confirms, then
checks the line is gone and stops if it is not. Removals run before
additions. The panel never uses ERPx's "Verwijderen" button, which deletes
the whole expense claim.

Without app data (the user said no, the app is not set up, or the small
window could not open), the panel ticks every workday, as the original
script does, but leaves the km per ride empty until the user fills it in, so
nobody claims someone else's distance. The panel waits up to two minutes for
an answer in the small window; closing it falls back at once.

The panel and the ERPx automation come from a colleague's console script,
reused with their consent and credited in the README. Where that script
paused a fixed 1.8 seconds per day, the panel waits until ERPx is ready for
each step and checks the line was saved with its date, so it is as fast as
ERPx allows and stops rather than leave a half-filled line.
