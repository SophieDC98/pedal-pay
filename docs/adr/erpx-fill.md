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
only after the user clicks generate, and days that already have a line are
shown as done and skipped. Without app data, the panel ticks every workday,
as the original script does.

The panel and the ERPx automation come from a colleague's console script,
reused with their consent and credited in the README.
