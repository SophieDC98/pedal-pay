// The small window the fill bookmark opens on the app's site. It hands the
// rides to the ERPx page, but only to sites the user allowed.

import { toKey } from './dates.js';
import { loadState, saveState, allowSite, isSetUp } from './store.js';
import { sourceHash, fetchBookmarkSources } from './bookmark.js';

const $ = id => document.getElementById(id);
const storage = (() => { try { return window.localStorage; } catch { return null; } })();
let state = loadState(storage);

function show(id) {
  for (const v of ['handoff-wait', 'handoff-ask', 'handoff-setup', 'handoff-outdated', 'handoff-alone']) $(v).hidden = v !== id;
}

// The browser tests pin the date with 'pedal-pay-today'.
function today() {
  try { return storage?.getItem('pedal-pay-today') || toKey(new Date()); } catch { return toKey(new Date()); }
}

const rides = () => Object.keys(state.answers).filter(k => state.answers[k] === true).sort();

if (!window.opener) {
  show('handoff-alone');
} else {
  let answered = false;
  // The fingerprint of the current bookmark code; null when it cannot be
  // worked out (offline), and then the check is skipped.
  const currentBuild = fetchBookmarkSources().then(sourceHash).catch(() => null);
  window.addEventListener('message', async e => {
    if (answered || e.source !== window.opener || e.data?.type !== 'pedal-pay-request') return;
    answered = true;
    const origin = e.origin;
    const send = msg => { try { window.opener.postMessage(msg, origin); } catch { /* the page went away */ } };
    // An outdated bookmark carries old code: it fills nothing.
    const build = await currentBuild;
    if (build && e.data.build !== build) {
      send({ type: 'pedal-pay-refused', reason: 'outdated' });
      show('handoff-outdated');
      return;
    }
    const rate = Number(e.data.ratePerKm);
    const share = () => {
      // ERPx's rate per km replaces the app's, for an allowed site only.
      if (rate >= 0.05 && rate <= 2) {
        state = { ...loadState(storage), ratePerKm: rate };
        saveState(storage, state);
      }
      send({ type: 'pedal-pay-rides', rides: rides(), kmPerRide: state.kmPerRide, today: today() });
      window.close();
    };

    if (!isSetUp(state)) {
      send({ type: 'pedal-pay-refused', reason: 'not-set-up' });
      show('handoff-setup');
      return;
    }
    if (state.allowedSites.includes(origin)) { share(); return; }

    let host;
    try { host = new URL(origin).host; } catch { host = ''; }
    if (!host) {
      send({ type: 'pedal-pay-refused', reason: 'unknown-site' });
      window.close();
      return;
    }
    $('handoff-host').textContent = host;
    // Allow waits a moment, so a quick double click elsewhere cannot land on it.
    $('handoff-allow').disabled = true;
    show('handoff-ask');
    setTimeout(() => { $('handoff-allow').disabled = false; }, 800);
    $('handoff-allow').addEventListener('click', () => {
      state = allowSite(loadState(storage), origin);
      saveState(storage, state);
      share();
    });
    $('handoff-deny').addEventListener('click', () => {
      send({ type: 'pedal-pay-refused', reason: 'refused' });
      window.close();
    });
  });
  window.opener.postMessage({ type: 'pedal-pay-ready' }, '*');
}
