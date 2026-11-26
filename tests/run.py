#!/usr/bin/env python3
"""Handbook checks. Run from the repo root:  python3 tests/run.py
Needs Python Playwright with Chromium (pip install playwright && playwright install chromium).

What it does, with no network and no server (files are served straight from this folder):
  1. every inline <script>, jobs.js and sw.js must parse (uses node if it's installed)
  2. the page loads on a phone-size screen and every page opens with no script errors
  3. calculator answers match hand-worked numbers (the "why" is next to each case)
  4. every "jump to a card" link lands on its card
  5. text typed into jobs, people and notes is shown as text, never run as code
  6. photo markup saves a new photo and leaves the original untouched
  7. job rooms: copy, add, link from notes, rename
Exit code 0 = all passed. Not part of the app: the app never downloads this folder."""
import json, mimetypes, pathlib, re, shutil, subprocess, sys, time
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
BASE = "https://handbook.test/"
FAILS = []
def check(ok, what):
    print(("  ok   " if ok else "  FAIL ") + what)
    if not ok: FAILS.append(what)

def serve(route):
    u = route.request.url
    if not u.startswith(BASE): return route.abort()   # offline: fonts and weather are skipped
    f = ROOT / (u[len(BASE):].split("?")[0].split("#")[0] or "index.html")
    if f.is_file(): route.fulfill(status=200, body=f.read_bytes(), content_type=mimetypes.guess_type(str(f))[0] or "text/plain")
    else: route.fulfill(status=404, body=b"not found")

# ---------- 1. scripts parse ----------
print("1. Scripts parse")
if shutil.which("node"):
    js = r"""const fs=require('fs');const s=fs.readFileSync(process.argv[1],'utf8');let bad=[],m,re=/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g;
while((m=re.exec(s))){try{new Function(m[1])}catch(e){bad.push('index.html line '+s.slice(0,m.index).split('\n').length+': '+e.message)}}
for(const f of ['jobs.js','sw.js']){try{new Function(fs.readFileSync(process.argv[2]+'/'+f,'utf8'))}catch(e){bad.push(f+': '+e.message)}}console.log(JSON.stringify(bad))"""
    bad = json.loads(subprocess.run(["node", "-e", js, str(ROOT / "index.html"), str(ROOT)], capture_output=True, text=True).stdout or "[]")
    check(not bad, "index.html scripts, jobs.js and sw.js parse" + (": " + "; ".join(bad) if bad else ""))
else:
    print("  skip (node not installed)")

SET = """([id,v])=>{const e=document.getElementById(id); if(!e) return 'missing box '+id; e.value=v;
  for (const t of ['input','change']) e.dispatchEvent(new Event(t,{bubbles:true})); return e.value===String(v)?'ok':'value not taken '+id}"""
TXT = "id=>{const e=document.getElementById(id); return e ? e.textContent.replace(/\\s+/g,' ').trim() : 'missing '+id}"

# page, [(box, value)], answer box, text the answer must contain, why
CALCS = [
 ("calc/layout", [("ro-rise","12"),("ro-rise-f","0"),("ro-ang","45"),("ro-to","0"),("ro-to-f","0")], "ro-travel", "16.971", "45° travel = 12 × 1.4142"),
 ("calc/layout", [("ro-rise","66"),("ro-ang","45"),("ro-to","1"),("ro-to-f","8")], "ro-cut", "90 3/8", "66 × 1.4142 = 93.338, minus 2 × 1½ = 90.338 → 90 3/8"),
 ("calc/layout", [("ro-rise","10"),("ro-ang","22.5"),("ro-to","0"),("ro-to-f","0")], "ro-travel", "26.131", "22½° travel = 10 ÷ sin 22.5°"),
 ("calc/layout", [("ro-rise","5' 6"),("ro-rise-f","0"),("ro-ang","45"),("ro-to","0"),("ro-to-f","0")], "ro-run", "66", "tape style: 5' 6 = 66 in"),
 ("calc/layout", [("ro-rise","5' 6 1/2"),("ro-ang","45")], "ro-travel", "94.045", "66.5 × 1.4142"),
 ("calc/layout", [("ro-rise","66"),("ro-rise-f","8"),("ro-ang","45")], "ro-travel", "94.045", "66 + 8/16 from the pad"),
 ("calc/layout", [("ro-rise","12abc"),("ro-rise-f","0")], "ro-cut", "Can't read", "junk input warns"),
 ("calc/layout", [("fi-expr","10' 4 3/8\" + 5 1/2")], "fi-out", "10' 9 7/8\"", "124.375 + 5.5 = 129.875"),
 ("calc/layout", [("fi-expr","12' ÷ 0")], "fi-out", "Can't divide by 0", "divide by zero is caught"),
 ("calc/layout", [("cl-m","36 1/4")], "cl-cut", "34", "36¼ minus two 1⅛ take-offs"),
 ("calc/layout", [("sq-a","6'"),("sq-b","8'")], "sq-ans", "10' 0\"", "3-4-5 triangle"),
 ("calc/layout", [("bc-d","6"),("bc-n","4")], "bc-ans", "4 1/4", "chord = 6 × sin 45° = 4.243"),
 ("calc/layout", [("po-s","6"),("po-ang","45"),("po-n","3")], "po-ans", "2.485", "setback = 6 × tan 22.5°"),
 ("calc/layout", [("es-len","10'"),("es-max","16"),("es-in","")], "es-ans", "15", "120 in ÷ 8 gaps"),
 ("calc/grade", [("sl-run","40'"),("sl-pitch","0.25")], "sl-ans", "10\" fall", "40 ft × ¼\""),
 ("calc/grade", [("sl-run","480\""),("sl-pitch","0.125")], "sl-ans", "5\" fall", "480\" = 40 ft × ⅛\""),
 ("calc/grade", [("sl-run","-10")], "sl-ans", "Enter a run", "negative run is refused"),
 ("calc/grade", [("lr-start","4.52"),("lr-slope","0.25"),("lr-dist","20'")], "lr-ans", "4.94", "4.52 ft + 5\" (0.417 ft)"),
 ("calc/water", [("h-ft","10")], "h-ans", "4.33 psi", "10 ft × 0.433"),
 ("calc/water", [("v-pipe","1"),("v-gpm","5")], "v-ans", "3.31", "5 × 0.4085 ÷ 0.785²"),
 ("calc/water", [("p-size","4"),("p-len","50'"),("p-gpm","2")], "p-ans", "0.92 gal", "PEX ¾ ID 0.671: 0.7854 × 0.671² × 600 ÷ 231"),
 ("calc/water", [("hy-btu","40000"),("hy-dt","20"),("hy-fl","500")], "hy-ans", "4 gpm", "40,000 ÷ (500 × 20)"),
 ("calc/water", [("te-mat","0"),("te-len","100'"),("te-dt","100")], "te-ans", "11\"", "PEX 1.1\" per 100 ft per 10°F"),
 ("calc/water", [("tv-a","20"),("tv-h","60")], "tv-ans", "81.6 gal", "0.7854 × 20² × 60 ÷ 231"),
 ("calc/water", [("bt-g","5"),("bt-s","30")], "bt-ans", "10 gpm", "5 gal in 30 s"),
 ("calc/water", [("mx-h","120"),("mx-c","50"),("mx-t","105")], "mx-ans", "79% hot", "(105−50) ÷ (120−50)"),
 ("calc/sizing", [("g-btu","100000"),("g-elev","4520")], "g-out", "81,920", "4% per 1,000 ft: 18.08% off"),
 ("calc/math", [("mf-a","1 1/2"),("mf-b","3/8")], "mf-ans", "1 7/8", "1½ + ⅜"),
 ("calc/math", [("mr-a","2"),("mr-b","3"),("mr-c","10")], "mr-ans", "15", "2:3 = 10:15"),
 ("calc/math", [("mt-a","07:00"),("mt-b","15:30"),("mt-c","30")], "mt-ans", "8 hr", "8½ h less a 30-min break"),
 ("calc/math", [("mt-a","22:00"),("mt-b","06:00"),("mt-c","0")], "mt-ans", "past midnight", "overnight shift is 8 h"),
 ("calc/math", [("mt-a","07:00"),("mt-b","07:15"),("mt-c","30")], "mt-ans", "break is as long", "a break longer than the shift warns"),
 ("rough/vents", [("vs-stack","3"),("vs-dfu","20"),("vs-len","100")], "vs-ans", "2\"", "2021 IPC Table 906.1: 3\" stack, 21 DFU row, 2\" good to 110 ft"),
 ("rough/vents", [("vs-drain","3"),("vs-len2","50")], "vs-ans2", "2\"", "half of 3\" is 1½\", one size up past 40 ft"),
 ("mech/heaters", [("wh-btu","40000"),("wh-eff","80"),("wh-in","50"),("wh-set","120")], "wh-ans", "54.8 gph", "32,000 ÷ (8.34 × 70)"),
 ("mech/heaters", [("hl-tank","50"),("hl-set","120"),("hl-in","50"),("hl-use","105"),("hl-gpm","2"),("hl-rec","45"),("hl-usep","70")], "hl-ans", "43 min", "35 gal ÷ (1.571 − 0.75) gpm"),
 ("mech/hotwater", [("et-gal","50"),("et-t1","50"),("et-t2","120"),("et-p1","60"),("et-p2","150"),("et-el","4500")], "et-ans", "1.02 gal", "0.567 gal growth ÷ 0.554 acceptance"),
 ("mech/treat", [("sf-p","4"),("sf-gal","75"),("sf-h","15"),("sf-fe","0"),("sf-d","7"),("sf-salt","10")], "sf-ans", "48,000", "31,500 gr ÷ 25,000 = 1.26 → 1.5 ft³"),
 ("calc/sizing", [("ej-d","18"),("ej-pd","10"),("ej-q","40"),("ej-in","5"),("ej-lift","10'"),("ej-len","30'")], "ej-out", "11 gal", "0.7854 × 18² ÷ 231 × 10"),
 ("site/power", [("el-w","4500"),("el-v","240"),("el-load","tank")], "el-ans", "30 A", "18.75 A × 125% = 23.4 → 30 A"),
]

def hostile(tag): return '<img src=x onerror="window.PWN=(window.PWN||[]).concat(\'%s\')">' % tag

