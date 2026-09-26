# 체인메이트 (Chainmate)

잡으면 그것이 된다 — 체스 기물 로그라이크 퍼즐.

## 실행

빌드 없이 바닐라 JS ES 모듈로 돈다.

```
npm run serve
```

브라우저로 http://localhost:8000 을 연다. 마우스로 손의 기물을 들어 빛나는 칸에 떨구고, 흔들리는 적을 눌러 먹는다. 키보드: 1~5 손, Space 무르기, Esc 멈춤, Enter 다음.

## 검증

```
npm test
npm run smoke          # 화면 연기 시험(가짜 캔버스로 한 판 끝까지)
node tools/shots.mjs   # 화면별 스크린샷(docs/shots, Playwright 필요)
node tools/sim.mjs --battles 300 --seed 1
node tools/run.mjs --runs 300 --policy smart|random|none --seed 1 --workers 10
```

`npm test`는 전부 통과해야 한다. 두 하네스는 대국과 판 단위로 봇을 돌려 수치를 확인한다(smart 300판 ≈ 10분).

## 더 읽기

- [docs/DESIGN.md](docs/DESIGN.md) — 규칙·수치·구조
- [docs/HOOKS.md](docs/HOOKS.md) — 도파민 설계
- [CLAUDE.md](CLAUDE.md) — 작업 규칙
