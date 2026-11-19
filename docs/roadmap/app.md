# App

Status: done.

The installable app, the first thing colleagues use every day.

- The main screen shows, from top to bottom: a switch between this month and
  this year, the km biked in large type, the money it is worth at the rate per
  km, the streak, and the month calendar.
- In the month calendar each day is a circle. Tapping a past or present day
  marks or unmarks a ride. Weekends and Belgian public holidays are shown
  apart. Fixing a wrong answer is done here; there is no separate undo.
- The morning prompt is a strip over the main screen at the reminder time,
  plus a notification. After an answer it says "Saved" and slides away.
- The first run asks only for the km per ride, then asks to allow
  notifications. The rate per km starts at 0.36. Both can be changed later in
  Settings, together with the reminder time, 09:00 by default.
- The README explains how to let Edge start the app at Windows sign-in.

Depends on: nothing.

Bound by: [Storage](../adr/storage.md), [Morning prompt](../adr/morning-prompt.md), [Hosting](../adr/hosting.md), [Look](../adr/look.md).
