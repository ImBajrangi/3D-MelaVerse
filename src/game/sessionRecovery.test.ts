import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RECOVERY_SAVE_INTERVAL_MS,
  RECOVERY_MAX_AGE_MS,
  RECOVERY_STORAGE_KEY,
  createRecoverySnapshot,
  parseRecoverySnapshot,
  saveRecoverySnapshotToStorage,
  loadRecoverySnapshotFromStorage,
  clearRecoverySnapshotFromStorage,
  shouldSaveRecoverySnapshot,
  formatRecoveryAge,
  type StorageLike,
} from './sessionRecovery';

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, val) => {
      map.set(key, val);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

test('RECOVERY_SAVE_INTERVAL_MS is strictly 30 seconds (30000ms)', () => {
  assert.equal(RECOVERY_SAVE_INTERVAL_MS, 30_000);
});

test('shouldSaveRecoverySnapshot returns true only for playing and paused states', () => {
  assert.equal(shouldSaveRecoverySnapshot('playing'), true);
  assert.equal(shouldSaveRecoverySnapshot('paused'), true);
  assert.equal(shouldSaveRecoverySnapshot('title'), false);
  assert.equal(shouldSaveRecoverySnapshot('gameover'), false);
});

test('createRecoverySnapshot validates coordinates, gameState, and world safely', () => {
  const titleSnap = createRecoverySnapshot({
    gameState: 'title',
    activeWorld: 'holi_braj',
    playerPosition: { x: 0, y: 0, z: 6.5, yaw: Math.PI },
    now: 1_700_000_000_000,
  });
  assert.equal(titleSnap, null);

  const validSnap = createRecoverySnapshot({
    gameState: 'playing',
    activeWorld: 'diwali_ghat',
    playerPosition: { x: 14.25, y: 1.5, z: -22.75, yaw: 1.2345 },
    dayNightMode: 'night',
    selectedGulal: 'haldi',
    selectedArsenal: 'hawai_rocket',
    score: 920,
    revelersSplashed: 7,
    diyasLit: 4,
    spiritPips: 5,
    now: 1_700_000_000_000,
  });

  assert.ok(validSnap);
  assert.equal(validSnap.gameState, 'playing');
  assert.equal(validSnap.activeWorld, 'diwali_ghat');
  assert.deepEqual(validSnap.playerPosition, {
    x: 14.25,
    y: 1.5,
    z: -22.75,
    yaw: 1.2345,
  });
  assert.equal(validSnap.score, 920);
  assert.equal(validSnap.diyasLit, 4);
});

test('parseRecoverySnapshot rejects malformed JSON, non-recoverable states, NaN positions, and expired saves', () => {
  const now = 1_700_000_000_000;

  assert.equal(parseRecoverySnapshot(null, now), null);
  assert.equal(parseRecoverySnapshot('{bad-json', now), null);
  assert.equal(
    parseRecoverySnapshot(
      JSON.stringify({
        version: 1,
        gameState: 'gameover',
        activeWorld: 'holi_braj',
        playerPosition: { x: 0, y: 0, z: 0, yaw: 0 },
        savedAt: now - 1000,
      }),
      now
    ),
    null
  );
  assert.equal(
    parseRecoverySnapshot(
      JSON.stringify({
        version: 1,
        gameState: 'playing',
        activeWorld: 'holi_braj',
        playerPosition: { x: null, y: 0, z: 0, yaw: 0 },
        savedAt: now - 1000,
      }),
      now
    ),
    null
  );
  assert.equal(
    parseRecoverySnapshot(
      JSON.stringify({
        version: 1,
        gameState: 'playing',
        activeWorld: 'holi_braj',
        playerPosition: { x: 2, y: 0, z: 4, yaw: 1 },
        savedAt: now - RECOVERY_MAX_AGE_MS - 5000,
      }),
      now
    ),
    null
  );
});

test('storage helpers round-trip, prune invalid entries, and clear cleanly', () => {
  const storage = createMemoryStorage();
  const now = 1_700_000_000_000;

  const snap = createRecoverySnapshot({
    gameState: 'paused',
    activeWorld: 'mela_central',
    playerPosition: { x: -12.5, y: 0.2, z: 18.4, yaw: 0.5 },
    score: 450,
    now,
  });
  assert.ok(snap);

  assert.equal(saveRecoverySnapshotToStorage(snap, storage), true);
  assert.ok(storage.getItem(RECOVERY_STORAGE_KEY));

  const loaded = loadRecoverySnapshotFromStorage(storage, now + 30_000);
  assert.ok(loaded);
  assert.equal(loaded.gameState, 'paused');
  assert.equal(loaded.activeWorld, 'mela_central');
  assert.equal(loaded.playerPosition.x, -12.5);
  assert.equal(loaded.playerPosition.z, 18.4);

  clearRecoverySnapshotFromStorage(storage);
  assert.equal(loadRecoverySnapshotFromStorage(storage, now + 30_000), null);

  // Corrupted entries are automatically purged on load
  storage.setItem(RECOVERY_STORAGE_KEY, '{"broken":true}');
  assert.equal(loadRecoverySnapshotFromStorage(storage, now), null);
  assert.equal(storage.getItem(RECOVERY_STORAGE_KEY), null);
});

test('formatRecoveryAge formats elapsed durations readably', () => {
  const now = 1_700_000_000_000;
  assert.equal(formatRecoveryAge(now - 5_000, now), 'Just now');
  assert.equal(formatRecoveryAge(now - 30_000, now), '30s ago');
  assert.equal(formatRecoveryAge(now - 180_000, now), '3m ago');
  assert.equal(formatRecoveryAge(now - 7_200_000, now), '2h ago');
});
