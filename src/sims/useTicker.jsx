import { useEffect, useRef, useState } from 'react';

// Runs `step(now, dt)` every animation frame while mounted and visible, and re-renders at ~30 fps.
export function useTicker(step, running = true) {
  const [, force] = useState(0);
  const stepRef = useRef(step);
  stepRef.current = step;

  useEffect(() => {
    if (!running) return;
    let raf;
    let last = performance.now();
    let lastPaint = 0;
    const loop = (now) => {
      const dt = Math.min(100, now - last);
      last = now;
      if (!document.hidden) stepRef.current(now, dt);
      if (now - lastPaint > 33) {
        lastPaint = now;
        force((n) => n + 1);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);
}

export const fnv = (str) => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
};

export function Segmented({ options, value, onChange }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)} title={o.hint}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Slider({ label, value, min, max, step = 1, onChange, fmt = (v) => v }) {
  return (
    <label className="slider">
      <span>
        {label} <b>{fmt(value)}</b>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}
