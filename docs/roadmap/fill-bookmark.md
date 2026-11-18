# Fill bookmark

Status: done.

The fill bookmark: clicked on the ERPx expense page, it fetches the rides and
the km per ride from the app and makes one month in ERPx match them.

- It takes the previous month before the 15th and the current month from the
  15th.
- It adds the rides that have no bike allowance line in ERPx and removes the
  bike allowance lines that are not rides in the app.
- A small popup shows what it is doing, with a bike riding along a progress
  bar and a Stop button, and closes itself when done.
- When the app shares no rides, the popup says what to do and changes nothing.
- The popup follows the app's look, in light and dark.
- Until the install page exists, Settings in the app offers the fill bookmark
  as a link to drag to the favourites bar.

Depends on: [App](app.md).

Bound by: [ERPx fill](../adr/erpx-fill.md), [Storage](../adr/storage.md), [Look](../adr/look.md).
