/**
 * Mumen Anatomy – doorman for the locked games (Practical Cadaver, Cadaver Atlas).
 * Data lives in NOTION (page "Game access – Mumen Anatomy": databases Users + Log).
 * This Google Apps Script is only the invisible engine: checks passwords, writes the Log,
 * creates + emails passwords when you set a person to "approved".
 * TEMPLATE in the repo – the real copy has the keys + Notion token filled in and must never be published.
 */
const NOTION_TOKEN = '__NOTION_TOKEN__';               // secret of the Notion integration "Mumen Anatomy Doorman"
const USERS_DB = '425d43edb34f81a29d23d776fdf92b5f';   // Notion database "Users"
const LOG_DB = '425d43edb34f810ebb08c237bb8fa533';     // Notion database "Log"
const KEYS = {
  practical: '__KEY_PRACTICAL__', // raw AES key of Practical Cadaver (base64)
  atlas: '__KEY_ATLAS__',         // raw AES key of Cadaver Atlas (base64)
};
const GAMES = { practical: 'Practical Cadaver', atlas: 'Cadaver Atlas' };
const SITE = 'https://mumen313.github.io/mumen-anatomy/';
const LINKS = { practical: SITE + 'games/practical-cadaver/', atlas: SITE + 'games/cadaver-atlas/' };

/* ---------- run ONCE from the editor: tests Notion + starts the 5-minute password mailer ---------- */
function setup() {
  notion('get', 'databases/' + USERS_DB); notion('get', 'databases/' + LOG_DB); // throws if not connected
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sendPasswords').timeBased().everyMinutes(5).create();
  Logger.log('OK – Notion connected, password mailer runs every 5 minutes.');
}

/* ---------- web app ---------- */
function doPost(e) { let p = {}; try { p = JSON.parse(e.postData.contents || '{}'); } catch (_) {} return out(handle(p)); }
function doGet(e) { return out(handle(e.parameter || {})); }
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function handle(p) {
  try {
    const email = String(p.email || '').trim().toLowerCase();
    const game = GAMES[p.game] ? p.game : 'practical';
    const device = String(p.device || '').slice(0, 120);
    if (p.action === 'request') return request(email, String(p.name || '').trim().slice(0, 80), String(p.note || '').slice(0, 300), device);
    if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, error: 'Please type your email.' };
    const user = findUser(email);
    if (p.action === 'login') {
      const cache = CacheService.getScriptCache(); const fk = 'fail_' + email; const fails = +(cache.get(fk) || 0);
      if (fails >= 6) { log(email, user, game, 'too many tries', device); return { ok: false, error: 'Too many wrong tries – wait 15 minutes.' }; }
      const fail = (why, msg) => { cache.put(fk, String(fails + 1), 900); log(email, user, game, why, device); return { ok: false, error: msg }; };
      if (!user) return fail('unknown email', 'This email has no access yet. Use “Request access”.');
      if (user.status === 'pending') return fail('pending', 'Your request is waiting for approval.');
      if (user.status !== 'approved' || !user.password) return fail('blocked', user.status === 'approved' ? 'Your password is being created – check your email in a few minutes.' : 'Your access was removed.');
      if (String(p.password || '').trim() !== user.password) return fail('wrong password', 'Wrong password.');
      if (!allowed(user, game)) return fail('no access to this game', 'You have no access to ' + GAMES[game] + '.');
      if (!KEYS[game] || KEYS[game].indexOf('__') === 0) return fail('game not connected', GAMES[game] + ' is not connected yet.');
      cache.remove(fk); touch(user); log(email, user, game, 'login ✓', device);
      return { ok: true, key: KEYS[game], name: user.name };
    }
    if (p.action === 'open') { // a remembered device opens the game again
      if (!user || user.status !== 'approved' || !allowed(user, game)) { log(email, user, game, 'blocked', device); return { ok: false, blocked: true }; }
      touch(user); log(email, user, game, 'opened', device); return { ok: true };
    }
    return { ok: false, error: 'unknown action' };
  } catch (err) { console.error(err); return { ok: false, error: 'Server busy – try again in a moment.' }; }
}

