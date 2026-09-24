// Line icons for each component type, drawn in a 24×24 box.
const PATHS = {
  client: 'M4 5h16v10H4z M2 19h20 M9 15v4 M15 15v4',
  mobile: 'M7 2h10v20H7z M11 18h2',
  dns: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18 M3 12h18 M12 3c3 3 3 15 0 18 M12 3c-3 3-3 15 0 18',
  cdn: 'M7 18h10a4 4 0 0 0 0-8a6 6 0 0 0-11.5 1.5A3.5 3.5 0 0 0 7 18z',
  lb: 'M12 3v6 M12 9l-7 6 M12 9l7 6 M12 9v6 M5 15v5 M12 15v5 M19 15v5',
  gateway: 'M12 2l8 4v6c0 5-3.5 8.5-8 10c-4.5-1.5-8-5-8-10V6z M9 12l2 2l4-4',
  service: 'M12 2l9 5v10l-9 5l-9-5V7z M12 12l9-5 M12 12v10 M12 12L3 7',
  worker: 'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2',
  cache: 'M13 2L4 14h7l-1 8l9-12h-7z',
  db: 'M4 6c0-2 16-2 16 0v12c0 2-16 2-16 0z M4 6c0 2 16 2 16 0 M4 12c0 2 16 2 16 0',
  nosql: 'M4 6c0-2 16-2 16 0v12c0 2-16 2-16 0z M4 6c0 2 16 2 16 0 M9 12h.01 M12 13h.01 M15 12h.01 M9 16h.01 M12 17h.01 M15 16h.01',
  queue: 'M3 6h18 M3 10h18 M3 14h18 M3 18h12',
  stream: 'M2 8c3-3 5 3 8 0s5 3 8 0s3 0 4 0 M2 14c3-3 5 3 8 0s5 3 8 0s3 0 4 0',
  storage: 'M4 7h16l-2 13H6z M3 7l2-4h14l2 4 M9 12h6',
  search: 'M10 3a7 7 0 1 0 0 14a7 7 0 1 0 0-14 M15 15l6 6',
  ws: 'M4 9h13l-3-3 M20 15H7l3 3',
  coord: 'M12 3a2 2 0 1 0 0 4a2 2 0 1 0 0-4 M5 17a2 2 0 1 0 0 4a2 2 0 1 0 0-4 M19 17a2 2 0 1 0 0 4a2 2 0 1 0 0-4 M12 7v5 M12 12l-6 5 M12 12l6 5',
  analytics: 'M4 20V10 M10 20V4 M16 20v-7 M22 20H2',
  external: 'M14 3h7v7 M21 3l-9 9 M19 14v6H4V5h6',
};

export default function Icon({ type, size = 20, color = 'currentColor', strokeWidth = 1.7 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[type] || PATHS.service} />
    </svg>
  );
}

export const iconPath = (type) => PATHS[type] || PATHS.service;
