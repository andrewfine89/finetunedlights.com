// Show hours: daily, sunset to midnight. Sunset is computed for the show's
// location (rounded; good to a minute), in the visitor's device time.
const LAT = 35.60, LON = -97.66;
const TZ = 'America/Chicago';

function sunsetUTC(dateUTC) {
  // NOAA sunset, returns a Date (UTC) for the calendar day of dateUTC in TZ.
  const rad = Math.PI / 180;
  const y = dateUTC.getUTCFullYear(), m = dateUTC.getUTCMonth() + 1, d = dateUTC.getUTCDate();
  const a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
  const jdn = d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
  const n = jdn - 2451545 + 0.0008 - LON / 360;
  const M = (357.5291 + 0.98560028 * n) % 360;
  const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  const L = (M + C + 180 + 102.9372) % 360;
  const Jt = 2451545 + n + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * L * rad);
  const dec = Math.asin(Math.sin(L * rad) * Math.sin(23.4397 * rad));
  const cosH = (Math.sin(-0.833 * rad) - Math.sin(LAT * rad) * Math.sin(dec)) / (Math.cos(LAT * rad) * Math.cos(dec));
  const H = Math.acos(Math.max(-1, Math.min(1, cosH))) / rad;
  const Jset = Jt + H / 360;
  return new Date((Jset - 2440587.5) * 86400000);
}

function partsIn(date, tz) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false,
    year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });
  const o = {}; for (const p of f.formatToParts(date)) o[p.type] = p.value;
  return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour % 24, min: +o.minute };
}
function fmtTime(date) {
  return new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).format(date).toLowerCase();
}

function showStatus(now = new Date()) {
  const p = partsIn(now, TZ);
  // Sunset for "today" in show-local time. Build a UTC date near local noon so the day is right.
  const noonish = new Date(Date.UTC(p.y, p.m - 1, p.d, 18, 0, 0));
  const set = sunsetUTC(noonish);
  const minutesNow = p.h * 60 + p.min;
  const ps = partsIn(set, TZ);
  const minutesSet = ps.h * 60 + ps.min;
  if (minutesNow >= minutesSet) {
    return { on: true, text: 'Show is <b>on now</b> until midnight' };
  }
  const wait = minutesSet - minutesNow;
  const soon = wait <= 90 ? ` (in ${wait} min)` : '';
  return { on: false, text: `Tonight's show starts at sunset, <b>${fmtTime(set)}</b>${soon}` };
}

document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('status');
  if (!el) return;
  const paint = () => { const s = showStatus(); el.innerHTML = s.text; el.classList.toggle('on', s.on); };
  paint(); setInterval(paint, 30000);
});
