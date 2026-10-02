# 체인메이트 (Chainmate)

먹은 기물로 바뀌며 이어 먹는 체스 퍼즐 로그라이크.

## 실행

빌드 없이 바닐라 JS ES 모듈로 돈다.

```
npm run serve
```

브라우저로 http://localhost:8000 을 연다. 마우스로 손의 기물을 들어 빛나는 칸에 떨구고, 흔들리는 적을 눌러 먹는다. 손을 여럿 들면 무르기. 키보드: 1~5 손, Space 무르기, Esc 멈춤(오른쪽 누르기도), Enter 다음.

타이틀: 이어 하기 · 새 판(오프닝 · 단 고르기) · 오늘의 대국(날짜 시드) · 도감 · 기록 · 설정(소리 · 음악 · 연출 속도 ×1/×2/×4 · 흔들림 · 큰 글자 · 한국어/English). 판은 명령마다 자동 저장된다.

## 검증

```
npm test
npm run smoke          # 화면 연기 시험(가짜 캔버스로 한 판 끝까지)
node tools/shots.mjs   # 화면별 스크린샷(docs/shots, Playwright 필요)
node tools/sim.mjs --battles 300 --seed 1
node tools/run.mjs --runs 300 --policy smart|hunt|random|none --seed 1 --workers 4 [--opening london] [--dan 4] [--give vault]
```

`npm test`는 전부 통과해야 한다. 두 하네스는 대국과 판 단위로 봇을 돌려 수치를 확인한다(smart 300판 ≈ 10분).

## 더 읽기

- [docs/DESIGN.md](docs/DESIGN.md) — 규칙·수치·구조
- [docs/HOOKS.md](docs/HOOKS.md) — 도파민 설계
- [CLAUDE.md](CLAUDE.md) — 작업 규칙
- [docs/reports/night.md](docs/reports/night.md) — 밤샘(화면 · 연출 · 판 밖 · 다듬기) 요약
- [docs/shots/](docs/shots/) — 화면별 스크린샷과 정한 안
- [docs/PACKAGING.md](docs/PACKAGING.md) — 데스크톱 포장 준비
