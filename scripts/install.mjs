// Copyright © 2026 Christopher Snow.
export const installHelp = `<details id="install-help"><summary>Add GPU Lab to your apps</summary>
<p>Use your browser’s install option for an app icon and a separate window. Course status shows whether the course is downloaded and ready to use offline.</p>
<ul>
<li><strong>Chrome on Android:</strong> open the browser menu and look for Install app or Add to Home screen.</li>
<li><strong>Chrome or Edge on a computer:</strong> choose the install app icon in the address bar, or find Install GPU Lab in the browser menu.</li>
<li><strong>Safari on iPhone or iPad:</strong> choose Share → Add to Home Screen, with Open as Web App enabled if offered.</li>
<li><strong>Safari on Mac:</strong> choose File → Add to Dock.</li>
</ul></details>`;

export function installMarkup(html, base) {
  return html
    .replace('<link rel="icon" href="data:,">', `<link rel="icon" type="image/svg+xml" href="${base}assets/icon.svg">`)
    .replace('</head>', `<link rel="manifest" href="${base}manifest.webmanifest">
<meta name="theme-color" content="#122824">
<meta name="apple-mobile-web-app-title" content="GPU Lab">
<link rel="apple-touch-icon" sizes="180x180" href="${base}assets/apple-touch-icon.png"></head>`)
    .replace('<span class="brand-icon" aria-hidden="true">▦</span>', `<img class="brand-icon" src="${base}assets/icon.svg" alt="" width="32" height="32">`);
}
