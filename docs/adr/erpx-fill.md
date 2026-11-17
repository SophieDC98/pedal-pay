# ERPx fill

The fill bookmark runs on the ERPx page. A page cannot read another site's
browser storage, so the bookmark opens a small window on the app's site,
which reads the rides and km per ride and posts them back to the ERPx page,
then closes. A hidden frame was rejected because browsers partition its
storage away from the installed app.

The bookmark then opens the review panel with those rides ticked. Allowance
lines are created only after the user clicks generate, and days that already
have a line are skipped. Without app data, the panel ticks every workday, as
the original script does.

The panel and the ERPx automation come from a colleague's console script,
reused with their consent and credited in the README.
