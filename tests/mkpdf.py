# test helper: builds a plan-size PDF (vector lines + text) for tests/run.py
# a 3-page, 36x24 in "plan set": a grid of lines, a thick pipe run, and text (Helvetica, not embedded)
import sys
def pdf(path, pages=3):
    objs = []
    def add(b): objs.append(b); return len(objs)
    font = add(b"<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>")
    kids = []; pages_id = len(objs) + 1 + pages * 2
    for n in range(pages):
        ops = ["0.6 w 0 0 0 RG"]
        for x in range(0, 2592, 72): ops.append(f"{x} 0 m {x} 1728 l S")
        for y in range(0, 1728, 72): ops.append(f"0 {y} m 2592 {y} l S")
        ops += ["6 w 0 0 1 RG 200 300 m 2400 300 l 2400 1500 l S", f"BT /F1 48 Tf 100 1600 Td (SHEET P-{n+1}  3\" DWV) Tj ET", "BT /F1 6 Tf 1000 800 Td (tiny 6pt note: 1/4 in per ft) Tj ET"]
        c = "\n".join(ops).encode()
        cid = add(b"<</Length %d>>stream\n" % len(c) + c + b"\nendstream")
        kids.append(add(b"<</Type/Page/Parent %d 0 R/MediaBox[0 0 2592 1728]/Resources<</Font<</F1 %d 0 R>>>>/Contents %d 0 R>>" % (pages_id, font, cid)))
    assert add(b"<</Type/Pages/Kids[%s]/Count %d>>" % (b" ".join(b"%d 0 R" % k for k in kids), pages)) == pages_id
    cat = add(b"<</Type/Catalog/Pages %d 0 R>>" % pages_id)
    out = b"%PDF-1.4\n"; offs = []
    for i, o in enumerate(objs, 1): offs.append(len(out)); out += b"%d 0 obj\n" % i + o + b"\nendobj\n"
    x = len(out); out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1) + b"".join(b"%010d 00000 n \n" % o for o in offs)
    out += b"trailer<</Size %d/Root %d 0 R>>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, cat, x)
    open(path, "wb").write(out)
if __name__ == "__main__": pdf(sys.argv[1])

def tools_pdf(path):
    """2 sheets, 36x24 in, for Find and Measure, with answers worked by hand:
       sheet 1: a 720-unit line at y=864 from x=288 (10 in of paper: 40'-0" at 1/4" = 1'-0"), and a 216-unit line from x=288 at y=600
                (3 in of paper: 12'-0" at 1/4"); words "WH" at (1000,1200), "P-3" at (1400,1200), "CLEANOUT" turned 90 degrees at (2000,600)
       sheet 2: turned 90 degrees (/Rotate 90), with "WH" at (500,500)"""
    objs = []
    def add(b): objs.append(b); return len(objs)
    font = add(b"<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>")
    s1 = b"3 w 0 0 0 RG 288 864 m 1008 864 l S 288 600 m 504 600 l S BT /F1 24 Tf 1000 1200 Td (WH) Tj ET BT /F1 24 Tf 1400 1200 Td (P-3) Tj ET BT /F1 24 Tf 0 1 -1 0 2000 600 Tm (CLEANOUT) Tj ET"
    s2 = b"BT /F1 24 Tf 500 500 Td (WH) Tj ET 2 w 100 100 m 900 100 l S"
    c1 = add(b"<</Length %d>>stream\n" % len(s1) + s1 + b"\nendstream"); c2 = add(b"<</Length %d>>stream\n" % len(s2) + s2 + b"\nendstream")
    pages_id = len(objs) + 3
    p1 = add(b"<</Type/Page/Parent %d 0 R/MediaBox[0 0 2592 1728]/Resources<</Font<</F1 %d 0 R>>>>/Contents %d 0 R>>" % (pages_id, font, c1))
    p2 = add(b"<</Type/Page/Parent %d 0 R/MediaBox[0 0 2592 1728]/Rotate 90/Resources<</Font<</F1 %d 0 R>>>>/Contents %d 0 R>>" % (pages_id, font, c2))
    assert add(b"<</Type/Pages/Kids[%d 0 R %d 0 R]/Count 2>>" % (p1, p2)) == pages_id
    cat = add(b"<</Type/Catalog/Pages %d 0 R>>" % pages_id)
    out = b"%PDF-1.4\n"; offs = []
    for i, o in enumerate(objs, 1): offs.append(len(out)); out += b"%d 0 obj\n" % i + o + b"\nendobj\n"
    x = len(out); out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1) + b"".join(b"%010d 00000 n \n" % o for o in offs)
    out += b"trailer<</Size %d/Root %d 0 R>>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, cat, x)
    open(path, "wb").write(out)
