import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "scripts"))
import fetch_qt as f
books = f.load_books()
cases = [
  ('<html><head><meta charset="euc-kr"></head><body><span>2026.11.13 (금)</span><h2>아모스 6 : 1~7</h2><p>안락함에...</p><p>교만한 지도자들 6:1~3</p></body></html>',
   ("2026-11-13", "아모스 6:1-7")),
  ('<div>2026-12-01</div><b>창세기 1 : 26 ~ 2 : 3</b>', ("2026-12-01", "창세기 1:26-2:3")),
  ('<div>2026.1.5</div><b>요한1서 4:7-21</b>', ("2026-01-05", "요한일서 4:7-21")),
  ('<div>2026.1.5</div><b>시편 23 : 1 ~ 6</b>', ("2026-01-05", "시편 23:1-6")),
  ('<div>2026.1.5</div><b>사사기 3장 1절~11절</b>', ("2026-01-05", "사사기 3:1-11")),
  ('<div>2026.1.5</div><b>새 282 큰 죄에 빠진 날 위해</b>', ("2026-01-05", None)),
]
ok=True
for html, (d, lab) in cases:
    raw = html.encode('cp949')
    page = f.decode(raw, "text/html; charset=euc-kr")
    got_d, ref = f.parse(page, books)
    got = (got_d, f.label(ref) if ref else None)
    flag = got == (d, lab); ok &= flag
    print("OK " if flag else "BAD", got)
sys.exit(0 if ok else 1)
