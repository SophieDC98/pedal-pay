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

export function bookmarkUrl(sources, appUrl) {
  const code = `(() => {\nconst PEDAL_PAY_URL = ${JSON.stringify(appUrl)};\n${bundle(sources)}\n})();`;
  return 'javascript:' + encodeURIComponent(code);
}
