# 오늘의 큐티

매일 두란노 「생명의삶」 오늘의 QT 본문 **장절만** 가져와서, 개역한글 본문을 큰 글씨로 보여주는 개인용 사이트예요.

## 구조
```
index.html, style.css, app.js   사이트 화면
config.js                        제목·선물 메시지 (여기만 고치면 됨)
data/bible/                      개역한글 성경 전체 (66권, 책별 JSON)
data/today.json, history.json    매일 자동으로 갱신되는 장절
scripts/fetch_qt.py              생명의삶 페이지에서 장절만 추출
.github/workflows/fetch-qt.yml   매일 00:20 / 03:00 / 05:30(KST) 자동 실행
```

## 올리는 방법
1. GitHub에서 새 저장소 만들기 (예: `qt`) → **Public**
2. 이 폴더 안의 파일 전부 업로드 (`.github`, `.nojekyll` 숨김 파일 포함)
3. **Settings → Pages** → Source: `Deploy from a branch`, Branch: `main` / `(root)` → Save
4. **Settings → Actions → General** → Workflow permissions: **Read and write permissions** → Save
5. **Actions** 탭 → "오늘의 본문 가져오기" → **Run workflow** 로 한 번 수동 실행해 성공하는지 확인
6. 몇 분 뒤 `https://<아이디>.github.io/qt/` 접속

## 아버지 폰에 설치
- 아이폰: Safari로 열기 → 공유 버튼 → **홈 화면에 추가**
- 안드로이드: Chrome으로 열기 → ⋮ 메뉴 → **홈 화면에 추가**

## 오프라인
`sw.js`가 한 번 열어 본 화면·본문을 폰에 저장해 두어, 인터넷이 없어도 열려요.
오늘 장절은 인터넷이 될 때 새로 받아요. 화면을 고친 뒤에는 `sw.js`의 `VERSION`을 올려 주세요.

## 알아둘 점
- 한 줄 기록은 아버지 폰(그 브라우저)에만 저장돼요. 폰을 바꾸거나 브라우저 데이터를 지우면 사라져요.
  아이폰은 Safari와 홈 화면 아이콘의 저장 공간이 따로라서, 처음부터 홈 화면 아이콘으로만 쓰시게 해 주세요.
- 05:30 실행에서도 장절을 못 가져오면 Actions가 실패로 표시되고 GitHub가 메일을 보내요.
  그날은 사이트에서 "직접 고르기"와 "생명의삶에서 해설 보기"로 대신 읽으실 수 있어요.
- 공개 저장소는 오래 활동이 없으면 예약 실행이 꺼질 수 있어요. 매일 커밋이 생기니 보통 괜찮지만, 멈췄다면 Actions 탭에서 다시 켜 주세요.
- 성경 본문: 개역한글판(대한성서공회, 저작재산권 보호기간 만료). 데이터 출처: github.com/crizin/bible-db
- 두란노 콘텐츠(해설·기도문·개역개정 본문)는 저장하지 않고 링크로만 연결해요.

## 테스트
```
python3 tests/test_parse.py
```
