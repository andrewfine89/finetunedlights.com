// Show schedule and tonight's status line.
// Seasons (every year):
//   Halloween: Oct 24 - Oct 31            (HALLOWEEN switches it on/off)
//   Christmas: day after Thanksgiving - Jan 1, then a quiet grace week Jan 2 - Jan 6
// Nightly hours: sunset to 10 pm Sun-Thu; midnight Fri, Sat, Oct 31, Dec 24, Dec 25, Dec 31, Jan 1.
// Grace week: sunset to 10 pm every night.
// Sunset is computed for the show's location (rounded) in its own time zone.
const LAT = 35.60, LON = -97.66;
const TZ = 'America/Chicago';
const HALLOWEEN = true;

function sunsetUTC(dateUTC) {
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
  return new Date((Jt + H / 360 - 2440587.5) * 86400000);
}

function partsIn(date, tz) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, weekday: 'short',
    year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });
  const o = {}; for (const p of f.formatToParts(date)) o[p.type] = p.value;
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(o.weekday);
  return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour % 24, min: +o.minute, wd };
}
function fmtTime(date) {
  return new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).format(date).toLowerCase();
}

// day of month of Thanksgiving (4th Thursday of November) in the show's time zone
function thanksgivingDay(year) {
  const nov1 = partsIn(new Date(Date.UTC(year, 10, 1, 18)), TZ);
  return 1 + ((4 - nov1.wd + 7) % 7) + 21;
}

function season(p) {
  if (HALLOWEEN && p.m === 10 && p.d >= 24) return { name: 'halloween', grace: false };
  if (p.m === 11 && p.d > thanksgivingDay(p.y)) return { name: 'christmas', grace: false };
  if (p.m === 12) return { name: 'christmas', grace: false };
  if (p.m === 1 && p.d === 1) return { name: 'christmas', grace: false };
  if (p.m === 1 && p.d >= 2 && p.d <= 6) return { name: 'christmas', grace: true };
  return null;
}

// closing time as minutes after local midnight (1440 = midnight)
function closeMinutes(p, s) {
  if (s.grace) return 22 * 60;
  const holiday = (p.m === 12 && (p.d === 24 || p.d === 25 || p.d === 31)) || (p.m === 1 && p.d === 1) || (p.m === 10 && p.d === 31);
  const weekend = p.wd === 5 || p.wd === 6;
  return (holiday || weekend) ? 24 * 60 : 22 * 60;
}

function offSeasonText(p) {
  if (p.m <= 2) return 'Thanks for a great season. Back <b>next Halloween</b>';
  if (HALLOWEEN && (p.m < 10 || (p.m === 10 && p.d < 24))) return 'Halloween show opens <b>Oct 24</b>';
  if (p.m < 11 || (p.m === 11 && p.d <= thanksgivingDay(p.y))) {
    const tg = thanksgivingDay(p.m === 11 ? p.y : p.y);
    return 'Back the day after Thanksgiving, <b>Nov ' + (tg + 1) + '</b>';
  }
  return 'Thanks for a great season. Back <b>next Halloween</b>';
}

function showStatus(now = new Date()) {
  const p = partsIn(now, TZ);
  const s = season(p);
  if (!s) return { on: false, text: offSeasonText(p) };
  const set = sunsetUTC(new Date(Date.UTC(p.y, p.m - 1, p.d, 18, 0, 0)));
  const ps = partsIn(set, TZ);
  const minutesNow = p.h * 60 + p.min, minutesSet = ps.h * 60 + ps.min;
  const close = closeMinutes(p, s);
  const closeText = close === 24 * 60 ? 'midnight' : '10 pm';
  if (minutesNow < minutesSet) {
    const wait = minutesSet - minutesNow;
    const soon = wait <= 90 ? ' (in ' + wait + ' min)' : '';
    return { on: false, text: "Tonight's show starts at sunset, <b>" + fmtTime(set) + '</b>' + soon };
  }
  if (minutesNow < close) return { on: true, text: 'Show is <b>on now</b> until ' + closeText };
  return { on: false, text: 'Done for tonight. Back at <b>sunset tomorrow</b>' };
}

document.addEventListener('DOMContentLoaded', () => {
  const seasonEl = document.getElementById('season');
  if (seasonEl) {
    const y = partsIn(new Date(), TZ).y;
    seasonEl.textContent = 'November ' + (thanksgivingDay(y) + 1) + ' to January 1';
  }
  const el = document.getElementById('status');
  if (!el) return;
  const paint = () => { const s = showStatus(); el.innerHTML = s.text; el.classList.toggle('on', s.on); };
  paint(); setInterval(paint, 30000);
});
