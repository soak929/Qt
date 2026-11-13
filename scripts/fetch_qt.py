#!/usr/bin/env python3
"""생명의삶 오늘의 QT 페이지에서 '본문 장절'만 읽어 data/today.json, data/history.json 에 저장한다.

- 해설·기도문·본문 텍스트 등 두란노 콘텐츠는 저장하지 않는다. (책 이름 + 장절만)
- 페이지에 표시된 날짜가 오늘(한국 시간)과 다르면 저장하지 않는다.
  (두란노 페이지는 아직 갱신 전이거나 미래 날짜를 넣으면 '오늘' 것을 보여주기 때문)
- 환경변수 STRICT=true 이면, 오늘 장절을 끝내 못 구한 경우 실패(exit 1)로 끝내
  GitHub가 메일로 알려주게 한다.
"""
import datetime as dt
import html
import json
import os
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
KST = dt.timezone(dt.timedelta(hours=9))
URL = "https://www.duranno.com/qt/view/bible.asp?qtDate={date}"
UA = "Mozilla/5.0 (personal QT reminder; fetches once a day)"

# 흔히 쓰이는 다른 표기 → 표준 책 이름
ALIASES = {
    "요한1서": "요한일서", "요한2서": "요한이서", "요한3서": "요한삼서",
    "베드로1서": "베드로전서", "베드로2서": "베드로후서",
    "데살로니가1서": "데살로니가전서", "데살로니가2서": "데살로니가후서",
    "디모데1서": "디모데전서", "디모데2서": "디모데후서",
    "사무엘상서": "사무엘상", "사무엘하서": "사무엘하",
    "열왕기상서": "열왕기상", "열왕기하서": "열왕기하",
    "역대상서": "역대상", "역대하서": "역대하",
}


def load_books():
    index = json.loads((DATA / "bible" / "index.json").read_text(encoding="utf-8"))
    return {b["name"]: b for b in index}


def decode(raw: bytes, content_type: str) -> str:
    m = re.search(r"charset=([\w-]+)", content_type or "", re.I)
    head = raw[:3000].decode("ascii", "ignore")
    m2 = re.search(r'charset=["\']?([\w-]+)', head, re.I)
    for enc in [m and m.group(1), m2 and m2.group(1), "utf-8", "cp949"]:
        if not enc:
            continue
        if enc.lower() in ("euc-kr", "ks_c_5601-1987", "ksc5601"):
            enc = "cp949"
        try:
            return raw.decode(enc)
        except (UnicodeDecodeError, LookupError):
            continue
    return raw.decode("cp949", "replace")


def html_to_text(page: str) -> str:
    page = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", page)
    page = re.sub(r"(?s)<[^>]+>", " ", page)
    page = html.unescape(page).replace("\xa0", " ")
    return re.sub(r"[ \t\r\f\v]+", " ", page)


def find_reference(text: str, books: dict):
    names = sorted(set(books) | set(ALIASES), key=len, reverse=True)
    book_re = "|".join(map(re.escape, names))
    dash = r"\s*[~∼～\-–—]\s*"
    pat = re.compile(
        rf"(?<![가-힣])({book_re})\s*(\d{{1,3}})\s*[:：장]\s*(\d{{1,3}})\s*절?"
        rf"(?:{dash}(?:(\d{{1,3}})\s*[:：장]\s*)?(\d{{1,3}})\s*절?)?"
    )
    for m in pat.finditer(text):
        name = ALIASES.get(m.group(1), m.group(1))
        if name not in books:
            continue
        b = books[name]
        sc, sv = int(m.group(2)), int(m.group(3))
        ec = int(m.group(4)) if m.group(4) else sc
        ev = int(m.group(5)) if m.group(5) else sv
        if not (1 <= sc <= b["chapters"] and 1 <= ec <= b["chapters"]):
            continue
        if (ec, ev) < (sc, sv):
            continue
        return {"book_no": b["no"], "book": name, "start_ch": sc, "start_v": sv,
                "end_ch": ec, "end_v": ev}
    return None


def page_date(text: str):
    m = re.search(r"(20\d\d)\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})", text)
    if not m:
        return None
    return dt.date(int(m.group(1)), int(m.group(2)), int(m.group(3))).isoformat()


def label(ref):
    if ref["start_ch"] == ref["end_ch"]:
        verses = f'{ref["start_v"]}' if ref["start_v"] == ref["end_v"] else f'{ref["start_v"]}-{ref["end_v"]}'
        return f'{ref["book"]} {ref["start_ch"]}:{verses}'
    return f'{ref["book"]} {ref["start_ch"]}:{ref["start_v"]}-{ref["end_ch"]}:{ref["end_v"]}'


def parse(page: str, books: dict):
    text = html_to_text(page)
    return page_date(text), find_reference(text, books)


def main():
    today = dt.datetime.now(KST).date().isoformat()
    strict = os.environ.get("STRICT", "").lower() == "true"
    books = load_books()
    hist_path = DATA / "history.json"
    history = json.loads(hist_path.read_text(encoding="utf-8")) if hist_path.exists() else {}

    check = os.environ.get("CHECK", "").lower() == "true"
    if today in history and not check:
        print(f"[ok] {today} 은 이미 저장됨: {history[today]['label']}")
        return 0

    url = URL.format(date=today)
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=30) as r:
            page = decode(r.read(), r.headers.get("Content-Type", ""))
        shown_date, ref = parse(page, books)
    except Exception as e:  # 네트워크 오류 등
        shown_date, ref = None, None
        print(f"[warn] 페이지를 읽지 못함: {e}")

    if ref and shown_date and shown_date != today:
        print(f"[wait] 페이지 날짜({shown_date})가 오늘({today})과 달라 아직 갱신 전으로 봄")
        ref = None
    if ref and not shown_date:
        print("[warn] 페이지에서 날짜를 못 찾음 — 장절만 믿고 저장")

    if not ref:
        msg = f"[fail] {today} 본문 장절을 찾지 못함 ({url})"
        print(msg)
        return 1 if strict else 0

    ref["label"] = label(ref)
    ref["date"] = today
    if check:
        print(f"[check] 페이지 날짜={shown_date}, 장절={ref['label']} (저장 안 함)")
        return 0
    ref["source_url"] = url
    history[today] = ref
    hist_path.write_text(json.dumps(dict(sorted(history.items())), ensure_ascii=False, indent=1), encoding="utf-8")
    (DATA / "today.json").write_text(json.dumps(ref, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"[saved] {today}: {ref['label']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
