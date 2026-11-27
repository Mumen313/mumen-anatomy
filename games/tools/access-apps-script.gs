/**
 * Mumen Anatomy – doorman for the locked games (Practical Cadaver, Cadaver Atlas).
 * Lives in a private Google Sheet (Extensions → Apps Script). TEMPLATE in the repo:
 * the real copy has the keys filled in and must never be published.
 *
 * Sheet "Users": Created | Email | Name | Status | Password | Games | Last login | Logins | Note
 *   Status: pending → you set "approved" → a password Mumen####Varna is made and emailed.
 *           "blocked" → the person can no longer log in (also on remembered devices).
 *   Games:  practical, atlas   (or "all")
 * Sheet "Log": every login, failed try and visit.
 */
const KEYS = {
  practical: '__KEY_PRACTICAL__', // raw AES key of Practical Cadaver (base64)
  atlas: '__KEY_ATLAS__',         // raw AES key of Cadaver Atlas (base64) – empty = not via this doorman yet
};
const GAMES = { practical: 'Practical Cadaver', atlas: 'Cadaver Atlas' };
const SITE = 'https://mumen313.github.io/mumen-anatomy/';
const LINKS = { practical: SITE + 'games/practical-cadaver/', atlas: SITE + 'games/cadaver-atlas/' };
const DEFAULT_GAMES = 'practical, atlas';

/* ---------- run ONCE from the editor: creates the two sheets + the trigger ---------- */
function setup() {
  const ss = SpreadsheetApp.getActive();
  const u = ss.getSheetByName('Users') || ss.insertSheet('Users');
  if (u.getLastRow() === 0) {
    u.appendRow(['Created', 'Email', 'Name', 'Status', 'Password', 'Games', 'Last login', 'Logins', 'Note']);
    u.setFrozenRows(1); u.getRange('A1:I1').setFontWeight('bold');
    u.getRange('D2:D2000').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['pending', 'approved', 'blocked']).build());
  }
  const l = ss.getSheetByName('Log') || ss.insertSheet('Log');
  if (l.getLastRow() === 0) { l.appendRow(['Time', 'Email', 'Name', 'Game', 'Result', 'Device']); l.setFrozenRows(1); l.getRange('A1:F1').setFontWeight('bold'); }
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('onStatusEdit').forSpreadsheet(ss).onEdit().create();
}

/* ---------- web app ---------- */
function doPost(e) { let p = {}; try { p = JSON.parse(e.postData.contents || '{}'); } catch (_) {} return out(handle(p)); }
function doGet(e) { return out(handle(e.parameter || {})); }
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function handle(p) {
  const email = String(p.email || '').trim().toLowerCase();
  const game = GAMES[p.game] ? p.game : 'practical';
  const device = String(p.device || '').slice(0, 120);
  if (p.action === 'request') return request(email, String(p.name || '').trim().slice(0, 80), String(p.note || '').slice(0, 300), device);
  if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, error: 'Please type your email.' };
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const { sheet, row, user } = findUser(email);
    if (p.action === 'login') {
      const cache = CacheService.getScriptCache(); const fk = 'fail_' + email; const fails = +(cache.get(fk) || 0);
      if (fails >= 6) { log(email, user && user.name, game, 'too many tries', device); return { ok: false, error: 'Too many wrong tries – wait 15 minutes.' }; }
      const fail = (why, msg) => { cache.put(fk, String(fails + 1), 900); log(email, user && user.name, game, why, device); return { ok: false, error: msg }; };
      if (!user) return fail('unknown email', 'This email has no access yet. Use “Request access”.');
      if (user.status === 'pending') return fail('pending', 'Your request is waiting for approval.');
      if (user.status !== 'approved') return fail('blocked', 'Your access was removed.');
      if (String(p.password || '').trim() !== String(user.password).trim()) return fail('wrong password', 'Wrong password.');
      if (!allowed(user, game)) return fail('no access to this game', 'You have no access to ' + GAMES[game] + '.');
      if (!KEYS[game] || KEYS[game].indexOf('__') === 0) return fail('game not connected', GAMES[game] + ' is not connected yet.');
      cache.remove(fk);
      touch(sheet, row, user); log(email, user.name, game, 'login ✓', device);
      return { ok: true, key: KEYS[game], name: user.name };
    }
    if (p.action === 'open') { // remembered device opens the game again
      if (!user || user.status !== 'approved' || !allowed(user, game)) { log(email, user && user.name, game, 'blocked (remembered device)', device); return { ok: false, blocked: true }; }
      touch(sheet, row, user); log(email, user.name, game, 'opened', device);
      return { ok: true };
    }
    return { ok: false, error: 'unknown action' };
  } finally { lock.releaseLock(); }
}

