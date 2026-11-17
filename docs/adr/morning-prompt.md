# Morning prompt

The app is installed from Edge and set to start at Windows sign-in. When it
starts on a workday, Monday to Friday and not a Belgian public holiday, and
that day has no answer yet, it shows a small window with Yes and No and also
sends a notification, in case the window opens behind others. A browser app
cannot reliably wake itself at a set time, so sign-in is the moment it asks.

A missed day counts as no ride. The user can still mark it in the app's month
calendar.

The notification carries Yes and No buttons that answer through the service
worker. Notifications are only asked for once, from the first-run Start
button, and the window prompt works without them.

The streak counts workdays in a row with a ride. Weekends, holidays and missed
days are skipped; a "No" ends it.
