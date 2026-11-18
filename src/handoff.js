// The small window the fill bookmark opens on the app's site. It hands the
// rides to the ERPx page, but only to sites the user allowed.

import { toKey } from './dates.js';
import { loadState, saveState, allowSite, applyUpdate, isSetUp } from './store.js';

const $ = id => document.getElementById(id);
const storage = (() => { try { return window.localStorage; } catch { return null; } })();
let state = loadState(storage);

function show(id) {
  for (const v of ['handoff-wait', 'handoff-ask', 'handoff-setup', 'handoff-update', 'handoff-alone']) $(v).hidden = v !== id;
}

// The browser tests pin the date with 'pedal-pay-today'.
function today() {
  try { return storage?.getItem('pedal-pay-today') || toKey(new Date()); } catch { return toKey(new Date()); }
}

const rides = () => Object.keys(state.answers).filter(k => state.answers[k] === true).sort();

if (!window.opener) {
  show('handoff-alone');
} else if (new URLSearchParams(location.search).has('update')) {
  // Update mode: the panel sends the days it changed in ERPx, once it is done.
  show('handoff-update');
  window.addEventListener('message', e => {
    if (e.source !== window.opener || e.data?.type !== 'pedal-pay-update') return;
    const fresh = loadState(storage);
    if (!fresh.allowedSites.includes(e.origin)) { window.close(); return; }
    const set = Array.isArray(e.data.set) ? e.data.set : [];
    const clear = Array.isArray(e.data.clear) ? e.data.clear : [];
    const saved = saveState(storage, applyUpdate(fresh, { set, clear }));
    try { window.opener.postMessage({ type: 'pedal-pay-updated', saved }, e.origin); } catch { /* page gone */ }
    window.close();
  });
  // Close when the ERPx page goes away without sending anything.
  setInterval(() => { if (window.opener.closed) window.close(); }, 1000);
  window.opener.postMessage({ type: 'pedal-pay-ready', mode: 'update' }, '*');
} else {
  let answered = false;
  window.addEventListener('message', e => {
    if (answered || e.source !== window.opener || e.data?.type !== 'pedal-pay-request') return;
    answered = true;
    const origin = e.origin;
    const send = msg => { try { window.opener.postMessage(msg, origin); } catch { /* the page went away */ } };
    const share = () => {
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
