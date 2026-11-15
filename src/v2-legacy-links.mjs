// Copyright © 2026 Christopher Snow.
const v1Fragments = new Set([
  '#overview', '#audience', '#audience-title', '#prerequisites', '#prerequisites-title',
  '#curriculum', '#parallel-patterns', '#meet-gpu', '#lab', '#cuda', '#challenge', '#simulator',
]);

function openV1Bookmark() {
  if (!v1Fragments.has(location.hash)) return;
  const url = new URL('./v1.html', location.href);
  url.search = location.search;
  url.hash = location.hash;
  location.replace(url);
}

openV1Bookmark();
addEventListener('hashchange', openV1Bookmark);
