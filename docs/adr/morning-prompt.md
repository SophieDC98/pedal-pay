# Morning prompt

The app is installed from Edge and set to start at Windows sign-in. On a
workday, Monday to Friday and not a Belgian public holiday, without an answer
yet, it asks at the reminder time, 09:00 unless the user changes it in
Settings. If the app opens before that time it waits; if it opens later it
asks straight away. A browser app cannot wake itself while closed, so the app
must be running: with the PC off or the app closed, nothing is asked.

The question is an overlay on the main screen: the screen dims and a compact
strip drops in under the title bar with Yes and No. After an answer it says
"Saved", slides away, and the numbers and calendar underneath update. It has
no close button; an unanswered day is simply missed. A notification with Yes
and No goes out at the same moment, in case the window is behind others.
Notifications are only asked for once, from the first-run Start button, and
the overlay works without them.

A missed day counts as no ride. The user can still mark it in the app's month
calendar.

The streak counts days in a row with a ride, back from today. Marked weekends
and holidays count, unmarked ones are skipped, and the first workday without a
ride, answered "No" or never answered, ends it. Today is left out until it has
an answer, so the streak does not drop to zero every morning.

Mockups: https://claude.ai/artifact/HHi8ZmMXm81tHiQTsGqMJc
