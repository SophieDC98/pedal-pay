# Pedal Pay

Log your bike commutes in a tap, claim your bike allowance in ERPx in one click.

Every workday morning Pedal Pay asks whether you biked to work. It counts your
km, what they are worth and your streak, and keeps a month calendar where you
can fix any day. When you claim, the fill bookmark puts your rides into ERPx.

## Install it

1. Open https://sophiedc98.github.io/pedal-pay/ in Microsoft Edge.
2. Click the **App available** icon in the address bar (or **⋯ → Apps →
   Install this site as an app**) and choose **Install**.
3. Enter your **km per ride** and your **rate per km** (for example `18` and
   `0,36`), press **Start**, and allow notifications.

## Let it ask you every morning

Pedal Pay can only ask while it is running, so let Edge start it when you
sign in to Windows:

1. Go to `edge://apps` in Edge.
2. Right-click **Pedal Pay** (or open its **Details**).
3. Switch on **Start app when you sign in**.

On workdays (Monday to Friday, not on Belgian public holidays) it asks
"Biked to work today?" at 09:00, in a strip over the app and with a
notification. If your PC starts later, it asks as soon as it opens. Change the
time under ⚙ **Ask me at**. A day you don't answer counts as no ride; tap it in
the calendar to change it.

## Claim your rides in ERPx

1. In Pedal Pay, open ⚙ and drag the **🚲 Pedal Pay fill** button to your
   favourites bar.
2. Open your expense claim in ERPx and click the favourite.
3. The first time, a small Pedal Pay window asks whether to share your rides
   with that ERPx site. Click **Allow**; it remembers this in your browser only.
4. A panel shows the month with your rides ticked: last month before the
   15th, this month from the 15th. Days already in ERPx have a check mark and
   are skipped. Fix anything, then click **Add … days to ERPx**.
5. The panel adds one bike allowance line per day and closes. Check and
   submit the claim in ERPx yourself.

If you click **Don't allow**, or Pedal Pay isn't set up in this browser, the
panel ticks every workday instead, like the original script.

## Good to know

- Change your km per ride, rate per km or reminder time with the ⚙ button.
- Your rides are stored only in this browser, on this PC. Clearing Edge's site
  data for Pedal Pay removes them, and the sites you allowed.
- Only the days you biked and your km per ride are ever shared, and only with
  sites you allowed.
- Weekends and Belgian public holidays don't break your streak, and neither do
  days you didn't answer. Answering "No" does.

## Credits

The ERPx automation and the Belgian holiday rules come from a colleague's
ERPx bike allowance script, reused with their consent.

## For developers

No build step and no dependencies: the site is served as-is.

```bash
npm run serve        # http://localhost:8000
npm test             # unit tests
npm run test:e2e     # browser tests (needs Playwright with Chromium)
node scripts/make-icons.mjs   # re-render the PNG icons from icons/icon.svg
```
