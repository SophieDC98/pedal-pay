# Fill bookmark

Status: done.

The fill bookmark: clicked on the ERPx expense page, it fetches the rides and
the km per ride from the app and shows the review panel, built from the
colleague's script.

- The panel opens on the previous month before the 15th, and on the current
  month from the 15th. The user can move between months.
- Rides of that month are ticked. Days that already have a line in ERPx show
  a check mark and cannot be ticked, so nothing is added twice.
- The km per ride comes from the app and can be changed in the panel.
- Generate creates one allowance line per ticked day, shows how many were
  added, and closes itself after a few seconds.
- The panel follows the app's look, in light and dark.
- Until the install page exists, Settings in the app offers the fill bookmark
  as a link to drag to the favourites bar.

Depends on: [App](app.md).

Bound by: [ERPx fill](../adr/erpx-fill.md), [Storage](../adr/storage.md), [Look](../adr/look.md).
