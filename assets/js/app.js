'use strict';
/* 408 刷题网站：选择题答题 + 综合应用题辅导 + 错题本（localStorage） */
const SUBJECTS = ['数据结构', '操作系统', '计组', '计网'];
const LS_P = 'q408.progress.v1';
const LS_M = 'q408.mistakes.v1';
const cache = {};
const S = { xzt: {}, dt: {} }; // 当前视图状态

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s || '').replace(/[①②③④]/g, c => ({ '①': '1', '②': '2', '③': '3', '④': '4' }[c]))
  .replace(/[\s、，,。.．·（）()【】\[\]“”"']/g, '').toUpperCase();
const imgHtml = rel => rel ? '<img class="fig" src="data/' + encodeURI(rel) + '" alt="配图" loading="lazy">' : '';

function load(subject) {
  if (cache[subject]) return Promise.resolve(cache[subject]);
  return fetch('data/' + encodeURIComponent(subject) + '.json')
    .then(r => { if (!r.ok) throw new Error('加载失败 ' + r.status); return r.json(); })
    .then(d => { cache[subject] = d; return d; });
}
function getProgress() { try { return JSON.parse(localStorage.getItem(LS_P)) || {}; } catch (e) { return {}; } }
function setProgress(p) { localStorage.setItem(LS_P, JSON.stringify(p)); }
function getMistakes() { try { return JSON.parse(localStorage.getItem(LS_M)) || []; } catch (e) { return []; } }
function setMistakes(m) { localStorage.setItem(LS_M, JSON.stringify(m)); updateBadge(); }
function updateBadge() {
  const b = $('#ct-badge'); if (!b) return;
  const n = getMistakes().length;
  b.textContent = n; b.classList.toggle('hidden', !n);
}
function fmtDate(ts) { const d = new Date(ts); return d.getMonth() + 1 + '月' + d.getDate() + '日 ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }

/* ---------- 导航 ---------- */
const routes = { '': home, xzt: viewXzt, dt: viewDt, ct: viewCt, stats: viewStats };
function route() {
  const h = location.hash.replace(/^#\/?/, '');
  const v = routes[h] ? h : '';
  $$('#nav a').forEach(a => a.classList.toggle('on', a.dataset.v === v));
  routes[v]();
}
window.addEventListener('hashchange', route);

/* ---------- 首页 ---------- */
function home() {
  const app = $('#app');
  Promise.all(SUBJECTS.map(load)).then(ds => {
    const p = getProgress();
    app.innerHTML = '<h2 class="page-title">开始刷题</h2><div class="sub">选择科目进入练习；答案需作答或点击后才显示，错题自动进入错题本。</div><div class="grid">' +
      SUBJECTS.map((s, i) => {
        const d = ds[i];
        const tot = Object.values(d.sections).reduce((a, v) => a + v.qs.length, 0);
        const done = Object.values(p[s] || {}).reduce((a, sec) => a + Object.keys(sec).length, 0);
        const ok = Object.values(p[s] || {}).reduce((a, sec) => a + Object.values(sec).filter(q => q.ok).length, 0);
        const pct = done ? Math.round(ok / done * 100) : 0;
        return '<div class="card" onclick="location.hash=\'#/xzt\';S.xzt.subject=\'' + s + '\'">' +
          '<h3>' + esc(d.name) + '</h3><div class="stat">共 ' + tot + ' 题 · 已做 ' + done + ' · 正确率 ' + pct + '%</div>' +
          '<div class="bar"><i style="width:' + pct + '%"></i></div></div>';
      }).join('') + '</div>';
  }).catch(e => app.innerHTML = '<div class="empty">数据加载失败：' + esc(e.message) + '</div>');
}

/* ---------- 选择题 ---------- */
function pickBar(subject, sec, onSubj, onSec) {
  const p = $('#app');
  p.innerHTML = '<div class="pick">' +
    '<label>科目 <select id="p-subj">' + SUBJECTS.map(s => '<option' + (s === subject ? ' selected' : '') + '>' + s + '</option>').join('') + '</select></label>' +
    '<label>章节 <select id="p-sec"></select></label></div>' +
    '<div id="p-body"></div>';
  $('#p-subj').onchange = () => { S.xzt.subject = $('#p-subj').value; S.xzt.sec = null; viewXzt(); };
  return load(subject).then(d => {
    const secEl = $('#p-sec');
    const secs = Object.keys(d.sections).sort((a, b) => a.localeCompare(b, 'zh', { numeric: true }));
    secEl.innerHTML = secs.map(s => '<option value="' + s + '"' + (s === sec ? ' selected' : '') + '>' + s + ' ' + esc(d.sections[s].title) + '</option>').join('');
    secEl.onchange = () => { S.xzt.sec = secEl.value; viewXzt(); };
    const cur = secs.includes(sec) ? sec : secs[0];
    if (!sec) { S.xzt.sec = cur; }
    return cur;
  });
}
function viewXzt() {
  updateBadge();
  const subject = S.xzt.subject || SUBJECTS[0];
  const app = $('#app');
  app.innerHTML = '<h2 class="page-title">选择题练习</h2><div class="sub">点击题目作答；答案在提交或点击“看答案”后显示。</div>';
  pickBar(subject, S.xzt.sec).then(sec => renderXztList(subject, sec));
}
function renderXztList(subject, sec) {
  load(subject).then(d => {
    const v = d.sections[sec]; if (!v) return;
    const p = getProgress();
    const prog = p[subject] && p[subject][sec] || {};
    $('#p-body').innerHTML = '<div class="list">' + v.qs.map(q => {
      const st = prog[q[0]];
      const tag = st ? (st.ok ? '<span class="tag ok">✓</span>' : '<span class="tag bad">✗</span>') : '';
      return '<div class="row" data-i="' + q[0] + '"><span class="no">' + q[0] + '</span><span class="stem clamp">' + esc(q[2]) + '</span>' + tag + '</div>';
    }).join('') + '</div>';
    $$('#p-body .row').forEach(r => r.onclick = () => renderXztQuestion(subject, sec, Number(r.dataset.i), false));
  });
}
function renderXztQuestion(subject, sec, num, next) {
  load(subject).then(d => {
    const v = d.sections[sec];
    const qs = v.qs;
    const idx = qs.findIndex(q => q[0] === num);
    const q = qs[idx];
    const isOpts = /^[A-D]{1,4}$/.test(q[1]);
    const multi = isOpts && q[1].length > 1;
    const body = $('#p-body');
    body.innerHTML = '<div class="panel">' +
      '<div class="small">' + esc(d.name) + ' · ' + sec + ' ' + esc(v.title) + ' · 第 ' + q[0] + ' 题' + (multi ? '（多选）' : '') + '</div>' +
      '<h3 class="stem-text">' + esc(q[2]) + '</h3>' +
      imgHtml(q[5]) +
      '<div class="opts" id="p-opts"></div>' +
      '<div class="act-row">' +
      '<button class="btn primary" id="p-sub">提交答案</button>' +
      '<button class="btn" id="p-peek">直接看答案</button>' +
      '</div>' +
      '<div class="result" id="p-res"></div>' +
      '<div class="navbtns">' +
      '<button class="btn" id="p-prev"' + (idx <= 0 ? ' disabled' : '') + '>← 上一题</button>' +
      '<button class="btn" id="p-next"' + (idx >= qs.length - 1 ? ' disabled' : '') + '>下一题 →</button>' +
      '</div></div>';
    const optsEl = $('#p-opts');
    const opts = q[4] || [];
    const sel = new Set();
    if (isOpts) {
      optsEl.innerHTML = (opts.length ? opts : ['A', 'B', 'C', 'D']).map(t => {
        const L = t[0];
        return '<div class="opt" data-l="' + L + '">' + esc(t) + '</div>';
      }).join('');
      $$('#p-opts .opt').forEach(o => o.onclick = () => {
        if (!multi) { $$('#p-opts .opt').forEach(x => x.classList.remove('sel')); sel.clear(); }
        if (sel.has(o.dataset.l)) { sel.delete(o.dataset.l); o.classList.remove('sel'); }
        else { sel.add(o.dataset.l); o.classList.add('sel'); }
      });
    } else {
      optsEl.innerHTML = '<input type="text" id="p-txt" placeholder="输入你的答案，如 CD 或 ①I、IV…" style="width:100%">' +
        (opts.length ? '<div class="hint-line">选项参考：' + opts.map(esc).join('　') + '</div>' : '');
    }
    const reveal = (mine, ok, right) => {
      $('#p-sub').disabled = true;
      const res = $('#p-res');
      res.className = 'result show ' + (ok ? 'ok' : 'bad');
      res.innerHTML = (ok ? '✅ 回答正确' : '❌ 回答错误') +
        '<div class="ans">正确答案：' + esc(right) + '</div>' +
        (ok ? '' : '<div class="small">你的答案：' + esc(mine) + '</div>') +
        '<div class="kp">考点：' + esc(v.title) + '</div>' +
        '<div class="expl">' + esc(q[3] || '（教材无文字解析）') + '</div>';
      $$('#p-opts .opt').forEach(o => {
        if (right.includes(o.dataset.l)) o.classList.add('right');
        if (!ok && mine.includes(o.dataset.l)) o.classList.add('wrong');
      });
    };
    $('#p-sub').onclick = () => {
      const mine = isOpts ? Array.from(sel).sort().join('') : $('#p-txt').value;
      if (!mine) { alert('请先选择/输入答案'); return; }
      const ok = isOpts ? mine === q[1] : norm(mine) === norm(q[1]);
      mark(subject, sec, num, mine, ok);
      reveal(mine, ok, q[1]);
    };
    $('#p-peek').onclick = () => reveal('（未作答）', false, q[1]);
    $('#p-prev').onclick = () => renderXztQuestion(subject, sec, qs[idx - 1][0]);
    $('#p-next').onclick = () => renderXztQuestion(subject, sec, qs[idx + 1][0]);
    $('#p-body').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

/* ---------- 大题 ---------- */
function viewDt() {
  updateBadge();
  const subject = S.dt.subject || SUBJECTS[0];
  const app = $('#app');
  app.innerHTML = '<h2 class="page-title">综合应用题辅导</h2><div class="sub">先按思路引导自己动笔，需要时再点“显示解答”。</div>';
  const pick = '<div class="pick">' +
    '<label>科目 <select id="d-subj">' + SUBJECTS.map(s => '<option' + (s === subject ? ' selected' : '') + '>' + s + '</option>').join('') + '</select></label>' +
    '<label>章节 <select id="d-sec"></select></label></div><div id="d-body"></div>';
  app.innerHTML += pick;
  $('#d-subj').onchange = () => { S.dt.subject = $('#d-subj').value; S.dt.sec = null; viewDt(); };
  load(subject).then(d => {
    const secEl = $('#d-sec');
    const secs = Object.keys(d.sections).filter(s => d.sections[s].bigq.length).sort((a, b) => a.localeCompare(b, 'zh', { numeric: true }));
    if (!secs.length) { $('#d-body').innerHTML = '<div class="empty">该科暂无大题</div>'; return; }
    secEl.innerHTML = secs.map(s => '<option value="' + s + '">' + s + ' ' + esc(d.sections[s].title) + '</option>').join('');
    secEl.onchange = () => { S.dt.sec = secEl.value; renderDtList(d); };
    const cur = S.dt.sec && secs.includes(S.dt.sec) ? S.dt.sec : secs[0];
    S.dt.sec = cur; secEl.value = cur; renderDtList(d);
  });
}
function renderDtList(d) {
  const v = d.sections[S.dt.sec];
  $('#d-body').innerHTML = '<div class="list">' + v.bigq.map(b =>
    '<div class="row" data-i="' + b[0] + '"><span class="no">' + b[0] + '</span><span class="stem clamp">' + esc(b[1]) + '</span></div>'
  ).join('') + '</div>';
  $$('#d-body .row').forEach(r => r.onclick = () => renderDtDetail(d, Number(r.dataset.i)));
}
function renderDtDetail(d, num) {
  const v = d.sections[S.dt.sec];
  const b = v.bigq.find(x => x[0] === num);
  const body = $('#d-body');
  const hints = (b[3] || []).map(h => (h[0] ? h[0] + '　' : '') + esc(h[1])).join('；') || '先列出已知条件，按章节思路逐步推演。';
  body.innerHTML = '<div class="panel">' +
    '<div class="small">' + esc(d.name) + ' · ' + S.dt.sec + ' ' + esc(v.title) + ' · 综合应用题第 ' + b[0] + ' 题</div>' +
    '<h3 class="stem-text">' + esc(b[1]) + '</h3>' +
    imgHtml(b[4]) +
    '<div class="act-row">' +
    '<button class="btn" id="d-hint">💡 思路引导</button>' +
    '<button class="btn primary" id="d-ans">显示解答</button>' +
    '</div>' +
    '<div class="result" id="d-hintbox"></div>' +
    '<div class="result" id="d-ansbox"></div></div>';
  $('#d-hint').onclick = () => {
    const r = $('#d-hintbox');
    r.className = 'result show';
    r.innerHTML = '<b>思路引导</b><div class="hint-line">' + hints + '</div>';
  };
  $('#d-ans').onclick = () => {
    const r = $('#d-ansbox');
    r.className = 'result show';
    r.innerHTML = '<b>参考解答</b><div class="expl">' + esc(b[2] || '（解答待核，请翻教材）') + '</div>' +
      imgHtml(b[5]);
  };
  body.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ---------- 错题本 ---------- */
function viewCt() {
  updateBadge();
  const app = $('#app');
  const ms = getMistakes();
  app.innerHTML = '<h2 class="page-title">错题本</h2><div class="sub">答错的选择题自动记录在此（存于本机浏览器）。</div>' +
    '<div class="act-row"><button class="btn" id="m-exp">导出 JSON</button><button class="btn" id="m-clr">清空错题本</button></div>';
  if (!ms.length) { app.insertAdjacentHTML('beforeend', '<div class="empty">暂无错题记录，继续刷题吧～</div>'); bindClear(); return; }
  const list = document.createElement('div');
  list.className = 'list';
  ms.slice().reverse().forEach(m => {
    const item = document.createElement('div');
    item.className = 'mistake';
    item.innerHTML = '<div class="head"><div><b>' + esc(m.subject) + ' ' + esc(m.sec) + ' 第' + m.num + '题</b>' +
      '<div class="meta">' + fmtDate(m.ts) + ' · 我的答案 ' + esc(m.mine) + ' / 正确答案 ' + esc(m.right) + '</div></div>' +
      '<div><button class="btn small" data-a="view">解析</button> <button class="btn small" data-a="del">删除</button></div></div>' +
      '<div class="body" id="m-body-' + m.subject + '-' + m.sec + '-' + m.num + '">加载中…</div>';
    item.querySelector('[data-a=del]').onclick = () => { setMistakes(getMistakes().filter(x => !(x.subject === m.subject && x.sec === m.sec && x.num === m.num))); viewCt(); };
    item.querySelector('[data-a=view]').onclick = () => {
      item.classList.toggle('open');
      const body = item.querySelector('.body');
      if (item.classList.contains('open') && body) {
        load(m.subject).then(d => {
          const q = (d.sections[m.sec] && d.sections[m.sec].qs.find(x => x[0] === m.num));
          if (q) body.innerHTML = '<div class="dim">' + esc(q[2]) + '</div>' +
            imgHtml(q[5]) +
            ((q[4] && q[4].length) ? '<div class="hint-line">' + q[4].map(esc).join('　') + '</div>' : '') +
            '<div class="expl">' + esc(q[3] || '（教材无文字解析）') + '</div>';
          else body.innerHTML = '（该题数据不存在，可能已更新）';
        });
      }
    };
    list.appendChild(item);
  });
  app.appendChild(list);
  bindClear();
  $('#m-exp').onclick = () => {
    const blob = new Blob([JSON.stringify(ms, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = '408-错题本.json'; a.click();
  };
}
function bindClear() {
  const b = $('#m-clr'); if (!b) return;
  b.onclick = () => { if (confirm('确定清空错题本？')) { setMistakes([]); viewCt(); } };
}

/* ---------- 统计 ---------- */
function viewStats() {
  updateBadge();
  const app = $('#app');
  app.innerHTML = '<h2 class="page-title">学习统计</h2>';
  Promise.all(SUBJECTS.map(load)).then(ds => {
    const p = getProgress();
    let tDone = 0, tOk = 0, tTot = 0;
    const rows = SUBJECTS.map((s, i) => {
      const d = ds[i];
      const tot = Object.values(d.sections).reduce((a, v) => a + v.qs.length, 0);
      const done = Object.values(p[s] || {}).reduce((a, sec) => a + Object.keys(sec).length, 0);
      const ok = Object.values(p[s] || {}).reduce((a, sec) => a + Object.values(sec).filter(q => q.ok).length, 0);
      tDone += done; tOk += ok; tTot += tot;
      const pct = done ? Math.round(ok / done * 100) : 0;
      return '<div class="panel"><h3>' + esc(d.name) + '</h3><div>总题数 ' + tot + ' · 已做 ' + done + ' · 答对 ' + ok + ' · 正确率 <b>' + pct + '%</b></div>' +
        '<div class="bar"><i style="width:' + pct + '%"></i></div></div>';
    }).join('');
    const all = tDone ? Math.round(tOk / tDone * 100) : 0;
    app.innerHTML += '<div class="panel"><h3>总计</h3><div>总题数 ' + tTot + ' · 已做 ' + tDone + ' · 正确率 <b>' + all + '%</b> · 错题 ' + getMistakes().length + '</div></div>' + rows;
  });
}

/* ---------- 进度写入 ---------- */
function mark(subject, sec, num, mine, ok) {
  const p = getProgress();
  if (!p[subject]) p[subject] = {};
  if (!p[subject][sec]) p[subject][sec] = {};
  p[subject][sec][num] = { mine, ok, ts: Date.now() };
  setProgress(p);
  const ms = getMistakes();
  if (!ok) {
    load(subject).then(d => {
      const q = d.sections[sec] && d.sections[sec].qs.find(x => x[0] === num);
      ms.push({ subject, sec, num, mine, right: q ? q[1] : '?', ts: Date.now() });
      setMistakes(ms);
    });
  } else {
    setMistakes(ms.filter(x => !(x.subject === subject && x.sec === sec && x.num === num)));
  }
}

/* ---------- 启动 ---------- */
document.addEventListener('DOMContentLoaded', () => { updateBadge(); route(); });
