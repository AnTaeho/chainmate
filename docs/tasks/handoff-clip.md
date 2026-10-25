# 잘린 글 줄이기 — 넘겨받기(2026-10-25)

브랜치 `worktree-agent-ae7706537b1a52dc6`(main 722b818 위). 푸시하지 않았다.

## 한 것
| 커밋 | 내용 |
|---|---|
| 952d0b3 | `parts-depth.js` `familyMoreTip`: 효과 줄을 `optLine`으로. 자리가 모자라면 효과 줄부터 빼고 시너지 이름 · 수는 모두 남긴다(ko · en 「시너지 +4」 「…」 없어짐) |
| 952d0b3 | `en.js` 「증원 환영」 Welcome Party → **Welcome Crew**(굵게 99 → 96, 격언 칸 98 안) |
| 952d0b3 | `en.js` 「같은 종류를 잇달아 잡을 때마다 배수 ×2」 Each same-kind take in a row: ×2 Mult → **Each same kind in a row: ×2 Mult**(말풍선 폭 100에서 3줄 → 2줄, 상점 「Hunt synergy 8」 「…」 없어짐) |
| 952d0b3 | `battle.js` `headSpec` 후보를 재는 폭 `LW − PAD_BOX·2`(96)를 그리는 폭 `LW − PX·2 − 세력 점 9`(95)로. 지금 결과는 같다 |
| a08d46f | `parts.js` 카드 이름 줄임 기록 폭을 실제 이름 폭(`nameW`)으로(Pilgrimage 94 → 68) |
| (이 커밋) | `layout.md` 「잘린 글 검사」 두 줄 · 이 파일 |

## 잘린 글 수(smoke 원문)
전:
```
잘린 글 2(… 2 · 줄임 0 · 글자 끊김 0) · 허용 2 · 보류 0 · 목록 밖 0 — ko
잘린 글 24(… 12 · 줄임 12 · 글자 끊김 0) · 허용 12 · 보류 0 · 목록 밖 0 — en
```
뒤:
```
잘린 글 1(… 1 · 줄임 0 · 글자 끊김 0) · 허용 1 · 보류 0 · 목록 밖 0 — ko
잘린 글 19(… 9 · 줄임 10 · 글자 끊김 0) · 허용 9 · 보류 0 · 목록 밖 0 — en
```
「…」 열둘은 원래 모두 `CLIP_OK` 안이었고 줄임은 설계상 허용(세기만)이다. `CLIP_OK`에 더해도 수는 줄지 않는다.

## 검증
- `npm test`: `# tests 901 · # pass 901 · # fail 0`
- `node tools/drawcheck.mjs`: `합계: 프레임 23030 · 건너뜀 4738 (21%) · 어김 0`
- smoke ko · en: 글 넘침 0, 한 수 연출 최대 3.94s. 둘 다 `SMOKE FAIL`인데 까닭은 「프레임 p99가 16ms를 넘는다」 하나뿐(부하 24에서 돌림, 87s ↔ 평소 41s). **조용할 때 따로 다시 돌려 OK를 확인해야 한다.**

## 남은 것(en 19)
- 명경기 이름 「…」 4: 격언 칸 98(CHM-40에서 실제 이름을 지키기로 함) — 그대로.
- 도감 명경기 말풍선 「…」 5: 세 열 · 두 줄, 자리 143 · 143 · 169 · 97 · 97 < 154 ~ 186. 글로는 못 줄인다. **사람 결정**: `placement.js` `placeNotes` 'below'에서 아래 · 위 어디에도 다 안 들어갈 때(clip 직전) 가리킨 것 옆(오른쪽, 안 되면 왼쪽)에 `avoid`를 피해 세우는 안. 도감은 `COVER_OK`라 이웃 칸을 덮어도 된다. 시안(전후 스크린샷)을 찍어 고르게 한다. 그러면 −5.
- 대국 이름 줄임 5(「Peasants · Rated」 굵게 113 · 보통 94 · 폭 95): **사람 결정**: 굵게 들어가지 않으면 세력 이름만 굵게(종류는 「이기면 $N」 알약이 말한다)로 후보 차례를 바꾸는 안. 바꾸면 −5. 지금은 보통 굵기 「세력 · Rated」.
- 줄임 Pilgrimage(68) · Vanguard(63, 1px) · Rainbow · Obsidian(55) · The Opera Game(98): 이름 · 칸 폭 — 그대로 두기를 권함.
- ko 1: 상점 「사냥 시너지 8」(사냥 세 효과가 각 3줄, 자리 154 < 168). ko 효과 글(`src/data/families.js`)을 한 줄 줄여야 풀린다 — 손대지 않았다.

## 다음 명령
```
npm test
node tools/smoke.mjs --verbose            # ko — 「잘린 글」 · 「글 검사」 · SMOKE OK
node tools/smoke.mjs --lang en --verbose  # en
node tools/drawcheck.mjs                  # 그리기를 바꿨으면, 따로
```
결정 시안용 스크린샷 스크립트는 `tools/shots-fragment-tip.mjs`를 본떠 도감 `codex:evergreen` · `codex:opera` · `codex:century`(en)를 가리켜 찍는다.
