// 첫 판 대본 대국의 걸음과 킹의 말(CHM-22, docs/design-notes/tutorial.md). 판 · 손 · 증원은 src/data/tutorial.js.
// 대국 화면(screens/script.js)이 걸음마다 누를 곳 하나만 밝히고, 킹이 그 곁에서 한두 문장으로 말한다. 규칙은 실제 대국 그대로.
//   pick   손에서 그 종류를 든다          drop  그 칸에 떨군다        cap  그 적을 먹는다
//   discard 희생 단추                   moves 「행마」 단추(행마 보기가 열리면 넘어간다)
//   ok     「알겠어」로 넘어간다(target: 가리킬 구역 id, sq: 가리킬 칸) · okLabel 단추 글
//   try    이 걸음부터 대국 복사본에서 둔다(한 번 끊겨 보기) · rewind 「되돌리기」로 복사본을 버리고 진짜 대국으로
//   end    대국이 끝난 뒤 킹의 마지막 말(joy: 금관이 반짝인다) — 누르면 평소의 막간(보상 · 상점)으로
//   move   몇째 수의 걸음인가(0부터, 이어 하기로 돌아왔을 때 그 수의 첫 걸음부터)
import { parseSq } from '../sim/board.js';

export const TUTORIAL_STEPS = [
  // ① 떨구기 · 먹기 · 갈아입기 · 잇기 · 점수
  { move: 0, ok: true, target: 'hand:0', say: '나는 킹. 첫 대국은 내가 알려 줄게. 이미 안다면 건너뛰어도 돼' },
  { move: 0, pick: 'N', say: '손에 있는 나이트를 골라 봐' },
  { move: 0, drop: 'b2', say: '빛나는 칸에 놓아 봐. 거기서 룩을 먹을 수 있어' },
  { move: 0, cap: 'a4', say: '룩을 먹어 봐. 먹으면 룩으로 변해' },
  { move: 0, cap: 'a8', say: '이제 넌 룩이야. 곧게 미끄러져서 퀸까지 먹어' },
  { move: 0, ok: true, target: 'goal', say: '먹은 값 × 배수가 점수야. 막대가 목표까지 차면 이겨' },
  // ② 지키는 적 · 끊김: 한 번 끊겨 보고 되돌려 순서대로
  { move: 1, pick: 'N', try: true, say: '저 룩은 비숍이 지키고 있어. 룩부터 먹어 보자' },
  { move: 1, drop: 'b1', say: '여기에 놓아 봐' },
  { move: 1, cap: 'c3', say: '룩을 먹어 봐' },
  { move: 1, ok: true, sq: 'e1', okLabel: '되돌리기', rewind: true, say: '그 칸은 비숍이 지키고 있었어. 룩 모습으로는 비숍을 못 먹어서 끊겼어' },
  { move: 1, pick: 'N', say: '다시 해 보자. 이번엔 지키는 비숍부터' },
  { move: 1, drop: 'g2', say: '비숍을 먹을 수 있는 칸이야' },
  { move: 1, cap: 'e1', say: '비숍을 먹어 봐' },
  { move: 1, cap: 'c3', say: '지키던 비숍이 없으니까 사슬이 이어져' },
  // ③ 증원 그림자 · 행마 보기
  { move: 2, ok: true, sq: 'd6', say: '▼ 그림자는 증원이야. 이 수가 끝나면 그 칸에 적이 들어와' },
  { move: 2, moves: true, say: '처음 보는 기물이 있네. 「행마」를 눌러 봐' },
  { move: 2, pick: 'R', say: '이제 룩을 골라 봐' },
  { move: 2, drop: 'h1', say: '놓아 봐. 곧게 가면 나이트가 있어' },
  { move: 2, cap: 'h2', say: '나이트를 먹고' },
  { move: 2, cap: 'g4', say: '폰까지 먹어' },
  // ④ 희생 · 목표
  { move: 3, pick: 'P', say: '폰은 놓을 곳이 없네. 폰을 골라 봐' },
  { move: 3, discard: true, say: '희생해 봐. 희생한 폰은 이번 대국에 안 돌아와' },
  { move: 3, pick: 'B', say: '새로 뽑은 비숍을 골라 봐. 이걸로 곧바로 메이트하면 탁월수야' },
  { move: 3, drop: 'c3', say: '놓아 봐' },
  { move: 3, cap: 'e5', say: '폰을 먹어 봐' },
  { move: 3, cap: 'd6', say: '들어온 퀸이 노리고 있어. 퀸부터 먹어' },
  { move: 3, end: true, ok: true, joy: true, target: 'goal', say: '목표 달성! 이제 혼자 해 봐' },
];

// 칸 이름 → 칸 번호(걸음의 drop · cap · sq)
export const stepSq = (st) => parseSq(st.drop || st.cap || st.sq);
// 몇째 수의 첫 걸음(이어 하기)
export const firstStepOf = (move) => Math.max(0, TUTORIAL_STEPS.findIndex((s) => s.move === move && !s.rewind));
