import { useRef } from 'react';

const MIN = 0.08;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Photo with a draggable, resizable rectangle. `rect` is normalised
 * {x, y, w, h} (0–1). Drag inside to move, drag a corner to resize.
 * Works with touch, mouse and pen (pointer events).
 */
export default function CropBox({ src, alt, rect, onChange }) {
  const boxRef = useRef(null);
  const drag = useRef(null);

  const start = (mode) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { mode, x: e.clientX, y: e.clientY, rect };
  };

  const move = (e) => {
    const d = drag.current;
    if (!d) return;
    const box = boxRef.current.getBoundingClientRect();
    const dx = (e.clientX - d.x) / box.width;
    const dy = (e.clientY - d.y) / box.height;
    const r = d.rect;
    let { x, y, w, h } = r;
    if (d.mode === 'move') {
      x = clamp(r.x + dx, 0, 1 - r.w);
      y = clamp(r.y + dy, 0, 1 - r.h);
    } else {
      if (d.mode.includes('w')) { x = clamp(r.x + dx, 0, r.x + r.w - MIN); w = r.x + r.w - x; }
      if (d.mode.includes('e')) { w = clamp(r.w + dx, MIN, 1 - r.x); }
      if (d.mode.includes('n')) { y = clamp(r.y + dy, 0, r.y + r.h - MIN); h = r.y + r.h - y; }
      if (d.mode.includes('s')) { h = clamp(r.h + dy, MIN, 1 - r.y); }
    }
    onChange({ x, y, w, h });
  };

  const end = () => { drag.current = null; };
  const pct = (v) => `${(v * 100).toFixed(2)}%`;

  return (
    <div className="crop-box" ref={boxRef} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
      <img src={src} alt={alt} draggable={false} />
      <div
        className="crop-rect"
        style={{ left: pct(rect.x), top: pct(rect.y), width: pct(rect.w), height: pct(rect.h) }}
        onPointerDown={start('move')}
      >
        {['nw', 'ne', 'sw', 'se'].map((c) => (
          <span key={c} className={`crop-handle crop-${c}`} onPointerDown={start(c)} aria-hidden="true" />
        ))}
      </div>
    </div>
  );
}
