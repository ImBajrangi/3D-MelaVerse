import type {
  ArsenalModeId,
  DayNightCycleMode,
  FestivalWorldId,
  GameState,
  GulalColorId,
} from './rules';

export const RECOVERY_STORAGE_KEY = 'melaverse-session-recovery-v1';
export const RECOVERY_SAVE_INTERVAL_MS = 30_000;
export const RECOVERY_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface PlayerPositionSnapshot {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export interface SessionRecoverySnapshot {
  version: 1;
  gameState: 'playing' | 'paused';
  activeWorld: FestivalWorldId;
  playerPosition: PlayerPositionSnapshot;
  dayNightMode: DayNightCycleMode;
  selectedGulal: GulalColorId;
  selectedArsenal: ArsenalModeId;
  score: number;
  revelersSplashed: number;
  diyasLit: number;
  spiritPips: number;
  savedAt: number;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const VALID_WORLDS: FestivalWorldId[] = [
  'holi_braj',
  'diwali_ghat',
  'mela_central',
];
const VALID_DAY_NIGHT_MODES: DayNightCycleMode[] = [
  'auto',
  'dawn',
  'day',
  'dusk',
  'night',
];
const VALID_GULAL_COLORS: GulalColorId[] = ['gulabi', 'haldi', 'neel'];
const VALID_ARSENAL_MODES: ArsenalModeId[] = [
  'pichkari',
  'punch_kick',
  'balloon_throw',
  'hawai_rocket',
  'sutli_bomb',
];

export function isRecoverableGameState(
  state: unknown
): state is 'playing' | 'paused' {
  return state === 'playing' || state === 'paused';
}

export function shouldSaveRecoverySnapshot(state: GameState): boolean {
  return state === 'playing' || state === 'paused';
}

function clampFinite(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

export interface CreateRecoverySnapshotInput {
  gameState: GameState;
  activeWorld: FestivalWorldId;
  playerPosition: PlayerPositionSnapshot;
  dayNightMode?: DayNightCycleMode;
  selectedGulal?: GulalColorId;
  selectedArsenal?: ArsenalModeId;
  score?: number;
  revelersSplashed?: number;
  diyasLit?: number;
  spiritPips?: number;
  now?: number;
}

export function createRecoverySnapshot(
  input: CreateRecoverySnapshotInput
): SessionRecoverySnapshot | null {
  if (!isRecoverableGameState(input.gameState)) {
    return null;
  }

  const activeWorld = VALID_WORLDS.includes(input.activeWorld)
    ? input.activeWorld
    : 'holi_braj';

  const dayNightMode =
    input.dayNightMode && VALID_DAY_NIGHT_MODES.includes(input.dayNightMode)
      ? input.dayNightMode
      : 'auto';

  const selectedGulal =
    input.selectedGulal && VALID_GULAL_COLORS.includes(input.selectedGulal)
      ? input.selectedGulal
      : 'gulabi';

  const selectedArsenal =
    input.selectedArsenal && VALID_ARSENAL_MODES.includes(input.selectedArsenal)
      ? input.selectedArsenal
      : 'pichkari';

  const savedAt =
    typeof input.now === 'number' && Number.isFinite(input.now) && input.now > 0
      ? Math.round(input.now)
      : Date.now();

  return {
    version: 1,
    gameState: input.gameState,
    activeWorld,
    playerPosition: {
      x: Number(clampFinite(input.playerPosition.x, -60, 60, 0).toFixed(3)),
      y: Number(clampFinite(input.playerPosition.y, 0, 40, 0).toFixed(3)),
      z: Number(clampFinite(input.playerPosition.z, -60, 60, 6.5).toFixed(3)),
      yaw: Number(
        (Number.isFinite(input.playerPosition.yaw)
          ? input.playerPosition.yaw
          : Math.PI
        ).toFixed(4)
      ),
    },
    dayNightMode,
    selectedGulal,
    selectedArsenal,
    score: Math.max(0, Math.round(Number.isFinite(input.score ?? 0) ? (input.score ?? 0) : 0)),
    revelersSplashed: Math.max(
      0,
      Math.round(
        Number.isFinite(input.revelersSplashed ?? 0)
          ? (input.revelersSplashed ?? 0)
          : 0
      )
    ),
    diyasLit: Math.max(
      0,
      Math.round(Number.isFinite(input.diyasLit ?? 0) ? (input.diyasLit ?? 0) : 0)
    ),
    spiritPips: Math.max(
      1,
      Math.min(
        6,
        Math.round(
          Number.isFinite(input.spiritPips ?? 6) ? (input.spiritPips ?? 6) : 6
        )
      )
    ),
    savedAt,
  };
}

export function parseRecoverySnapshot(
  rawJson: string | null | undefined,
  now = Date.now()
): SessionRecoverySnapshot | null {
  if (!rawJson || typeof rawJson !== 'string') return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') return null;
  const record = parsed as Record<string, unknown>;

  if (record.version !== 1) return null;
  if (!isRecoverableGameState(record.gameState)) return null;
  if (
    typeof record.activeWorld !== 'string' ||
    !VALID_WORLDS.includes(record.activeWorld as FestivalWorldId)
  ) {
    return null;
  }

  const pos = record.playerPosition as Record<string, unknown> | undefined;
  if (!pos || typeof pos !== 'object') return null;
  if (
    typeof pos.x !== 'number' ||
    !Number.isFinite(pos.x) ||
    typeof pos.y !== 'number' ||
    !Number.isFinite(pos.y) ||
    typeof pos.z !== 'number' ||
    !Number.isFinite(pos.z) ||
    typeof pos.yaw !== 'number' ||
    !Number.isFinite(pos.yaw)
  ) {
    return null;
  }

  if (typeof record.savedAt !== 'number' || !Number.isFinite(record.savedAt) || record.savedAt <= 0) {
    return null;
  }

  const ageMs = now - record.savedAt;
  if (ageMs < -60_000 || ageMs > RECOVERY_MAX_AGE_MS) {
    return null;
  }

  return createRecoverySnapshot({
    gameState: record.gameState,
    activeWorld: record.activeWorld as FestivalWorldId,
    playerPosition: {
      x: pos.x,
      y: pos.y,
      z: pos.z,
      yaw: pos.yaw,
    },
    dayNightMode: record.dayNightMode as DayNightCycleMode | undefined,
    selectedGulal: record.selectedGulal as GulalColorId | undefined,
    selectedArsenal: record.selectedArsenal as ArsenalModeId | undefined,
    score: typeof record.score === 'number' ? record.score : 0,
    revelersSplashed:
      typeof record.revelersSplashed === 'number' ? record.revelersSplashed : 0,
    diyasLit: typeof record.diyasLit === 'number' ? record.diyasLit : 0,
    spiritPips: typeof record.spiritPips === 'number' ? record.spiritPips : 6,
    now: record.savedAt,
  });
}

function getDefaultStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function saveRecoverySnapshotToStorage(
  snapshot: SessionRecoverySnapshot,
  storage: StorageLike | null = getDefaultStorage()
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
}

export function loadRecoverySnapshotFromStorage(
  storage: StorageLike | null = getDefaultStorage(),
  now = Date.now()
): SessionRecoverySnapshot | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(RECOVERY_STORAGE_KEY);
    const parsed = parseRecoverySnapshot(raw, now);
    if (!parsed && raw !== null) {
      storage.removeItem(RECOVERY_STORAGE_KEY);
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearRecoverySnapshotFromStorage(
  storage: StorageLike | null = getDefaultStorage()
): void {
  if (!storage) return;
  try {
    storage.removeItem(RECOVERY_STORAGE_KEY);
  } catch {
    // Ignore storage access errors
  }
}

export function formatRecoveryAge(savedAt: number, now = Date.now()): string {
  const diffSec = Math.max(0, Math.floor((now - savedAt) / 1000));
  if (diffSec < 15) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
}
