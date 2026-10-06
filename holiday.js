// Dress the page for the season: a string of bulbs under the header; snow in Nov-Dec.
(function () {
  const m = new Date().getMonth() + 1; // 1-12
  const xmas = !(m === 10 || m === 9);
  document.body.classList.add(xmas ? 'xmas' : 'halloween');
  const cols = xmas ? ['#ff3b30', '#34c759', '#ffd60a', '#0a84ff', '#fff6d0'] : ['#ff7a1a', '#c77dff', '#39ff6a', '#ff7a1a', '#fff6d0'];
  const host = document.getElementById('bulbs');
  if (host) {
    const n = 22, W = 1000;
    let s = `<svg viewBox="0 0 ${W} 34" preserveAspectRatio="none"><path d="M0 6 Q ${W / 2} 30 ${W} 6" fill="none" stroke="#2a2f45" stroke-width="2"/>`;
    for (let i = 0; i < n; i++) {
      const x = (i + 0.5) * W / n, t = x / W, y = 6 + 24 * 4 * t * (1 - t) * 0.5 + 2;
      s += `<g class="bulb" style="color:${cols[i % cols.length]}"><rect x="${x - 2}" y="${y}" width="4" height="4" fill="#3a4060"/><ellipse cx="${x}" cy="${y + 11}" rx="5" ry="7.5" fill="${cols[i % cols.length]}"/></g>`;
    }
    host.innerHTML = s + '</svg>';
  }
  if (xmas && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const snow = document.createElement('div'); snow.className = 'snow';
    for (let i = 0; i < 40; i++) {
      const f = document.createElement('i');
      const sz = 2 + Math.random() * 4;
      f.style.cssText = `left:${Math.random() * 100}%;width:${sz}px;height:${sz}px;opacity:${.3 + Math.random() * .5};animation-duration:${8 + Math.random() * 10}s;animation-delay:-${Math.random() * 18}s`;
      snow.appendChild(f);
    }
    document.body.appendChild(snow);
  }
})();
