# 체인메이트 (Chainmate)

잡으면 그것이 된다 — 체스 기물 로그라이크 퍼즐.

## 실행

빌드 없이 바닐라 JS ES 모듈로 돈다.

```
npm run serve
```

브라우저로 http://localhost:8000 을 연다. 화면은 아직 만들지 않았다. 지금은 규칙 엔진과 하네스만 있다.

## 검증

```
npm test
node tools/sim.mjs --battles 300 --seed 1
node tools/run.mjs --runs 300 --policy smart|random|none --seed 1 --workers 10
```

`npm test`는 전부 통과해야 한다. 두 하네스는 대국과 판 단위로 봇을 돌려 수치를 확인한다(smart 300판 ≈ 10분).

## 더 읽기

- [docs/DESIGN.md](docs/DESIGN.md) — 규칙·수치·구조
- [docs/HOOKS.md](docs/HOOKS.md) — 도파민 설계
- [CLAUDE.md](CLAUDE.md) — 작업 규칙
