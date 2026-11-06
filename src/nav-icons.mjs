const shapes = {
  grip: '<g fill="currentColor" stroke="none"><circle cx="9" cy="5" r="1.4"/><circle cx="15" cy="5" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="19" r="1.4"/><circle cx="15" cy="19" r="1.4"/></g>',
  shuffle:
    '<path d="M3 6h2c5 0 9 12 14 12h2m-4-4 4 4-4 4M3 18h2c2.1 0 4-2.1 5.8-4.5M13.2 10.5C15 8.1 17 6 19 6h2m-4-4 4 4-4 4"/>',
  volume:
    '<path d="m11 4-6 5H2v6h3l6 5Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  muted: '<path d="m11 4-6 5H2v6h3l6 5Z"/><path d="m16 9 6 6m0-6-6 6"/>',
  play: '<path d="m8 4 12 8-12 8Z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M8 5v14M16 5v14" stroke-width="3"/>',
  previous: '<path d="M5 5v14m14-14L8 12l11 7Z"/>',
  next: '<path d="M19 5v14M5 5l11 7-11 7Z"/>',

  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
  explore:
    '<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5Z"/>',
  artists:
    '<circle cx="9" cy="8" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m3 10v-2a6 6 0 0 0-2-4.5"/>',
  playlists: '<path d="M4 5h16M4 10h16M4 15h8M4 20h8m5-6 4 3-4 3Z"/>',
  me: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="9" r="3"/><path d="M5.5 18.2a7 7 0 0 1 13 0"/>',
  wallet:
    '<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 8h18m-4 5h4"/>',
  liked:
    '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  queue: '<path d="M4 5h16M4 10h16M4 15h8m5-1v7m-3-3 3 3 3-3"/>',
  recovery:
    '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Zm0 0v6h6M8 13h8m-8 4h5"/>',
};

export function navIcon(name) {
  return `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${shapes[name] || shapes.explore}</svg>`;
}
