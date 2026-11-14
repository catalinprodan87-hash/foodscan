/*
 * Turns a flat label (or barcode) image into a synthetic "phone photo":
 * cylinder curve, keystone perspective, tilt, placement on a table, blur,
 * brightness, glare and seeded noise. Runs in the browser (injected by the
 * benchmark generators); deterministic for a given seed.
 *
 * window.photoize(src, opts) → { jpeg: dataURL, crop: [x, y, w, h] | null }
 *   src   data URL of the flat image
 *   opts  { curve, tilt, keystone, blur, glare, noise, bright, contrast, fill,
 *           sceneW, sceneH, quality, seed, mask, rotate }
 *         mask: data URL of the same image where only the region of interest
 *               is pure red (#f00) on transparent; its box after the same
 *               geometry becomes `crop` (normalised to the output).
 *         rotate: extra 90° steps applied last (0–3), for orientation tests.
 */
(() => {
  const load = (src) => new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = src;
  });

  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Cylinder: columns compressed towards the edges, edges bent and shaded. */
  function curved(img, curve, shade) {
    const W = img.width;
    const H = img.height;
    if (!curve) {
      const c = new OffscreenCanvas(W, H);
      c.getContext('2d').drawImage(img, 0, 0);
      return c;
    }
    const phiMax = curve * 1.25; // radians of the visible arc
    const bend = curve * 0.06 * H;
    const out = new OffscreenCanvas(W, H + Math.ceil(bend) + 2);
    const ctx = out.getContext('2d');
    const srcX = (xo) => {
      const t = (xo / (W - 1)) * 2 - 1; // −1..1 across the visible width
      const phi = Math.asin(Math.max(-1, Math.min(1, t * Math.sin(phiMax))));
      return { t, phi, xs: ((phi / phiMax + 1) / 2) * (W - 1) };
    };
    for (let xo = 0; xo < W; xo++) {
      const { t, phi, xs } = srcX(xo);
      const sw = Math.max(1, srcX(Math.min(W - 1, xo + 1)).xs - xs);
      const dy = (bend * (1 - Math.cos(phi))) / (1 - Math.cos(phiMax) || 1);
      ctx.drawImage(img, xs, 0, sw, H, xo, dy, 1, H);
      if (shade) {
        ctx.fillStyle = `rgba(0,0,0,${(0.35 * Math.abs(t) ** 3).toFixed(3)})`;
        ctx.fillRect(xo, dy, 1, H);
      }
    }
    return out;
  }

  /** Keystone: rows get narrower towards the top (camera tilted back). */
  function keystoned(src, k) {
    const W = src.width;
    const H = src.height;
    if (!k) return src;
    const out = new OffscreenCanvas(W, H);
    const ctx = out.getContext('2d');
    for (let y = 0; y < H; y++) {
      const s = 1 - k * (1 - y / (H - 1));
      const w = W * s;
      ctx.drawImage(src, 0, y, W, 1, (W - w) / 2, y, w, 1);
    }
    return out;
  }

  function place(src, o, background) {
    const sw = o.sceneW;
    const sh = o.sceneH;
    const c = new OffscreenCanvas(sw, sh);
    const ctx = c.getContext('2d');
    if (background) {
      const g = ctx.createLinearGradient(0, 0, sw, sh);
      g.addColorStop(0, '#8a7560');
      g.addColorStop(1, '#5f4c3b');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, sw, sh);
    }
    const scale = (sw * o.fill) / src.width;
    ctx.translate(sw / 2, sh / 2);
    ctx.rotate((o.tilt * Math.PI) / 180);
    ctx.scale(scale, scale);
    if (background) {
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = 30 / scale;
      ctx.shadowOffsetY = 8 / scale;
    }
    ctx.drawImage(src, -src.width / 2, -src.height / 2);
    return c;
  }

  function rotate90(src, steps) {
    const s = ((steps % 4) + 4) % 4;
    if (!s) return src;
    const swap = s % 2 === 1;
    const out = new OffscreenCanvas(swap ? src.height : src.width, swap ? src.width : src.height);
    const ctx = out.getContext('2d');
    ctx.translate(out.width / 2, out.height / 2);
    ctx.rotate((s * Math.PI) / 2);
    ctx.drawImage(src, -src.width / 2, -src.height / 2);
    return out;
  }

  function geometry(img, o, background, shade) {
    return rotate90(place(keystoned(curved(img, o.curve, shade), o.keystone), o, background), o.rotate || 0);
  }

  function effects(canvas, o) {
    const out = new OffscreenCanvas(canvas.width, canvas.height);
    const ctx = out.getContext('2d');
    ctx.filter = `blur(${o.blur || 0}px) brightness(${o.bright ?? 1}) contrast(${o.contrast ?? 1})`;
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = 'none';
    if (o.glare) {
      const rand = rng(o.seed + 7);
      const gx = out.width * (0.3 + 0.4 * rand());
      const gy = out.height * (0.3 + 0.4 * rand());
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, out.width * 0.28);
      g.addColorStop(0, `rgba(255,255,255,${o.glare})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, out.width, out.height);
    }
    if (o.noise) {
      const rand = rng(o.seed);
      const d = ctx.getImageData(0, 0, out.width, out.height);
      const p = d.data;
      for (let i = 0; i < p.length; i += 4) {
        const n = (rand() - 0.5) * o.noise;
        p[i] += n; p[i + 1] += n; p[i + 2] += n;
      }
      ctx.putImageData(d, 0, 0);
    }
    return out;
  }

  function redBox(canvas) {
    const ctx = canvas.getContext('2d');
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let x0 = width; let y0 = height; let x1 = -1; let y1 = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (data[i + 3] > 128 && data[i] > 150 && data[i + 1] < 90 && data[i + 2] < 90) {
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return null;
    const r = (v) => Math.round(v * 10000) / 10000;
    return [r(x0 / width), r(y0 / height), r((x1 - x0 + 1) / width), r((y1 - y0 + 1) / height)];
  }

  async function toDataURL(canvas, quality) {
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
    return new Promise((res) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.readAsDataURL(blob);
    });
  }

  window.photoize = async (src, opts) => {
    const o = { curve: 0, tilt: 0, keystone: 0, blur: 0, glare: 0, noise: 0, bright: 1, fill: 0.75, sceneW: 1800, sceneH: 1350, quality: 0.82, seed: 1, ...opts };
    const img = await load(src);
    const photo = effects(geometry(img, o, true, true), o);
    const jpeg = await toDataURL(photo, o.quality);
    let crop = null;
    if (o.mask) crop = redBox(geometry(await load(o.mask), o, false, false));
    return { jpeg, crop, width: photo.width, height: photo.height };
  };
})();
