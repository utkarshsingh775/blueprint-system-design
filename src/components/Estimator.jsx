import { useMemo, useState } from 'react';

// Sliders move on a log scale when the range spans orders of magnitude, so both 1M and 1B are reachable.
const isLog = (i) => i.max / Math.max(i.min, 1e-9) >= 100;
const toSlider = (i, v) => (isLog(i) ? (Math.log(v / i.min) / Math.log(i.max / i.min)) * 1000 : v);
const fromSlider = (i, s) => {
  if (!isLog(i)) return s;
  const raw = i.min * (i.max / i.min) ** (s / 1000);
  const mag = 10 ** Math.floor(Math.log10(raw));
  return Math.max(i.min, Math.min(i.max, Math.round(raw / (mag / 10)) * (mag / 10)));
};

export default function Estimator({ estimate }) {
  const [values, setValues] = useState(() => Object.fromEntries(estimate.inputs.map((i) => [i.key, i.value])));
  const outputs = useMemo(() => estimate.outputs(values), [values, estimate]);
  const reset = () => setValues(Object.fromEntries(estimate.inputs.map((i) => [i.key, i.value])));

  return (
    <div className="estimator">
      <div className="est-inputs">
        {estimate.inputs.map((i) => (
          <label key={i.key} className="slider">
            <span>
              {i.label} <b>{i.fmt ? i.fmt(values[i.key]) : values[i.key]}</b>
            </span>
            <input
              type="range"
              min={isLog(i) ? 0 : i.min}
              max={isLog(i) ? 1000 : i.max}
              step={isLog(i) ? 1 : i.step}
              value={toSlider(i, values[i.key])}
              onChange={(e) => setValues((v) => ({ ...v, [i.key]: fromSlider(i, Number(e.target.value)) }))}
            />
          </label>
        ))}
        <button className="link-btn" onClick={reset}>Reset to defaults</button>
      </div>
      <div className="est-outputs">
        {outputs.map((o) => (
          <div key={o.label} className="est-card">
            <span>{o.label}</span>
            <b>{o.value}</b>
            {o.hint && <em>{o.hint}</em>}
          </div>
        ))}
      </div>
    </div>
  );
}
