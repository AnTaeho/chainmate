import { TitleScreen } from './title.js';
import { SelectScreen } from './select.js';
import { BattleScreen } from './battle.js';
import { RewardScreen } from './reward.js';
import { ChestScreen } from './chest.js';
import { LegendScreen } from './legend.js';
import { ShopScreen } from './shop.js';
import { PackScreen } from './pack.js';
import { ResultScreen } from './result.js';
import { PauseScreen } from './pause.js';
import { SettingsScreen } from './settings.js';

export const SCREENS = {
  title: TitleScreen,
  select: SelectScreen,
  battle: BattleScreen,
  reward: RewardScreen,
  chest: ChestScreen,
  legend: LegendScreen,
  shop: ShopScreen,
  pack: PackScreen,
  result: ResultScreen,
  pause: PauseScreen,
  settings: SettingsScreen,
};
