/* ---------- My jobs (Mine → Jobs). Each job is a timeline of stages (Underground → Final) with the blanks laid out:
   status, dates, lead, checklist, inspections, hours, notes, photos. People (lead, super, inspector…) are their own pages,
   linked from jobs and from notes with [[Name]]. Jobs and people live in jpb-jobs (in Settings → Download backup); photos
   and files live in IndexedDB "jpb-files" with their own zip backup. Own script block, all inside try. */
try {
const jbD = (x => { if (x && typeof x === "object" && Array.isArray(x.jobs)) return x;
  try { const raw = localStorage.getItem("jpb-jobs"); if (raw && raw !== "null") localStorage.setItem("jpb-jobs-unreadable", raw); } catch(e){}   /* never overwrite what we couldn't read */
  return {jobs: [], goal: 8000, before: 0}; })(store.get("jpb-jobs", null));
if (!Array.isArray(jbD.people)) jbD.people = []; if (!Array.isArray(jbD.builders)) jbD.builders = []; if (!Array.isArray(jbD.subs)) jbD.subs = [];
const JB = {open: null, person: null, view: "jobs", show: "open", tag: null, edit: null, stage: null, back: null, ckEdit: false, ent: null, hist: []}, JF = {n: 0, cur: null, url: null};
const JB_STG = [["under", "Underground"], ["rough", "Top-out (rough-in)"], ["gas", "Gas"], ["trim", "Finish (trim)"], ["final", "Final"], ["warr", "Warranty"]];
const JB_SNAME = Object.fromEntries(JB_STG);
/* every job has Underground, Top-out and Finish; Gas, Final and Warranty are extras you add to a job when it needs them */
const JB_XTRA = ["gas", "final", "warr"];
const jbStages = j => JB_STG.filter(([k]) => !JB_XTRA.includes(k) || (j.xs || []).includes(k));
const JB_SST = {todo: "To do", doing: "Doing", done: "Done", skip: "Skip"};
const JB_ICON = {todo: "○", doing: "●", done: "✓", skip: "–"};
/* starting checklists: the book's "Before you call it in" lists, and the Phases card's lines for gas and trim */
const JB_TPL = {under: () => CK.under, rough: () => CK.rough, final: () => CK.final,
  gas: () => ["Gas piping under test (often the same visit as top-out)", "Test pressure and hold time logged in the Test log"],
  trim: () => ["Toilets set", "Faucets and sinks set", "Disposer hooked up", "Water heater hooked up", "Hose bibbs on"], warr: () => []};
const JB_ROLES = ["Lead", "Superintendent", "Builder / GC", "Homeowner", "Inspector", "Supply house", "Other"];
const JB_RES = {booked: "Booked", pass: "Pass", partial: "Partial", fail: "Fail"};
const JB_ST = {open: "Open", hold: "On hold", done: "Done"};
let jbT, jfNT;
let jbFull = false;
const jbSave = () => { clearTimeout(jbT); JB_IX = null; let ok = true;
  try { localStorage.setItem("jpb-jobs", JSON.stringify(jbD)); } catch(e){ ok = false; }
  if (!ok && !jbFull) toast("<b>Jobs didn't save:</b> this phone's space for them is full. Download a backup, then delete finished jobs.", 9000);
  jbFull = !ok; IDX = null; try { homeDraw(); } catch(e){} };
const jbBytes = () => { try { return (localStorage.getItem("jpb-jobs") || "").length; } catch(e){ return 0; } };
const jbId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const jbDay = (n = new Date()) => new Date(n - n.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const jbWk = s => { const x = new Date(s + "T12:00:00"); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return jbDay(x); };   /* weeks start Monday */
const jbNice = s => { const x = new Date(s + "T12:00:00"); return !s || isNaN(x) ? esc(s || "") : x.toLocaleDateString(undefined, {weekday: "short", month: "short", day: "numeric"}); };
const jbHr = x => (Math.round(x * 100) / 100).toLocaleString();
const jbCur = () => jbD.jobs.find(j => j.id === JB.open);
const jbName = j => (j.name || "").trim() || (j.a || "").trim() || "Untitled job";   /* the job's name, else its address */
const jbNext = j => j.insp.filter(i => i.r === "booked").sort((a, b) => a.d < b.d ? -1 : 1)[0];
const jbByDate = (a, b) => a.d < b.d ? 1 : a.d > b.d ? -1 : 0;
const jfMB = n => n >= 1e6 ? (n / 1e6).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1e3)) + " KB";
const jfSay = (t, c) => { const s = $("jf-say"); if (s){ s.textContent = t; s.className = "note " + (c || ""); } };
const jbOpts = (o, v) => Object.entries(o).map(([k, t]) => `<option value="${k}"${k === v ? " selected" : ""}>${t}</option>`).join("");
const jbList = (a, v) => a.map(x => `<option${x === v ? " selected" : ""}>${esc(x)}</option>`).join("");
const jbIn = (k, j) => k === "all" || (k === "done") === (j.st === "done");
/* iPhone: a system pop-up (Delete?, a picker wheel, the photo sheet) or the keyboard vanishing can leave the page sitting off
   and the bottom bar floating. Re-seat it after each one. */
const jbReseat = () => { try { if (window.navReseat) navReseat(); } catch(e){} };
const jbAsk = q => { const ok = confirm(q); jbReseat(); return ok; };

/* people */
const pById = id => jbD.people.find(p => p.id === id);
const pByName = n => { const q = String(n).trim().toLowerCase(); return q ? jbD.people.find(p => p.n.trim().toLowerCase() === q) : null; };
const pName = id => (pById(id) || {}).n || "";
function pGet(name, role){ const n = String(name).trim(); if (!n) return null; let p = pByName(n);
  if (!p){ p = {id: jbId(), n, role: role || "Other", co: "", ph: "", em: "", log: [], draft: "", t: Date.now()}; jbD.people.push(p); } return p; }
const pTel = p => (p.ph || "").replace(/[^\d+]/g, "");
let JB_IX = null;   /* per screen: each job's people and its notes' text, so person and builder pages don't rescan every note */
const jbIx = () => JB_IX || (JB_IX = jbD.jobs.map(j => ({j, ids: new Set([j.lead, j.sup, ...j.ppl.map(x => x.p), ...JB_STG.map(([k]) => (j.stages[k] || {}).lead)].filter(Boolean)), txt: j.log.map(e => e.b).join("\n").toLowerCase()})));
const jbMentions = (x, n) => { const L = "[[" + n.trim().toLowerCase(); return !!n.trim() && (x.txt.includes(L + "]]") || x.txt.includes(L + "|")); };

/* builders and subdivisions: saved once, picked on any job, each with a page (fields, notes, every job) */
const ENT = {
  bld: {list: "builders", one: "builder", Title: "Builder", ph: "Ivory Homes", fields: [["ph", "Office phone", "tel", "801-555-0100"], ["web", "Website", "url", "ivoryhomes.com"], ["addr", "Office address", "text", ""]]},
  sub: {list: "subs", one: "subdivision", Title: "Subdivision", ph: "Holbrook Farms", fields: [["city", "City", "city", ""], ["bld", "Builder", "bld", "Ivory Homes"], ["gate", "Access / gate code", "text", "Gate 1234#"], ["tie", "Water & sewer tie-in", "text", "Sewer stub 9 ft deep, east lot line"]]}};
const eList = t => jbD[ENT[t].list];
const eById = (t, id) => id ? eList(t).find(x => x.id === id) : null;
const eByName = (t, n) => { const q = String(n).trim().toLowerCase(); return q ? eList(t).find(x => x.n.trim().toLowerCase() === q) : null; };
const eName = (t, id) => (eById(t, id) || {}).n || "";
function eGet(t, name){ const n = String(name).trim(); if (!n) return null; let x = eByName(t, n);
  if (!x){ x = {id: jbId(), n, log: [], draft: "", t: Date.now()}; ENT[t].fields.forEach(([k]) => { x[k] = ""; }); eList(t).push(x); } return x; }
const eJobs = (t, x) => jbIx().filter(r => r.j[t] === x.id || jbMentions(r, x.n)).map(r => r.j);
const pJobs = p => jbIx().filter(r => r.ids.has(p.id) || jbMentions(r, p.n)).map(r => r.j);
const eCur = () => JB.ent && eById(JB.ent.t, JB.ent.id);
/* jobs from earlier builds: notes into the log, phase into stages */
function jbFix(j){
  if (!Array.isArray(j.log)){ j.log = (j.note || "").trim() ? [{id: jbId(), d: jbDay(new Date(j.t || Date.now())), at: j.t || Date.now(), b: j.note}] : []; delete j.note; }
  if (typeof j.draft !== "string") j.draft = ""; if (typeof j.name !== "string") j.name = "";
  ["insp", "hrs", "punch", "ppl"].forEach(k => { if (!Array.isArray(j[k])) j[k] = []; });
  if (j.lead === undefined) j.lead = ""; if (j.sup === undefined) j.sup = "";
  if (typeof j.bld !== "string"){ const b = (j.who || "").trim() ? eGet("bld", j.who) : null; j.bld = b ? b.id : ""; if (b) j.who = ""; }   /* "Builder / customer" becomes a builder page */
  if (typeof j.sub !== "string") j.sub = "";
  if (!j.stages){
    const map = {"Underground": "under", "Rough-in": "rough", "Top-out": "rough", "Gas": "gas", "Trim": "trim", "Final": "final", "Service": "warr", "Warranty": "warr"};
    const cur = map[j.ph] || "under", ci = JB_STG.findIndex(([k]) => k === cur);
    j.stages = {}; JB_STG.forEach(([k], i) => { j.stages[k] = {st: i < ci ? "done" : i === ci ? "doing" : "todo", d0: "", d1: "", lead: "", done: [], extra: []}; });
    const im = {"Underground": "under", "Rough / 4-way": "rough", "Top-out": "rough", "Gas": "gas", "Shower pan": "rough", "Water heater": "trim", "Final": "final"};
    j.insp.forEach(i => { if (!i.s) i.s = im[i.k] || cur; }); j.hrs.forEach(h => { if (!h.s) h.s = cur; }); j.log.forEach(e => { if (e.s === undefined) e.s = cur; });
    delete j.ph;
  }
}
/* saved data is checked and repaired before use, so one damaged record can't take down the job tracker */
function jbClean(){
  const isO = x => !!x && typeof x === "object" && !Array.isArray(x), arrO = a => Array.isArray(a) ? a.filter(isO) : [];
  const str = x => typeof x === "string" ? x : x == null ? "" : String(x);
  jbD.jobs = arrO(jbD.jobs);
  ["people", "builders", "subs"].forEach(k => { jbD[k] = arrO(jbD[k]); jbD[k].forEach(x => { x.id = str(x.id) || jbId(); x.n = str(x.n); }); });
  jbD.jobs.forEach(j => {
    j.id = str(j.id) || jbId(); ["name", "a", "who", "city", "draft"].forEach(k => { j[k] = str(j[k]); });
    if (!Array.isArray(j.log)){ j.log = str(j.note).trim() ? [{id: jbId(), d: jbDay(new Date(+j.t || Date.now())), at: +j.t || Date.now(), b: str(j.note)}] : []; delete j.note; }
    ["log", "insp", "hrs", "punch", "ppl"].forEach(k => { j[k] = arrO(j[k]); j[k].forEach(x => { x.id = str(x.id) || jbId(); }); });
    j.log.forEach(e => { e.b = str(e.b); e.d = str(e.d) || jbDay(); if (typeof e.at !== "number") e.at = 0; });
    j.hrs = j.hrs.filter(h => +h.h > 0 && +h.h <= 24); j.hrs.forEach(h => { h.h = +h.h; h.d = str(h.d) || jbDay(); h.n = str(h.n); });
    j.insp.forEach(i => { i.d = str(i.d); if (!JB_RES[i.r]) i.r = "booked"; ["who", "n", "k"].forEach(k => { i[k] = str(i[k]); }); });
    j.punch.forEach(x => { x.t = str(x.t); x.done = !!x.done; });
    if (!JB_ST[j.st]) j.st = "open";
    if (j.stages != null && !isO(j.stages)) j.stages = null;   /* jbFix builds it fresh */
    if (j.stages) JB_STG.forEach(([k]) => { const S = j.stages[k] = Object.assign({st: "todo", d0: "", d1: "", lead: "", done: [], extra: []}, isO(j.stages[k]) ? j.stages[k] : {});
      if (!JB_SST[S.st]) S.st = "todo"; S.done = Array.isArray(S.done) ? S.done.map(str) : []; S.extra = arrO(S.extra); if (S.hide && !Array.isArray(S.hide)) S.hide = []; });
    if (j.xs && !Array.isArray(j.xs)) delete j.xs;
  });
}
jbClean();
jbD.jobs.forEach(jbFix);
jbD.jobs.forEach(j => { if (!Array.isArray(j.xs)) j.xs = JB_XTRA.filter(k => { const s = j.stages[k];   /* older jobs keep an extra that has anything in it */
  return s.st === "done" || s.st === "doing" || s.d0 || s.d1 || s.lead || s.done.length || s.extra.length || j.insp.some(i => i.s === k) || j.hrs.some(h => h.s === k) || j.log.some(e => e.s === k); }); });
