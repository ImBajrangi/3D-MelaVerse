import { useState, useEffect, useCallback } from 'react';
import {
  createInitialKarmaState,
  type ArsenalModeId,
  type GameState,
  type GameOutcome,
  type FestivalWorldId,
  type GulalColorId,
} from './game/rules';
import {
  ATTIRE_PRESETS,
  DEFAULT_RANGOLI_GRID,
  type CharacterAttirePreset,
  type NpcCharacter,
} from './game/worldData';
import { MelaverseCanvas, type HudSnapshot } from './game/MelaverseCanvas';
import { TitleScreen } from './components/TitleScreen';
import { GameHUD } from './components/GameHUD';
import { RangoliModal } from './components/RangoliModal';
import { RhythmModal } from './components/RhythmModal';
import { CharacterModal } from './components/CharacterModal';
import { WorldAtlasModal } from './components/WorldAtlasModal';
import { BlueprintModal } from './components/BlueprintModal';
import { StatusModal } from './components/StatusModal';
import { melaverseAudio } from './game/audio';

export function App() {
  const [gameState, setGameState] = useState<GameState>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        return 'playing';
      }
    }
    return 'title';
  });

  const [outcome, setOutcome] = useState<GameOutcome>('none');
  const [activeWorld, setActiveWorld] = useState<FestivalWorldId>('holi_braj');
  const [selectedGulal, setSelectedGulal] = useState<GulalColorId>('gulabi');
  const [selectedArsenal, setSelectedArsenal] =
    useState<ArsenalModeId>('pichkari');
  const [attire, setAttire] = useState<CharacterAttirePreset>(ATTIRE_PRESETS[0]);
  const [rangoliGrid, setRangoliGrid] = useState<number[][]>(DEFAULT_RANGOLI_GRID);
  const [resetCounter, setResetCounter] = useState<number>(0);
  const [fireworksCount, setFireworksCount] = useState<number>(0);
  const [shieldTriggerCount, setShieldTriggerCount] = useState<number>(0);
  const [fireTriggerCount, setFireTriggerCount] = useState<number>(0);
  const [karmaOfferingCount, setKarmaOfferingCount] = useState<number>(0);

  // Progression & Currencies
  const [festivalCoins, setFestivalCoins] = useState<number>(350);
  const [totalXp, setTotalXp] = useState<number>(280);
  const [unlockedStamps, setUnlockedStamps] = useState<string[]>([
    'Brass Braj Pichkari & Bansuri Stamp',
  ]);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Overlay Modals
  const [rangoliOpen, setRangoliOpen] = useState<boolean>(false);
  const [rhythmOpen, setRhythmOpen] = useState<boolean>(false);
  const [characterOpen, setCharacterOpen] = useState<boolean>(false);
  const [worldAtlasOpen, setWorldAtlasOpen] = useState<boolean>(false);
  const [blueprintOpen, setBlueprintOpen] = useState<boolean>(false);
  const [activeNpc, setActiveNpc] = useState<NpcCharacter | null>(null);

  // Live HUD State Snapshot
  const [hud, setHud] = useState<HudSnapshot>({
    spiritPips: 6,
    maxSpiritPips: 6,
    spiritTrail: 6,
    score: 0,
    bestScore: 1250,
    combo: 1,
    comboStreak: 0,
    comboTimerRatio: 0,
    revelersSplashed: 0,
    targetRevelers: 12,
    diyasLit: 0,
    targetDiyas: 6,
    selectedGulal: 'gulabi',
    selectedArsenal: 'pichkari',
    cooldownPct: 0,
    dashCooldownPct: 0,
    shieldCooldownPct: 0,
    shieldActive: false,
    nearbyPrompt: null,
    activeWave: 1,
    activeBlessing: null,
    objectiveHint: 'Space/Click: Fire · [1-5] Pichkari / Kick / Throw / Rocket / Bomb',
    magnetLockInfo: null,
    adaptiveDifficulty: {
      tierId: 'balanced',
      label: 'SAMTULYA · BALANCED',
      accuracyPct: 60,
      movementSpeedScale: 1.05,
      reactionFrequencyScale: 1.08,
      maxConcurrentAttackers: 2,
    },
    karma: createInitialKarmaState(),
  });

  const [finalStats, setFinalStats] = useState({
    score: 0,
    bestScore: 1250,
    revelersSplashed: 0,
    targetRevelers: 12,
    diyasLit: 0,
    targetDiyas: 6,
    clearTimeSec: 0,
  });

  // Mirror game state to document.body.dataset.state
  useEffect(() => {
    document.body.dataset.state = gameState;
  }, [gameState]);

  const startGameplay = useCallback(() => {
    document.body.dataset.state = 'playing';
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setOutcome('none');
    setActiveNpc(null);
    setRangoliOpen(false);
    setRhythmOpen(false);
    setCharacterOpen(false);
    setWorldAtlasOpen(false);
    setBlueprintOpen(false);
    setGameState('playing');
  }, []);

  const restartRound = useCallback(() => {
    setResetCounter((c) => c + 1);
    startGameplay();
  }, [startGameplay]);

  const handleRewardEarned = useCallback(
    (coinsDelta: number, xpDelta: number, stamp?: string) => {
      setFestivalCoins((c) => c + coinsDelta);
      setTotalXp((x) => x + xpDelta);
      if (stamp) {
        setUnlockedStamps((prev) =>
          prev.includes(stamp) ? prev : [...prev, stamp]
        );
      }
    },
    []
  );

  const handleRoundEnd = useCallback(
    (
      roundOutcome: 'victory' | 'defeat',
      stats: {
        score: number;
        revelersSplashed: number;
        diyasLit: number;
        clearTimeSec: number;
      }
    ) => {
      document.exitPointerLock?.();
      setOutcome(roundOutcome);
      setFinalStats((prev) => ({
        score: stats.score,
        bestScore: Math.max(prev.bestScore, stats.score),
        revelersSplashed: stats.revelersSplashed,
        targetRevelers: 12,
        diyasLit: stats.diyasLit,
        targetDiyas: 6,
        clearTimeSec: stats.clearTimeSec,
      }));
      setGameState('gameover');
    },
    []
  );

  // Global keyboard shortcuts for Title Start, Pause, Fireworks, and Studio Drawers
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const anyDrawerOpen =
        rangoliOpen ||
        rhythmOpen ||
        characterOpen ||
        worldAtlasOpen ||
        blueprintOpen ||
        activeNpc !== null;

      if (gameState === 'title' && !anyDrawerOpen) {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          startGameplay();
        }
        return;
      }

      if (e.code === 'KeyM') {
        const nextMuted = melaverseAudio.toggleMute();
        setIsMuted(nextMuted);
      }

      if (anyDrawerOpen) return;

      if (gameState === 'playing') {
        if (e.code === 'Escape' || e.code === 'KeyP') {
          e.preventDefault();
          document.exitPointerLock?.();
          setFinalStats((prev) => ({
            ...prev,
            score: hud.score,
            revelersSplashed: hud.revelersSplashed,
            diyasLit: hud.diyasLit,
          }));
          setGameState('paused');
        } else if (e.code === 'KeyG') {
          e.preventDefault();
          setRangoliOpen(true);
        } else if (e.code === 'KeyF') {
          e.preventDefault();
          setRhythmOpen(true);
        } else if (e.code === 'KeyV') {
          e.preventDefault();
          setFireworksCount((c) => c + 1);
        } else if (e.code === 'KeyC') {
          e.preventDefault();
          setCharacterOpen(true);
        } else if (e.code === 'KeyK') {
          e.preventDefault();
          setWorldAtlasOpen(true);
        } else if (e.code === 'KeyB') {
          e.preventDefault();
          setBlueprintOpen(true);
        } else if (e.code === 'KeyR') {
          e.preventDefault();
          restartRound();
        }
      } else if (gameState === 'paused') {
        if (e.code === 'Escape' || e.code === 'KeyP') {
          e.preventDefault();
          setGameState('playing');
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    gameState,
    rangoliOpen,
    rhythmOpen,
    characterOpen,
    worldAtlasOpen,
    blueprintOpen,
    activeNpc,
    hud,
    startGameplay,
    restartRound,
  ]);

  const anySubModalOpen =
    rangoliOpen ||
    rhythmOpen ||
    characterOpen ||
    worldAtlasOpen ||
    blueprintOpen ||
    activeNpc !== null;

  // Pause 3D simulation while a studio modal is open so player cannot be hurt while painting Rangoli or playing Rhythm
  const effectiveCanvasGameState: GameState =
    gameState === 'playing' && anySubModalOpen ? 'paused' : gameState;

  return (
    <main
      className="relative w-screen h-screen overflow-hidden select-none"
      data-focus-fallback="true"
      tabIndex={-1}
    >
      {/* Isolated 3D WebGL Viewport Container */}
      <MelaverseCanvas
        gameState={effectiveCanvasGameState}
        activeWorld={activeWorld}
        selectedGulal={selectedGulal}
        selectedArsenal={selectedArsenal}
        attire={attire}
        rangoliGrid={rangoliGrid}
        resetCounter={resetCounter}
        fireworksCount={fireworksCount}
        shieldTriggerCount={shieldTriggerCount}
        fireTriggerCount={fireTriggerCount}
        karmaOfferingCount={karmaOfferingCount}
        onSelectGulal={setSelectedGulal}
        onSelectArsenal={setSelectedArsenal}
        onHudUpdate={setHud}
        onRewardEarned={handleRewardEarned}
        onOpenNpcDialogue={(npc) => setActiveNpc(npc)}
        onOpenWorldAtlas={() => setWorldAtlasOpen(true)}
        onRoundEnd={handleRoundEnd}
        onTogglePause={() =>
          setGameState((prev) => (prev === 'playing' ? 'paused' : 'playing'))
        }
      />

      {/* Title Screen Stage */}
      {gameState === 'title' && (
        <TitleScreen
          activeWorld={activeWorld}
          onStartGame={startGameplay}
          onOpenCharacterModal={() => setCharacterOpen(true)}
          onOpenBlueprintModal={() => setBlueprintOpen(true)}
          onSelectWorld={(w) => setActiveWorld(w)}
        />
      )}

      {/* Active Playing HUD */}
      {gameState !== 'title' && (
        <GameHUD
          hud={{ ...hud, selectedGulal, selectedArsenal }}
          activeWorld={activeWorld}
          festivalCoins={festivalCoins}
          totalXp={totalXp}
          unlockedStampsCount={unlockedStamps.length}
          isMuted={isMuted}
          onSelectGulal={setSelectedGulal}
          onSelectArsenal={(mode) => {
            setSelectedArsenal(mode);
            setFireTriggerCount((c) => c + 1);
          }}
          onToggleMute={() => setIsMuted(melaverseAudio.toggleMute())}
          onTriggerFire={() => setFireTriggerCount((c) => c + 1)}
          onTriggerShield={() => setShieldTriggerCount((c) => c + 1)}
          onTriggerKarmaHelp={() => setKarmaOfferingCount((c) => c + 1)}
          onOpenRangoli={() => setRangoliOpen(true)}
          onOpenRhythm={() => setRhythmOpen(true)}
          onTriggerFireworks={() => setFireworksCount((c) => c + 1)}
          onOpenCharacter={() => setCharacterOpen(true)}
          onOpenWorldAtlas={() => setWorldAtlasOpen(true)}
          onOpenBlueprint={() => setBlueprintOpen(true)}
          onPauseGame={() => {
            setFinalStats((prev) => ({
              ...prev,
              score: hud.score,
              revelersSplashed: hud.revelersSplashed,
              diyasLit: hud.diyasLit,
            }));
            setGameState('paused');
          }}
          onRestartRound={restartRound}
        />
      )}

      {/* Interactive Studio & Cultural Modals */}
      <RangoliModal
        isOpen={rangoliOpen}
        grid={rangoliGrid}
        onUpdateGrid={setRangoliGrid}
        onClaimReward={(coins, xp) => {
          handleRewardEarned(coins, xp, 'Symmetric Lotus Rangoli Stamp');
          setKarmaOfferingCount((c) => c + 1);
        }}
        onClose={() => setRangoliOpen(false)}
      />

      <RhythmModal
        isOpen={rhythmOpen}
        onClaimReward={(coins, xp, stamp) => {
          handleRewardEarned(coins, xp, stamp);
          setKarmaOfferingCount((c) => c + 1);
        }}
        onTriggerSkyFireworks={() => setFireworksCount((c) => c + 1)}
        onClose={() => setRhythmOpen(false)}
      />

      <CharacterModal
        isOpen={characterOpen}
        attire={attire}
        onChangeAttire={setAttire}
        onClose={() => setCharacterOpen(false)}
      />

      <WorldAtlasModal
        isOpen={worldAtlasOpen}
        activeWorld={activeWorld}
        unlockedStamps={unlockedStamps}
        onTravelToWorld={(sceneId, stampToAward) => {
          setActiveWorld(sceneId);
          handleRewardEarned(30, 50, stampToAward);
        }}
        onClose={() => setWorldAtlasOpen(false)}
      />

      <BlueprintModal
        isOpen={blueprintOpen}
        onClose={() => setBlueprintOpen(false)}
      />

      <StatusModal
        gameState={gameState}
        outcome={outcome}
        activeNpc={activeNpc}
        finalStats={finalStats}
        onResume={() => setGameState('playing')}
        onRestart={restartRound}
        onReturnToTitle={() => {
          setOutcome('none');
          setGameState('title');
        }}
        onCloseNpc={(npc) => {
          handleRewardEarned(npc.rewardCoins, npc.rewardXp, npc.stampUnlocked);
          setKarmaOfferingCount((c) => c + 1);
          setActiveNpc(null);
        }}
      />
    </main>
  );
}

export default App;