with sync_playwright() as pw:
    br = pw.chromium.launch()
    def fresh(**kw):
        o = dict(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, service_workers="block")
        if kw.get("viewport", {}).get("width", 0) > 900: o.update(is_mobile=False, has_touch=False)   # a computer screen: mouse, no touch
        o.update(kw); ctx = br.new_context(**o)
        ctx.route("**/*", serve)
        pg = ctx.new_page(); pg.errs = []; pg.on("pageerror", lambda e: pg.errs.append(str(e)[:160]))
        return ctx, pg
    def open_book(pg):
        pg.goto(BASE + "index.html"); pg.wait_for_load_state("load")
        pg.evaluate("()=>{const d=document.getElementById('terms-dlg'); if(d&&d.open) document.getElementById('terms-ok').click()}")
        pg.wait_for_timeout(3200)   # let the after-terms re-seat finish

    # ---------- 2. load + every page ----------
    print("2. Loads and every page opens")
    ctx, pg = fresh(); open_book(pg)
    pages = pg.evaluate("Object.entries(GROUPS).flatMap(([g,v])=>v.map(x=>g+'/'+x[0]))")
    empty = []
    for p in pages:
        pg.evaluate(f"location.hash='#{p}'"); pg.wait_for_timeout(60)
        if not pg.evaluate("[...document.querySelectorAll('.book > section[data-sec]')].some(s=>!s.hidden)"): empty.append(p)
    check(not empty, f"all {len(pages)} pages show cards" + (f" (empty: {empty})" if empty else ""))
    check(not pg.errs and not pg.evaluate("window.jpbErrs.length"), "no script errors" + (f": {pg.errs}" if pg.errs else ""))

    # ---------- 3. calculators ----------
    print("3. Calculators match hand-worked answers")
    for page, sets, out, want, why in CALCS:
        pg.evaluate(f"location.hash='#{page}'"); pg.wait_for_timeout(40)
        r = [pg.evaluate(SET, [i, v]) for i, v in sets]
        got = pg.evaluate(TXT, out)
        check(all(x == "ok" for x in r) and want in got, f"{page} {out}: {why}" + ("" if want in got else f" — wanted '{want}', got '{got[:90]}'") + ("" if all(x == "ok" for x in r) else f" — {r}"))
    check(not pg.errs, "no script errors while calculating" + (f": {pg.errs}" if pg.errs else ""))

    # ---------- 4. jump links ----------
    print("4. Jump links land on their card")
    gos = pg.evaluate("[...new Set([...document.querySelectorAll('[data-go]')].map(e=>e.dataset.go))]")
    miss = []
    for g in gos:
        pg.evaluate("location.hash='#home/home'"); pg.wait_for_timeout(60)
        pg.evaluate("g=>[...document.querySelectorAll('[data-go]')].find(x=>x.dataset.go===g).click()", g)
        t = g.split("|")[2] if g.count("|") >= 2 else None
        if not t: continue
        pg.wait_for_timeout(2200)
        top = pg.evaluate("""t=>{t=t.replace(/&amp;/g,'&').toLowerCase();const s=[...document.querySelectorAll('.book > section[data-sec]')].find(x=>!x.hidden&&x.querySelector('h2').textContent.trim().toLowerCase().startsWith(t));
          return s?Math.round(s.getBoundingClientRect().top):null}""", t)
        if top is None or not (-5 < top < 400): miss.append(f"{g} (top {top})")
    check(not miss, f"{len(gos)} jump links land" + (f"; off: {miss[:5]}" if miss else ""))
    ctx.close()

    # ---------- 5. hostile text ----------
    print("5. Typed text never runs as code")
    st = {k: {"st": "todo", "d0": "", "d1": "", "lead": hostile("lead"), "done": [], "extra": [hostile("extra")]} for k in ["under","rough","gas","trim","final","warr"]}
    data = {"jobs": [{"id": "j1", "made": 1, "name": hostile("name"), "a": hostile("addr"), "who": "", "bld": "b1", "sub": "s1", "city": hostile("city"), "st": "open", "lead": "p1", "sup": "", "ppl": ["p1"],
              "log": [{"id": "n1", "d": "2026-11-20", "at": 1, "b": "note " + hostile("note") + " [[Bob" + hostile("link") + "]] #t" + hostile("tag") + " [ ] " + hostile("box"), "s": "under"}],
              "draft": hostile("draft"), "t": 1, "insp": [{"s": "under", "d": "2026-11-21", "r": "booked", "who": hostile("insp")}], "hrs": [{"d": "2026-11-20", "h": 2, "n": hostile("hrs")}],
              "punch": [{"t": hostile("punch")}], "stages": st, "xs": [], "tags": [hostile("tg")]}],
            "goal": 8000, "before": 0, "people": [{"id": "p1", "n": hostile("person"), "role": hostile("role"), "co": hostile("co"), "ph": "", "em": "", "log": [{"id": "pn", "d": "2026-11-20", "at": 1, "b": hostile("pnote")}], "draft": "", "t": 1}],
            "builders": [{"id": "b1", "n": hostile("builder"), "log": []}], "subs": [{"id": "s1", "n": hostile("sub"), "log": []}]}
    ctx, pg = fresh()
    ctx.add_init_script("if(!sessionStorage.s){sessionStorage.s=1;localStorage.setItem('jpb-jobs',%s);localStorage.setItem('jpb-notes',%s)}" % (json.dumps(json.dumps(data)), json.dumps(json.dumps({"x": hostile("cardnote")}))))
    open_book(pg)
    for h in ["home/home", "mine/jobs", "mine/notes"]:
        pg.evaluate(f"location.hash='#{h}'"); pg.wait_for_timeout(250)
    for sel in ["[data-peek]", "[data-qa=open]", "[data-stage]", "[data-person]"]:
        n = pg.evaluate(f"document.querySelectorAll('{sel}').length")
        for i in range(min(n, 6)):
            pg.evaluate(f"(()=>{{const e=document.querySelectorAll('{sel}')[{i}]; e&&e.click()}})()"); pg.wait_for_timeout(200)
    check(not pg.evaluate("window.PWN"), "hostile names, notes, people and builders stay text" + (f" (ran: {pg.evaluate('window.PWN')})" if pg.evaluate("window.PWN") else ""))
    check(not pg.errs, "no script errors on the jobs pages" + (f": {pg.errs}" if pg.errs else ""))
    ctx.close()

    # ---------- 6. photo markup ----------
    print("6. Photo markup saves a copy and leaves the original alone")
    import tempfile, struct, zlib
    def png(path, w=600, h=450):   # a plain test photo, no extra libraries
        raw = b"".join(b"\x00" + bytes([200, 184, 154]) * w for _ in range(h))
        ch = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
        open(path, "wb").write(b"\x89PNG\r\n\x1a\n" + ch(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + ch(b"IDAT", zlib.compress(raw)) + ch(b"IEND", b""))
    tp = tempfile.mktemp(suffix=".png"); png(tp)
    st1 = {k: {"st": "todo", "d0": "", "d1": "", "lead": "", "done": [], "extra": []} for k in ["under","rough","gas","trim","final","warr"]}
    one = {"jobs": [{"id": "j1", "made": 1, "name": "Lot 1", "a": "", "who": "", "bld": "", "sub": "", "city": "", "st": "open", "lead": "", "sup": "", "ppl": [], "log": [], "draft": "", "t": 1, "insp": [], "hrs": [], "punch": [], "stages": st1, "xs": [], "tags": []}], "goal": 8000, "before": 0, "people": [], "builders": [], "subs": []}
    ctx, pg = fresh()
    ctx.add_init_script("if(!sessionStorage.s){sessionStorage.s=1;localStorage.setItem('jpb-jobs',%s)}" % json.dumps(json.dumps(one)))
    open_book(pg)
    ALL = "new Promise(ok=>{const r=indexedDB.open('jpb-files',1);r.onsuccess=()=>{const q=r.result.transaction('files').objectStore('files').getAll();q.onsuccess=()=>ok(q.result.map(f=>[f.id,f.blob.size,f.from||'']))}})"
    pg.evaluate("location.hash='#mine/jobs'"); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('[data-peek]').click()"); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('[data-qa=open]').click()"); pg.wait_for_timeout(500)
    pg.set_input_files("#jf-ph", tp); pg.wait_for_timeout(1000)
    before = pg.evaluate(ALL)
    check(len(before) == 1, "a photo was added to the test job")
    if before:
        pg.evaluate(f"document.querySelector('[data-v=\"{before[0][0]}\"]').click()"); pg.wait_for_timeout(500)
        pg.click("#jf-mark"); pg.wait_for_timeout(600)
        bx = pg.locator("#mk-cv").bounding_box()
        pg.mouse.move(bx["x"] + 30, bx["y"] + 30); pg.mouse.down(); pg.mouse.move(bx["x"] + 120, bx["y"] + 100, steps=5); pg.mouse.up()
        pg.click("#mk-save"); pg.wait_for_timeout(1200)
        after = pg.evaluate(ALL)
        orig = [x for x in after if x[0] == before[0][0]]
        check(len(after) == 2 and any(x[2] == before[0][0] for x in after), "the marked-up copy is a new photo linked to the original")
        check(bool(orig) and orig[0][1] == before[0][1], "the original photo is unchanged")
    pdf = tempfile.mktemp(suffix=".pdf"); open(pdf, "wb").write(b"%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF")
    pg.evaluate("document.querySelector('#jf-dlg').open && document.getElementById('jf-close').click()"); pg.wait_for_timeout(300)
    pg.set_input_files("#jf-fi", pdf); pg.wait_for_timeout(900)
    pid = [x for x in pg.evaluate(ALL) if x[0] not in [y[0] for y in before] and not x[2]]
    newtabs = []; pg.context.on("page", lambda p: newtabs.append(p.url))
    if pid:
        pg.evaluate("id => document.querySelector(`[data-v='${id}']`).click()", pid[-1][0]); pg.wait_for_timeout(400); pg.click("#jf-open"); pg.wait_for_timeout(2500)
        check(pg.evaluate("document.getElementById('jv-dlg').open && !!document.querySelector('#jv-body .pv-pg canvas')") and not newtabs, "Open full screen draws the PDF inside the app (no dead new tab, no browser PDF frame)")
        pg.click("#jv-close"); pg.wait_for_timeout(200); check(pg.evaluate("!document.getElementById('jv-dlg').open && document.getElementById('jf-dlg').open"), "Close goes back to the file")
    else: check(False, "a PDF was added to the test job")
    # plan sets: the app draws every page itself (PDF.js), and zoomed in it draws the part on screen again, sharp
    sys.path.insert(0, str(ROOT / "tests")); from mkpdf import pdf as mkplans
    plans = tempfile.mktemp(suffix=".pdf"); mkplans(plans, 3)
    pg.evaluate("document.getElementById('jf-dlg').open && document.getElementById('jf-close').click()"); pg.wait_for_timeout(200)
    have = [x[0] for x in pg.evaluate(ALL)]; pg.set_input_files("#jf-fi", plans); pg.wait_for_timeout(900)
    pid = [x[0] for x in pg.evaluate(ALL) if x[0] not in have]
    if pid:
        pg.evaluate("id => document.querySelector(`[data-v='${id}']`).click()", pid[0]); pg.wait_for_timeout(400); pg.click("#jf-open"); pg.wait_for_timeout(3000)
        INK = "[...document.querySelectorAll('.pv-pg')].map(p => { const c = p.querySelector('.pv-base'); if (!c.width) return 0; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let k = 0; for (let i = 0; i < d.length; i += 16) if (d[i] < 200) k++; return k; })"
        ink = pg.evaluate(INK)
        check(len(ink) == 3 and all(k > 1000 for k in ink), f"a 3-sheet 36×24\" plan set: all 3 pages drawn (dark pixels per page: {ink})")
        W = "document.querySelector('.pv-pg').clientWidth"; w0 = pg.evaluate(W)
        check("Page 1 of 3" in pg.evaluate("document.getElementById('jv-note').textContent"), "it says Page 1 of 3")
        bx = pg.locator("#jv-body").bounding_box(); pg.mouse.dblclick(bx["x"] + 150, bx["y"] + 100); pg.wait_for_timeout(1700)
        w1 = pg.evaluate(W); det = pg.evaluate("[...document.querySelectorAll('.pv-det')].map(c => [c.width, c.height, c.clientWidth])")
        scr = pg.evaluate("[document.getElementById('jv-body').clientWidth, document.getElementById('jv-body').clientHeight, devicePixelRatio]")
        check(abs(w1 / w0 - 2.5) < 0.02, f"double-tap zooms the sheet to 2.5× ({w0} → {w1} px wide)")
        check(bool(det) and all(d[0] * d[1] <= 6e6 + 1 and d[0] >= min(d[2], scr[0]) * scr[2] - 2 for d in det), f"zoomed in, the part on screen is drawn again sharp, with a small margin, inside the 6 MP close-up budget ({det})")
        pg.click("#jv-zoom"); pg.wait_for_timeout(500)
        check(abs(pg.evaluate(W) - w0) < 1 and not pg.evaluate("document.querySelectorAll('.pv-det').length"), "Fit to screen puts the sheet back")
        pg.click("#jv-close"); pg.wait_for_timeout(300)
        check(pg.evaluate("document.getElementById('jv-body').innerHTML === ''"), "closing the viewer lets the PDF go (memory back)")
    else: check(False, "the plan set was added to the test job")
    # photos: sized in proportion to fit, double-tap or the button zooms in, still in proportion, and back
    if before:
        pg.evaluate("document.getElementById('jf-dlg').open && document.getElementById('jf-close').click()"); pg.wait_for_timeout(200)
        pg.evaluate(f"document.querySelector('[data-v=\"{before[0][0]}\"]').click()"); pg.wait_for_timeout(400); pg.click("#jf-open"); pg.wait_for_timeout(700)
        SZ = "(() => { const i = document.querySelector('#jv-body img'), B = document.getElementById('jv-body'); return [i.clientWidth, i.clientHeight, B.clientWidth, B.clientHeight]; })()"
        w, h, bw, bh = pg.evaluate(SZ)
        check(abs(w / h - 600 / 450) < 0.02 and (abs(w - bw) < 2 or abs(h - bh) < 2) and w <= bw + 1 and h <= bh + 1, f"a photo fits the screen in proportion (4:3; got {w}×{h} in {bw}×{bh})")
        bx = pg.locator("#jv-body").bounding_box(); pg.mouse.dblclick(bx["x"] + bx["width"] / 2, bx["y"] + bx["height"] / 2); pg.wait_for_timeout(500)
        w2, h2, _, _ = pg.evaluate(SZ)
        check(abs(w2 / w - 2.5) < 0.05 and abs(w2 / h2 - 600 / 450) < 0.02, f"double-tap zooms to 2.5× and stays in proportion (got {w2}×{h2})")
        pg.click("#jv-zoom"); pg.wait_for_timeout(450)
        check(abs(pg.evaluate(SZ)[0] - w) < 2, "Fit to screen brings it back")
        pg.click("#jv-close"); pg.wait_for_timeout(200)
    check(not pg.errs and not pg.evaluate("window.jpbErrs.length"), "no script errors in markup" + (f": {pg.errs}" if pg.errs else ""))
    ctx.close()

    # ---------- 6b. proof photo settings ----------
    print("6b. Proof photo settings: stamp follows them, location off never asks")
    ctx, pg = fresh(geolocation={"latitude": 40.39, "longitude": -111.85}, permissions=["geolocation"])
    ctx.add_init_script("if(!sessionStorage.s){sessionStorage.s=1;localStorage.setItem('jpb-jobs',%s)}" % json.dumps(json.dumps(dict(one, proof={"pos": "on", "gps": 0}))))
    ctx.add_init_script("window.GEO=0;const g=navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);navigator.geolocation.getCurrentPosition=(...a)=>{window.GEO++;return g(...a)}")
    open_book(pg)
    pg.evaluate("location.hash='#mine/jobs'"); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('[data-peek]').click()"); pg.wait_for_timeout(300); pg.evaluate("document.querySelector('[data-qa=open]').click()"); pg.wait_for_timeout(500)
    pg.set_input_files("#jf-proof", tp); pg.wait_for_timeout(2500)
    r = pg.evaluate("new Promise(ok=>{const q=indexedDB.open('jpb-files',1);q.onsuccess=()=>{const g=q.result.transaction('files').objectStore('files').getAll();g.onsuccess=async()=>{const f=g.result.find(x=>x.proof);if(!f)return ok(null);const b=await createImageBitmap(f.blob);ok([b.width,b.height,f.proof.lat==null,f.proof.gpsErr||''])}}})")
    check(bool(r) and r[0] == 600 and r[1] == 450, "stamp 'on the photo' keeps the photo its own size" + (f" (got {r})" if r and (r[0], r[1]) != (600, 450) else ""))
    check(bool(r) and r[2] and "off" in r[3] and pg.evaluate("window.GEO") == 0, "location off: never asks the phone, and the record says so")
    check(not pg.errs and not pg.evaluate("window.jpbErrs.length"), "no script errors with proof settings" + (f": {pg.errs}" if pg.errs else ""))
    ctx.close()

    # ---------- 6c. job report settings ----------
    print("6c. Job report settings: parts left out stay out, and the report says so")
    rj = dict(one["jobs"][0], log=[{"id": "n1", "d": "2026-11-20", "at": 1, "b": "PRIVATE-NOTE-TEXT"}])
    ctx, pg = fresh()
    ctx.add_init_script("if(!sessionStorage.s){sessionStorage.s=1;localStorage.setItem('jpb-jobs',%s)}" % json.dumps(json.dumps(dict(one, jobs=[rj], proof={"gps": 0}))))
    open_book(pg)
    pg.evaluate("location.hash='#mine/jobs'"); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('[data-peek]').click()"); pg.wait_for_timeout(300); pg.evaluate("document.querySelector('[data-qa=open]').click()"); pg.wait_for_timeout(500)
    pg.set_input_files("#jf-proof", tp); pg.wait_for_timeout(2500)
    # make the report, then tap Send; with no share sheet the app downloads it, so catch the file there
    REP = "async()=>{const B=()=>document.querySelector('.jb-hacts [data-a=job-report]');B().click();for(let i=0;i<80&&!/Send/.test(B().textContent);i++)await new Promise(r=>setTimeout(r,100));let got=null;const o=URL.createObjectURL;URL.createObjectURL=x=>{got=x;return o.call(URL,x)};navigator.share=undefined;B().click();URL.createObjectURL=o;return got?await got.text():''}"
    WAIT = "async()=>{const B=()=>document.querySelector('.jb-hacts [data-a=job-report]');return /Send/.test(B().textContent)}"
    full = pg.evaluate(REP)
    check("PRIVATE-NOTE-TEXT" in full and "Left out" not in full and "<h2>Proof photos" in full, "by default the report has everything (notes, proof photos) and nothing is listed as left out")
    pg.evaluate("document.querySelector('.jb-hacts [data-a=job-report]').click()"); pg.wait_for_timeout(2500)
    ready = pg.evaluate(WAIT)
    pg.evaluate("document.querySelector('[data-rsp=proof]').click()"); pg.wait_for_timeout(300)
    check(ready and not pg.evaluate(WAIT), "changing a setting drops the report that was waiting to be sent")
    pg.evaluate("document.querySelector('[data-rsv=\"ph|s\"]').click()"); pg.wait_for_timeout(200)
    lean = pg.evaluate(REP)
    check("PRIVATE-NOTE-TEXT" not in lean and "<h2>Activity log" not in lean and "<h2>Proof photos" in lean, "Proof photos only: notes and the activity log stay out, proof photos stay in")
    check("Left out of this report" in lean and "Notes" in lean.split("Left out of this report")[1] and "Activity log" in lean.split("Left out of this report")[1], "the report lists what was left out (inside the fingerprinted part)")
    check('class="pp s' in lean, "Small photo size is used")
    pg.evaluate("localStorage.setItem('jpb-jobs', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('jpb-jobs')), {rep: [1,2]})))"); pg.reload(); pg.wait_for_timeout(800)
    pg.evaluate("location.hash='#mine/jobs'"); pg.wait_for_timeout(300); pg.evaluate("(document.querySelector('[data-qa=open]') || document.querySelector('.jb-list .jb-row')).click()"); pg.wait_for_timeout(500)
    pg.evaluate("document.querySelector('.card-h[data-fold=proof]').classList.contains('jb-folded') && document.querySelector('.card-h[data-fold=proof]').click()"); pg.wait_for_timeout(300)
    check(pg.evaluate("""(() => { const b = document.querySelector('[data-rsv="ph|l"]'); return !!b && b.getAttribute('aria-pressed') === 'true' && [...document.querySelectorAll('[data-rs^="sec."]')].every(x => x.checked); })()"""), "broken saved report settings fall back to the defaults")
    check(not pg.errs and not pg.evaluate("window.jpbErrs.length"), "no script errors with report settings" + (f": {pg.errs}" if pg.errs else ""))
    ctx.close()

    # ---------- 6d. self-cleaning ----------
    print("6d. Self-cleaning: old deletes go on their own, photos with no job only when you say so")
    ctx, pg = fresh()
    ctx.add_init_script("if(!sessionStorage.s){sessionStorage.s=1;localStorage.setItem('jpb-jobs',%s)}" % json.dumps(json.dumps(one)))
    open_book(pg)
    pg.evaluate("location.hash='#mine/jobs'"); pg.wait_for_timeout(500)
    PUT = """async () => { const day = 864e5, now = Date.now(), b = new Blob(['x'.repeat(2000)], {type: 'image/jpeg'});
      const L = [{id: 'live', job: 'j1'}, {id: 'old', job: 'j1', del: now - 40 * day}, {id: 'new', job: 'j1', del: now - 5 * day}, {id: 'none', job: 'gone-job'}];
      await new Promise(ok => { const r = indexedDB.open('jpb-files', 1); r.onupgradeneeded = () => r.result.createObjectStore('files', {keyPath: 'id'}).createIndex('job', 'job'); r.onsuccess = () => { const t = r.result.transaction('files', 'readwrite'); L.forEach(f => t.objectStore('files').put(Object.assign({kind: 'photo', name: f.id + '.jpg', type: 'image/jpeg', blob: b, thumb: '', note: '', t: now}, f))); t.oncomplete = () => { r.result.close(); ok(); }; }; }); }"""
    IDS = "new Promise(ok=>{const r=indexedDB.open('jpb-files',1);r.onsuccess=()=>{const q=r.result.transaction('files').objectStore('files').getAllKeys();q.onsuccess=()=>ok(q.result.sort())}})"
    pg.evaluate(PUT); pg.reload(); pg.wait_for_timeout(9500)
    ids = pg.evaluate(IDS)
    check(ids == ["live", "new", "none"], "deleted over 31 days ago: gone; deleted 5 days ago, on a job, or with no job: kept" + (f" (got {ids})" if ids != ["live", "new", "none"] else ""))
    pg.evaluate("location.hash='#mine/jobs'"); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('[data-a=set-go]').click()"); pg.wait_for_timeout(300)
    pg.wait_for_timeout(600)
    txt = pg.evaluate("(document.getElementById('jf-use') || {}).innerText || ''")
    check("with no job" in txt and "Recently deleted" in txt, "Backup shows photos on jobs, in Recently deleted, and with no job" + (f" (got {txt!r})" if "with no job" not in txt else ""))
    pg.on("dialog", lambda d: d.accept())
    pg.evaluate("document.querySelector('[data-a=jf-orph]') && document.querySelector('[data-a=jf-orph]').click()"); pg.wait_for_timeout(800)
    ids = pg.evaluate(IDS)
    check(ids == ["live", "new"], "Delete them… removes only the photos with no job" + (f" (got {ids})" if ids != ["live", "new"] else ""))
    check(not pg.errs and not pg.evaluate("window.jpbErrs.length"), "no script errors while cleaning" + (f": {pg.errs}" if pg.errs else ""))
    ctx.close()

    # ---------- 7. rooms ----------
    print("7. Rooms: add, link from a note, rename follows")
    two = {"jobs": [dict(one["jobs"][0], id="j1", name="Lot 1"), dict(one["jobs"][0], id="j2", name="Lot 2", rooms=[{"id": "r1", "n": "Master bath", "f": [{"id": "f1", "k": "Tub / shower", "v": "60 alcove"}]}])],
           "goal": 8000, "before": 0, "people": [], "builders": [], "subs": []}
    ctx, pg = fresh()
    ctx.add_init_script("if(!sessionStorage.s){sessionStorage.s=1;localStorage.setItem('jpb-jobs',%s)}" % json.dumps(json.dumps(two)))
    open_book(pg)
    J1 = lambda: [x for x in json.loads(pg.evaluate("localStorage.getItem('jpb-jobs')"))["jobs"] if x["id"] == "j1"][0]
    pg.evaluate("location.hash='#mine/jobs'"); pg.wait_for_timeout(300)
    pg.evaluate("[...document.querySelectorAll('[data-peek]')].find(b=>b.dataset.peek==='j1').click()"); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('[data-qa=open]').click()"); pg.wait_for_timeout(500)
    pg.evaluate("document.querySelector('[data-fold=rooms]').click()"); pg.wait_for_timeout(200)
    pg.select_option("#jr-copy", "j2"); pg.click("[data-ra=copy]"); pg.wait_for_timeout(300)
    check([r["n"] for r in J1().get("rooms", [])] == ["Master bath"] and J1()["rooms"][0]["f"][0]["v"] == "60 alcove", "copy rooms and details from another job")
    pg.fill("#jr-add", "Hall bath"); pg.press("#jr-add", "Enter"); pg.wait_for_timeout(300)
    pg.fill("#jr-add", "hall BATH"); pg.press("#jr-add", "Enter"); pg.wait_for_timeout(200)
    check([r["n"] for r in J1()["rooms"]] == ["Master bath", "Hall bath"], "add a room; the same name twice is refused")
    pg.click("[data-ra=note]"); pg.wait_for_timeout(300)
    pg.fill("#jn-new", pg.input_value("#jn-new") + "set the tub\nValve: Moen M-Core"); pg.click("[data-a=jn-add]"); pg.wait_for_timeout(300)
    pg.evaluate("[...document.querySelectorAll('[data-wl]')].find(b=>b.dataset.wl==='Hall bath').click()"); pg.wait_for_timeout(300)
    txt = pg.evaluate("(document.getElementById('jr-open')||{}).textContent||''")
    check("set the tub" in txt and "Moen M-Core" in txt, "a [[room]] link opens the room, which shows the note and its Label: value line")
    pg.fill("#jr-n", "Kids bath"); pg.press("#jr-n", "Tab"); pg.wait_for_timeout(300)
    check(J1()["log"][0]["b"].startswith("[[Kids bath]]") and J1()["rooms"][1]["n"] == "Kids bath", "renaming a room updates the notes that link it")
    pg.fill("#jr-n", "<img src=x onerror=PWN=1>"); pg.press("#jr-n", "Tab"); pg.wait_for_timeout(400)
    check(not pg.evaluate("window.PWN") and pg.evaluate("document.getElementById('toast').textContent.includes('<img')"), "a room named with HTML in it shows as text in the pop-up, never runs")
    check(not pg.errs and not pg.evaluate("window.jpbErrs.length"), "no script errors in rooms" + (f": {pg.errs}" if pg.errs else ""))
    ctx.close()

    # ---------- 8. weather: week totals and inspections (a made-up forecast, worked by hand) ----------
    print("8. Weather: week totals add up, inspections get their town's day")
    import datetime, urllib.parse as up
    today = datetime.date.today(); DAY = lambda n: (today + datetime.timedelta(days=n)).isoformat(); NOW = int(datetime.datetime.now().timestamp())
    LO, HI, POP = [30, 28, 35, 40, 25, None, 38], [45, 44, 50, 55, 40, None, 52], [10, 20, 70, 5, 60, None, 30]   # day 6 blank, as the service sometimes sends: must not count as freezing (null reads as 0)
    PR, SN = [0, 0, 0.31, 0, 0.12, 0, 0.02], [0, 0, 0, 0, 3.5, 0, 0]   # rain in inches; snow sent in cm on purpose: 3.5 cm = 1.38"
    def daily(unix):
        t = [NOW + 86400 * i if unix else DAY(i) for i in range(7)]
        return {"time": t, "weather_code": [3, 61, 61, 0, 73, 1, 2], "temperature_2m_max": HI, "temperature_2m_min": LO, "precipitation_sum": PR, "precipitation_probability_max": POP,
                "snowfall_sum": SN, "wind_gusts_10m_max": [10, 30, 12, 8, 20, 5, 9], "sunrise": t, "sunset": t}
    def om(route):
        q = up.parse_qs(up.urlparse(route.request.url).query); units = {"precipitation_sum": "inch", "snowfall_sum": "cm"}
        if "current" in q:
            H = {"time": [NOW + 3600 * i for i in range(48)]}; H.update({k: [40] * 48 for k in q["hourly"][0].split(",")})
            body = {"elevation": 1400, "current": {k: 40 for k in q["current"][0].split(",")}, "hourly": H, "hourly_units": {}, "daily": daily(True), "daily_units": units}
        else:
            n = len(q["latitude"][0].split(",")); body = [{"daily": daily(False), "daily_units": units} for _ in range(n)]; body = body[0] if n == 1 else body
        route.fulfill(status=200, body=json.dumps(body), content_type="application/json")
    wj = {"jobs": [dict(one["jobs"][0], id="w1", name="Lot 1", city="le", insp=[{"id": "i1", "d": DAY(2), "s": "under", "r": "booked", "who": "", "n": ""}])], "goal": 8000, "before": 0, "people": [], "builders": [], "subs": []}
    ctx, pg = fresh(); ctx.route("https://api.open-meteo.com/**", om)
    ctx.add_init_script("if(!sessionStorage.s){sessionStorage.s=1;localStorage.setItem('jpb-jobs',%s);localStorage.setItem('jpb-wx-place',JSON.stringify({name:'Lehi',sub:'',lat:40.39,lon:-111.85,src:'town',at:Date.now()}))}" % json.dumps(json.dumps(wj)))
    open_book(pg); pg.evaluate("location.hash='#site/wxnow'"); pg.wait_for_timeout(2500)
    wk = pg.evaluate("document.getElementById('wx-wk').textContent")
    check('0.45" wet' in wk and '1.4" snow' in wk and "3 freezing nights" in wk, f"week: 0.31 + 0.12 + 0.02 = 0.45\" wet; 3.5 cm = 1.4\" snow; lows of 30, 28, 25 = 3 freezing nights, and the blank day isn't one (got {wk!r})")
    wkt = pg.evaluate("document.getElementById('wx-wkt').innerText")
    check("3 of 7 days" in wkt and "Coldest 25" in wkt and "55°F" in wkt and "30 mph" in wkt, "week box: 3 wet days, coldest 25°F, warmest 55°F, windiest 30 mph")
    ins = pg.evaluate("document.getElementById('wx-insp-h').hidden ? '' : document.getElementById('wx-insp').innerText")
    check("Underground inspection" in ins and "35–50°F" in ins and '0.31"' in ins and "trench" in ins, "the underground inspection shows that day's Lehi forecast and the wet-trench heads-up")
    check(not pg.errs and not pg.evaluate("window.jpbErrs.length"), "no script errors on the weather page" + (f": {pg.errs}" if pg.errs else ""))
    ctx.close()

    # ---------- 9. fonts ship with the app; the frame-rate setting holds its cap ----------
    print("9. Fonts load from the app; frame rate caps hold")
    ctx, pg = fresh(); outside = []; WXOK = ("https://api.open-meteo.com/", "https://air-quality-api.open-meteo.com/", "https://geocoding-api.open-meteo.com/", "https://api.weather.gov/")   # the weather services the lockdown allows
    pg.on("request", lambda r: outside.append(r.url) if not r.url.startswith((BASE, "data:", "blob:") + WXOK) else None)
    open_book(pg); pg.wait_for_timeout(500)
    fams = pg.evaluate("Promise.all([...document.fonts].map(f => f.load().then(() => f.family + ' ' + f.weight + ':' + f.status, () => f.family + ' ' + f.weight + ':error')))")
    check(len(fams) == 12 and all(f.endswith(":loaded") for f in fams), f"all 12 font files load from the app's fonts/ folder ({sum(f.endswith(':loaded') for f in fams)}/12)")
    check(not outside, "at start-up the book asks no outside site but the weather services (no Google Fonts)" + (f": {outside[:3]}" if outside else ""))
    RATE = "new Promise(ok => { let n = 0, t0 = 0; const f = t => { if (!t0) t0 = t; n++; if (t - t0 < 1200) requestAnimationFrame(f); else ok(Math.round((n - 1) * 1000 / (t - t0))); }; requestAnimationFrame(f); })"
    rates = {}
    for v in ["", "30", "15"]:
        pg.evaluate("v => { PREFS.fps = v; savePrefs(); prefApply(); }", v); pg.wait_for_timeout(80); rates[v or "Auto"] = pg.evaluate(RATE)
    check(abs(rates["30"] - 30) <= 2 and abs(rates["15"] - 15) <= 2 and rates["Auto"] >= 50, f"frame rate: Auto runs free, 30 and 15 hold their caps (measured {rates})")
    pg.evaluate("() => { PREFS.fps = '15'; PREFS.fpsShow = true; savePrefs(); prefApply(); }"); pg.wait_for_timeout(1300)
    check(pg.evaluate("/^1[3-7] fps · cap 15$/.test(document.getElementById('fps-meter').textContent)"), "the frame counter shows the capped rate")
    check(pg.evaluate("new Promise(ok => { let ran = false; const id = requestAnimationFrame(() => ran = true); cancelAnimationFrame(id); setTimeout(() => ok(!ran), 300); })"), "a held frame can still be cancelled")
    pg.evaluate("() => { PREFS.fps = ''; PREFS.fpsShow = false; savePrefs(); prefApply(); }")
    check(pg.evaluate(RATE) >= 50 and pg.evaluate("document.getElementById('fps-meter').hidden"), "back to Auto: full rate, counter hidden")
    check(not pg.errs and not pg.evaluate("window.jpbErrs.length"), "no script errors with fonts and frame rate" + (f": {pg.errs}" if pg.errs else ""))
    ctx.close()

    # ---------- 10. files that break, fast taps, memory, markup ----------
    print("10. Bad files, fast reopen, memory given back, quick markup")
    import os, shutil, subprocess
    tmp = tempfile.mkdtemp(); P = lambda n: os.path.join(tmp, n)
    open(P("corrupt.pdf"), "wb").write(os.urandom(5000)); open(P("empty.pdf"), "wb").close(); open(P("broken.jpg"), "wb").write(os.urandom(3000))
    plans3 = P("plans.pdf"); mkplans(plans3, 3)
    locked = shutil.which("qpdf") and subprocess.run(["qpdf", "--encrypt", "pw", "pw", "256", "--", plans3, P("locked.pdf")]).returncode == 0
    ctx, pg = fresh(); ctx.add_init_script("if(!sessionStorage.s){sessionStorage.s=1;localStorage.setItem('jpb-jobs',%s)}" % json.dumps(json.dumps(dict(one, peeked=1))))
    open_book(pg); pg.evaluate("location.hash='#mine/jobs'"); pg.wait_for_timeout(300); pg.evaluate("document.querySelector('.jb-list .jb-row, .jb-list [data-open]').click()"); pg.wait_for_timeout(500)
    def add(sel, path):
        have = {x[0] for x in pg.evaluate(ALL)}; pg.set_input_files(sel, path); pg.wait_for_timeout(900)
        new = [x[0] for x in pg.evaluate(ALL) if x[0] not in have]; return new[0] if new else None
    def card(fid):
        for d in ("jv", "jf"): pg.evaluate(f"document.getElementById('{d}-dlg').open && document.getElementById('{d}-close').click()")
        pg.wait_for_timeout(150); pg.evaluate("id => document.querySelector(`[data-v='${id}']`).click()", fid)
        for _ in range(40):
            if pg.evaluate("document.getElementById('jf-dlg').open"): break
            pg.wait_for_timeout(50)
        pg.wait_for_timeout(150)
    def body(fid, wait=2500): card(fid); pg.click("#jf-open"); pg.wait_for_timeout(wait); return pg.evaluate("document.getElementById('jv-body').innerText")
    ids = {k: add("#jf-fi", P(k + ".pdf")) for k in ["corrupt", "empty", "plans"] + (["locked"] if locked else [])}; ids["broken"] = add("#jf-ph", P("broken.jpg"))
    check("couldn't draw this PDF" in body(ids["corrupt"]) and "couldn't draw this PDF" in body(ids["empty"]), "a broken or empty PDF says so (with Open in another app), no crash")
    if locked: check("has a password" in body(ids["locked"]), "a password-protected PDF says it has a password")
    else: print("  (skipped the password PDF check: qpdf isn't installed here)")
    check("can't be shown in the app" in body(ids["broken"], 1200), "a photo the phone can't read says so instead of a blank screen")
    card(ids["plans"]); pg.evaluate("document.getElementById('jf-open').click(); document.getElementById('jv-close').click(); document.getElementById('jf-open').click(); document.getElementById('jv-close').click(); document.getElementById('jf-open').click()"); pg.wait_for_timeout(2500)
    check(pg.evaluate("document.getElementById('jv-dlg').open && document.querySelectorAll('.pv-pg').length === 3"), "open, close, open fast: the viewer shows the plans (a late 'closed' notice doesn't wipe them)")
    bx = pg.locator("#jv-body").bounding_box(); pg.mouse.dblclick(bx["x"] + 150, bx["y"] + 100); pg.wait_for_timeout(1700)
    pg.evaluate("(() => { window.__mk = 0; const o = document.createElement.bind(document); document.createElement = (t, ...a) => { if (String(t).toLowerCase() === 'canvas') window.__mk++; return o(t, ...a); }; })()")
    pg.evaluate("document.getElementById('jv-body').scrollLeft += 15"); pg.wait_for_timeout(700)
    check(pg.evaluate("window.__mk") == 0, "zoomed in, a small pan doesn't redraw (the sharp close-up has a margin)")
    for _ in range(6): pg.evaluate("document.getElementById('jv-close').click()"); pg.wait_for_timeout(60); pg.click("#jf-open"); pg.wait_for_timeout(600)
    pg.evaluate("document.getElementById('jv-close').click()"); pg.wait_for_timeout(300)
    left = pg.evaluate("[...document.querySelectorAll('#jv-body canvas, .pv-pg canvas')].reduce((n, c) => n + c.width * c.height, 0)")
    check(left == 0, f"after 6 opens and a close, the viewer holds no canvas memory (iPhone blanks pages past its limit) ({left} px left)")
    # markup: the work per frame doesn't grow with the number of marks
    pid = add("#jf-ph", tp); card(pid); pg.click("#jf-mark"); pg.wait_for_timeout(500); pg.evaluate("document.querySelector('#mk-dlg [data-tool=pen]').click()")
    DRAW = """async (n) => { const cv = document.getElementById('mk-cv'), r = cv.getBoundingClientRect(), E = (k, x, y) => cv.dispatchEvent(new PointerEvent(k, {pointerId: 1, isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true}));
      for (let s = 0; s < n; s++){ const y = r.top + 10 + (s % 20) * 8; E('pointerdown', r.left + 10, y); for (let i = 1; i <= 15; i++) E('pointermove', r.left + 10 + i * 6, y + (i % 3)); E('pointerup', r.left + 100, y); }
      const C = CanvasRenderingContext2D.prototype, o = C.stroke; let k = 0; C.stroke = function(...a){ k++; return o.apply(this, a); };
      const f = () => new Promise(ok => requestAnimationFrame(() => requestAnimationFrame(ok)));
      E('pointerdown', r.left + 20, r.top + 20); await f(); k = 0; E('pointermove', r.left + 60, r.top + 30); await f(); const per = k; E('pointerup', r.left + 60, r.top + 30); await f(); C.stroke = o; return per; }"""
    few = pg.evaluate(DRAW, 2); many = pg.evaluate(DRAW, 40)
    check(few == many and many <= 4, f"markup: drawing one stroke costs the same with 2 or 42 marks on the photo ({few} vs {many} strokes per frame)")
    pg.evaluate("document.getElementById('mk-undo').click()"); pg.on("dialog", lambda d: d.accept()); pg.evaluate("document.getElementById('mk-save').click()"); pg.wait_for_timeout(1500)
    check(pg.evaluate("!document.getElementById('mk-dlg').open && document.getElementById('mk-cv').width === 0"), "saving the marked-up copy closes markup and gives its memory back")
    check(not pg.errs and not pg.evaluate("window.jpbErrs.length"), "no script errors with bad files, fast taps or markup" + (f": {pg.errs}" if pg.errs else ""))
    ctx.close()
    # computer: + / − / 0 zoom, and dragging with the mouse moves a zoomed sheet
    ctx, pg = fresh(viewport={"width": 1280, "height": 800}); ctx.add_init_script("if(!sessionStorage.s){sessionStorage.s=1;localStorage.setItem('jpb-jobs',%s)}" % json.dumps(json.dumps(dict(one, peeked=1))))
    open_book(pg); pg.evaluate("location.hash='#mine/jobs'"); pg.wait_for_timeout(300); pg.evaluate("document.querySelector('.jb-list .jb-row, .jb-list [data-open]').click()"); pg.wait_for_timeout(500)
    pid = add("#jf-fi", plans3); card(pid); pg.click("#jf-open"); pg.wait_for_timeout(2500)
    W = "document.querySelector('.pv-pg').clientWidth"; w0 = pg.evaluate(W); pg.keyboard.press("+"); pg.wait_for_timeout(500); w1 = pg.evaluate(W)
    check(abs(w1 / w0 - 1.6) < 0.02, f"computer: + zooms in 1.6× ({w0} → {w1} px)")
    SC = "[document.getElementById('jv-body').scrollLeft, document.getElementById('jv-body').scrollTop]"; s0 = pg.evaluate(SC); bx = pg.locator("#jv-body").bounding_box()
    pg.mouse.move(bx["x"] + 600, bx["y"] + 300); pg.mouse.down(); pg.mouse.move(bx["x"] + 500, bx["y"] + 250, steps=6); pg.mouse.up(); s1 = pg.evaluate(SC)
    check(abs(s1[0] - s0[0] - 100) <= 1 and abs(s1[1] - s0[1] - 50) <= 1, f"computer: dragging with the mouse moves the sheet with it ({s0} → {s1})")
    pg.keyboard.press("0"); pg.wait_for_timeout(500); check(pg.evaluate(W) == w0, "computer: 0 fits it back to the screen")
    check(not pg.errs and not pg.evaluate("window.jpbErrs.length"), "no script errors with mouse and keys" + (f": {pg.errs}" if pg.errs else ""))
    # ---------- 11. plan tools: Measure and Find, against answers worked by hand ----------
    print("11. Measure on plans and Find words (hand-worked answers)")
    from mkpdf import tools_pdf
    tools = P("tools.pdf"); tools_pdf(tools); tid = add("#jf-fi", tools); card(tid); pg.click("#jf-open"); pg.wait_for_timeout(2200)
    check(pg.evaluate("!document.getElementById('pv-bar').hidden"), "a PDF shows the Find and Measure tools")
    def spot(n, x, y, aim=True):   # a spot on sheet n in PDF units (y from the bottom); brought on screen first, as you would
        if aim: pg.evaluate("([n, x, y]) => { const B = document.getElementById('jv-body'), r = document.querySelectorAll('.pv-pg')[n - 1].getBoundingClientRect(), b = B.getBoundingClientRect(); const sx = r.left + x / 2592 * r.width, sy = r.top + (1728 - y) / 1728 * r.height; B.scrollTop += sy - (b.top + b.height / 2); B.scrollLeft += sx - (b.left + b.width / 2); }", [n, x, y]); pg.wait_for_timeout(150)
        return pg.evaluate("([n, x, y]) => { const r = document.querySelectorAll('.pv-pg')[n - 1].getBoundingClientRect(); return [r.left + x / 2592 * r.width, r.top + (1728 - y) / 1728 * r.height]; }", [n, x, y])
    def inches(t):
        m = re.search(r"(?:(\d+)' )?(\d+)?(?: ?(\d+)/(\d+))?\"", t); ft, i, nn, d = m.groups(); return int(ft or 0) * 12 + int(i or 0) + (int(nn) / int(d) if nn else 0)
    MST = "document.getElementById('pv-mst').textContent"
    pg.click("[data-pvt=measure]"); pg.wait_for_timeout(200)
    check("no scale yet" in pg.evaluate(MST) or "tap both ends" in pg.evaluate(MST), "Measure on a sheet with no scale asks for one first")
    a = spot(1, 450, 864); a = spot(1, 288, 864, False); pg.mouse.click(*a); pg.mouse.click(*spot(1, 1008, 864, False)); pg.wait_for_timeout(200)
    pg.fill("#pv-calv", "40'"); pg.press("#pv-calv", "Enter"); pg.wait_for_timeout(300)
    check("that line is 40' 0\"" in pg.evaluate("document.getElementById('toast').textContent"), "setting the scale says back the length it read (40' 0\")")
    a = spot(1, 396, 600); a = spot(1, 288, 600, False); pg.mouse.click(*a); pg.mouse.click(*spot(1, 504, 600, False)); pg.wait_for_timeout(200)
    t = pg.evaluate(MST); v, u = inches(t.split("±")[0]), inches(t.split("±")[1])
    check(abs(v - 144) <= u and u <= 4, f"scale from a 40' line (720 units), a 216-unit line measures 12' 0\" by hand: got {t.split('.')[0]}")
    for _ in range(3): pg.keyboard.press("+"); pg.wait_for_timeout(400)
    a = spot(1, 396, 600); a = spot(1, 288, 600, False); pg.mouse.click(*a); pg.mouse.click(*spot(1, 504, 600, False)); pg.wait_for_timeout(200)
    t = pg.evaluate(MST); v, u = inches(t.split("±")[0]), inches(t.split("±")[1])
    check(abs(v - 144) <= u and u < 1, f"zoomed in 4×, the same line is closer and says so: {t.split('.')[0]}")
    pg.keyboard.press("0"); pg.wait_for_timeout(400); pg.click("#pv-scs"); pg.wait_for_timeout(150); pg.select_option("#pv-ps", "48"); pg.wait_for_timeout(200)
    check("36.0 × 24.0 in" in pg.evaluate("document.getElementById('toast').textContent"), "a printed scale warns it's only right on a full-size sheet and gives the sheet size")
    a = spot(1, 396, 600); a = spot(1, 288, 600, False); pg.mouse.click(*a); pg.mouse.click(*spot(1, 504, 600, False)); pg.wait_for_timeout(200)
    t = pg.evaluate(MST); v, u = inches(t.split("±")[0]), inches(t.split("±")[1])
    check(abs(v - 144) <= u, f"printed 1/4\" = 1'-0\" (48 ÷ 72 = 0.667\" per unit): 216 units = 12' 0\" by hand: got {t.split('.')[0]}")
    n0 = pg.evaluate("document.querySelectorAll('.pv-mp').length"); sp = spot(1, 1500, 1000)
    pg.mouse.move(*sp); pg.mouse.down(); pg.mouse.move(sp[0] - 80, sp[1] - 40, steps=5); pg.mouse.up(); pg.wait_for_timeout(200)
    check(pg.evaluate("document.querySelectorAll('.pv-mp').length") == n0, "dragging the sheet in Measure doesn't drop a point")
    pg.click("[data-pvt=find]"); pg.wait_for_timeout(200); FST = "document.getElementById('pv-fst').textContent"
    check(pg.evaluate("document.querySelectorAll('.pv-m').length") == 0, "switching to Find clears the measuring marks")
    pg.fill("#pv-q", "wh"); pg.press("#pv-q", "Enter"); pg.wait_for_timeout(800)
    check(pg.evaluate(FST).startswith("1 of 2") and pg.evaluate("document.querySelectorAll('.pv-hit').length") == 2, f"Find 'wh': both, including on the turned sheet ({pg.evaluate(FST)})")
    box = pg.evaluate("(() => { const r = document.querySelector('.pv-hit.on'); return ['x', 'y', 'width', 'height'].map(k => +r.getAttribute(k)); })()")
    check(box[0] <= 1000 <= box[0] + box[2] and box[1] <= 1728 - 1200 - 12 <= box[1] + box[3], f"the highlight sits on the word (WH at 1000, {1728 - 1200} from the top; box {[round(x) for x in box]})")
    pg.press("#pv-q", "Enter"); pg.wait_for_timeout(500); check(pg.evaluate(FST).startswith("2 of 2 · sheet 2"), "Enter goes to the next match, on sheet 2")
    pg.fill("#pv-q", "cleanout"); pg.press("#pv-q", "Enter"); pg.wait_for_timeout(500)
    check("rotate(-90" in (pg.evaluate("document.querySelector('.pv-hit.on').getAttribute('transform')") or ""), "a sideways word gets a sideways highlight")
    pg.fill("#pv-q", "zzz"); pg.press("#pv-q", "Enter"); pg.wait_for_timeout(400); check(pg.evaluate(FST).startswith("No “zzz”"), "a word that isn't there says so")
    card(tid); pg.click("#jf-open"); pg.wait_for_timeout(2000)
    check(pg.evaluate("document.getElementById('pv-meas').hidden && document.getElementById('pv-find').hidden"), "reopening the plans starts with the tools closed")
    pg.click("[data-pvt=measure]"); pg.wait_for_timeout(200)
    check("printed 1/4" in pg.evaluate("document.getElementById('pv-scs').textContent"), "the sheet's scale is saved with the PDF and back when it's reopened")
    check(not pg.errs and not pg.evaluate("window.jpbErrs.length"), "no script errors with Find and Measure" + (f": {pg.errs}" if pg.errs else ""))

    # ---------- 12. getting around: More lands on the page, recent jobs one tap ----------
    print("12. Getting around: More lands on the page, recent jobs one tap, first open")
    many = dict(one, peeked=1, seenV=1, jobs=[dict(one["jobs"][0], id=f"r{i}", name=f"Lot {i}", t=int(time.time() * 1000) - (11 - i) * 60000) for i in range(1, 11)])
    ctx, pg = fresh(); ctx.add_init_script("if(!sessionStorage.s){sessionStorage.s=1;localStorage.setItem('jpb-setup','1');localStorage.setItem('jpb-jobs',%s)}" % json.dumps(json.dumps(many)))
    open_book(pg)
    want = pg.evaluate("MORE_G.map(g => g + ':' + GROUPS[g].map(x => x[0]).join(','))")
    got = pg.evaluate("[...document.querySelectorAll('#more-list .more-item')].filter(w => !w.hidden).map(w => w.dataset.group + ':' + [...w.querySelectorAll('.more-subs button')].map(b => b.dataset.sub).join(','))")
    check(want == got, f"More lists every page of each section, in order ({len(got)} sections)")
    pg.click("nav.tabs [data-group=calc]"); pg.wait_for_timeout(300); pg.click("#more-btn"); pg.wait_for_timeout(300)
    pg.click("#more-list button[data-sub=utah]"); pg.wait_for_timeout(500)
    check(pg.evaluate("nav.group + '/' + nav.sub") == "inspect/utah" and not pg.evaluate("sheetOn('more')"), "More → Cities lands on Cities in one tap and closes More")
    pg.go_back(); pg.wait_for_timeout(600)
    check(pg.evaluate("nav.group") == "calc", "Back from there goes to the page before More, not back into More")
    pg.click("#more-btn"); pg.wait_for_timeout(300); pg.click("#more-list .more-main[data-group=inspect]"); pg.wait_for_timeout(400)
    check(pg.evaluate("nav.group + '/' + nav.sub") == "inspect/phases", "the section name opens its first page (no page memory)")
    pg.click("#more-btn"); pg.wait_for_timeout(300)
    check(pg.evaluate("document.querySelector('#more-list button[data-sub=phases]').getAttribute('aria-current')") == "page", "More marks the page you're on")
    pg.keyboard.press("Escape"); pg.wait_for_timeout(200)
    pg.evaluate("() => { PREFS.tabs.mine = 'bar'; savePrefs(); tabsApply(); }")
    check(pg.evaluate("document.querySelector('#more-list .more-item[data-group=mine]').hidden"), "a section moved to the bar leaves More")
    pg.evaluate("() => { delete PREFS.tabs.mine; savePrefs(); tabsApply(); }")
    pg.evaluate("location.hash = '#mine/jobs'"); pg.wait_for_timeout(800)
    rc = pg.evaluate("[...document.querySelectorAll('.jb-recent button')].map(b => b.textContent)")
    check(rc == ["Lot 10", "Lot 9", "Lot 8", "Lot 7"], f"Recent shows the 4 jobs worked on last, newest first ({rc})")
    pg.click(".jb-recent button[data-open=r8]"); pg.wait_for_timeout(600)
    check(pg.evaluate("(() => { const b = document.querySelector('.jb-back'); return !!b && b.closest('section').innerText.includes('Lot 8'); })()"), "tapping a recent job opens it")
    same = pg.evaluate("(() => { const a = GLOSS.map(x => x[0]), b = a.slice().sort((x, y) => x.localeCompare(y, undefined, {sensitivity: 'base', numeric: true})); return a.every((t, i) => t === b[i] || x0(t, b[i])); function x0(p, q){ return p.localeCompare(q, undefined, {sensitivity: 'base', numeric: true}) === 0; } })()")
    check(same, "the glossary is still in the same A to Z order (faster sort)")
    check(pg.evaluate("document.querySelector('meta[name=theme-color]').content") == pg.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--k').trim()"), "the status-bar colour still follows the look")
    check(not pg.errs and not pg.evaluate("window.jpbErrs.length"), "no script errors getting around" + (f": {pg.errs}" if pg.errs else ""))
    ctx.close()

    # ---------- 13. one copy of each fact; stage checklists set before a job ----------
    print("13. No duplicates: cities from one list, numbers once; stage checklists edited before a job")
    ctx, pg = fresh(); ctx.add_init_script("if(!sessionStorage.s){sessionStorage.s=1;localStorage.setItem('jpb-setup','1');localStorage.setItem('jpb-jobs',%s)}" % json.dumps(json.dumps(dict(one, peeked=1, seenV=1, jobs=[dict(one["jobs"][0], stages=dict(one["jobs"][0]["stages"], under=dict(one["jobs"][0]["stages"]["under"], extra=[{"id": "e1", "t": "My own line", "done": True, "at": 1}])))], people=[{"id": "p1", "n": "Mike <b>R</b>", "role": "Superintendent", "co": "ABC", "ph": "801-555-0101", "em": "", "log": [], "draft": "", "t": 1}, {"id": "p2", "n": "Saved twice", "role": "Inspector", "co": "", "ph": "(801) 555-0102", "em": "", "log": [], "draft": "", "t": 1}, {"id": "p3", "n": "No phone", "role": "Other", "co": "", "ph": "", "em": "", "log": [], "draft": "", "t": 1}]))))
    ctx.add_init_script("if(!sessionStorage.n){sessionStorage.n=1;localStorage.setItem('jpb-mynums',JSON.stringify([{name:'Inspector cell',num:'801-555-0102'}]))}")
    open_book(pg)
    ci = pg.evaluate("(() => { const want = CITIES.filter(c => !Array.isArray(c) && c.book && !/^<span class=\"mc-gap\">Not checked yet/.test(c.book)).map(c => c.n); const got = [...document.querySelectorAll('#ci-rows td b')].map(b => b.textContent); return [want.length, got.length, want.every((n, i) => n === got[i])]; })()")
    check(ci[0] == ci[1] and ci[2] and ci[0] > 30, f"City inspections is built from the city list, every checked town once ({ci[1]} towns)")
    rows = pg.evaluate("(() => { const r = [...document.querySelectorAll('#ci-rows tr')].find(t => /Cedar Hills/.test(t.cells[0] && t.cells[0].textContent)); return r ? r.textContent : ''; })()")
    check("800-560-6151" in rows and "801-785-9668" not in rows, "Cedar Hills reads the city's current booking line (Sunrise Engineering), not the old copy")
    tel = pg.evaluate("(() => { const n = h => { const s = [...document.querySelectorAll('section')].find(x => x.querySelector('h2') && x.querySelector('h2').textContent.trim() === h); return new Set([...s.querySelectorAll('.pn')].map(e => e.textContent.replace(/\\D/g, ''))); }; const u = n('Utilities & state lines'), p = n('Problem? First call'); return [...u].filter(x => p.has(x)); })()")
    check(tel == [], f"Utilities & state lines repeats no number from Problem? First call ({tel})")
    mn = pg.evaluate("[...document.querySelectorAll('#mn-rows tr')].map(t => t.textContent.replace(/\\s+/g, ' ').trim())")
    check(any("Mike <b>R</b>" in r and "801-555-0101" in r for r in mn), "My numbers lists My jobs people with a number (names shown as typed, not as code)")
    check(not any("Saved twice" in r for r in mn) and not any("No phone" in r for r in mn), "…but not someone already saved there, or with no number")
    pg.evaluate("location.hash = '#mine/jobs'"); pg.wait_for_timeout(700)
    JOBS = "JSON.parse(localStorage.getItem('jpb-jobs')).jobs"
    before = pg.evaluate("jbCk(%s[0], 'under').items.map(x => x.t + (x.done ? ' ✓' : ''))" % JOBS)
    check("My own line ✓" in before and len(before) > 3, "the job you already have shows the book's Underground list plus its own checked line")
    pg.click("[data-a=set-go][data-k=jb-tpl-h]"); pg.wait_for_timeout(500)
    check(pg.evaluate("document.getElementById('jb-tpl-h').open"), "Stage checklists opens from the jobs list")
    pg.fill("#jb-tpl-under", "Sleeves set\n\n- Building drain under test\nSleeves set\n<img src=x onerror=window.__x=1>\n   Cleanouts to grade   ")
    pg.click("[data-a=tpl-save][data-k=under]"); pg.wait_for_timeout(400)
    tpl = pg.evaluate("jbTplGet('under')")
    check(tpl == ["Sleeves set", "Building drain under test", "<img src=x onerror=window.__x=1>", "Cleanouts to grade"], f"Saving trims spaces, bullets, blank and repeated lines ({tpl})")
    check(pg.evaluate("document.getElementById('jb-tpl-h').open") and "4 items" in pg.inner_text("#jb-tpl-h summary ~ div"), "the list stays open and shows the new count")
    pg.click("[data-a=set-back]"); pg.wait_for_timeout(300); pg.evaluate("document.querySelector('[data-a=new]').click()"); pg.wait_for_timeout(500)
    new = pg.evaluate("(J => jbCk(J[J.length - 1], 'under').items.map(x => x.t))(%s)" % JOBS)
    check(new == tpl, "a job made after that starts Underground with exactly that list")
    check(pg.evaluate("jbCk(%s[0], 'under').items.map(x => x.t + (x.done ? ' ✓' : ''))" % JOBS) == before, "the job you already had keeps its list and its check")
    check(pg.evaluate("ckList('under')") == tpl, "Inspect → Before you call it in uses the same list")
    check(not pg.evaluate("window.__x"), "an item typed as code stays text")
    pg.click(".jb-back"); pg.wait_for_timeout(400); pg.click("[data-a=set-go][data-k=jb-tpl-h]"); pg.wait_for_timeout(400); pg.once("dialog", lambda d: d.accept())
    pg.click("[data-a=tpl-book][data-k=under]"); pg.wait_for_timeout(300)
    check(pg.evaluate("!jbTplMine('under') && JSON.stringify(jbTplGet('under')) === JSON.stringify(CK.under)"), "Back to the book's list restores the book's Underground list")
    check(not pg.errs and not pg.evaluate("window.jpbErrs.length"), "no script errors" + (f": {pg.errs}" if pg.errs else ""))
    ctx.close()

    # ---------- 14. code cards; no page memory (data kept); room presets ----------
    print("14. Code cards, pages open fresh (your data stays), room presets")
    two = dict(one, peeked=1, seenV=1, jobs=[dict(one["jobs"][0], t=int(time.time() * 1000))])
    ctx, pg = fresh(); ctx.add_init_script("if(!sessionStorage.s){sessionStorage.s=1;localStorage.setItem('jpb-setup','1');localStorage.setItem('jpb-jobs',%s);localStorage.setItem('jpb-nav',JSON.stringify({group:'mech',sub:'codes'}));localStorage.setItem('jpb-last-sub',JSON.stringify({mech:'codes'}));localStorage.setItem('jpb-pins',JSON.stringify(['how:how-the-code-books-fit-together']));localStorage.setItem('jpb-prefs',JSON.stringify({start:'last'}))}" % json.dumps(json.dumps(two)))
    open_book(pg)
    check(pg.evaluate("nav.group + '/' + nav.sub") == "home/home" and pg.evaluate("PREFS.start") == "home", "an old 'Where I left off' setting opens Home now, not the last page")
    check(pg.evaluate("localStorage.getItem('jpb-nav') === null && localStorage.getItem('jpb-last-sub') === null"), "the old page-memory keys are cleared")
    titles = pg.evaluate("[...document.querySelectorAll('section[data-sec=code] h2')].map(h => h.textContent.trim())")
    check(titles.index("IRC and IPC in Utah") == titles.index("Which code applies") + 1 and "State code vs. city rules" in titles, f"Inspect → Which code has the two new cards after Which code applies ({titles})")
    check(not pg.evaluate("[...document.querySelectorAll('h2')].some(h => h.textContent.trim() === 'How the code books fit together')"), "the old Learn copy is gone (no duplicate)")
    check(pg.evaluate("PINS.has('code:irc-and-ipc-in-utah')"), "a pin on the old card moved to the new one")
    pg.click("nav.tabs [data-group=mech]"); pg.wait_for_timeout(200); pg.click(".subtabs [data-sub=codes]"); pg.wait_for_timeout(200)
    pg.click("nav.tabs [data-group=calc]"); pg.wait_for_timeout(200); pg.click("nav.tabs [data-group=mech]"); pg.wait_for_timeout(300)
    check(pg.evaluate("nav.sub") == "mechfix", "a tab opens on its first page, not the last one you used")
    pg.click(".subtabs [data-sub=codes]"); pg.wait_for_timeout(200)
    fold = "(() => { const s = SECTIONS.find(x => x.dataset.sec === 'codes'); return s.querySelector('details[data-o0=\"\"]'); })()"
    has = pg.evaluate(f"!!{fold}")
    if has: pg.evaluate(f"{fold}.open = true")
    pg.click("nav.tabs [data-group=calc]"); pg.wait_for_timeout(300)
    check(not has or not pg.evaluate(f"{fold}.open"), "a fold you opened is shut again when you leave the page")
    pg.click(".subtabs [data-sub=grade]"); pg.wait_for_timeout(200)
    box = pg.evaluate("(() => { const i = [...document.querySelectorAll('section[data-sec=grade] input:not([type=checkbox]):not([type=radio])')].find(i => i.offsetParent); i.id = i.id || 'tmp-box'; return '#' + i.id; })()")
    pg.fill(box, "37"); pg.click(".subtabs [data-sub=layout]"); pg.wait_for_timeout(200); pg.click(".subtabs [data-sub=grade]"); pg.wait_for_timeout(200)
    check(pg.input_value(box) == "37", "what you typed in a calculator stays (informational data isn't wiped)")
    pg.evaluate("location.hash = '#mine/jobs'"); pg.wait_for_timeout(600)
    pg.evaluate("[...document.querySelectorAll('[data-peek]')].find(b => b.dataset.peek === 'j1').click()"); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('[data-qa=open]').click()"); pg.wait_for_timeout(500)
    check(pg.evaluate("!!document.querySelector('.jb-back')"), "a job is open")
    pg.click("nav.tabs [data-group=calc]"); pg.wait_for_timeout(300); pg.evaluate("location.hash = '#mine/jobs'"); pg.wait_for_timeout(600)
    check(pg.evaluate("!document.querySelector('.jb-back') && !!document.querySelector('[data-peek=j1]')"), "coming back to My jobs shows the list, with the job still there")
    check(pg.evaluate("nav.group + '/' + nav.sub") == "mine/jobs", "and the page didn't jump anywhere else")
    # room presets
    pg.evaluate("[...document.querySelectorAll('[data-peek]')].find(b => b.dataset.peek === 'j1').click()"); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('[data-qa=open]').click()"); pg.wait_for_timeout(500)
    pg.evaluate("document.querySelector('[data-fold=rooms]').click()"); pg.wait_for_timeout(200)
    J = lambda: json.loads(pg.evaluate("localStorage.getItem('jpb-jobs')"))["jobs"][0].get("rooms", [])
    pg.click("[data-rpre='Half bath']"); pg.wait_for_timeout(300); pg.click("[data-rpre='Half bath']"); pg.wait_for_timeout(300)
    R = J(); check([r["n"] for r in R] == ["Half bath", "Half bath 2"] and [f["k"] for f in R[0]["f"]] == ["Toilet", "Toilet rough-in", "Vanity / lav", "Lav faucet"], f"one tap adds a room with its fields ready; a second one is numbered ({[r['n'] for r in R]})")
    pg.click("[data-rfk='Floor drain']") if pg.query_selector("[data-rfk='Floor drain']") else pg.evaluate("document.querySelector('[data-rfk]').click()")
    pg.wait_for_timeout(300)
    check(len(J()[1]["f"]) == 5 and pg.evaluate("document.activeElement && document.activeElement.dataset.rv !== undefined"), "a ＋ field chip adds the field and puts you in its box")
    pg.click("[data-ra=f-clean]"); pg.wait_for_timeout(300)
    check(J()[1]["f"] == [], "Remove empty fields clears the blanks")
    pg.evaluate("document.querySelector('[data-a=set-go][data-k=jb-rpre-h]').click()"); pg.wait_for_timeout(400)
    check(pg.evaluate("document.getElementById('jb-rpre-h').open"), "Room presets opens from the rooms section")
    pg.fill("#jb-rpre", "Owner's suite: Freestanding tub, Tub filler, Shower valve, Shower valve\n\n- Garage: Hose bibb, Floor drain\nBad[[name]]|x: A")
    pg.click("[data-a=rpre-save]"); pg.wait_for_timeout(300)
    pre = json.loads(pg.evaluate("localStorage.getItem('jpb-jobs')"))["rpre"]
    check(pre == [{"n": "Owner's suite", "f": ["Freestanding tub", "Tub filler", "Shower valve"]}, {"n": "Garage", "f": ["Hose bibb", "Floor drain"]}, {"n": "Badnamex", "f": ["A"]}], f"presets save one per line, cleaned up ({pre})")
    check(pg.evaluate("[...document.querySelectorAll('#jb-rpre-h ~ *, body')].length > 0") and not pg.errs and not pg.evaluate("window.jpbErrs.length"), "no script errors" + (f": {pg.errs}" if pg.errs else ""))
    ctx.close()

    # ---------- 15. cleanup pass: exact reference fractions, renamed card, folded history ----------
    print("15. Cleanup: reference fractions stay exact, take-offs go in exact, renamed card keeps pins")
    ctx, pg = fresh(); ctx.add_init_script("if(!sessionStorage.s){sessionStorage.s=1;localStorage.setItem('jpb-setup','1');localStorage.setItem('jpb-takeoffs',JSON.stringify([['Test 90','1 5/16']]));localStorage.setItem('jpb-pins',JSON.stringify(['vents:vent-sizing-and-terminals']))}")
    open_book(pg)
    fr = pg.evaluate("[...document.querySelectorAll('#frac b')].map(b => b.textContent)")
    check(fr[:4] == ['1/16"', '1/8"', '3/16"', '1/4"'] and fr[-1] == '1"' and len(fr) == 16, f"the 16ths table shows every 16th, not rounded to the answer setting ({fr[:4]})")
    chip = pg.evaluate("(document.querySelector('#cl-chips button') || {}).textContent || ''")
    check(chip.endswith('1 5/16"'), f"a saved 1 5/16\" take-off shows exact on its chip ({chip})")
    pg.evaluate("location.hash = '#calc/layout'"); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('#cl-chips button').click()"); pg.wait_for_timeout(200)
    check(pg.evaluate("CLV.a.c") == "1 5/16", f"tapping it puts 1 5/16 in the box, not a rounded 1 1/4 or 1 3/8 ({pg.evaluate('CLV.a.c')})")
    check(pg.evaluate("toFracX(1.3125)") == '1 5/16"' and pg.evaluate("toFracX(2.1)") == '2.1"' and pg.evaluate("toFracX(-0.5)") == '-1/2"' and pg.evaluate("toFracX(0)") == '0"', "exact fraction helper: 1 5/16, 2.1 (no tape fraction), -1/2, 0")
    check(pg.evaluate("PINS.has('vents:vent-terminals')") and pg.evaluate("[...document.querySelectorAll('h2')].some(h => h.textContent.trim() === 'Vent terminals')"), "Vent sizing & terminals is now Vent terminals, and its pin followed")
    check(pg.evaluate("document.querySelectorAll('section h2')") is not None and pg.evaluate("(() => { const s = [...document.querySelectorAll('section')].find(x => x.querySelector('h2') && x.querySelector('h2').textContent.trim() === \"What's new\"); return [s.querySelector('table tbody').rows.length, !document.getElementById('news-older').open]; })()") == [5, True], "What's new shows the latest 5; older changes fold away")
    check(not pg.errs and not pg.evaluate("window.jpbErrs.length"), "no script errors" + (f": {pg.errs}" if pg.errs else ""))
    ctx.close()

    print("16. IPC first")
    ctx, pg = fresh(); ctx.add_init_script("if(!sessionStorage.s){sessionStorage.s=1;localStorage.setItem('jpb-setup','1')}")
    open_book(pg)
    check(pg.evaluate("myCode") == "ipc21" and pg.evaluate("document.querySelector('#code-pick [data-code=ipc21]').getAttribute('aria-pressed')") == "true", f"a fresh install starts on the 2021 IPC ({pg.evaluate('myCode')})")
    check("2021 IPC" in pg.evaluate("document.getElementById('code-chip-txt').textContent"), "the code chip says 2021 IPC")
    check("15A-3-201(2)" in pg.content() and "don't change the IRC" not in pg.content(), "Utah's IPC changes reach the matching IRC section, with the law cited")
    pg.evaluate("setCode('irc21')"); pg.wait_for_timeout(100)
    check(pg.evaluate("localStorage.getItem('jpb-code')") == '"irc21"' or pg.evaluate("localStorage.getItem('jpb-code')") == 'irc21', "picking the IRC still saves")
    check(not pg.errs and not pg.evaluate("window.jpbErrs.length"), "no script errors" + (f": {pg.errs}" if pg.errs else ""))
    ctx.close()
    br.close()

print(f"\n{'ALL PASSED' if not FAILS else str(len(FAILS)) + ' FAILED'}")
sys.exit(1 if FAILS else 0)
