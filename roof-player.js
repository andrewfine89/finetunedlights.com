// Live roofline renderer. Draws the real sequence (site/show-data/<slug>) on a
// canvas, one frame picked by a clock. The clock source is swappable:
//   - 'audio'     : an <audio> element's currentTime (local/demo, our own file)
//   - 'pulsemesh' : the PulseMesh player's getStatus().position (production;
//                   licensed audio, synced to what phones hear). Enabled by the
//                   page; this file only reads a positionMs() callback.
// Node positions and per-frame RGB come from tools/export_show_web.py.
(function () {
  const NS = {};
  window.Roofline = NS;

  async function loadShow(slug, base) {
    base = base || 'show-data/';
    const [nodes, manifest] = await Promise.all([
      fetch(base + 'roofline-nodes.json').then(r => r.json()),
      fetch(base + slug + '.json').then(r => r.json()),
    ]);
    const gzResp = await fetch(base + manifest.data);
    let bytes;
    if ('DecompressionStream' in window) {
      const ds = new DecompressionStream('gzip');
      const stream = gzResp.body.pipeThrough(ds);
      bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    } else {
      bytes = new Uint8Array(await gzResp.arrayBuffer()); // assume already plain
    }
    return { nodes: nodes.nodes, lines: nodes.lines || [], w: nodes.w, h: nodes.h, manifest, data: bytes };
  }

  function makeRenderer(canvas, show, opts) {
    opts = opts || {};
    const ctx = canvas.getContext('2d');
    const lit = document.createElement('canvas');
    const lc = lit.getContext('2d');
    let bg = null;
    if (opts.background) { bg = new Image(); bg.src = opts.background; }
    const { nodes, lines, w, h, manifest, data } = show;
    const N = manifest.nodes, step = manifest.step_ms, frames = manifest.frames;
    const gradCache = new Map();
    function grad(r, g, b) {
      const key = (r >> 4) << 8 | (g >> 4) << 4 | (b >> 4);
      let gd = gradCache.get(key);
      if (!gd) {
        const R = 10;
        gd = lc.createRadialGradient(0, 0, 0, 0, 0, R);
        gd.addColorStop(0, `rgba(${r},${g},${b},0.34)`);
        gd.addColorStop(0.35, `rgba(${r},${g},${b},0.09)`);
        gd.addColorStop(1, `rgba(${r},${g},${b},0)`);
        gradCache.set(key, gd);
      }
      return gd;
    }
    let scale = 1, ox = 0, oy = 0, dpr = 1;
    const sil = document.createElement('canvas');
    function buildSil() {
      sil.width = canvas.width; sil.height = canvas.height;
      const sc = sil.getContext('2d');
      sc.clearRect(0, 0, sil.width, sil.height);
      if (!(lines && lines.length)) return;
      sc.filter = 'blur(' + (2.4 * dpr) + 'px)';
      sc.strokeStyle = 'rgba(150,162,190,0.55)';
      sc.lineWidth = Math.max(1, 2 * dpr); sc.lineCap = 'round'; sc.lineJoin = 'round';
      sc.beginPath();
      for (let i = 0; i < lines.length; i++) {
        const L = lines[i];
        sc.moveTo(ox + L[0] * scale, oy + L[1] * scale);
        sc.lineTo(ox + L[2] * scale, oy + L[3] * scale);
      }
      sc.stroke(); sc.filter = 'none';
    }
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = canvas.clientWidth, ch = canvas.clientHeight;
      canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
      lit.width = canvas.width; lit.height = canvas.height;
      const s = Math.min(cw / w, ch / h);
      scale = s * dpr;
      ox = (cw - w * s) / 2 * dpr; oy = (ch - h * s) / 2 * dpr;
      buildSil();
    }
    resize();
    window.addEventListener('resize', resize);

    function drawFrame(fi) {
      fi = Math.max(0, Math.min(frames - 1, fi | 0));
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#0b0d14';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (bg && bg.complete && bg.naturalWidth) { ctx.globalAlpha = 0.9; ctx.drawImage(bg, ox, oy, w * scale, h * scale); ctx.globalAlpha = 1; }
      if (!bg && sil.width) { ctx.globalAlpha = 0.3; ctx.drawImage(sil, 0, 0); ctx.globalAlpha = 1; }
      // draw the lights onto an offscreen layer, then composite with a soft blur
      lc.setTransform(1, 0, 0, 1, 0, 0);
      lc.clearRect(0, 0, lit.width, lit.height);
      lc.globalCompositeOperation = 'lighter';
      const base = fi * N * 3;
      const R = 10;
      for (let i = 0; i < N; i++) {
        const c = base + i * 3;
        const r = data[c], g = data[c + 1], b = data[c + 2];
        if (r + g + b < 24) continue;
        const x = ox + nodes[i][0] * scale, y = oy + nodes[i][1] * scale;
        lc.setTransform(scale, 0, 0, scale, x, y);
        lc.fillStyle = grad(r, g, b);
        lc.fillRect(-R, -R, 2 * R, 2 * R);
      }
      lc.setTransform(1, 0, 0, 1, 0, 0);
      for (let i = 0; i < N; i++) {
        const c = base + i * 3;
        const r = data[c], g = data[c + 1], b = data[c + 2];
        if (r + g + b < 24) continue;
        const x = ox + nodes[i][0] * scale, y = oy + nodes[i][1] * scale;
        lc.fillStyle = `rgb(${r},${g},${b})`;
        lc.globalAlpha = 0.6; lc.beginPath(); lc.arc(x, y, 1.3 * dpr, 0, 6.2832); lc.fill(); lc.globalAlpha = 1;
      }
      ctx.globalCompositeOperation = 'lighter';
      ctx.filter = 'blur(' + (2.8 * dpr) + 'px)';
      ctx.globalAlpha = 0.75;
      ctx.drawImage(lit, 0, 0);
      ctx.globalAlpha = 1;
      ctx.filter = 'none';
      ctx.globalCompositeOperation = 'source-over';
    }

    let raf = 0, posFn = null;
    function loop() {
      if (posFn) drawFrame(Math.round(posFn() / step));
      raf = requestAnimationFrame(loop);
    }
    return {
      start(positionMs) { posFn = positionMs; if (!raf) loop(); },
      stop() { cancelAnimationFrame(raf); raf = 0; },
      drawFrame, frames, step,
      durationMs: frames * step,
    };
  }

  NS.loadShow = loadShow;
  NS.makeRenderer = makeRenderer;
})();
