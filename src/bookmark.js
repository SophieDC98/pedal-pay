// Builds the fill bookmark from the app's own source files, so the site needs
// no build step. The bookmark must carry everything: ERPx may refuse to load
// scripts from elsewhere.

export function bundle(sources) {
  return sources
    .map(src => src
      .split('\n')
      .filter(line => !/^\s*import\s/.test(line))
      .map(line => line.replace(/^(\s*)export\s+/, '$1'))
      .join('\n'))
    .join('\n');
}

// The files the bookmark is made of, relative to the app.
export const BOOKMARK_FILES = ['src/dates.js', 'src/fill-logic.js', 'fill/panel.js'];

// A short fingerprint of the bookmark code. It changes whenever that code
// changes, so the app can tell an outdated bookmark from a current one.
export async function sourceHash(sources) {
  const bytes = new TextEncoder().encode(bundle(sources));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].slice(0, 4).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function bookmarkUrl(sources, appUrl, build = '') {
  const code = `(() => {\nconst PEDAL_PAY_URL = ${JSON.stringify(appUrl)};\nconst PEDAL_PAY_BUILD = ${JSON.stringify(build)};\n${bundle(sources)}\n})();`;
  return 'javascript:' + encodeURIComponent(code);
}

// Fetches the bookmark's source files from the app's own site.
export function fetchBookmarkSources() {
  return Promise.all(BOOKMARK_FILES.map(f => fetch(`./${f}`).then(r => {
    if (!r.ok) throw new Error(f);
    return r.text();
  })));
}