function request(email, name, note, device) {
  if (!/^\S+@\S+\.\S+$/.test(email) || !name) return { ok: false, error: 'Please type your name and email.' };
  const user = findUser(email);
  if (user) return { ok: true, message: user.status === 'approved' ? 'You already have access – check your email for the password.' : user.status === 'blocked' ? 'This email has no access.' : 'Your request is already waiting for approval.' };
  notion('post', 'pages', { parent: { database_id: USERS_DB }, properties: {
    Name: title(name), Email: { email }, Status: { select: { name: 'pending' } }, Note: text(note),
    Games: { multi_select: [{ name: GAMES.practical }, { name: GAMES.atlas }] }, Requested: { date: { start: new Date().toISOString() } }, Logins: { number: 0 } } });
  log(email, { name }, '-', 'access requested', device);
  MailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'Mumen Anatomy – access request from ' + name,
    name + ' (' + email + ') asks for access to the locked games.' + (note ? '\n\nNote: ' + note : '') +
    '\n\nTo allow: open Notion → "Game access – Mumen Anatomy" → Users → set Status to "approved". The password is created and emailed within 5 minutes.\nhttps://www.notion.so/' + USERS_DB);
  return { ok: true, message: 'Request sent ✓ You will get your password by email once Mumen approves it.' };
}

/* ---------- every 5 minutes: approved + not yet emailed → make password, email it ---------- */
function sendPasswords() {
  const res = notion('post', 'databases/' + USERS_DB + '/query', { filter: { and: [
    { property: 'Status', select: { equals: 'approved' } }, { property: 'Password emailed', checkbox: { equals: false } }] } });
  for (const pg of res.results) {
    const u = parseUser(pg); if (!u.email) continue;
    const pw = u.password || ('Mumen' + (1000 + Math.floor(Math.random() * 9000)) + 'Varna');
    const games = u.games.length ? u.games : [GAMES.practical, GAMES.atlas];
    MailApp.sendEmail(u.email, 'Your access to Mumen Anatomy',
      'Hi ' + (u.name || '') + ',\n\nyou now have access to the private study games of Mumen Anatomy.\n\n' +
      Object.keys(GAMES).filter((g) => games.indexOf(GAMES[g]) >= 0).map((g) => GAMES[g] + ': ' + LINKS[g]).join('\n') +
      '\n\nEmail: ' + u.email + '\nPassword: ' + pw + '\n\nThe password is personal – please do not share it. Every login is recorded.\n\nMumen Uthman');
    notion('patch', 'pages/' + u.id, { properties: { Password: text(pw), 'Password emailed': { checkbox: true },
      Games: { multi_select: games.map((n) => ({ name: n })) } } });
  }
}

/* ---------- Notion helpers ---------- */
function notion(method, path, body) {
  const r = UrlFetchApp.fetch('https://api.notion.com/v1/' + path, { method, muteHttpExceptions: true, contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + NOTION_TOKEN, 'Notion-Version': '2022-06-28' }, payload: body ? JSON.stringify(body) : undefined });
  const j = JSON.parse(r.getContentText() || '{}');
  if (r.getResponseCode() >= 300) throw new Error('Notion ' + r.getResponseCode() + ': ' + (j.message || ''));
  return j;
}
const title = (s) => ({ title: [{ text: { content: String(s || '').slice(0, 200) } }] });
const text = (s) => ({ rich_text: s ? [{ text: { content: String(s).slice(0, 1900) } }] : [] });
const plain = (arr) => (arr || []).map((t) => t.plain_text).join('');
function parseUser(pg) {
  const P = pg.properties;
  return { id: pg.id, name: plain(P.Name.title), email: String(P.Email.email || '').trim().toLowerCase(), status: (P.Status.select && P.Status.select.name) || '',
    password: plain(P.Password.rich_text).trim(), games: (P.Games.multi_select || []).map((o) => o.name), logins: P.Logins.number || 0 };
}
function findUser(email) {
  const res = notion('post', 'databases/' + USERS_DB + '/query', { filter: { property: 'Email', email: { equals: email } }, page_size: 1 });
  return res.results.length ? parseUser(res.results[0]) : null;
}
function allowed(user, game) { return !user.games.length || user.games.indexOf(GAMES[game]) >= 0; }
function touch(user) { notion('patch', 'pages/' + user.id, { properties: { 'Last login': { date: { start: new Date().toISOString() } }, Logins: { number: (user.logins || 0) + 1 } } }); }
function log(email, user, game, result, device) {
  try {
    notion('post', 'pages', { parent: { database_id: LOG_DB }, properties: {
      Who: title((user && user.name) || email), Email: { email: email || null }, Game: { select: { name: GAMES[game] || '-' } },
      Result: { select: { name: result } }, Device: text(device), Time: { date: { start: new Date().toISOString() } } } });
  } catch (e) { console.error(e); }
}
