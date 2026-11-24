# ERPx fill

The fill bookmark runs on the ERPx page. A page cannot read another site's
browser storage, so the bookmark opens a small window on the app's site,
which reads the rides and km per ride and posts them back to the ERPx page,
then closes. A hidden frame was rejected because browsers partition its
storage away from the installed app.

The app shares rides only with sites the user allowed. The first time a site
asks, the small window asks "Share your rides with <site>?"; the answer is
kept in the user's own browser and every other site is refused. Allow only
works after a short moment, so a quick double click elsewhere cannot land on
it. The ERPx address is never written into the repository or the public
site, because it names the employer; a GitHub secret was rejected for the
same reason, since anything it put into the published files would be public.
Only ride dates and the km per ride are shared. In the other direction the
bookmark sends the rate per km it works out from the bike allowance lines in
ERPx (their amount divided by their km); the app keeps it for an allowed site,
so its amounts match what ERPx pays. Until then the app uses 0.36, and setup
does not ask for it.

The app is the only place where days are checked. The bookmark takes one
month, the previous one before the 15th and the current one from the 15th,
and makes ERPx match the app: it adds the rides that have no bike allowance
line and removes the bike allowance lines that are not rides. A calendar to
review the days inside ERPx was tried first and dropped: it repeated the
app's calendar, and changes made there had to be sent back to the app.
A line counts as a bike allowance line when its type says so, or when its
type cannot be read, so an unexpected ERPx field never causes duplicates; a
train or parking line on the same day is left alone. If the lines in ERPx
cannot be read at all, nothing is changed.

A small popup shows what it does, for example "Adding 12 days of November to
ERPx · removing 1". The logo bike rides along a little road towards a finish
flag with its wheels turning, the km being claimed count up underneath, and a
Stop button halts after the current day. It closes itself when done. When
the app shares no rides (the user said no, the app is not set up in that
browser, or the small window could not open), the popup explains what to do
and changes nothing. The bookmark waits up to two minutes for an answer in
the small window; closing it ends the wait at once.

To remove a line, the bookmark selects only that row, presses "Kosten
verwijderen" and confirms, then checks the line is gone. It never uses ERPx's
"Verwijderen" button, which deletes the whole expense claim. Removals run
before additions.

The bookmark carries all its code, because ERPx may refuse to load scripts
from elsewhere. The app builds the bookmark link from its own source files
when it is offered, so there is still no build step.

The ERPx automation comes from a colleague's console script, reused with
their consent and credited in the README. Where that script took the first
table on the page, the bookmark picks the expense lines table by its name
(expenseLinesGrid): an existing claim shows its summary table first. Where that script paused a fixed
1.8 seconds per day, the bookmark waits until ERPx is ready for each step and
checks the line was saved with its date, so it is as fast as ERPx allows and
stops rather than leave a half-filled line. Choosing the category makes ERPx
fill in defaults a moment later, including today's date, so every value the
bookmark sets must stay put for a moment; one that ERPx overwrites is set
again.
