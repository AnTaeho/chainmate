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

## 결과(2026-10-25, `claude/clip-finish`)
| 커밋 | 내용 |
|---|---|
| 02e179a · 5f2ba56 → efd1e6b | smoke · `test/accountui.test.js` 계정 흐름 기다림을 고쳤다가 되돌렸다 — 같은 고침이 `claude/brave-bohr-r74efm`(93ba3c0 · 312c2f4)에 있어 그 브랜치를 합쳤다(05a0306) |
| 2d6cc85 | `placement.js` 'below': 위 · 아래 어디에도 다 안 들어갈 때(clip 직전)만 가리킨 것 옆(오른쪽 +3, 안 되면 왼쪽 −3). 그 쪽 자리가 176보다 좁으면 150(`NOTE_MIN_W`)까지 좁혀 `remeasure`로 다시 잰다. 세로는 가리킨 것의 윗변, 누를 것을 덮으면 가리킨 것과 겹치는 데까지 올린다. smoke 자리 검사에 `beside-right` · `beside-left`, `test/render.test.js`에 넷 |
| f968574 | `battle.js` `headSpec`: 굵게 「세력 · 종류」 → 굵게 「세력 · 짧은 종류」 → **굵게 세력 이름만** → 보통 굵기 「세력 · 종류」 |
| 88f8a12 | `layout.md` 5절 표 · 잘린 글 검사 · 머리 칸 줄 |

### 고른 것 · 버린 것(시안 `docs/shots/clip/`, before = 고치기 전)
- **도감 명경기 말풍선** — `before-en-codex-*` · `after-en-codex-*`.
  - 고른 안: 옆에 세우기. 왼쪽 열(Immortal · Evergreen)은 오른쪽 176, 오른쪽 열(Century)은 왼쪽 176, 가운데 열(Opera · March of Eight)은 양옆이 176에 모자라 오른쪽 160. 다섯 모두 조각 세 줄까지 다 뜬다. 도감은 `COVER_OK`라 이웃 칸을 덮는 것은 괜찮고, 가리킨 칸은 그대로 보인다.
  - 버린 안 ①(before): 위 · 아래 넓은 쪽에서 자르기 — 조각 줄(「Second · Third」)이 「…」로 사라진다. 도감에서 그 줄이 곧 할 일이다.
  - 버린 안 ②: 폭 176만 허용 — 가운데 열 둘이 그대로 잘린다(−3에 그침).
  - 버린 안 ③: 아래 · 위에서 가로로 밀어 단추를 피하기 — Opera는 풀리지만 March of Eight(아래 122 · 위 95)은 못 푼다. 화살 없는 말풍선이 가리킨 칸과 어긋난 x에 떠 무엇을 말하는지 흐리다.
  - 에버그린 첫 시도(윗변 · 아랫변 맞춤 두 자리만)는 탭 · 「뒤로」 줄에 막혀 잘렸다 — 가리킨 것과 겹치는 데까지 1px씩 올리는 것으로 바꿨다.
- **대국 이름** — `before-en-battle-head-crop@3x` 「Peasants · Rated」(보통 굵기) · `after-en-battle-head-crop@3x` 「Peasants」(굵게).
  - 고른 안: 세력 이름만 굵게. 왼쪽 칸 제목 줄이 다른 화면 제목과 같은 굵기로 또렷하고, 「Win $3」(연습 $2)가 바로 위에서 종류를 말한다. 가리키면 세력 버릇 말풍선은 그대로.
  - 버린 안(before): 보통 굵기 「세력 · Rated」 — 제목이 점수 이름표보다 흐려 보이고 줄임으로 센다.
  - ko는 「농민군 · 정식 대국」이 굵게 들어가 바뀌지 않는다.

### 잘린 글 수(smoke 원문)
```
잘린 글 9(… 4 · 줄임 5 · 글자 끊김 0) · 허용 4 · 보류 0 · 목록 밖 0 — en
잘린 글 1(… 1 · 줄임 0 · 글자 끊김 0) · 허용 1 · 보류 0 · 목록 밖 0 — ko
```
남은 en 9: 명경기 이름 「…」 4(격언 칸 98 — 실제 이름을 지킨다) · 줄임 Pilgrimage · Vanguard · Rainbow · Obsidian · The Opera Game(이름 · 칸 폭 — 그대로). ko 1: 상점 「사냥 시너지 8」(`families.js` 효과 글 — 손대지 않음).

### 검증(원문)
아래는 `claude/brave-bohr-r74efm`을 합치기 전에 잰 것. 합친 뒤(05a0306, 꽉 채움 기본 · 배율 3.23)에 다시 잰 것은 맨 아래 「합친 뒤」.
- `npm test`: `# tests 905 · # pass 905 · # fail 0`(계정 시험 대기를 고친 뒤 — 고치기 전에는 `test/accountui.test.js` 둘이 혼자 돌려도 `# fail 2`)
- `node tools/drawcheck.mjs`: `합계: 프레임 23032 · 건너뜀 4738 (21%) · 어김 0`
- `node tools/drawcheck.mjs --scale 1280x720 --fit fill`: `합계: 프레임 23031 · 건너뜀 4738 (21%) · 어김 0`
- smoke en: `자리 규칙: 가리킨 것 1329(판 틀 1258 · 판 밖 71, 화면 10) · 어김 0 · … · 누를 것 덮음 0 · 안 뜸 0 · … · 잘림(…) 0` · `글 넘침 0(…) · 잰 프레임 48426` · `한 수 연출(×1, 멈칫 포함) … 최대 3.94s`
- smoke ko: `자리 규칙: 가리킨 것 1362 · 어김 0 · … · 잘림(…) 1 (shop fam 1)` · `글 넘침 0(…) · 잰 프레임 48483`
- **smoke 둘 다 `SMOKE FAIL`, 까닭은 「프레임 p99가 16ms를 넘는다」 하나뿐**: en `p99 16.96ms`(혼자 다시 돌림, 부하 2), ko `p99 17.40ms`. 같은 기기에서 고치기 전 코드(`handoff/clip` + smoke 계정 대기만)도 `p99 16.95ms`로 FAIL — 이 4코어 클라우드 기기의 바닥값이다. 넘겨받는 사람의 기기에서 `SMOKE OK`를 다시 확인해야 한다.

### 합친 뒤(05a0306)
- `npm test`: `# tests 915 · # pass 915 · # fail 0`
- smoke en: `잘린 글 9(… 4 · 줄임 5 · 글자 끊김 0) · 허용 4 · 보류 0 · 목록 밖 0 — en` · `자리 규칙: 가리킨 것 1328(판 틀 1258 · 판 밖 70, 화면 10) · 어�…` · 글 넘침 0 · 계정 흐름 모두 확인 · `p99 16.75ms` → SMOKE FAIL(p99만)
- smoke ko: `잘린 글 1(… 1 · 줄임 0 · 글자 끊김 0) · 허용 1 · 보류 0 · 목록 밖 0 — ko` · 글 넘침 0 · 계정 흐름 모두 확인 · `p99 16.96ms` → SMOKE FAIL(p99만)
- `node tools/drawcheck.mjs`: `합계: 프레임 23031 · 건너뜀 4738 (21%) · 어김 0`
- `node tools/drawcheck.mjs --scale 1280x720 --fit fill`: `합계: 프레임 23032 · 건너뜀 4737 (21%) · 어김 0`
