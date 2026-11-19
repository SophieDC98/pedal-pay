# Storage

Rides, km per ride, the rate per km and the allowed sites are kept in the
browser's storage for the app's own site, on the work PC where ERPx is opened. There is no server and no sync.
Colleagues log rides on that PC anyway, and a backend would mean accounts,
hosting and personal data to look after for a tool this small.

Wiped browser data loses the logged rides. That is accepted for now; a backup
is an idea.

The app window and the fill bookmark's small window both write that storage.
The app window reloads it when the other window changes it, and never writes
back its own copy of the allowed sites, so an Allow is not lost.

The app asks the browser to keep its storage persistent, so Edge does not
clear it by itself when disk space runs low; Settings says whether Edge
agreed. That does not protect against the user or IT clearing the data.
