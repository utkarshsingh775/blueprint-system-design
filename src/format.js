export const DAY = 86400;
export const YEAR = 365 * DAY;

const scale = (n, units, base) => {
  let i = 0;
  while (Math.abs(n) >= base && i < units.length - 1) {
    n /= base;
    i++;
  }
  const digits = n >= 100 || i === 0 ? 0 : n >= 10 ? 1 : 2;
  return `${n.toFixed(digits)}${units[i]}`;
};

export const num = (n) => scale(n, ['', 'K', 'M', 'B', 'T'], 1000);
export const bytes = (n) => scale(n, [' B', ' KB', ' MB', ' GB', ' TB', ' PB', ' EB'], 1000);
export const bits = (n) => scale(n, [' bps', ' Kbps', ' Mbps', ' Gbps', ' Tbps', ' Pbps'], 1000);
export const qps = (n) => `${num(n)}/s`;