function request(email, name, note, device) {
  if (!/^\S+@\S+\.\S+$/.test(email) || !name) return { ok: false, error: 'Please type your name and email.' };
  const { user } = findUser(email);
  if (user) return { ok: true, status: user.status, message: user.status === 'approved' ? 'You already have access – check your email for the password.' : 'Your request is already waiting for approval.' };
  sheetUsers().appendRow([new Date(), email, name, 'pending', '', DEFAULT_GAMES, '', 0, note]);
  log(email, name, '-', 'access requested', device);
  MailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'Mumen Anatomy – access request from ' + name,
    name + ' (' + email + ') asks for access to the locked games.' + (note ? '\n\nNote: ' + note : '') +
    '\n\nTo allow: open the sheet "' + SpreadsheetApp.getActive().getName() + '" → Users → set Status to "approved". The password is created and emailed automatically.\n' + SpreadsheetApp.getActive().getUrl());
  return { ok: true, status: 'pending', message: 'Request sent ✓ You will get your password by email once Mumen approves it.' };
}

/* ---------- approve → password + email ---------- */
function onStatusEdit(e) {
  const sh = e.range.getSheet(); if (sh.getName() !== 'Users' || e.range.getColumn() !== 4 || e.range.getRow() < 2) return;
  const r = e.range.getRow(); const v = sh.getRange(r, 1, 1, 9).getValues()[0];
  if (String(v[3]).trim() !== 'approved' || !v[1]) return;
  let pw = String(v[4]).trim();
  if (!pw) { pw = 'Mumen' + (1000 + Math.floor(Math.random() * 9000)) + 'Varna'; sh.getRange(r, 5).setValue(pw); }
  if (!String(v[5]).trim()) sh.getRange(r, 6).setValue(DEFAULT_GAMES);
  const games = gameList(String(v[5]).trim() || DEFAULT_GAMES);
  MailApp.sendEmail(String(v[1]).trim(), 'Your access to Mumen Anatomy',
    'Hi ' + (v[2] || '') + ',\n\nyou now have access to the private study games of Mumen Anatomy.\n\n' +
    games.map((g) => GAMES[g] + ': ' + LINKS[g]).join('\n') +
    '\n\nEmail: ' + String(v[1]).trim() + '\nPassword: ' + pw +
    '\n\nThe password is personal – please do not share it. Every login is recorded.\n\nMumen Uthman');
}

/* ---------- helpers ---------- */
function sheetUsers() { return SpreadsheetApp.getActive().getSheetByName('Users'); }
function findUser(email) {
  const sheet = sheetUsers(); const vals = sheet.getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) if (String(vals[i][1]).trim().toLowerCase() === email) {
    return { sheet, row: i + 1, user: { name: vals[i][2], status: String(vals[i][3]).trim(), password: vals[i][4], games: String(vals[i][5]), logins: +vals[i][7] || 0 } };
  }
  return { sheet, row: 0, user: null };
}
function gameList(s) { s = String(s || '').toLowerCase(); return s.indexOf('all') >= 0 ? Object.keys(GAMES) : Object.keys(GAMES).filter((g) => s.indexOf(g) >= 0); }
function allowed(user, game) { return gameList(user.games || DEFAULT_GAMES).indexOf(game) >= 0; }
function touch(sheet, row, user) { sheet.getRange(row, 7, 1, 2).setValues([[new Date(), (user.logins || 0) + 1]]); }
function log(email, name, game, result, device) {
  SpreadsheetApp.getActive().getSheetByName('Log').appendRow([new Date(), email, name || '', GAMES[game] || game, result, device]);
}
