# App

Status: done.

The installable app, the first thing colleagues use every day.

- The main screen shows, from top to bottom: a switch between this month and
  this year, the km biked in large type, the money it is worth at the rate per
  km, the streak, and the month calendar.
- In the month calendar each day is a circle. Tapping a past or present day
  marks or unmarks a ride. Weekends and Belgian public holidays are shown
  apart. Fixing a wrong answer is done here; there is no separate undo.
- The morning prompt is a small window with Yes and No, plus a notification.
  After an answer it says "Saved" and shows the main screen.
- The first run asks for the km per ride and the rate per km, then asks to
  allow notifications. Both values can be changed later in Settings.
- The README explains how to let Edge start the app at Windows sign-in.

Depends on: nothing.

Bound by: [Storage](../adr/storage.md), [Morning prompt](../adr/morning-prompt.md), [Hosting](../adr/hosting.md), [Look](../adr/look.md).
