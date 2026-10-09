import { TitleScreen } from './title.js';
import { SelectScreen } from './select.js';
import { BattleScreen } from './battle.js';
import { RewardScreen } from './reward.js';
import { ChestScreen } from './chest.js';
import { LegendScreen } from './legend.js';
import { AwakenScreen } from './awaken.js';
import { ShopScreen } from './shop.js';
import { PackScreen } from './pack.js';
import { ResultScreen } from './result.js';
import { PauseScreen } from './pause.js';
import { SettingsScreen } from './settings.js';
import { SetupScreen } from './setup.js';
import { CodexScreen } from './codex.js';
import { RecordsScreen } from './records.js';
import { LessonScreen } from './lesson.js';
import { DraftScreen } from './draft.js';
import { LessonsScreen } from './lessons.js';
import { ScriptScreen } from './script.js';
import { MovesScreen } from './moves.js';
import { ReviewScreen } from './review.js';
import { RankScreen } from './rank.js';
import { LinkScreen } from './link.js';
import { AccountScreen } from './account.js';
import { HighlightScreen } from './highlight.js';

// 대국: 판의 대국이 대본 대국이면(첫 판 1관 연습, CHM-22) 대본 화면으로 — 화면 이름은 같은 battle
class BattleEntry {
  constructor(app, args) { return app.run && app.run.battle && app.run.battle.script ? new ScriptScreen(app, args) : new BattleScreen(app, args); }
}

export const SCREENS = {
  title: TitleScreen,
  select: SelectScreen,
  battle: BattleEntry,
  reward: RewardScreen,
  chest: ChestScreen,
  legend: LegendScreen,
  awaken: AwakenScreen,
  shop: ShopScreen,
  pack: PackScreen,
  result: ResultScreen,
  pause: PauseScreen,
  settings: SettingsScreen,
  setup: SetupScreen,
  codex: CodexScreen,
  records: RecordsScreen,
  lesson: LessonScreen,
  draft: DraftScreen,
  lessons: LessonsScreen,
  moves: MovesScreen,
  review: ReviewScreen,
  rank: RankScreen,
  link: LinkScreen,
  account: AccountScreen,
  highlight: HighlightScreen,
};
