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
import json, mimetypes, pathlib, re, shutil, subprocess, sys
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
        ctx = br.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, service_workers="block", **kw)
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
        pg.evaluate("id => document.querySelector(`[data-v='${id}']`).click()", pid[-1][0]); pg.wait_for_timeout(400); pg.click("#jf-open"); pg.wait_for_timeout(600)
        check(pg.evaluate("document.getElementById('jv-dlg').open && !!document.querySelector('#jv-body iframe')") and not newtabs, "Open full screen shows a PDF inside the app (no dead new tab)")
        pg.click("#jv-close"); pg.wait_for_timeout(200); check(pg.evaluate("!document.getElementById('jv-dlg').open && document.getElementById('jf-dlg').open"), "Close goes back to the file")
    else: check(False, "a PDF was added to the test job")
    check(not pg.errs and not pg.evaluate("window.jpbErrs.length"), "no script errors in markup" + (f": {pg.errs}" if pg.errs else ""))
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
    check(not pg.errs and not pg.evaluate("window.jpbErrs.length"), "no script errors in rooms" + (f": {pg.errs}" if pg.errs else ""))
    br.close()

print(f"\n{'ALL PASSED' if not FAILS else str(len(FAILS)) + ' FAILED'}")
sys.exit(1 if FAILS else 0)
