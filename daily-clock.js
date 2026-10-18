// One calendar boundary for the server selection and every open browser.
export const DAILY_TIME_ZONE = 'America/New_York';
const dateFormat = new Intl.DateTimeFormat('en-CA', { timeZone: DAILY_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const clockFormat = new Intl.DateTimeFormat('en-CA', { timeZone: DAILY_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
const parts = (formatter, at) => Object.fromEntries(formatter.formatToParts(new Date(at)).map(p => [p.type, p.value]));
export function dailyDate(at = Date.now()) {
  const p = parts(dateFormat, at);
  return `${p.year}-${p.month}-${p.day}`;
}
export function nextDailyReset(at = Date.now()) {
  const p = parts(dateFormat, at);
  const target = Date.UTC(+p.year, +p.month - 1, +p.day + 1);
  let guess = target;
  // Resolve the next local midnight with its own offset, including DST changes.
  for (let i = 0; i < 3; i++) {
    const q = parts(clockFormat, guess);
    const wall = Date.UTC(+q.year, +q.month - 1, +q.day, +q.hour, +q.minute, +q.second);
    guess += target - wall;
  }
  return guess;
}
