/**
 * Skim & Trust 사용성 실험 로그 수집 (구글 시트 연결용 Apps Script)
 *
 * 설치
 * 1. 구글 시트를 새로 만들고 [확장 프로그램] > [Apps Script]를 연다.
 * 2. 이 파일 내용을 Code.gs에 통째로 붙여넣고 저장한다.
 * 3. [배포] > [새 배포] > 유형: 웹 앱
 *    실행 사용자: 나 / 액세스 권한: 모든 사용자  로 배포하고 권한을 허용한다.
 * 4. 웹 앱 URL(https://script.google.com/macros/s/.../exec)을 관리자 화면 [설정]에 넣는다.
 *
 * 시트 구성 (처음 기록될 때 자동 생성)
 * - sessions: 과제 1회당 1줄. 상태(진행 중, 결정 완료, 완료)와 요약 지표, 설문 응답
 * - events: 행동 로그 1건당 1줄 (시간, 종류, 세부 내용)
 * - raw: 과제가 끝날 때 받은 전체 데이터(JSON) 백업
 */

const SHEET_ID = '';   // 시트에 붙은 스크립트가 아니면 기록할 시트 ID를 넣는다
const ADMIN_KEY = 'CHANGE_ME';   // 관리자 화면에서 기록을 불러올 때 쓰는 키
const SESSION_HEAD = ['sid', 'pid', 'slot', 'product', 'condition', 'status', 'started_at', 'updated_at', 'device', 'screen',
  'choice', 'decision_time_s', 'reviews_expanded', 'reviews_viewed_1s', 'review_page_visits',
  'ai_toggle_clicks', 'ai_hidden_at_end', 'chip_clicks', 'chip_clicks_from_product', 'chips_used', 'temp_taps', 'ai_label_taps',
  'sort_changes', 'filter_used', 'photo_toggle', 'helpful_clicks', 'unhelpful_clicks', 'detail_expand_clicks',
  'q1', 'q2', 'q3', 'q4', 'open1', 'open2'];
const EVENT_HEAD = ['received_at', 'sid', 'pid', 'product', 'condition', 't', 'type', 'review', 'value', 'detail'];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.kind === 'start') upsertSession_(d, Object.assign({ status: '진행 중' }, d.session || {}));
    else if (d.kind === 'events') appendEvents_(d);
    else if (d.kind === 'session') {
      const row = Object.assign({ status: d.status }, d.summary || {});
      upsertSession_(d, row);
      if (d.status === '완료') appendRaw_(d);
    }
    return out_({ ok: true });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  const p = e.parameter || {};
  CB_ = /^[A-Za-z_$][\w$]*$/.test(p.callback || '') ? p.callback : '';
  if (p.action === 'ping') {
    return out_({ ok: true, sheet: ss_().getUrl(), name: ss_().getName() });
  }
  if (p.key !== ADMIN_KEY) return out_({ ok: false, error: '관리자 키가 맞지 않습니다.' });
  if (p.action === 'sessions') return out_({ ok: true, rows: readSheet_('sessions') });
  if (p.action === 'events') {
    const rows = readSheet_('events').filter(function (r) { return !p.sid || r.sid === p.sid; });
    return out_({ ok: true, rows: rows });
  }
  if (p.action === 'hide') {   // 파일럿, 테스트 기록 표시
    const sh = sheet_('sessions', SESSION_HEAD);
    const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    const r = findRow_(sh, p.sid);
    if (r > 0) sh.getRange(r, head.indexOf('status') + 1).setValue('제외');
    return out_({ ok: true });
  }
  return out_({ ok: false, error: 'unknown action' });
}

/* ---------- 내부 ---------- */
function ss_() { return SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet(); }
let CB_ = '';
function out_(o) {
  if (CB_) return ContentService.createTextOutput(CB_ + '(' + JSON.stringify(o) + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function sheet_(name, head) {
  const ss = ss_();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}
function findRow_(sh, sid) {
  if (sh.getLastRow() < 2) return -1;
  const f = sh.getRange(2, 1, sh.getLastRow() - 1, 1).createTextFinder(sid).matchEntireCell(true).findNext();
  return f ? f.getRow() : -1;
}
function upsertSession_(d, fields) {
  const sh = sheet_('sessions', SESSION_HEAD);
  let head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const now = new Date();
  const rec = Object.assign({}, fields, { sid: d.sid, pid: d.pid, slot: d.slot || '', product: d.product, condition: d.condition, updated_at: now });
  if (fields.ua) rec.device = fields.ua;
  delete rec.ua;
  // 처음 보는 항목은 열을 추가
  Object.keys(rec).forEach(function (k) {
    if (head.indexOf(k) < 0) { head.push(k); sh.getRange(1, head.length).setValue(k).setFontWeight('bold'); }
  });
  let r = findRow_(sh, d.sid);
  if (r < 0) { r = sh.getLastRow() + 1; }
  const cur = r <= sh.getLastRow() ? sh.getRange(r, 1, 1, head.length).getValues()[0] : head.map(function () { return ''; });
  if (cur[head.indexOf('status')] === '완료' && rec.status !== '완료') rec.status = '완료';
  head.forEach(function (k, i) {
    if (rec[k] !== undefined && rec[k] !== null) cur[i] = typeof rec[k] === 'object' && !(rec[k] instanceof Date) ? JSON.stringify(rec[k]) : rec[k];
  });
  sh.getRange(r, 1, 1, head.length).setValues([cur]);
}
function appendEvents_(d) {
  const sh = sheet_('events', EVENT_HEAD);
  const now = new Date();
  const rows = (d.events || []).map(function (ev) {
    const rest = Object.assign({}, ev);
    ['t', 'type', 'review', 'v'].forEach(function (k) { delete rest[k]; });
    return [now, d.sid, d.pid, d.product, d.condition, ev.t, ev.type, ev.review || '', ev.v !== undefined ? String(ev.v) : '', Object.keys(rest).length ? JSON.stringify(rest) : ''];
  });
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, EVENT_HEAD.length).setValues(rows);
}
function appendRaw_(d) {
  const sh = sheet_('raw', ['received_at', 'sid', 'pid', 'json']);
  sh.appendRow([new Date(), d.sid, d.pid, JSON.stringify(d).slice(0, 49000)]);
}
function readSheet_(name) {
  const sh = ss_().getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  const v = sh.getDataRange().getValues(), head = v.shift();
  return v.map(function (row) {
    const o = {};
    head.forEach(function (k, i) { o[k] = row[i] instanceof Date ? row[i].toISOString() : row[i]; });
    return o;
  });
}
