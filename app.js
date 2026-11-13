(function () {
  "use strict";

  const CFG = window.QT_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
  const SCALES = [1, 1.15, 1.3, 1.5];
  const DURANNO = (d) => "https://www.duranno.com/qt/view/bible.asp?qtDate=" + d;

  // ---------- 저장소 (실패해도 사이트는 동작) ----------
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
      catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); return true; }
      catch (e) { return false; }
    },
  };

  // ---------- 날짜 (항상 한국 시간 기준) ----------
  function kstParts(date) {
    const f = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
    });
    const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
    return { iso: `${p.year}-${p.month}-${p.day}`, y: +p.year, m: +p.month, d: +p.day, h: +p.hour };
  }
  const NOW = kstParts(new Date());
  const TODAY = NOW.iso;
  const iso = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const weekday = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const prettyDate = (isoStr) => {
    const [y, m, d] = isoStr.split("-").map(Number);
    return `${y}년 ${m}월 ${d}일 ${WEEK[weekday(y, m, d)]}요일`;
  };

  // ---------- 데이터 ----------
  let BOOKS = [];
  let HISTORY = {};
  let records = store.get("qt.records", {});
  const bookCache = {};

  async function getJSON(url) {
    const r = await fetch(url, { cache: "no-cache" });
    if (!r.ok) throw new Error(url + " " + r.status);
    return r.json();
  }
  async function getBook(no) {
    if (!bookCache[no]) bookCache[no] = getJSON(`data/bible/${no}.json`);
    return bookCache[no];
  }

  // ---------- 본문 표시 ----------
  let HL = store.get("qt.hl", {});

  function setHeader(bookName, head, pill) {
    $("book-title").textContent = bookName;
    $("ref-title").textContent = head;
    $("pill-ref").textContent = pill;
  }

  function verseHead(ref) {
    if (ref.start_ch === ref.end_ch) {
      if (ref.end_v >= 999) return `${ref.start_ch}장`;
      return ref.start_v === ref.end_v ? `${ref.start_ch}장 ${ref.start_v}절` : `${ref.start_ch}장 ${ref.start_v}–${ref.end_v}절`;
    }
    return `${ref.start_ch}장 ${ref.start_v}절 – ${ref.end_ch}장 ${ref.end_v}절`;
  }

  async function showPassage(ref) {
    const box = $("verses");
    box.textContent = "";
    try {
      const book = await getBook(ref.book_no);
      setHeader(book.name, verseHead(ref), `${book.name} ${ref.start_ch}`);
      for (let ch = ref.start_ch; ch <= ref.end_ch; ch++) {
        const chapter = book.chapters[String(ch)] || {};
        const nums = Object.keys(chapter).map(Number).sort((a, b) => a - b);
        const from = ch === ref.start_ch ? ref.start_v : 1;
        const to = ch === ref.end_ch ? ref.end_v : nums[nums.length - 1];
        const para = document.createElement("p");
        const cap = document.createElement("span");
        cap.className = "dropcap";
        cap.textContent = ch;
        para.appendChild(cap);
        nums.filter((n) => n >= from && n <= to).forEach((n, i) => {
          const key = `${book.no}-${ch}-${n}`;
          const span = document.createElement("span");
          span.className = "v" + (HL[key] ? " hl" : "");
          if (!(i === 0 && n === 1)) {
            const vn = document.createElement("sup");
            vn.className = "vn";
            vn.textContent = n;
            span.appendChild(vn);
          }
          span.appendChild(document.createTextNode(chapter[String(n)] + " "));
          span.onclick = () => {
            if (HL[key]) delete HL[key]; else HL[key] = true;
            span.classList.toggle("hl", !!HL[key]);
            store.set("qt.hl", HL);
          };
          para.appendChild(span);
        });
        box.appendChild(para);
      }
    } catch (e) {
      box.textContent = "본문을 불러오지 못했어요. 인터넷 연결을 확인하고 다시 열어 주세요.";
    }
  }

  function showNotice(text) {
    const n = $("notice");
    n.textContent = text;
    n.hidden = !text;
  }

  // ---------- 본문 직접 고르기 (예비 화면) ----------
  function setupPicker() {
    const bookSel = $("pick-book");
    const chSel = $("pick-chapter");
    bookSel.innerHTML = "";
    BOOKS.forEach((b) => {
      const o = document.createElement("option");
      o.value = b.no;
      o.textContent = b.name;
      bookSel.appendChild(o);
    });
    const fillChapters = () => {
      const b = BOOKS.find((x) => x.no === +bookSel.value);
      chSel.innerHTML = "";
      for (let i = 1; i <= b.chapters; i++) {
        const o = document.createElement("option");
        o.value = i;
        o.textContent = i + "장";
        chSel.appendChild(o);
      }
    };
    bookSel.onchange = fillChapters;
    fillChapters();
    $("pick-go").onclick = () => {
      const b = BOOKS.find((x) => x.no === +bookSel.value);
      const ch = +chSel.value;
      showPassage({ book_no: b.no, start_ch: ch, start_v: 1, end_ch: ch, end_v: 999 });
    };
    $("picker").hidden = false;
  }

  // ---------- 한 줄 기록 ----------
  function todayRef() {
    return HISTORY[TODAY] || null;
  }
  function renderNoteState() {
    const rec = records[TODAY];
    const btn = $("done-btn");
    const msg = $("saved-msg");
    if (rec && rec.done) {
      btn.textContent = "기록 고치기";
      btn.classList.add("done");
      btn.classList.remove("primary");
      msg.textContent = "오늘 묵상을 마치셨어요. 수고하셨습니다 🙏";
      msg.hidden = false;
    } else {
      btn.textContent = "오늘 묵상 완료";
      btn.classList.add("primary");
      btn.classList.remove("done");
      msg.hidden = true;
    }
  }
  function setupNote() {
    const input = $("note-input");
    if (records[TODAY]) input.value = records[TODAY].note || "";
    renderNoteState();
    $("done-btn").onclick = () => {
      const ref = todayRef();
      records[TODAY] = {
        done: true,
        note: input.value.trim(),
        label: ref ? ref.label : (records[TODAY] && records[TODAY].label) || "",
        savedAt: new Date().toISOString(),
      };
      const ok = store.set("qt.records", records);
      renderNoteState();
      if (!ok) {
        $("saved-msg").textContent = "이 기기에서는 기록 저장이 안 돼요. (개인정보 보호 모드인지 확인해 주세요)";
      }
      renderCalendar();
      input.blur();
    };
  }

  // ---------- 달력 ----------
  let calY = NOW.y, calM = NOW.m, selected = null;

  function renderCalendar() {
    $("cal-title").textContent = `${calY}년 ${calM}월`;
    const wk = $("cal-weekdays");
    if (!wk.childElementCount) WEEK.forEach((w) => { const d = document.createElement("div"); d.textContent = w; wk.appendChild(d); });

    const grid = $("cal-days");
    grid.innerHTML = "";
    const first = weekday(calY, calM, 1);
    const last = new Date(Date.UTC(calY, calM, 0)).getUTCDate();
    for (let i = 0; i < first; i++) {
      const e = document.createElement("button");
      e.className = "day empty";
      e.tabIndex = -1;
      grid.appendChild(e);
    }
    let count = 0;
    for (let d = 1; d <= last; d++) {
      const key = iso(calY, calM, d);
      const b = document.createElement("button");
      b.className = "day";
      b.textContent = d;
      if (key === TODAY) b.classList.add("today");
      if (records[key] && records[key].done) { b.classList.add("done"); count++; }
      if (key === selected) b.classList.add("selected");
      if (key > TODAY) b.disabled = true;
      b.onclick = () => { selected = key; renderCalendar(); showDay(key); };
      grid.appendChild(b);
    }
    $("cal-count").textContent = count ? `이번 달 ${count}일 말씀과 함께하셨어요` : "묵상을 마치면 달력에 표시돼요";
    const atNow = calY === NOW.y && calM === NOW.m;
    $("cal-next").disabled = atNow;
    $("cal-next").style.visibility = atNow ? "hidden" : "visible";
  }

  function showDay(key) {
    const box = $("day-detail");
    box.innerHTML = "";
    const rec = records[key];
    const ref = HISTORY[key];
    const label = (ref && ref.label) || (rec && rec.label) || "";

    const p1 = document.createElement("p"); p1.className = "dd-date"; p1.textContent = prettyDate(key);
    const p2 = document.createElement("p"); p2.className = "dd-ref"; p2.textContent = label || "본문 기록 없음";
    const p3 = document.createElement("p"); p3.className = "dd-note";
    p3.textContent = rec && rec.done ? (rec.note || "(한 줄 없이 묵상 완료)") : "이 날은 기록이 없어요.";
    box.append(p1, p2, p3);

    if (ref && key !== TODAY) {
      const btn = document.createElement("button");
      btn.className = "btn wide";
      btn.style.marginTop = "12px";
      btn.textContent = "이 날 본문 다시 읽기";
      btn.onclick = () => {
        showNotice(`${prettyDate(key)} 본문이에요.`);
        $("today-date").textContent = prettyDate(key);
        showPassage(ref);
        $("duranno-link").href = DURANNO(key);
        window.scrollTo({ top: 0, behavior: "smooth" });
      };
      box.appendChild(btn);
    }
    box.hidden = false;
  }

  function setupCalendar() {
    $("cal-prev").onclick = () => { calM--; if (calM < 1) { calM = 12; calY--; } renderCalendar(); };
    $("cal-next").onclick = () => { calM++; if (calM > 12) { calM = 1; calY++; } renderCalendar(); };
    renderCalendar();
  }

  // ---------- 글씨 크기 ----------
  function setupFont() {
    let idx = store.get("qt.scale", 1);
    const apply = () => {
      document.documentElement.style.setProperty("--scale", SCALES[idx]);
    };
    apply();
    $("font-btn").onclick = () => { idx = (idx + 1) % SCALES.length; store.set("qt.scale", idx); apply(); };
  }

  // ---------- 선물 메시지 ----------
  function setupGift() {
    $("gift-msg").textContent = CFG.giftMessage || "";
    $("gift-from").textContent = CFG.giftFrom || "";
    const open = () => { $("gift").hidden = false; };
    const close = () => { $("gift").hidden = true; store.set("qt.giftSeen", true); };
    $("gift-close").onclick = close;
    $("gift-again").onclick = open;
    if (CFG.giftMessage && !store.get("qt.giftSeen", false)) open();
  }

  // ---------- 시작 ----------
  async function init() {
    if (CFG.title) document.title = CFG.title;
    $("today-date").textContent = `${CFG.title ? CFG.title + " · " : ""}${prettyDate(TODAY).replace(/^\d+년 /, "")}`;
    $("cal-jump").onclick = () => $("cal-section").scrollIntoView({ behavior: "smooth" });
    $("duranno-link").href = DURANNO(TODAY);
    setupFont();
    setupGift();
    setupNote();
    setupCalendar();

    try {
      const [books, history, today] = await Promise.all([
        getJSON("data/bible/index.json"),
        getJSON("data/history.json").catch(() => ({})),
        getJSON("data/today.json").catch(() => null),
      ]);
      BOOKS = books;
      HISTORY = history || {};
      if (today && today.date && !HISTORY[today.date]) HISTORY[today.date] = today;
    } catch (e) {
      setHeader("잠시만요", "", "연결 확인");
      showNotice("인터넷 연결을 확인하고 다시 열어 주세요.");
      return;
    }

    renderCalendar();
    const ref = todayRef();
    if (ref) {
      showPassage(ref);
    } else {
      setHeader("오늘의 말씀", "본문 준비 중", "오늘 본문");
      showNotice(
        !navigator.onLine
          ? "지금 인터넷에 연결되어 있지 않아 오늘 본문을 가져오지 못했어요. 연결되면 다시 열어 주세요. 그동안 아래에서 본문을 직접 고르실 수 있어요."
          : NOW.h < 6
          ? "오늘 본문은 새벽 6시 전에 준비돼요. 아래에서 본문을 직접 고르시거나, 생명의삶에서 바로 보실 수 있어요."
          : "오늘 본문을 아직 가져오지 못했어요. 아래에서 본문을 직접 고르시거나, 생명의삶에서 바로 보실 수 있어요."
      );
      setupPicker();
    }
  }

  init();

  // 오프라인 지원
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }
})();