[...jbD.people, ...jbD.builders, ...jbD.subs].forEach(p => { if (!Array.isArray(p.log)) p.log = []; if (typeof p.draft !== "string") p.draft = ""; });
const jbStageNow = j => { const S = jbStages(j); return (S.find(([k]) => j.stages[k].st === "doing") || S.find(([k]) => j.stages[k].st === "todo") || S[S.length - 1])[0]; };
const jbTpl = k => Array.isArray((jbD.tpl || {})[k]) ? jbD.tpl[k] : JB_TPL[k]();   /* your saved list for a stage, else the book's */
function jbCk(j, k){ const s = j.stages[k], dn = new Set(s.done), hide = new Set(s.hide || []), T = jbTpl(k), TS = new Set(T);
  const items = [...T.map((t, i) => ({key: "t" + i, t, done: dn.has(t), tpl: true})).filter(x => !hide.has(x.t)),
    ...s.extra.filter(x => !TS.has(x.t)).map(x => ({key: "x" + x.id, t: x.t, done: x.done, id: x.id}))];
  return {items, total: items.length, done: items.filter(x => x.done).length}; }

/* notes: a dated log with our own light markup (see "How to write notes") */
const JN_TAG = /(^|[\s(])#([A-Za-z][\w-]*)/g;
const jbTags = j => [...new Set(j.log.flatMap(e => [...e.b.matchAll(JN_TAG)].map(m => m[2].toLowerCase())))];
const jbTasks = j => j.log.reduce((n, e) => n + (e.b.match(/^\s*[-*] \[ \]/gm) || []).length, 0);
const jnSort = (a, b) => a.d < b.d ? 1 : a.d > b.d ? -1 : b.at - a.at;
/* one line of note text → HTML. Order matters: code spans first (nothing inside them is touched), then a backslash
   escapes the next mark (\* \# \[ shows the mark itself), then links, bold, italic, highlight, strike, web links, phones, tags. */
function jnInline(s){
  const keep = [], hold = h => "\u0001" + (keep.push(h) - 1) + "\u0002";
  s = s.replace(/`([^`]+)`/g, (m, x) => hold(`<code>${esc(x)}</code>`)).replace(/\\([\\`*_=~#\[\]!>-])/g, (m, x) => hold(esc(x)));
  s = esc(s)
    .replace(/\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]/g, (m, x, label) => !x.trim() ? m : hold(`<button type="button" class="jn-link" data-wl="${x.trim()}">${(label || x).trim()}</button>`))
    .replace(/\*\*(?=\S)(.+?)\*\*/g, "<b>$1</b>").replace(/(^|[^*\w])\*(?=[^*\s])([^*]*?[^*\s])\*(?!\w)/g, "$1<i>$2</i>")
    .replace(/==(?=\S)(.+?)==/g, "<mark>$1</mark>").replace(/~~(?=\S)(.+?)~~/g, "<s>$1</s>")
    .replace(/\bhttps?:\/\/[^\s<]+?(?=[.,;:!?)]*(?:\s|$|<))/g, u => hold(`<a href="${u}" target="_blank" rel="noopener">${u}</a>`))
    .replace(/(^|[^\d-])((?:\+?1[-. ]?)?\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4})(?!\d)/g, (m, a, n) => a + hold(`<span class="pn">${n}</span>`))
    .replace(JN_TAG, (m, a, t) => `${a}<button type="button" class="jn-tag" data-tag="${t.toLowerCase()}">#${t}</button>`);
  return s.replace(/\u0001(\d+)\u0002/g, (m, i) => keep[+i]).replace(/\u0001(\d+)\u0002/g, (m, i) => keep[+i]);
}
/* a whole note → HTML, line by line, so each checkbox knows its own line to tick */
function jnMd(src, eid){
  let h = "", list = null, quote = false, code = null, gap = false;
  const close = () => { if (list){ h += `</${list.tag}>`; list = null; } if (quote){ h += "</blockquote>"; quote = false; } };
  const item = (tag, depth, start, html) => {
    if (quote){ h += "</blockquote>"; quote = false; }
    if (!list || list.tag !== tag){ if (list) h += `</${list.tag}>`; h += `<${tag}${tag === "ol" && start !== 1 ? ` start="${start}"` : ""}>`; list = {tag}; }
    h += `<li${depth ? ` class="jn-d${Math.min(depth, 3)}"` : ""}>${html}</li>`;
  };
  String(src).replace(/\r/g, "").split("\n").forEach((ln, i) => { let m;
    if (code !== null){ if (/^\s*```/.test(ln)){ h += `<pre class="jn-pre">${esc(code.join("\n"))}</pre>`; code = null; } else code.push(ln); return; }
    if (/^\s*```/.test(ln)){ close(); code = []; gap = false; return; }
    const depth = Math.floor((ln.match(/^ */)[0].length) / 2);
    if ((m = ln.match(/^\s*[-*+] \[( |x|X)\]\s?(.*)$/))){ close(); gap = false;
      h += `<label class="jn-task${depth ? " jn-d" + Math.min(depth, 3) : ""}"><input type="checkbox" data-tk="${eid}|${i}"${m[1] !== " " ? " checked" : ""}><span>${jnInline(m[2])}</span></label>`; return; }
    if ((m = ln.match(/^\s*[-*+•]\s+(.*)$/))){ gap = false; item("ul", depth, 1, jnInline(m[1])); return; }
    if ((m = ln.match(/^\s*(\d+)[.)]\s+(.*)$/))){ gap = false; item("ol", depth, +m[1], jnInline(m[2])); return; }
    if ((m = ln.match(/^>\s?(.*)$/))){ if (list){ h += `</${list.tag}>`; list = null; } if (!quote){ h += "<blockquote>"; quote = true; } else h += "<br>"; h += jnInline(m[1]); gap = false; return; }
    close();
    if ((m = ln.match(/^(#{1,3})\s+(.*)$/))) h += `<p class="jn-h jn-h${m[1].length}">${jnInline(m[2])}</p>`;
    else if ((m = ln.match(/^!!\s*(.*)$/))) h += `<p class="flag jn-flag">${jnInline(m[1])}</p>`;
    else if (/^\s*(-{3,}|_{3,}|\*{3,})\s*$/.test(ln)) h += "<hr>";
    else if (ln.trim()) h += `<p>${jnInline(ln)}</p>`;
    else { if (!gap) h += `<div class="jn-gap"></div>`; gap = true; return; }
    gap = false;
  });
  if (code !== null) h += `<pre class="jn-pre">${esc(code.join("\n"))}</pre>`;   /* a ``` never closed still shows */
  close(); return h;
}
const JN_TOOLS = `<div class="chips jn-tools">${[["- [ ] ", "☐ Task"], ["- ", "• List"], ["**", "Bold"], ["!! ", "Heads-up"], ["# ", "Heading"], ["#", "#tag"], ["[[", "[[link]]"], ["@date", "Date"]]
  .map(([k, t]) => `<button type="button" data-ins="${esc(k)}">${t}</button>`).join("")}</div>`;
const jnWhen = e => { const t = new Date(e.at); return jbNice(e.d) + (jbDay(t) === e.d ? " · " + t.toLocaleTimeString(undefined, {hour: "numeric", minute: "2-digit"}) : ""); };
const jnEntry = e => JB.edit === e.id
  ? `<article class="jn-e"><div class="calc"><label for="jn-ed-d">Date<input id="jn-ed-d" type="date" value="${esc(e.d)}"></label><label for="jn-ed" class="wide">Note<textarea id="jn-ed" class="jn-ta" rows="6">${esc(e.b)}</textarea></label></div>${JN_TOOLS}
     <div class="set-btns jn-btns"><button type="button" class="btn" data-a="jn-save">Save</button><button type="button" class="btn ghost" data-a="jn-cancel">Cancel</button><button type="button" class="del" data-a="jn-del">Delete</button></div></article>`
  : `<article class="jn-e"><header><span>${jnWhen(e)}</span><button type="button" class="jb-x" data-edit="${e.id}" aria-label="Edit this note">✎</button></header><div class="jn-b">${jnMd(e.b, e.id)}</div></article>`;
const jnHelp = `<details class="explain"><summary>How to write notes</summary><div><div class="x"><table class="t wrap jn-help"><tbody>
  <tr><th><code>- [ ] call super</code></th><td>A checkbox you tap off. The job shows how many are still open.</td></tr>
  <tr><th><code>!! gas not tested</code></th><td>A red heads-up line.</td></tr>
  <tr><th><code># Heading</code></th><td>A heading. <code>##</code> for a smaller one.</td></tr>
  <tr><th><code>**bold**</code> <code>*italic*</code></th><td>Bold, italic. <code>==this==</code> highlights, <code>~~this~~</code> strikes out.</td></tr>
  <tr><th><code>- item</code> <code>1. item</code></th><td>A list. Start a line with two spaces to put it under the one above.</td></tr>
  <tr><th><code>&gt; text</code></th><td>A quote: what the inspector said, word for word.</td></tr>
  <tr><th><code>#tag</code></th><td>A tag. Tap it to see every job that has it.</td></tr>
  <tr><th><code>[[Dave]]</code></th><td>A link to a person, another job (<code>[[Lot 14]]</code>) or a card in the book (<code>[[Offset calculator]]</code>). A person's page lists every job that mentions them.</td></tr>
  <tr><th><code>[[Dave|the inspector]]</code></th><td>The same link, showing your own words.</td></tr>
  <tr><th><code>&#96;&#96;&#96;</code></th><td>A line with just <code>&#96;&#96;&#96;</code> above and below: what's between shows exactly as typed (a cut list, a model number).</td></tr>
  <tr><th><code>&#92;*</code></th><td>A backslash before a mark shows the mark itself: <code>&#92;*not italic&#92;*</code>.</td></tr>
  <tr><th>801-555-0100</th><td>Phone numbers and web links become tappable.</td></tr>
</tbody></table></div></div></details>`;
/* one notes block, for a job stage or a person */
const jnOwner = () => eCur() || (JB.person ? pById(JB.person) : jbCur());
const jnBlock = (o, list, ph) => `<div class="calc"><label for="jn-new" class="wide">New note<textarea id="jn-new" class="jn-ta" rows="3" placeholder="${ph}">${esc(o.draft)}</textarea></label>
    <label for="jn-d">Date<input id="jn-d" type="date" value="${jbDay()}"></label></div>
  ${JN_TOOLS}
  <div class="jb-in"><div class="set-btns"><button type="button" class="btn" data-a="jn-add">Add note</button></div></div>
  ${jnHelp}
  ${list.length ? `<div class="jn-log">${list.slice().sort(jnSort).map(jnEntry).join("")}</div>` : ""}`;

function jbHours(){
  const all = jbD.jobs.flatMap(j => j.hrs), now = jbDay(), wk = jbWk(now), lx = new Date(wk + "T12:00:00"); lx.setDate(lx.getDate() - 7);
  const lw = jbDay(lx), sum = f => all.filter(f).reduce((n, h) => n + (+h.h || 0), 0);
  return {today: sum(h => h.d === now), wk: sum(h => jbWk(h.d) === wk), lw: sum(h => jbWk(h.d) === lw), all: sum(() => true)};
}
function jbNew(){
  const j = {id: jbId(), name: "", a: "", who: "", bld: "", sub: "", city: "", st: "open", lead: "", sup: "", ppl: [], log: [], draft: "", t: Date.now(), insp: [], hrs: [], punch: [], stages: {}};
  JB_STG.forEach(([k], i) => { j.stages[k] = {st: i ? "todo" : "doing", d0: "", d1: "", lead: "", done: [], extra: []}; }); j.xs = [];
  jbD.jobs.push(j); JB.open = j.id; JB.person = null; JB.ent = null; JB.edit = null; JB.stage = null; jbSave(); return j;
}
const jbRow = (j, attr = "data-open") => { const n = jbNext(j), c = cityById(j.city), tk = jbTasks(j), cs = jbStageNow(j), last = j.log.slice().sort(jnSort)[0];
  const act = jbStages(j).filter(([k]) => j.stages[k].st !== "skip"), done = act.filter(([k]) => j.stages[k].st === "done").length;
  const gist = last ? last.b.split("\n").map(x => x.replace(/^\s*([-*] \[[ xX]\]|[-*•]|\d+[.)]|#{1,3}|!!|>)\s*/, "").replace(/\*\*|==|~~|\[\[|\]\]|`/g, "").trim()).find(Boolean) || "" : "";
  return `<button type="button" class="jb-row" ${attr}="${j.id}"><b>${esc(jbName(j))}</b><span>${[(j.name || "").trim() && j.a, eName("sub", j.sub), j.who, c && c.n, pName(j.lead) && "Lead " + pName(j.lead)].filter(Boolean).map(esc).join(" · ") || "&nbsp;"}</span>`
    + (gist ? `<span class="jb-gist">${esc(gist.slice(0, 90))}</span>` : "")
    + `<span class="jb-tags"><span class="badge">${esc(JB_SNAME[cs])}</span><span class="badge">${done}/${act.length}</span>${j.st !== "open" ? `<span class="badge">${JB_ST[j.st]}</span>` : ""}${tk ? `<span class="badge">☐ ${tk}</span>` : ""}${n ? `Inspection ${jbNice(n.d)}` : ""}</span></button>`; };
const eRow = (t, x) => { const n = eJobs(t, x).length, c = t === "sub" && cityById(x.city);
  const sub = t === "bld" ? [x.ph, (n2 => `${n2 || "no"} subdivision${n2 === 1 ? "" : "s"}`)(jbD.subs.filter(s => s.bld === x.id).length)] : [c && c.n, eName("bld", x.bld)];
  return `<button type="button" class="jb-row" data-ent="${t}|${x.id}"><b>${esc(x.n || "No name")}</b><span>${[...sub, `${n} job${n === 1 ? "" : "s"}`].filter(Boolean).map(esc).join(" · ")}</span></button>`; };
const pRow = p => { const n = pJobs(p).length;
  return `<div class="jp-row"><button type="button" class="jb-row" data-person="${p.id}"><b>${esc(p.n || "No name")}</b><span>${[p.role, p.co].filter(Boolean).map(esc).join(" · ")}${n ? ` · ${n} job${n === 1 ? "" : "s"}` : ""}</span></button>${pTel(p) ? `<a class="btn ghost jp-call" href="tel:${pTel(p)}" aria-label="Call ${esc(p.n)}">Call</a>` : ""}</div>`; };

/* the job list, grouped under each builder (A to Z), jobs with no builder last */
function jbGroups(L){
  const G = new Map(); L.forEach(j => { const k = eById("bld", j.bld) ? j.bld : ""; if (!G.has(k)) G.set(k, []); G.get(k).push(j); });
  return [...G.keys()].sort((a, b) => !a ? 1 : !b ? -1 : eName("bld", a).localeCompare(eName("bld", b))).map(k =>
    `<div class="jb-grp">${k ? `<button type="button" class="jb-gh" data-ent="bld|${k}"><b>${esc(eName("bld", k))}</b><span>${G.get(k).length} ›</span></button>` : `<p class="jb-gh"><b>No builder</b><span>${G.get(k).length}</span></p>`}
    <div class="jb-list">${G.get(k).map(j => jbRow(j)).join("")}</div></div>`).join("");
}
function jbListHtml(){
  const viewSeg = `<div class="seg jb-seg jb-views" role="group" aria-label="Show">${[["jobs", "Jobs", jbD.jobs], ["people", "People", jbD.people], ["bld", "Builders", jbD.builders], ["sub", "Subdivisions", jbD.subs]]
    .map(([k, t, L]) => `<button type="button" data-view="${k}" aria-pressed="${JB.view === k}">${t} · ${L.length}</button>`).join("")}</div>`;
  if (JB.view === "bld" || JB.view === "sub"){ const t = JB.view, C = ENT[t], E = eList(t).slice().sort((a, b) => a.n.localeCompare(b.n));
    return `${viewSeg}<div class="set-btns jb-top"><button type="button" class="btn" data-a="e-new">+ New ${C.one}</button></div>
    <div class="jb-list">${E.map(x => eRow(t, x)).join("") || `<p class="note">None yet. They show up here when you pick a ${C.one} on a job, or tap <b>+ New ${C.one}</b>. Each has a page: ${t === "bld" ? "office phone, website, their people and subdivisions" : "city, builder, gate code, where water and sewer tie in"}, notes, and every job.</p>`}</div>`; }
  if (JB.view === "people"){
    const P = jbD.people.slice().sort((a, b) => a.n.localeCompare(b.n));
    return `${viewSeg}<div class="set-btns jb-top"><button type="button" class="btn" data-a="p-new">+ New person</button></div>
    <div class="jb-list">${P.map(pRow).join("") || `<p class="note">No one yet. People show up here when you add a lead or super to a job, or tap <b>+ New person</b>. Each has a page: phone, company, notes, and every job they're on.</p>`}</div>`;
  }
  const L = jbD.jobs.filter(j => jbIn(JB.show, j) && (!JB.tag || jbTags(j).includes(JB.tag))).sort((a, b) => b.t - a.t), H = jbHours();
  const tags = [...new Set(jbD.jobs.flatMap(jbTags))].sort();
  const goal = +jbD.goal === 6000 ? 6000 : 8000, have = H.all + (+jbD.before || 0), pct = Math.min(100, have / goal * 100);
  return `${viewSeg}<div class="set-btns jb-top"><button type="button" class="btn" data-a="new">+ New job</button></div>
  <div class="seg jb-seg" role="group" aria-label="Show">${[["open", "Open"], ["done", "Done"], ["all", "All"]].map(([k, t]) => `<button type="button" data-show="${k}" aria-pressed="${JB.show === k}">${t} · ${jbD.jobs.filter(j => jbIn(k, j)).length}</button>`).join("")}</div>
  ${tags.length ? `<div class="chips jn-tagbar">${JB.tag ? `<button type="button" data-tagclr="1" aria-pressed="true">#${esc(JB.tag)} ✕ show all</button>` : tags.map(t => `<button type="button" data-tag="${esc(t)}">#${esc(t)}</button>`).join("")}</div>` : ""}
  ${L.length ? jbGroups(L) : `<div class="jb-list"><p class="note">${jbD.jobs.length ? "Nothing here." : "No jobs yet. Tap <b>+ New job</b>. Each job is a timeline, Underground to Final, with the blanks ready to fill in as you go."}</p></div>`}
  <p class="card-h">Hours</p>
  <div class="x"><table class="t wrap"><tbody>
    <tr><th>Today</th><td>${jbHr(H.today)} hr</td></tr>
    <tr><th>This week</th><td>${jbHr(H.wk)} hr <span class="sub">(Mon–Sun)</span></td></tr>
    <tr><th>Last week</th><td>${jbHr(H.lw)} hr</td></tr>
    <tr><th>Toward license</th><td>${jbHr(have)} of ${goal.toLocaleString()} hr · ${Math.floor(pct)}%<div class="jb-bar" aria-hidden="true"><i style="width:${pct}%"></i></div></td></tr>
  </tbody></table></div>
  <details class="explain"><summary>Set the license goal</summary><div>
    <div class="calc"><label for="jb-goal">Goal<select id="jb-goal"><option value="6000">Residential journeyman · 6,000 hr</option><option value="8000">Journeyman · 8,000 hr</option></select></label>
    <label for="jb-before">Hours before this app<input id="jb-before" type="number" inputmode="decimal" min="0" step="any" value="${+jbD.before || ""}" placeholder="0"></label></div>
    <p class="note">Your own count, so you can see where you stand. DOPL goes by the hours your sponsor reports, so keep those records too. The goals are the on-the-job hours in Learn → License → Path to a license.</p></div></details>
  ${jbBytes() > 15e5 ? `<div class="jb-in"><p class="note${jbBytes() > 35e5 ? " flag" : ""}">Jobs use about ${(jbBytes() / 1e6).toFixed(1)} MB of the roughly 5 MB this phone gives them. Download a backup and delete finished jobs before it fills: past that, new entries won't save.</p></div>` : ""}
  <p class="card-h">Photos &amp; files backup</p>
  <div class="jb-in"><p class="note" id="jf-use">Photos and files stay on this phone. They're too big for Settings → Download backup, so save them here now and then.</p>
  <div class="set-btns"><button type="button" class="btn ghost" data-a="jf-save">Download photos &amp; files</button><label class="btn ghost">Restore photos &amp; files<input type="file" id="jf-restore" accept=".zip,application/zip" hidden></label></div>
  <p class="note" id="jf-say" aria-live="polite"></p></div>`;
}

function jbStageSum(j, k){
  const s = j.stages[k], ins = j.insp.filter(i => i.s === k).sort(jbByDate)[0], nN = j.log.filter(e => e.s === k).length, hr = j.hrs.filter(h => h.s === k).reduce((n, h) => n + (+h.h || 0), 0), C = jbCk(j, k);
  const b = [JB_SST[s.st] + (s.st === "done" && s.d1 ? " " + jbNice(s.d1) : s.st === "doing" && s.d0 ? " since " + jbNice(s.d0) : "")];
  if (pName(s.lead)) b.push("Lead " + pName(s.lead));
  if (ins) b.push(`Inspection ${JB_RES[ins.r].toLowerCase()} ${jbNice(ins.d)}`);
  if (C.total && s.st !== "skip") b.push(`☑ ${C.done}/${C.total}`);
  if (nN) b.push(nN + (nN === 1 ? " note" : " notes")); if (hr) b.push(jbHr(hr) + " hr");
  return esc(b.join(" · "));
}
function jbStageHtml(j, k){
  const s = j.stages[k], C = jbCk(j, k), ins = j.insp.filter(i => i.s === k).sort(jbByDate), hrs = j.hrs.filter(h => h.s === k).sort(jbByDate);
  const hr = hrs.reduce((n, h) => n + (+h.h || 0), 0);
  return `<div class="jt-head"><span class="jt-dot" aria-hidden="true">${JB_ICON[s.st]}</span><h3>${JB_SNAME[k]}</h3>${JB_XTRA.includes(k) ? `<button type="button" class="linkish jt-rm" data-xdel="${k}">Remove stage</button>` : ""}</div>
  <div class="seg jb-seg" role="group" aria-label="${JB_SNAME[k]} status">${Object.entries(JB_SST).map(([v, t]) => `<button type="button" data-sst="${v}" aria-pressed="${s.st === v}">${t}</button>`).join("")}</div>
  <div class="calc">
    <label for="js-d0">Started<input id="js-d0" data-sf="d0" type="date" value="${esc(s.d0)}"></label>
    <label for="js-d1">Done<input id="js-d1" data-sf="d1" type="date" value="${esc(s.d1)}"></label>
    <label for="js-lead" class="wide">Lead on this stage<input id="js-lead" data-sp="1" list="jb-ppl" type="text" autocomplete="off" value="${esc(pName(s.lead))}" placeholder="${esc(pName(j.lead) || "Who ran it")}"></label>
  </div>
  <p class="card-h">Checklist · ${C.done} of ${C.total} <button type="button" class="linkish" data-a="ck-edit" aria-pressed="${JB.ckEdit}">${JB.ckEdit ? "Done editing" : "Edit list"}</button></p>
  ${C.items.length ? `<ul class="jb-punch">${C.items.map(x => `<li><label><input type="checkbox" data-ck="${x.key}"${x.done ? " checked" : ""}><span>${esc(x.t)}</span></label>${x.tpl && !JB.ckEdit ? "" : `<button type="button" class="jb-x" data-ckdel="${x.key}" aria-label="Remove ${esc(x.t)}">×</button>`}</li>`).join("")}</ul>` : `<div class="jb-in"><p class="note">Empty. Add what this stage needs below.</p></div>`}
  ${JB.ckEdit ? `<div class="jb-in"><p class="note">Remove what you don't use and add your own. Then save it as your list for ${JB_SNAME[k]} on every new job.${Array.isArray((jbD.tpl || {})[k]) ? " You're using your own list for this stage." : " Right now it starts from the book's list."}</p>
    <div class="set-btns"><button type="button" class="btn" data-a="ck-save">Use this list on new jobs</button>${Array.isArray((jbD.tpl || {})[k]) ? `<button type="button" class="btn ghost" data-a="ck-book">Back to the book's list</button>` : ""}</div></div>` : ""}
  <div class="calc"><label for="jc-t" class="wide">Add to the checklist<input id="jc-t" type="text" autocomplete="off" enterkeyhint="done" placeholder="Something your lead or city wants"></label></div>
  <div class="jb-in"><div class="set-btns"><button type="button" class="btn ghost" data-a="ck-add">Add item</button></div></div>

  <p class="card-h">Inspections</p>
  ${ins.length ? `<div class="x"><table class="t wrap jb-t"><tbody>${ins.map(i => `<tr><td><b>${jbNice(i.d)}</b>${i.who ? `<div class="sub">${esc(i.who)}</div>` : ""}${i.n ? `<div class="sub">${esc(i.n)}</div>` : ""}</td><td><select data-ir="${i.id}" aria-label="Result">${jbOpts(JB_RES, i.r)}</select></td><td><button type="button" class="jb-x" data-del="insp|${i.id}" aria-label="Delete this inspection">×</button></td></tr>`).join("")}</tbody></table></div>` : ""}
  <details class="explain"${ins.length ? "" : " open"}><summary>+ Add an inspection</summary><div><div class="calc">
    <label for="ji-d">Date<input id="ji-d" type="date" value="${jbDay()}"></label>
    <label for="ji-r">Result<select id="ji-r">${jbOpts(JB_RES, "booked")}</select></label>
    <label for="ji-who" class="wide">Inspector <i>(optional)</i><input id="ji-who" type="text" list="jb-ppl" autocomplete="off"></label>
    <label for="ji-n" class="wide">Notes / corrections <i>(optional)</i><input id="ji-n" type="text" autocomplete="off" placeholder="Strap the 3/4 in the garage"></label>
  </div><div class="set-btns jb-top"><button type="button" class="btn" data-a="insp-add">Add inspection</button></div></div></details>

  <p class="card-h">Hours · ${jbHr(hr)} hr</p>
  <div class="calc">
    <label for="jh-d">Date<input id="jh-d" type="date" value="${jbDay()}"></label>
    <label for="jh-h">Hours<input id="jh-h" type="number" inputmode="decimal" min="0" max="24" step="any" placeholder="8"></label>
    <label for="jh-n" class="wide">What you did <i>(optional)</i><input id="jh-n" type="text" autocomplete="off" placeholder="Set tubs, ran vents"></label>
  </div>
  <div class="jb-in"><div class="set-btns"><button type="button" class="btn" data-a="hrs-add">Log hours</button></div></div>
  ${hrs.length ? `<div class="x"><table class="t wrap jb-t"><tbody>${hrs.map(h => `<tr><td>${jbNice(h.d)}${h.n ? `<div class="sub">${esc(h.n)}</div>` : ""}</td><td class="n">${jbHr(+h.h)} hr</td><td><button type="button" class="jb-x" data-del="hrs|${h.id}" aria-label="Delete these hours">×</button></td></tr>`).join("")}</tbody></table></div>` : ""}

  <p class="card-h">Notes</p>
  ${jnBlock(j, j.log.filter(e => e.s === k), "Gate code 1234. - [ ] call the super. !! gas not tested. [[Dave]] #warranty")}

  <p class="card-h">Photos</p>
  <div class="jb-in"><div class="set-btns"><label class="btn">Add photos<input type="file" id="jf-ph" accept="image/*" multiple hidden></label></div></div>
  <div class="jf-grid" id="jf-photos"></div>`;
}

function jbJobHtml(j){
  const c = cityById(j.city), addr = (j.a || "").trim(), sel = JB.stage && jbStages(j).some(([k]) => k === JB.stage) ? JB.stage : jbStageNow(j); JB.stage = sel;
  const q = encodeURIComponent([addr.replace(/^lot\s*\w+\s*[·,\-–]\s*/i, ""), c && c.n, "UT"].filter(Boolean).join(", "));
  const tk = jbTasks(j), slot = (id, label, f, ph) => `<label for="${id}">${label}<input id="${id}" data-jp="${f}" list="jb-ppl" type="text" autocomplete="off" value="${esc(pName(j[f]))}" placeholder="${ph}"></label>`;
  const team = [...[["lead", "Lead"], ["sup", "Superintendent"]].filter(([f]) => pById(j[f])).map(([f, r]) => ({p: pById(j[f]), r})), ...j.ppl.map(x => ({p: pById(x.p), r: x.r, id: x.id})).filter(x => x.p)];
  return `<div class="set-btns jb-top"><button type="button" class="btn ghost" data-a="back">‹ All jobs</button></div>
  <div class="calc">
    <label for="jb-n" class="wide">Job name<input id="jb-n" data-f="name" type="text" autocomplete="off" value="${esc(j.name)}" placeholder="Lot 12 Ivory · Smith basement"></label>
    <label for="jb-a" class="wide">Address<input id="jb-a" data-f="a" type="text" autocomplete="off" value="${esc(j.a)}" placeholder="123 N Main St"></label>
    <label for="jb-bld" class="wide">Builder<input id="jb-bld" data-je="bld" list="jb-blds" type="text" autocomplete="off" value="${esc(eName("bld", j.bld))}" placeholder="Pick or type a new one"></label>
    <label for="jb-sub" class="wide">Subdivision<input id="jb-sub" data-je="sub" list="jb-subs" type="text" autocomplete="off" value="${esc(eName("sub", j.sub))}" placeholder="Pick or type a new one"></label>
    <label for="jb-who" class="wide">Customer / homeowner <i>(optional)</i><input id="jb-who" data-f="who" type="text" autocomplete="off" value="${esc(j.who)}" placeholder="For remodels and service"></label>
    <label for="jb-city">City <i>(for Directions)</i><select id="jb-city" data-f="city">${CITY_OPTS}</select></label>
    <label for="jb-st">Job status<select id="jb-st" data-f="st">${jbOpts(JB_ST, j.st)}</select></label>
  </div>
  ${addr ? `<div class="jb-in"><div class="set-btns"><a class="btn ghost" href="https://maps.apple.com/?daddr=${q}" target="_blank" rel="noopener">Directions</a></div></div>` : ""}
  ${eById("bld", j.bld) || eById("sub", j.sub) ? `<div class="jb-list">${[["bld", j.bld], ["sub", j.sub]].filter(([t, id]) => eById(t, id)).map(([t, id]) => eRow(t, eById(t, id))).join("")}</div>` : ""}
  ${eById("sub", j.sub) && eById("sub", j.sub).gate ? `<div class="jb-in"><p class="note"><b>Gate:</b> ${esc(eById("sub", j.sub).gate)}</p></div>` : ""}

  <p class="card-h">People</p>
  <div class="calc">${slot("jp-lead", "Lead", "lead", "Who's leading for your company")}${slot("jp-sup", "Superintendent", "sup", "The builder's super")}</div>
  ${team.length ? `<div class="jb-list">${team.map(x => `<div class="jp-row"><button type="button" class="jb-row" data-person="${x.p.id}"><b>${esc(x.p.n)}</b><span>${esc([x.r, x.p.co].filter(Boolean).join(" · "))}</span></button>${pTel(x.p) ? `<a class="btn ghost jp-call" href="tel:${pTel(x.p)}" aria-label="Call ${esc(x.p.n)}">Call</a>` : ""}${x.id ? `<button type="button" class="jb-x" data-pdel="${x.id}" aria-label="Take ${esc(x.p.n)} off this job">×</button>` : ""}</div>`).join("")}</div>` : ""}
  <details class="explain"><summary>+ Add someone else</summary><div><div class="calc">
    <label for="jpo-r">Role<select id="jpo-r">${jbList(JB_ROLES.slice(2), "Homeowner")}</select></label>
    <label for="jpo-n" class="wide">Name<input id="jpo-n" type="text" list="jb-ppl" autocomplete="off"></label>
  </div><div class="set-btns jb-top"><button type="button" class="btn" data-a="ppl-add">Add to this job</button></div></div></details>

  <p class="card-h">Timeline${tk ? ` · ☐ ${tk} open` : ""}</p>
  <ol class="jt">${jbStages(j).map(([k, name]) => { const s = j.stages[k];
    return k === sel ? `<li class="jt-i jt-${s.st} jt-open" id="jt-open">${jbStageHtml(j, k)}</li>`
      : `<li class="jt-i jt-${s.st}"><button type="button" class="jt-sum" data-stage="${k}"><span class="jt-dot" aria-hidden="true">${JB_ICON[s.st]}</span><span class="jt-txt"><b>${name}</b><span>${jbStageSum(j, k)}</span></span></button></li>`; }).join("")}</ol>
  ${JB_XTRA.some(k => !j.xs.includes(k)) ? `<div class="chips jn-tagbar jt-add" aria-label="Add a stage">${JB_XTRA.filter(k => !j.xs.includes(k)).map(k => `<button type="button" data-xadd="${k}">+ ${JB_SNAME[k]}</button>`).join("")}</div>` : ""}

  <p class="card-h">Punch list &amp; materials</p>
  <div class="calc"><label for="jp-t" class="wide">Add an item<input id="jp-t" type="text" autocomplete="off" enterkeyhint="done" placeholder="Nail plates, 2 × 1/2 PEX stub-outs"></label></div>
  <div class="jb-in"><div class="set-btns"><button type="button" class="btn" data-a="punch-add">Add</button>${j.punch.some(p => p.done) ? `<button type="button" class="btn ghost" data-a="punch-clear">Clear checked</button>` : ""}</div></div>
  ${j.punch.length ? `<ul class="jb-punch">${j.punch.map(p => `<li><label><input type="checkbox" data-pk="${p.id}"${p.done ? " checked" : ""}><span>${esc(p.t)}</span></label><button type="button" class="jb-x" data-del="punch|${p.id}" aria-label="Delete ${esc(p.t)}">×</button></li>`).join("")}</ul>` : ""}

  <p class="card-h">Files</p>
  <div class="jb-in"><div class="set-btns"><label class="btn ghost">Add files (PDF, plans)<input type="file" id="jf-fi" multiple hidden></label></div></div>
  <div class="jb-list" id="jf-files"></div>
  <div class="set-btns jb-end"><button type="button" class="del" data-a="job-del">Delete this job</button></div>`;
}

function jbPersonHtml(p){
  const jobs = pJobs(p), tel = pTel(p), f = (id, k, label, type, ph, wide) => `<label for="${id}"${wide ? ' class="wide"' : ""}>${label}<input id="${id}" data-pf="${k}" type="${type}" autocomplete="off" value="${esc(p[k] || "")}" placeholder="${ph}"${type === "tel" ? ' inputmode="tel"' : ""}></label>`;
  return `<div class="set-btns jb-top"><button type="button" class="btn ghost" data-a="back">‹ Back</button></div>
  <div class="calc">
    ${f("pp-n", "n", "Name", "text", "Dave Smith", true)}
    <label for="pp-role">Role<select id="pp-role" data-pf="role">${jbList(JB_ROLES, p.role)}</select></label>
    <label for="pp-co">Company<input id="pp-co" data-pf="co" list="jb-blds" type="text" autocomplete="off" value="${esc(p.co || "")}" placeholder="Builder, city or shop"></label>
    ${f("pp-ph", "ph", "Phone", "tel", "801-555-0100", false)}
    ${f("pp-em", "em", "Email", "email", "", false)}
  </div>
  ${tel ? `<div class="jb-in"><div class="set-btns"><a class="btn" href="tel:${tel}">Call</a><a class="btn ghost" href="sms:${tel}">Text</a></div></div>` : ""}
  <p class="card-h">Jobs · ${jobs.length}</p>
  <div class="jb-list">${jbFew(jobs) || `<p class="note">Not on a job yet. Add them as a lead, super or someone else on a job, or write [[${esc(p.n || "their name")}]] in a job's notes.</p>`}</div>
  <p class="card-h">Notes</p>
  ${jnBlock(p, p.log, "How they like things done. - [ ] send them the test photos")}
  <div class="set-btns jb-end"><button type="button" class="del" data-a="p-del">Delete this person</button></div>`;
}

/* a page that lists jobs shows the 15 most recent; "Show all" for the rest (a lead can be on hundreds) */
const jbFew = jobs => { const L = jobs.slice().sort((a, b) => b.t - a.t), more = L.length - 15;
  return (JB.allJobs ? L : L.slice(0, 15)).map(j => jbRow(j)).join("") + (!JB.allJobs && more > 0 ? `<button type="button" class="btn ghost" data-a="all-jobs">Show all ${L.length} jobs</button>` : ""); };
function jbEntHtml(t, x){
  const C = ENT[t], jobs = eJobs(t, x), tel = (x.ph || "").replace(/[^\d+]/g, ""), web = (x.web || "").trim();
  const fld = ([k, label, type, ph]) => type === "city" ? `<label for="ef-city">${label}<select id="ef-city" data-ef="city">${CITY_OPTS}</select></label>`
    : `<label for="ef-${k}"${type === "text" ? ' class="wide"' : ""}>${label}<input id="ef-${k}" data-ef="${k}" type="${type === "bld" ? "text" : type}"${type === "bld" ? ' list="jb-blds"' : ""}${type === "tel" ? ' inputmode="tel"' : ""} autocomplete="off" value="${esc(type === "bld" ? eName("bld", x[k]) : x[k] || "")}" placeholder="${esc(ph)}"></label>`;
  const nm = x.n.trim().toLowerCase(), ppl = t === "bld" ? jbD.people.filter(p => (p.co || "").trim().toLowerCase() === nm || jbD.jobs.some(j => j.bld === x.id && (j.sup === p.id))) : [];
  const subs = t === "bld" ? jbD.subs.filter(s => s.bld === x.id) : [];
  return `<div class="set-btns jb-top"><button type="button" class="btn ghost" data-a="back">‹ Back</button></div>
  <div class="calc"><label for="ef-n" class="wide">${C.Title}<input id="ef-n" data-ef="n" type="text" autocomplete="off" value="${esc(x.n)}" placeholder="${C.ph}"></label>${C.fields.map(fld).join("")}</div>
  ${tel || web ? `<div class="jb-in"><div class="set-btns">${tel ? `<a class="btn" href="tel:${tel}">Call</a><a class="btn ghost" href="sms:${tel}">Text</a>` : ""}${web ? `<a class="btn ghost" href="${esc(/^https?:/i.test(web) ? web : "https://" + web)}" target="_blank" rel="noopener">Website</a>` : ""}</div></div>` : ""}
  ${t === "bld" ? `<p class="card-h">People · ${ppl.length}</p><div class="jb-list">${ppl.map(pRow).join("") || `<p class="note">Their supers and office people show up here: set a person's company to ${esc(x.n || "this builder")}, or make someone the super on one of their jobs.</p>`}</div>
  <p class="card-h">Subdivisions · ${subs.length}</p><div class="jb-list">${subs.map(s => eRow("sub", s)).join("") || `<p class="note">None yet. Pick this builder on a subdivision's page.</p>`}</div>` : ""}
  <p class="card-h">Jobs · ${jobs.length}</p>
  <div class="jb-list">${jbFew(jobs) || `<p class="note">No jobs yet. Pick ${esc(x.n || `this ${C.one}`)} on a job, or write [[${esc(x.n || "its name")}]] in a job's notes.</p>`}</div>
  <p class="card-h">Notes</p>
  ${jnBlock(x, x.log, t === "bld" ? "How they want things done. Who pays. - [ ] get the new super's number" : "Where the meters are, HOA rules, which lots are left")}
  <div class="set-btns jb-end"><button type="button" class="del" data-a="e-del">Delete this ${C.one}</button></div>`;
}
function jbDraw(){
  JB_IX = null;
  const body = $("jb-body"), ae = document.activeElement, had = !!ae && ae !== document.body && body.contains(ae);
  if (had) ae.blur();   /* a box removed while the keyboard is up never says so, and the bar floats: close it properly first */
  const en = eCur(), j = jbCur(), p = JB.person && pById(JB.person); if (JB.open && !j) JB.open = null; if (JB.person && !p) JB.person = null; if (JB.ent && !en) JB.ent = null;
  const dl = `<datalist id="jb-ppl">${jbD.people.map(x => `<option value="${esc(x.n)}">${esc(x.role)}</option>`).join("")}</datalist>`
    + ["bld", "sub"].map(t => `<datalist id="jb-${t}s">${eList(t).map(x => `<option value="${esc(x.n)}"></option>`).join("")}</datalist>`).join("");
  body.innerHTML = (en ? jbEntHtml(JB.ent.t, en) : p ? jbPersonHtml(p) : j ? jbJobHtml(j) : jbListHtml()) + dl;
  if (en){ if ($("ef-city")) $("ef-city").value = en.city || ""; }
  else if (p){}
  else if (j){ $("jb-city").value = j.city || ""; jfDraw(j.id); }
  else if (JB.view === "jobs"){ $("jb-goal").value = String(+jbD.goal === 6000 ? 6000 : 8000); jfUse(); }
  bindPn(body);
  if (had) jbReseat();
}
const jbTouch = o => { o.t = Date.now(); jbSave(); jbDraw(); };
const jbTop = () => { const c = $("jobs-card"); if (c) c.scrollIntoView({block: "start"}); };
const jbOpenStage = () => { const o = $("jt-open"); if (o) o.scrollIntoView({block: "start"}); };
const jbState = () => ({open: JB.open, stage: JB.stage, person: JB.person, ent: JB.ent});
const jbPush = () => { if (JB.open || JB.person || JB.ent) JB.hist.push(jbState()); };
function jbOpenPerson(id){ JB.allJobs = false; jbPush(); JB.ent = null; JB.person = id; JB.edit = null; jbDraw(); jbTop(); }
function jbOpenEnt(t, id){ JB.allJobs = false; jbPush(); JB.person = null; JB.ent = {t, id}; JB.edit = null; jbDraw(); jbTop(); }
function jbGoBack(){ const b = JB.hist.pop() || {open: null, stage: null, person: null, ent: null}; Object.assign(JB, b); JB.edit = null; JB.ckEdit = false; jbSave(); jbDraw(); jbTop(); }
function jbBack(){
  const en = eCur(); if (en){ if (!en.n.trim() && !en.log.length && !eJobs(JB.ent.t, en).length) jbD[ENT[JB.ent.t].list] = eList(JB.ent.t).filter(x => x !== en); jbGoBack(); return; }   /* a new page left blank isn't kept */
  if (JB.person){ const p = pById(JB.person);
    if (p && !p.n.trim() && !p.log.length && !pJobs(p).length) jbD.people = jbD.people.filter(x => x !== p);
    jbGoBack(); return; }
  const j = jbCur();
  if (j && !(j.a || "").trim() && !(j.name || "").trim() && !j.who.trim() && !j.bld && !j.sub && !j.log.length && !j.draft.trim() && !j.insp.length && !j.hrs.length && !j.punch.length && !j.lead && !j.sup && !JF.n)
    jbD.jobs = jbD.jobs.filter(x => x !== j);   /* a new job left blank isn't kept */
  jbGoBack();
}
/* [[link]]: a person, another job by its address, else a card in the book by its title */
function jnGo(x){
  const per = pByName(x); if (per){ jbOpenPerson(per.id); return; }
  for (const t of ["bld", "sub"]){ const e = eByName(t, x); if (e){ jbOpenEnt(t, e.id); return; } }
  const q = x.trim().toLowerCase(), nm = j => [j.name, j.a].map(v => (v || "").trim().toLowerCase()).filter(Boolean);   /* by name or address */
  const job = jbD.jobs.find(j => nm(j).includes(q)) || jbD.jobs.find(j => nm(j).some(v => v.includes(q)));
  if (job){ jbPush(); JB.person = null; JB.ent = null; JB.open = job.id; JB.edit = null; JB.stage = null; JF.n = 0; jbDraw(); jbTop(); return; }
  const secs = SECTIONS.filter(s => s.dataset.sec !== "jobs" && s.querySelector("h2")), h = s => s.querySelector("h2").textContent.trim().toLowerCase();
  const sec = secs.find(s => h(s) === q) || secs.find(s => h(s).includes(q));
  if (sec) jumpToSec(sec);
  else if (jbAsk(`No person, builder, subdivision, job or card called "${x}". Make a page for a person named ${x}?`)){ const p = pGet(x, "Other"); jbSave(); jbOpenPerson(p.id); }
}
/* toolbar: put the markup in for you, at the cursor or at the start of the line */
let jnTa = null;
function jnInsert(k){
  const ta = jnTa && document.body.contains(jnTa) ? jnTa : $("jn-new"); if (!ta) return;
  const v = ta.value, s = ta.selectionStart ?? v.length, en = ta.selectionEnd ?? s, sel = v.slice(s, en); let nv, cs, ce;
  if (k === "**" || k === "[["){ const [p, q] = k === "**" ? ["**", "**"] : ["[[", "]]"]; nv = v.slice(0, s) + p + sel + q + v.slice(en); cs = s + p.length; ce = cs + sel.length; }
  else if (k === "@date" || k === "#"){ const x = k === "#" ? (s && !/\s/.test(v[s - 1]) ? " #" : "#") : jbNice(jbDay()); nv = v.slice(0, s) + x + v.slice(en); cs = ce = s + x.length; }
  else { const ls = v.lastIndexOf("\n", s - 1) + 1; nv = v.slice(0, ls) + k + v.slice(ls); cs = s + k.length; ce = en + k.length; }
  ta.value = nv; ta.focus(); ta.setSelectionRange(cs, ce); ta.dispatchEvent(new Event("input", {bubbles: true}));
}

const B = $("jb-body");
B.addEventListener("focusin", e => { if (e.target.classList.contains("jn-ta")) jnTa = e.target; });
["pointerdown", "mousedown"].forEach(ev => B.addEventListener(ev, e => { if (e.target.closest("[data-ins]")) e.preventDefault(); }));   /* keep the keyboard up */
B.addEventListener("click", e => {
  const t = e.target.closest("[data-a],[data-open],[data-show],[data-view],[data-del],[data-v],[data-ins],[data-edit],[data-wl],[data-tag],[data-tagclr],[data-stage],[data-sst],[data-person],[data-pdel],[data-ckdel],[data-ent],[data-xadd],[data-xdel]"); if (!t) return;
  const j = jbCur(), o = jnOwner(), a = t.dataset.a, v = id => $(id).value.trim(), st = j && j.stages[JB.stage];
  if (t.dataset.ins){ jnInsert(t.dataset.ins); return; }
  if (t.dataset.wl){ jnGo(t.dataset.wl); return; }
  if (t.dataset.xadd && j){ const k = t.dataset.xadd; if (!j.xs.includes(k)) j.xs.push(k); JB.stage = k; JB.ckEdit = false; jbTouch(j); jbOpenStage(); return; }
  if (t.dataset.xdel && j){ const k = t.dataset.xdel; if (!jbAsk(`Take ${JB_SNAME[k]} off this job? Anything filled in stays saved and comes back if you add it again.`)) return;
    j.xs = j.xs.filter(x => x !== k); JB.stage = null; jbTouch(j); return; }
  if (t.dataset.ent){ const [et, id] = t.dataset.ent.split("|"); jbOpenEnt(et, id); return; }
  if (t.dataset.tag){ JB.tag = t.dataset.tag; JB.view = "jobs"; JB.show = "all"; JB.open = null; JB.person = null; JB.ent = null; JB.hist = []; JB.edit = null; jbDraw(); jbTop(); return; }
  if (t.dataset.tagclr){ JB.tag = null; jbDraw(); return; }
  if (t.dataset.view){ JB.view = t.dataset.view; jbDraw(); return; }
  if (t.dataset.person){ jbOpenPerson(t.dataset.person); return; }
  if (t.dataset.edit){ JB.edit = t.dataset.edit; jbDraw(); const ta = $("jn-ed"); if (ta){ ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } return; }
  if (t.dataset.open){ jbPush(); JB.person = null; JB.ent = null; JB.open = t.dataset.open; JB.edit = null; JB.stage = null; JF.n = 0; jbDraw(); jbTop(); return; }
  if (t.dataset.show){ JB.show = t.dataset.show; jbDraw(); return; }
  if (t.dataset.v){ jfView(t.dataset.v); return; }
  if (t.dataset.stage && j){ JB.stage = t.dataset.stage; JB.edit = null; JB.ckEdit = false; jbDraw(); jbOpenStage(); return; }
  if (t.dataset.sst && st){ const val = t.dataset.sst; st.st = val;
    if (val === "doing" && !st.d0) st.d0 = jbDay();
    if (val === "done"){ if (!st.d1) st.d1 = jbDay(); if (!st.d0) st.d0 = st.d1;
      const S = jbStages(j), i = S.findIndex(([k]) => k === JB.stage), nx = S.slice(i + 1).find(([k]) => j.stages[k].st === "todo");
      if (nx){ const n = j.stages[nx[0]]; n.st = "doing"; if (!n.d0) n.d0 = jbDay(); toast(`${JB_SNAME[JB.stage]} done. ${JB_SNAME[nx[0]]} is next.`, 2400); JB.stage = nx[0]; jbTouch(j); jbOpenStage(); return; } }
    jbTouch(j); return; }
  if (t.dataset.pdel && j){ j.ppl = j.ppl.filter(x => x.id !== t.dataset.pdel); jbTouch(j); return; }
  if (t.dataset.ckdel && st){ const k = t.dataset.ckdel;
    if (k[0] === "t"){ const txt = jbTpl(JB.stage)[+k.slice(1)]; st.hide = [...new Set([...(st.hide || []), txt])]; }
    else st.extra = st.extra.filter(x => "x" + x.id !== k);
    jbTouch(j); return; }
  if (a === "ck-edit"){ JB.ckEdit = !JB.ckEdit; jbDraw(); jbOpenStage(); return; }
  if (a === "ck-save" && st){ const C = jbCk(j, JB.stage), list = C.items.map(x => x.t);
    jbD.tpl = Object.assign({}, jbD.tpl, {[JB.stage]: list});
    st.done = C.items.filter(x => x.done).map(x => x.t); st.hide = []; st.extra = [];   /* this job now runs on the saved list */
    JB.ckEdit = false; jbTouch(j); toast(`Saved. New jobs start ${JB_SNAME[JB.stage]} with these ${list.length} items.`, 2600); return; }
  if (a === "ck-book" && st){ if (!jbAsk(`Go back to the book's list for ${JB_SNAME[JB.stage]} on new jobs? Jobs you already have keep what they show now.`)) return;
    const book = JB_TPL[JB.stage](), bs = new Set(book);
    jbD.jobs.forEach(x => { const s2 = x.stages[JB.stage], have = jbCk(x, JB.stage).items;
      s2.extra = have.filter(y => !bs.has(y.t)).map(y => ({id: jbId(), t: y.t, done: y.done})); s2.hide = book.filter(b => !have.some(y => y.t === b)); s2.done = have.filter(y => y.done).map(y => y.t); });
    delete jbD.tpl[JB.stage]; JB.ckEdit = false; jbTouch(j); toast("Back to the book's list for new jobs.", 2200); return; }
  if (a === "back"){ JB.allJobs = false; jbBack(); return; }
  if (a === "all-jobs"){ JB.allJobs = true; jbDraw(); return; }
  if (a === "new"){ jbNew(); JF.n = 0; jbDraw(); jbTop(); $("jb-n").focus(); return; }
  if (a === "e-new"){ const x = eGet(JB.view, "\u200b"); x.n = ""; jbSave(); JB.open = null; jbOpenEnt(JB.view, x.id); $("ef-n").focus(); return; }
  if (a === "e-del" && JB.ent){ const {t: et} = JB.ent, x = eCur(); if (!x || !jbAsk(`Delete ${x.n || "this " + ENT[et].one}? It comes off every job; notes that mention it stay.`)) return;
    jbD[ENT[et].list] = eList(et).filter(y => y !== x); jbD.jobs.forEach(j => { if (j[et] === x.id) j[et] = ""; }); if (et === "bld") jbD.subs.forEach(s => { if (s.bld === x.id) s.bld = ""; });
    jbGoBack(); return; }
  if (a === "p-new"){ const p = {id: jbId(), n: "", role: "Other", co: "", ph: "", em: "", log: [], draft: "", t: Date.now()}; jbD.people.push(p); jbSave(); JB.open = null; jbOpenPerson(p.id); $("pp-n").focus(); return; }
  if (a === "p-del" && JB.person){ const p = pById(JB.person); if (!p || !jbAsk(`Delete ${p.n || "this person"}? They come off every job; notes that mention them stay.`)) return;
    jbD.people = jbD.people.filter(x => x !== p);
    jbD.jobs.forEach(x => { if (x.lead === p.id) x.lead = ""; if (x.sup === p.id) x.sup = ""; x.ppl = x.ppl.filter(y => y.p !== p.id); JB_STG.forEach(([k]) => { if (x.stages[k].lead === p.id) x.stages[k].lead = ""; }); });
    jbGoBack(); return; }
  if (a === "jn-add" && o){ const b = $("jn-new").value.trim(); if (!b){ toast("Write the note first."); return; }
    o.log.push(Object.assign({id: jbId(), d: $("jn-d").value || jbDay(), at: Date.now(), b}, (JB.person || JB.ent) ? {} : {s: JB.stage})); o.draft = ""; jnTa = null; jbTouch(o); toast("Note added.", 1600); return; }
  if (a === "jn-save" && o){ const n = o.log.find(x => x.id === JB.edit); if (n){ n.b = $("jn-ed").value.trim() || n.b; n.d = $("jn-ed-d").value || n.d; } JB.edit = null; jnTa = null; jbTouch(o); return; }
  if (a === "jn-cancel"){ JB.edit = null; jnTa = null; jbDraw(); return; }
  if (a === "jn-del" && o){ if (!jbAsk("Delete this note?")) return; o.log = o.log.filter(x => x.id !== JB.edit); JB.edit = null; jnTa = null; jbTouch(o); return; }
  if (t.dataset.del && j){ const [k, id] = t.dataset.del.split("|");
    if (k !== "punch" && !jbAsk(k === "hrs" ? "Delete these hours?" : "Delete this inspection?")) return;
    j[k] = j[k].filter(x => x.id !== id); jbTouch(j); return; }
  if (!j){ if (a === "jf-save") jfBackup(); return; }
  if (a === "ck-add" && st){ const x = v("jc-t"); if (!x) return; st.extra.push({id: jbId(), t: x, done: false}); jbTouch(j); $("jc-t").focus(); }
  else if (a === "insp-add"){ const d = v("ji-d"); if (!d){ toast("Pick a date."); return; }
    const who = v("ji-who"); if (who) pGet(who, "Inspector");
    j.insp.push({id: jbId(), d, s: JB.stage, k: JB_SNAME[JB.stage], r: $("ji-r").value, who, n: v("ji-n")}); jbTouch(j); toast("Inspection added.", 1800); }
  else if (a === "hrs-add"){ const h = parseFloat($("jh-h").value), d = v("jh-d");
    if (!(h > 0 && h <= 24) || !d){ toast("Enter the date and the hours (more than 0, up to 24)."); return; }
    j.hrs.push({id: jbId(), d, s: JB.stage, h: Math.round(h * 100) / 100, n: v("jh-n")}); jbTouch(j); toast(`${jbHr(h)} hr logged.`, 1800); }
  else if (a === "ppl-add"){ const p = pGet(v("jpo-n"), $("jpo-r").value); if (!p){ toast("Type their name."); return; }
    if (!j.ppl.some(x => x.p === p.id)) j.ppl.push({id: jbId(), r: $("jpo-r").value, p: p.id}); jbTouch(j); }
  else if (a === "punch-add"){ const x = v("jp-t"); if (!x) return; j.punch.push({id: jbId(), t: x, done: false}); jbTouch(j); $("jp-t").focus(); }
  else if (a === "punch-clear"){ j.punch = j.punch.filter(p => !p.done); jbTouch(j); }
  else if (a === "job-del"){
    if (!jbAsk(`Delete "${jbName(j)}" with its timeline, notes, hours, photos and files? This can't be undone.`)) return;
    jbD.jobs = jbD.jobs.filter(x => x !== j); jfAll(j.id).then(L => Promise.all(L.map(f => jfDel(f.id)))).catch(() => {});
    JB.open = null; jbSave(); jbDraw(); jbTop(); toast("Job deleted.", 1800); }
});
B.addEventListener("keydown", e => { if (e.key !== "Enter") return; const btn = {"jp-t": "punch-add", "jc-t": "ck-add"}[e.target.id];
  if (btn){ e.preventDefault(); B.querySelector(`[data-a="${btn}"]`).click(); } });
B.addEventListener("input", e => { const t = e.target, j = jbCur(), p = JB.person && pById(JB.person), en = eCur();
  if (en && t.dataset.ef && t.tagName !== "SELECT" && t.dataset.ef !== "bld"){ en[t.dataset.ef] = t.value; en.t = Date.now(); clearTimeout(jbT); jbT = setTimeout(jbSave, 500); }
  if (j && t.dataset.f && t.tagName !== "SELECT"){ j[t.dataset.f] = t.value; j.t = Date.now(); clearTimeout(jbT); jbT = setTimeout(jbSave, 500); }
  if (p && t.dataset.pf && t.tagName !== "SELECT"){ p[t.dataset.pf] = t.value; p.t = Date.now(); clearTimeout(jbT); jbT = setTimeout(jbSave, 500); }
  if (t.id === "jn-new"){ const o = jnOwner(); if (o){ o.draft = t.value; clearTimeout(jbT); jbT = setTimeout(() => store.set("jpb-jobs", jbD), 500); } } });   /* a half-written note survives leaving the page */
B.addEventListener("change", e => { const t = e.target, j = jbCur(), p = JB.person && pById(JB.person), st = j && j.stages[JB.stage], en = eCur();
  if (en && t.dataset.ef){ const k = t.dataset.ef; if (k === "bld"){ const b = eGet("bld", t.value); en.bld = b ? b.id : ""; } else en[k] = t.value.trim(); if (k !== "n" || en.n) jbTouch(en); return; }
  if (j && t.dataset.je){ const k = t.dataset.je, x = eGet(k, t.value); j[k] = x ? x.id : "";
    if (k === "sub" && x){ if (!j.city && x.city) j.city = x.city; if (!j.bld && x.bld) j.bld = x.bld; }   /* a subdivision fills in its city and builder */
    jbTouch(j); return; }
  if (t.tagName === "SELECT" || /^(date|file)$/.test(t.type)) jbReseat();   /* a picker wheel or the photo sheet just closed */
  if (p && t.dataset.pf){ p[t.dataset.pf] = t.value.trim(); jbTouch(p); return; }
  if (t.dataset.tk){ const o = jnOwner(), [eid, i] = t.dataset.tk.split("|"), n = o && o.log.find(x => x.id === eid);
    if (n){ const L = n.b.split("\n"); L[+i] = L[+i].replace(/\[( |x|X)\]/, m => m === "[ ]" ? "[x]" : "[ ]"); n.b = L.join("\n"); jbTouch(o); } return; }
  if (j && t.dataset.f){ if (t.tagName === "SELECT"){ j[t.dataset.f] = t.value; jbTouch(j); } else if (t.dataset.f === "a") jbTouch(j); else jbSave(); return; }   /* the address shows Directions */
  if (j && t.dataset.jp){ const per = pGet(t.value, t.dataset.jp === "lead" ? "Lead" : "Superintendent"); j[t.dataset.jp] = per ? per.id : ""; jbTouch(j); return; }
  if (st && t.dataset.sp){ const per = pGet(t.value, "Lead"); st.lead = per ? per.id : ""; jbTouch(j); return; }
  if (st && t.dataset.sf){ st[t.dataset.sf] = t.value; jbTouch(j); return; }
  if (st && t.dataset.ck){ const k = t.dataset.ck;
    if (k[0] === "t"){ const txt = jbTpl(JB.stage)[+k.slice(1)], s = new Set(st.done); t.checked ? s.add(txt) : s.delete(txt); st.done = [...s]; }
    else { const x = st.extra.find(y => "x" + y.id === k); if (x) x.done = t.checked; }
    jbTouch(j); return; }
  if (j && t.dataset.ir){ const i = j.insp.find(x => x.id === t.dataset.ir); if (i){ i.r = t.value; jbTouch(j); } return; }
  if (j && t.dataset.pk){ const x = j.punch.find(y => y.id === t.dataset.pk); if (x){ x.done = t.checked; jbTouch(j); } return; }
  if (t.id === "jb-goal"){ jbD.goal = +t.value; jbSave(); jbDraw(); return; }
  if (t.id === "jb-before"){ jbD.before = Math.max(0, parseFloat(t.value) || 0); jbSave(); jbDraw(); return; }
  if (t.id === "jf-ph" || t.id === "jf-fi"){ jfAdd([...t.files], t.id === "jf-ph"); return; }
  if (t.id === "jf-restore" && t.files[0]) jfRestore(t.files[0]);
});

/* Home: MY JOBS box (homeDraw calls this) */
window.jobsHome = () => {
  const open = jbD.jobs.filter(j => j.st === "open").sort((a, b) => b.t - a.t).slice(0, 3), H = jbHours();
  return `<p class="card-h">My jobs <button type="button" class="linkish" data-hj="all">All</button></p>`
    + (open.length ? `<div class="jb-list">${open.map(j => jbRow(j, "data-hj")).join("")}</div>`
      : `<p class="note"><button type="button" class="linkish" data-hj="new">Add a job</button>: a timeline from Underground to Final, with the blanks ready to fill in.</p>`)
    + (H.wk ? `<p class="note">${jbHr(H.today)} hr today · ${jbHr(H.wk)} hr this week</p>` : "");
};
$("home-body").addEventListener("click", e => { const b = e.target.closest("[data-hj]"); if (!b) return; const k = b.dataset.hj;
  JF.n = 0; JB.edit = null; JB.person = null; JB.ent = null; JB.hist = []; JB.stage = null; JB.view = "jobs"; if (k === "new") jbNew(); else JB.open = k === "all" ? null : k;
  go("mine", "jobs"); jbDraw(); jbTop(); });

/* ---- photos & files: IndexedDB */
let jfDbP = null;
const jfDb = () => jfDbP || (jfDbP = new Promise((ok, no) => {
  const r = indexedDB.open("jpb-files", 1);
  r.onupgradeneeded = () => r.result.createObjectStore("files", {keyPath: "id"}).createIndex("job", "job");
  r.onsuccess = () => ok(r.result); r.onerror = () => { jfDbP = null; no(r.error); };
}));
const jfTx = (mode, fn) => jfDb().then(db => new Promise((ok, no) => {
  const t = db.transaction("files", mode), r = fn(t.objectStore("files")); let out;
  if (r) r.onsuccess = () => { out = r.result; };
  t.oncomplete = () => ok(out); t.onerror = () => no(t.error); t.onabort = () => no(t.error);
}));
const jfAll = job => jfTx("readonly", s => job ? s.index("job").getAll(job) : s.getAll());
const jfPut = rec => jfTx("readwrite", s => s.put(rec));
const jfDel = id => jfTx("readwrite", s => s.delete(id));

async function jfDraw(job){
  let L; try { L = await jfAll(job); } catch(e){ const p = $("jf-photos"); if (p) p.innerHTML = `<p class="note">This browser won't store photos here.</p>`; return; }
  const j = jbCur(); if (!j || JB.open !== job || JB.person || JB.ent) return;
  L.sort((a, b) => a.t - b.t); JF.n = L.length;
  for (const f of L) if (f.kind === "photo" && !f.s){ f.s = jbStageNow(j); jfPut(f).catch(() => {}); }   /* photos from before stages */
  const P = L.filter(f => f.kind === "photo" && f.s === JB.stage), F = L.filter(f => f.kind !== "photo");
  const ph = $("jf-photos"), fi = $("jf-files");
  if (ph) ph.innerHTML = P.map(f => `<button type="button" class="jf-th" data-v="${f.id}" aria-label="Photo${f.note ? ": " + esc(f.note) : ""}">${f.thumb ? `<img src="${f.thumb}" alt="">` : "<b>Photo</b>"}${f.note ? `<span>${esc(f.note)}</span>` : ""}</button>`).join("")
    || `<p class="note">None yet. Stub-outs before drywall, the test gauge, what the inspector flagged.</p>`;
  if (fi) fi.innerHTML = F.map(f => `<button type="button" class="jb-row" data-v="${f.id}"><b>${esc(f.name)}</b><span>${jfMB(f.blob.size)}${f.note ? " · " + esc(f.note) : ""}</span></button>`).join("")
    || `<p class="note">None yet. Plans, the permit, spec sheets.</p>`;
}
function jfUse(){
  jfAll().then(L => { const u = $("jf-use"); if (!u) return; const s = L.reduce((n, f) => n + (f.blob ? f.blob.size : 0), 0);
    u.textContent = L.length ? `${L.length} photo${L.length === 1 ? "" : "s"} and file${L.length === 1 ? "" : "s"} in all, about ${jfMB(s)}, saved on this phone. They're too big for Settings → Download backup, so save them here now and then.`
      : "Photos and files stay on this phone. They're too big for Settings → Download backup, so save them here now and then."; }).catch(() => {});
}
/* one decode, two JPEGs: about 1600 px for the record, 240 px for the grid. The browser applies the phone's rotation. */
async function jfImg(file){
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error("decode")); i.src = url; });
    const draw = (max, q) => new Promise((ok, no) => {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); c.toBlob(b => b ? ok(b) : no(new Error("encode")), "image/jpeg", q); });
    const big = await draw(1600, .82), small = await draw(240, .7);
    const thumb = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(small); });
    return {big, thumb};
  } finally { URL.revokeObjectURL(url); }
}
async function jfAdd(files, photos){
  const j = jbCur(); if (!j || !files.length) return;
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch(e){}   /* ask the phone not to clear them */
  toast(`Saving ${files.length}…`, 9000);
  let n = 0, bad = 0;
  for (const f of files){
    try {
      const img = photos && /^image\//.test(f.type); let blob = f, thumb = "", type = f.type || "application/octet-stream";
      if (img){ try { const x = await jfImg(f); blob = x.big; thumb = x.thumb; type = "image/jpeg"; } catch(e){} }
      await jfPut(Object.assign({id: jbId(), job: j.id, kind: img ? "photo" : "file", name: f.name || (img ? "photo.jpg" : "file"), type, blob, thumb, note: "", t: Date.now()}, img ? {s: JB.stage} : {})); n++;
    } catch(e){ bad++; }
  }
  toast(bad ? `Saved ${n}. ${bad} couldn't be saved: the phone may be out of space.` : `Saved ${n}.`, 2400);
  j.t = Date.now(); jbSave(); jfDraw(j.id); jbReseat();
  const inp = $(photos ? "jf-ph" : "jf-fi"); if (inp) inp.value = "";
}
async function jfView(id){
  const f = await jfTx("readonly", s => s.get(id)).catch(() => null); if (!f) return;
  JF.cur = f; if (JF.url) URL.revokeObjectURL(JF.url); JF.url = URL.createObjectURL(f.blob);
  $("jf-dlg-body").innerHTML = f.kind === "photo" ? `<img src="${JF.url}" alt="Job photo">` : `<p class="jf-fname"><b>${esc(f.name)}</b><br>${jfMB(f.blob.size)}</p>`;
  $("jf-note").value = f.note || ""; $("jf-dlg").showModal();
}
$("jf-note").addEventListener("input", () => { if (!JF.cur) return; JF.cur.note = $("jf-note").value; clearTimeout(jfNT); jfNT = setTimeout(() => jfPut(JF.cur).catch(() => {}), 400); });
$("jf-close").addEventListener("click", () => $("jf-dlg").close());
$("jf-dlg").addEventListener("close", () => { const c = JF.cur; JF.cur = null; clearTimeout(jfNT); jbReseat();
  if (c) jfPut(c).catch(() => {}).then(() => { if (JB.open === c.job) jfDraw(c.job); }); });
