# Hosting

The app is a static site published with GitHub Pages from a public
repository, so colleagues install it from a plain URL with nothing to run. Its
interface is in English.

There is no build step: the files in the repository are the site. A service
worker serves them network first and falls back to its cache when offline,
so colleagues get a new version on their next start rather than a stale copy.
