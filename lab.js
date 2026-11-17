/* 실험 공통: 상품/조건 정의, 구글 시트 전송 */
(function () {
  var C = window.LAB_CONFIG || {};
  var Q = new URLSearchParams(location.search);
  var LS = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  if (Q.get('gs')) LS.set('lab_gas_url', Q.get('gs'));

  var LAB = window.LAB = {
    PRODUCTS: {
      chicken: { name: '닭가슴살', full: '득근파티 통 닭가슴살 6종 혼합', img: 'assets/chicken/product_main.jpg' },
      battery: { name: '보조배터리', full: '보바 22.5W 휴대용 보조배터리 20000mAh', img: 'assets/battery/product_main.jpg' },
      pants: { name: '트레이닝복', full: '차쿠 1+1 남여공용 트레이닝복 팬츠', img: 'assets/pants/product_main.jpg' }
    },
    CONDS: { base: '비교군', p1: 'P1' },
    plan: C.PLAN || {},
    gasUrl: function () { return LS.get('lab_gas_url') || C.GAS_URL || ''; },
    LS: LS,
    pid: Q.get('pid') || '',
    slot: Q.get('slot') || '',
    sid: '',
    ctx: {},
    _buf: [],
    _timer: 0
  };

  function post(obj, beacon) {
    var url = LAB.gasUrl();
    if (!url) return Promise.resolve(false);
    var body = JSON.stringify(obj);
    if (beacon && navigator.sendBeacon) {
      try { if (navigator.sendBeacon(url, new Blob([body], { type: 'text/plain;charset=utf-8' }))) return Promise.resolve(true); } catch (e) {}
    }
    return fetch(url, { method: 'POST', mode: 'no-cors', keepalive: body.length < 60000, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: body })
      .then(function () { return true; }, function () { return false; });
  }
  LAB.post = post;

  /* 시트에서 읽기 (JSONP: Apps Script는 다른 주소에서 fetch로 읽을 수 없어서 script 태그로 받음) */
  var jpn = 0;
  LAB.get = function (q) {
    var url = LAB.gasUrl();
    if (!url) return Promise.reject(new Error('저장 주소가 없어요'));
    return new Promise(function (res, rej) {
      var cb = '__lab' + Date.now().toString(36) + (jpn++);
      var s = document.createElement('script'), t;
      function end() { clearTimeout(t); delete window[cb]; s.remove(); }
      window[cb] = function (d) { end(); res(d); };
      s.onerror = function () { end(); rej(new Error('시트에 연결하지 못했어요')); };
      t = setTimeout(function () { end(); rej(new Error('응답 시간이 초과됐어요')); }, 30000);
      var p = new URLSearchParams(q || {}); p.set('callback', cb);
      s.src = url + '?' + p.toString();
      document.head.appendChild(s);
    });
  };

  function base() {
    return { sid: LAB.sid, pid: LAB.ctx.pid, product: LAB.ctx.product, condition: LAB.ctx.condition, slot: LAB.slot };
  }

  /* 세션 시작 */
  LAB.start = function (info) {
    LAB.ctx = info;
    LAB.sid = info.pid + '_' + info.product + '_' + info.condition + '_' + Date.now().toString(36);
    LAB._buf = [];
    var o = base();
    o.kind = 'start';
    o.session = { started_at: info.started_at, ua: navigator.userAgent, screen: screen.width + 'x' + screen.height, status: '진행 중' };
    LS.set('lab_current', JSON.stringify({ sid: LAB.sid, pid: info.pid, product: info.product, condition: info.condition, at: Date.now() }));
    return post(o);
  };

  /* 행동 이벤트: 모아서 5초마다 전송 */
  LAB.event = function (ev) {
    if (!LAB.sid) return;
    LAB._buf.push(ev);
    if (!LAB._timer) LAB._timer = setTimeout(function () { LAB.flush(); }, 5000);
  };
  LAB.flush = function (beacon) {
    clearTimeout(LAB._timer); LAB._timer = 0;
    if (!LAB.sid || !LAB._buf.length) return Promise.resolve(true);
    var o = base(); o.kind = 'events'; o.events = LAB._buf.splice(0);
    return post(o, beacon);
  };

  /* 세션 상태와 요약 갱신 */
  LAB.update = function (status, summary, extra) {
    if (!LAB.sid) return Promise.resolve(false);
    return LAB.flush().then(function () {
      var o = base(); o.kind = 'session'; o.status = status; o.summary = summary || {};
      if (extra) o.extra = extra;
      return post(o);
    });
  };

  /* 이 기기에서 끝낸 과제 기록 (시작 화면 표시용) */
  LAB.markDone = function (pid, product, condition, choice) {
    var a = [];
    try { a = JSON.parse(LS.get('lab_done') || '[]'); } catch (e) {}
    a.push({ pid: pid, product: product, condition: condition, choice: choice, at: Date.now() });
    LS.set('lab_done', JSON.stringify(a));
  };
  LAB.doneList = function () { try { return JSON.parse(LS.get('lab_done') || '[]'); } catch (e) { return []; } };

  addEventListener('pagehide', function () { LAB.flush(true); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') LAB.flush(true); });
})();
