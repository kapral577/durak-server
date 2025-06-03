// durak-server/types/GameState.ts - ТОЛЬКО ИГРОВЫЕ ТИПЫ

// ✅ ВСЕ ТИПЫ ИМПОРТИРУЮТСЯ ИЗ SHARED
export {
  Card,
  Player,
  GameState,
  GameRules,
  TableCard,
  GameAction,
  AutoStartInfo
} from '../shared/types';

// ✅ СЕРВЕРНЫЕ РАСШИРЕНИЯ (ЕСЛИ НУЖНЫ)
import { GameState as BaseGameState } from '../shared/types';

export interface ServerGameState extends BaseGameState {
  // Серверная специфика, если нужна
  internalData?: any;
}

// ✅ ВСЁ ОСТАЛЬНОЕ УДАЛЕНО - ИСПОЛЬЗУЕМ SHARED ТИПЫ