$("jf-open").addEventListener("click", () => { if (!JF.url) return; const a = document.createElement("a"); a.href = JF.url; a.target = "_blank"; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove(); });
$("jf-share").addEventListener("click", async () => { const c = JF.cur; if (!c) return;
  const f = new File([c.blob], c.kind === "photo" ? c.name.replace(/\.[^.]*$/, "") + ".jpg" : c.name, {type: c.type});
  try { if (navigator.canShare && navigator.canShare({files: [f]})){ await navigator.share({files: [f]}); return; } } catch(e){ if (e && e.name === "AbortError") return; }
  const a = document.createElement("a"); a.href = JF.url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); });
$("jf-del").addEventListener("click", async () => { const c = JF.cur; if (!c || !jbAsk(`Delete this ${c.kind === "photo" ? "photo" : "file"}?`)) return;
  JF.cur = null; await jfDel(c.id).catch(() => {}); $("jf-dlg").close(); jfDraw(c.job); });

/* ---- photos & files backup: a plain (stored, not compressed) zip with manifest.json; JPEGs and PDFs don't shrink anyway */
const JF_CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++){ let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const jfCrc = u => { let c = -1; for (let i = 0; i < u.length; i++) c = JF_CRC[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
async function jfZip(list){
  const enc = new TextEncoder(), parts = [], cd = []; let off = 0;
  for (const e of list){
    const nm = enc.encode(e.name), data = new Uint8Array(await e.blob.arrayBuffer()), crc = jfCrc(data), sz = data.length;
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(12, 0x21, true);
    h.setUint32(14, crc, true); h.setUint32(18, sz, true); h.setUint32(22, sz, true); h.setUint16(26, nm.length, true);
    parts.push(h.buffer, nm, e.blob);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(14, 0x21, true);
    c.setUint32(16, crc, true); c.setUint32(20, sz, true); c.setUint32(24, sz, true); c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
    cd.push(c.buffer, nm); off += 30 + nm.length + sz;
  }
  const cs = cd.reduce((n, p) => n + p.byteLength, 0), z = new DataView(new ArrayBuffer(22));
  z.setUint32(0, 0x06054b50, true); z.setUint16(8, list.length, true); z.setUint16(10, list.length, true); z.setUint32(12, cs, true); z.setUint32(16, off, true);
  return new Blob([...parts, ...cd, z.buffer], {type: "application/zip"});
}
function jfUnzip(buf){
  const v = new DataView(buf), u = new Uint8Array(buf), dec = new TextDecoder(), out = {};
  let e = buf.byteLength - 22; while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--; if (e < 0) throw new Error("not a zip");
  let p = v.getUint32(e + 16, true);
  for (let i = 0, n = v.getUint16(e + 10, true); i < n; i++){
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error("bad zip");
    const meth = v.getUint16(p + 10, true), sz = v.getUint32(p + 20, true), nl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), lo = v.getUint32(p + 42, true);
    const name = dec.decode(u.subarray(p + 46, p + 46 + nl)), s = lo + 30 + v.getUint16(lo + 26, true) + v.getUint16(lo + 28, true);
    if (meth === 0) out[name] = u.subarray(s, s + sz);
    p += 46 + nl + xl + cl;
  }
  return out;
}
async function jfBackup(){
  let L; try { L = await jfAll(); } catch(e){ jfSay("Couldn't read the photos on this phone.", "err"); return; }
  if (!L.length){ jfSay("No photos or files yet."); return; }
  jfSay(`Packing ${L.length}…`);
  const man = L.map(f => ({id: f.id, job: f.job, s: f.s, jobName: (j0 => j0 ? jbName(j0) : "")(jbD.jobs.find(x => x.id === f.job)), kind: f.kind, name: f.name, type: f.type, note: f.note, t: f.t, thumb: f.thumb,
    path: `files/${f.id}-${String(f.name).replace(/[^\w.\- ]+/g, "_").slice(-60)}`}));
  try {
    const zip = await jfZip([{name: "manifest.json", blob: new Blob([JSON.stringify({app: "utah-plumbers-handbook-files", v: 1, made: new Date().toISOString(), files: man})])},
      ...L.map((f, i) => ({name: man[i].path, blob: f.blob}))]);
    const a = document.createElement("a"); a.href = URL.createObjectURL(zip); a.download = `handbook-job-files-${jbDay()}.zip`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    jfSay(`Made a ${jfMB(zip.size)} zip. Keep it in Files or iCloud Drive.`, "good");
  } catch(e){ jfSay("Couldn't make the backup: " + (e && e.message || e), "err"); }
}
async function jfRestore(file){
  try {
    const z = jfUnzip(await file.arrayBuffer()), m = JSON.parse(new TextDecoder().decode(z["manifest.json"]));
    if (!m || m.app !== "utah-plumbers-handbook-files" || !Array.isArray(m.files)) throw 0;
    let n = 0, lost = 0;
    for (const f of m.files){ const x = z[f.path]; if (!x) continue;
      await jfPut(Object.assign({id: f.id, job: f.job, kind: f.kind, name: f.name, type: f.type, blob: new Blob([x], {type: f.type}), thumb: f.thumb || "", note: f.note || "", t: f.t || Date.now()}, f.s ? {s: f.s} : {})); n++;
      if (!jbD.jobs.some(j => j.id === f.job)) lost++; }
    jfSay(`Restored ${n}.` + (lost ? ` ${lost} belong to jobs that aren't on this phone: restore Settings → backup first, then this file again.` : ""), "good"); jfUse();
  } catch(e){ jfSay("That isn't a photos & files backup from this app.", "err"); }
  const r = $("jf-restore"); if (r) r.value = "";
}

jbDraw(); try { homeDraw(); } catch(e){}
} catch(e){ const b = document.getElementById("jb-body"); if (b){ b.innerHTML = '<p class="note flag">My jobs hit an error: ' + String(e && e.message || e).replace(/</g, "&lt;") + '. Your jobs are still saved on this phone. Download them so they\'re safe, then send the file and this message to Deklan.</p><div class="set-btns jb-top"><button type="button" class="btn" id="jb-rescue">Download my jobs data</button></div>';
  const r = document.getElementById("jb-rescue"); if (r) r.addEventListener("click", () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([localStorage.getItem("jpb-jobs") || ""], {type: "application/json"})); a.download = "handbook-jobs-rescue.json"; document.body.appendChild(a); a.click(); a.remove(); }); } if (window.console) console.error(e); }
