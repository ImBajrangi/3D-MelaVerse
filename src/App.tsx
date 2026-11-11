import { useState, useEffect, useCallback } from 'react';
import {
  MELA_RIDES,
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
import type { AssetLoadProgress } from './game/assetLoader';
import {
  useMelaStore,
  type RideId,
  type MiniGameStallId,
} from './store/useMelaStore';
import { MelaverseCanvas, type HudSnapshot } from './game/MelaverseCanvas';
import { LoadingScreen } from './components/LoadingScreen';
import { TitleScreen } from './components/TitleScreen';
import { GameHUD } from './components/GameHUD';
import { BalloonShootModal } from './components/BalloonShootModal';
import { RingTossModal } from './components/RingTossModal';
import { PrizeShopModal } from './components/PrizeShopModal';
import { SettingsModal } from './components/SettingsModal';
import { MobileTouchControls } from './components/MobileTouchControls';
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

  // Zustand Persistent Economy, Ride, Stall, Graphics & Camera Store
  const coins = useMelaStore((s) => s.coins);
  const tickets = useMelaStore((s) => s.tickets);
  const totalXp = useMelaStore((s) => s.totalXp);
  const unlockedStamps = useMelaStore((s) => s.unlockedStamps);
  const activeFoodBoostMultiplier = useMelaStore(
    (s) => s.activeFoodBoostMultiplier
  );
  const activeFoodBoostRemainingSec = useMelaStore(
    (s) => s.activeFoodBoostRemainingSec
  );
  const hasVipPass = useMelaStore((s) => s.hasVipPass);
  const graphicsPreset = useMelaStore((s) => s.graphicsPreset);
  const showFps = useMelaStore((s) => s.showFps);
  const isMuted = useMelaStore((s) => s.isMuted);
  const setIsMuted = useMelaStore((s) => s.setIsMuted);
  const cameraMode = useMelaStore((s) => s.cameraMode);
  const toggleCameraMode = useMelaStore((s) => s.toggleCameraMode);
  const mountedRide = useMelaStore((s) => s.mountedRide);
  const mountRide = useMelaStore((s) => s.mountRide);
  const exitRide = useMelaStore((s) => s.exitRide);
  const activeStallModal = useMelaStore((s) => s.activeStallModal);
  const openStallModal = useMelaStore((s) => s.openStallModal);
  const mobileControlsVisible = useMelaStore((s) => s.mobileControlsVisible);
  const addCoins = useMelaStore((s) => s.addCoins);
  const addXp = useMelaStore((s) => s.addXp);
  const unlockStamp = useMelaStore((s) => s.unlockStamp);
  const addTickets = useMelaStore((s) => s.addTickets);
  const stepFoodBoostTimer = useMelaStore((s) => s.stepFoodBoostTimer);
  const equippedAttireId = useMelaStore((s) => s.equippedAttireId);
  const equippedTrailColorHex = useMelaStore((s) => s.equippedTrailColorHex);
  const equippedShieldSkin = useMelaStore((s) => s.equippedShieldSkin);
  const highScore = useMelaStore((s) => s.highScore);
  const updateHighScore = useMelaStore((s) => s.updateHighScore);

  const [assetLoadProgress, setAssetLoadProgress] = useState<AssetLoadProgress>({
    loadedItems: 5,
    totalItems: 5,
    progressPct: 100,
    currentStageLabel: 'Mela 3D World Ready',
    isComplete: true,
  });

  const [outcome, setOutcome] = useState<GameOutcome>('none');
  const [activeWorld, setActiveWorldState] =
    useState<FestivalWorldId>('holi_braj');
  const [worldTransitionBanner, setWorldTransitionBanner] = useState<
    string | null
  >(null);

  const setActiveWorld = useCallback((nextWorld: FestivalWorldId) => {
    setActiveWorldState((prev) => {
      if (prev !== nextWorld) {
        const label =
          nextWorld === 'holi_braj'
            ? 'Entering World 01: Holi — Braj (Sanctum Courtyard & Color Vats)'
            : nextWorld === 'diwali_ghat'
            ? 'Entering World 02: Diwali — Ghat (Sacred River, Diyas & Fireworks)'
            : 'Entering Mela Central Hub (Sanctum Plaza, Ride Grounds & Meena Bazaar)';
        setWorldTransitionBanner(label);
        window.setTimeout(() => {
          setWorldTransitionBanner(null);
        }, 2800);
      }
      return nextWorld;
    });
  }, []);
  const [selectedGulal, setSelectedGulal] = useState<GulalColorId>('gulabi');
  const [selectedArsenal, setSelectedArsenal] =
    useState<ArsenalModeId>('pichkari');
  const [attire, setAttire] = useState<CharacterAttirePreset>(
    () =>
      ATTIRE_PRESETS.find((p) => p.id === equippedAttireId) ?? ATTIRE_PRESETS[0]
  );
  const [rangoliGrid, setRangoliGrid] = useState<number[][]>(DEFAULT_RANGOLI_GRID);
  const [resetCounter, setResetCounter] = useState<number>(0);
  const [fireworksCount, setFireworksCount] = useState<number>(0);
  const [shieldTriggerCount, setShieldTriggerCount] = useState<number>(0);
  const [fireTriggerCount, setFireTriggerCount] = useState<number>(0);
  const [dashTriggerCount, setDashTriggerCount] = useState<number>(0);
  const [rhythmDiyaTriggerCount, setRhythmDiyaTriggerCount] =
    useState<number>(0);
  const [stampRangoliTriggerCount, setStampRangoliTriggerCount] =
    useState<number>(0);
  const [karmaOfferingCount, setKarmaOfferingCount] = useState<number>(0);
  const [jumpTriggerCount, setJumpTriggerCount] = useState<number>(0);
  const [interactTriggerCount, setInteractTriggerCount] = useState<number>(0);
  const [mobileMoveVec, setMobileMoveVec] = useState<{
    dx: number;
    dz: number;
    sprinting: boolean;
  }>({
    dx: 0,
    dz: 0,
    sprinting: false,
  });
  const [mobileLookDeltaYaw, setMobileLookDeltaYaw] = useState<number>(0);

  // Sync attire preset when equippedAttireId changes in Zustand store
  useEffect(() => {
    const matched = ATTIRE_PRESETS.find((p) => p.id === equippedAttireId);
    if (matched) {
      setAttire(matched);
    }
  }, [equippedAttireId]);

  // Overlay Modals
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
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
    gulalTankPct: 100,
    score: 0,
    bestScore: highScore,
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
    objectiveHint:
      '[Space/LMB] Fire Gulal · [Q/RMB] Lotus Shield · [Shift] Dash · [R] Diyas',
    magnetLockInfo: null,
    floatingCallout: null,
    adaptiveDifficulty: {
      tierId: 'balanced',
      label: 'SAMTULYA · BALANCED',
      accuracyPct: 60,
      movementSpeedScale: 1.05,
      reactionFrequencyScale: 1.08,
      maxConcurrentAttackers: 2,
    },
    karma: createInitialKarmaState(),
    playerX: 0,
    playerZ: 6.5,
    playerYaw: Math.PI,
    fps: 60,
    crowdPositions: [],
  });

  const [finalStats, setFinalStats] = useState({
    score: 0,
    bestScore: highScore,
    revelersSplashed: 0,
    targetRevelers: 12,
    diyasLit: 0,
    targetDiyas: 6,
    clearTimeSec: 0,
  });

  // Step food boost timer once per second while playing
  useEffect(() => {
    if (gameState !== 'playing' || activeFoodBoostRemainingSec <= 0) return;
    const timer = window.setInterval(() => {
      stepFoodBoostTimer(1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [gameState, activeFoodBoostRemainingSec, stepFoodBoostTimer]);

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
    setSettingsOpen(false);
    setRangoliOpen(false);
    setRhythmOpen(false);
    setCharacterOpen(false);
    setWorldAtlasOpen(false);
    setBlueprintOpen(false);
    openStallModal(null);
    setGameState('playing');
  }, [openStallModal]);

  const restartRound = useCallback(() => {
    exitRide();
    openStallModal(null);
    setResetCounter((c) => c + 1);
    startGameplay();
  }, [exitRide, openStallModal, startGameplay]);

  const handleRewardEarned = useCallback(
    (coinsDelta: number, xpDelta: number, stamp?: string) => {
      if (coinsDelta > 0) addCoins(coinsDelta);
      if (xpDelta > 0) addXp(xpDelta);
      if (stamp) unlockStamp(stamp);
    },
    [addCoins, addXp, unlockStamp]
  );

  const handleBoardRide = useCallback(
    (rideId: RideId) => {
      if (mountedRide === rideId) {
        exitRide();
        melaverseAudio.playUiClick();
        return;
      }
      const rideSpec = MELA_RIDES.find((r) => r.id === rideId);
      const boarded = mountRide(rideId, rideSpec?.ticketCostCoins ?? 10);
      if (boarded) {
        melaverseAudio.playCoinCollect();
      }
    },
    [mountedRide, exitRide, mountRide]
  );

  const handleExitRide = useCallback(() => {
    exitRide();
    melaverseAudio.playUiClick();
  }, [exitRide]);

  const handleOpenStallModal = useCallback(
    (stallId: MiniGameStallId) => {
      melaverseAudio.playUiClick();
      openStallModal(stallId);
    },
    [openStallModal]
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
      exitRide();
      updateHighScore(stats.score);
      setOutcome(roundOutcome);
      setFinalStats((prev) => ({
        score: stats.score,
        bestScore: Math.max(prev.bestScore, highScore, stats.score),
        revelersSplashed: stats.revelersSplashed,
        targetRevelers: 12,
        diyasLit: stats.diyasLit,
        targetDiyas: 6,
        clearTimeSec: stats.clearTimeSec,
      }));
      setGameState('gameover');
    },
    [exitRide, highScore, updateHighScore]
  );

  // Global keyboard shortcuts for Title Start, Camera Toggle [V], Settings [O], Pause, and Action Hotbar ([R] Rhythm & Diyas, [F] Fireworks, [G] Rangoli, [B] Blueprint, [C] Wardrobe)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const anyDrawerOpen =
        settingsOpen ||
        activeStallModal !== null ||
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
        if (e.code === 'Escape' && mountedRide) {
          e.preventDefault();
          exitRide();
          return;
        }
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
        } else if (e.code === 'KeyV') {
          e.preventDefault();
          melaverseAudio.playUiClick();
          toggleCameraMode();
        } else if (e.code === 'KeyO') {
          e.preventDefault();
          setSettingsOpen(true);
        } else if (e.code === 'KeyR') {
          e.preventDefault();
          setRhythmDiyaTriggerCount((c) => c + 1);
        } else if (e.code === 'KeyF') {
          e.preventDefault();
          setFireworksCount((c) => c + 1);
        } else if (e.code === 'KeyG') {
          e.preventDefault();
          setStampRangoliTriggerCount((c) => c + 1);
          setRangoliOpen(true);
        } else if (e.code === 'KeyC') {
          e.preventDefault();
          setCharacterOpen(true);
        } else if (e.code === 'KeyK') {
          e.preventDefault();
          setWorldAtlasOpen(true);
        } else if (e.code === 'KeyB') {
          e.preventDefault();
          setBlueprintOpen(true);
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
    settingsOpen,
    activeStallModal,
    rangoliOpen,
    rhythmOpen,
    characterOpen,
    worldAtlasOpen,
    blueprintOpen,
    activeNpc,
    mountedRide,
    hud,
    startGameplay,
    toggleCameraMode,
    exitRide,
    setIsMuted,
  ]);

  const anySubModalOpen =
    settingsOpen ||
    activeStallModal !== null ||
    rangoliOpen ||
    rhythmOpen ||
    characterOpen ||
    worldAtlasOpen ||
    blueprintOpen ||
    activeNpc !== null;

  // Pause 3D combat simulation while a studio or mini-game stall modal is open
  const effectiveCanvasGameState: GameState =
    gameState === 'playing' && anySubModalOpen ? 'paused' : gameState;

  return (
    <main
      className="relative w-screen h-screen overflow-hidden select-none"
      data-focus-fallback="true"
      tabIndex={-1}
    >
      {/* Themed Mela Asset Loader Overlay */}
      <LoadingScreen progress={assetLoadProgress} />

      {/* Isolated 3D WebGL Viewport Container */}
      <MelaverseCanvas
        gameState={effectiveCanvasGameState}
        activeWorld={activeWorld}
        selectedGulal={selectedGulal}
        selectedArsenal={selectedArsenal}
        attire={attire}
        equippedTrailColorHex={equippedTrailColorHex}
        equippedShieldSkin={equippedShieldSkin}
        rangoliGrid={rangoliGrid}
        resetCounter={resetCounter}
        fireworksCount={fireworksCount}
        shieldTriggerCount={shieldTriggerCount}
        fireTriggerCount={fireTriggerCount}
        dashTriggerCount={dashTriggerCount}
        rhythmDiyaTriggerCount={rhythmDiyaTriggerCount}
        stampRangoliTriggerCount={stampRangoliTriggerCount}
        karmaOfferingCount={karmaOfferingCount}
        jumpTriggerCount={jumpTriggerCount}
        interactTriggerCount={interactTriggerCount}
        graphicsPreset={graphicsPreset}
        cameraMode={cameraMode}
        mountedRide={mountedRide}
        foodBoostMultiplier={activeFoodBoostMultiplier}
        mobileMoveVec={mobileMoveVec}
        mobileLookDeltaYaw={mobileLookDeltaYaw}
        onSelectWorld={setActiveWorld}
        onSelectGulal={setSelectedGulal}
        onSelectArsenal={setSelectedArsenal}
        onHudUpdate={(snap) => {
          setHud(snap);
          if (snap.score > highScore) {
            updateHighScore(snap.score);
          }
          if (mobileLookDeltaYaw !== 0) {
            setMobileLookDeltaYaw(0);
          }
        }}
        onRewardEarned={handleRewardEarned}
        onOpenNpcDialogue={(npc) => setActiveNpc(npc)}
        onOpenWorldAtlas={() => setWorldAtlasOpen(true)}
        onBoardRide={handleBoardRide}
        onExitRide={handleExitRide}
        onOpenStallModal={handleOpenStallModal}
        onAssetLoadProgress={setAssetLoadProgress}
        onRoundEnd={handleRoundEnd}
        onTogglePause={() =>
          setGameState((prev) => (prev === 'playing' ? 'paused' : 'playing'))
        }
      />

      {/* Smooth World Portal / Stage Transition Banner */}
      {worldTransitionBanner && (
        <div
          data-testid="world-transition-banner"
          className="fixed top-16 left-1/2 -translate-x-1/2 z-40 pointer-events-none px-5 py-2 rounded-full bg-black/85 backdrop-blur-md border border-[#FBBF24] text-xs font-mono font-bold text-[#FFFBEB] shadow-[0_8px_28px_rgba(0,0,0,0.9)] flex items-center gap-2"
        >
          <span className="w-2 h-2 rounded-full bg-[#FBBF24] animate-ping" />
          <span>{worldTransitionBanner}</span>
        </div>
      )}

      {/* Title Screen Stage (Landing Menu State: isPlaying === false) */}
      {gameState === 'title' && (
        <TitleScreen
          activeWorld={activeWorld}
          onStartGame={startGameplay}
          onOpenCharacterModal={() => setCharacterOpen(true)}
          onOpenBlueprintModal={() => setBlueprintOpen(true)}
          onSelectWorld={(w) => setActiveWorld(w)}
        />
      )}

      {/* Active Playing HUD (Active Gameplay State: isPlaying === true) */}
      {gameState !== 'title' && (
        <GameHUD
          hud={{ ...hud, selectedGulal, selectedArsenal }}
          activeWorld={activeWorld}
          festivalCoins={coins}
          rewardTickets={tickets}
          totalXp={totalXp}
          unlockedStampsCount={unlockedStamps.length}
          isMuted={isMuted}
          showFps={showFps}
          cameraMode={cameraMode}
          mountedRide={mountedRide}
          hasVipPass={hasVipPass}
          foodBoostMultiplier={activeFoodBoostMultiplier}
          foodBoostRemainingSec={activeFoodBoostRemainingSec}
          onSelectWorld={setActiveWorld}
          onSelectGulal={setSelectedGulal}
          onSelectArsenal={(mode) => {
            setSelectedArsenal(mode);
            setFireTriggerCount((c) => c + 1);
          }}
          onToggleMute={() => {
            const next = melaverseAudio.toggleMute();
            setIsMuted(next);
          }}
          onToggleCameraMode={() => {
            melaverseAudio.playUiClick();
            toggleCameraMode();
          }}
          onTriggerFire={() => setFireTriggerCount((c) => c + 1)}
          onTriggerShield={() => setShieldTriggerCount((c) => c + 1)}
          onTriggerDash={() => setDashTriggerCount((c) => c + 1)}
          onTriggerRhythmDiyas={() => setRhythmDiyaTriggerCount((c) => c + 1)}
          onTriggerStampRangoli={() => setStampRangoliTriggerCount((c) => c + 1)}
          onTriggerKarmaHelp={() => setKarmaOfferingCount((c) => c + 1)}
          onBoardRide={handleBoardRide}
          onExitRide={handleExitRide}
          onOpenStallModal={handleOpenStallModal}
          onOpenSettings={() => setSettingsOpen(true)}
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

      {/* On-Screen Mobile Virtual Joystick & Action Controls */}
      {gameState === 'playing' && !anySubModalOpen && (
        <MobileTouchControls
          visible={mobileControlsVisible}
          onMoveVector={(dx, dz, sprinting) =>
            setMobileMoveVec({ dx, dz: -dz, sprinting })
          }
          onCameraLookDelta={(deltaYaw) =>
            setMobileLookDeltaYaw((prev) => prev + deltaYaw)
          }
          onJump={() => setJumpTriggerCount((c) => c + 1)}
          onInteract={() => setInteractTriggerCount((c) => c + 1)}
          onFire={() => setFireTriggerCount((c) => c + 1)}
          onToggleCamera={toggleCameraMode}
        />
      )}

      {/* Mini-Game 1: Balloon Shooting Stall Modal */}
      <BalloonShootModal
        isOpen={activeStallModal === 'balloon_shoot'}
        onAwardTickets={(ticketsWon, coinsBonus, xpBonus) => {
          addTickets(ticketsWon);
          handleRewardEarned(
            coinsBonus,
            xpBonus,
            'Gubbara Nishana Sharpshooter Stamp'
          );
          setKarmaOfferingCount((c) => c + 1);
        }}
        onClose={() => openStallModal(null)}
      />

      {/* Mini-Game 2: Physics Ring Toss Stall Modal */}
      <RingTossModal
        isOpen={activeStallModal === 'ring_toss'}
        onAwardTickets={(ticketsWon, coinsBonus, xpBonus) => {
          addTickets(ticketsWon);
          handleRewardEarned(
            coinsBonus,
            xpBonus,
            'Challa Pheko Ring Master Stamp'
          );
          setKarmaOfferingCount((c) => c + 1);
        }}
        onClose={() => openStallModal(null)}
      />

      {/* Mini-Game 3: Prize Shop & Chaat Bazaar Stall Modal */}
      <PrizeShopModal
        isOpen={activeStallModal === 'prize_shop'}
        onActivatePowerupBlessing={() => {
          setKarmaOfferingCount((c) => c + 1);
        }}
        onClose={() => openStallModal(null)}
      />

      {/* Graphics Quality, Camera & Spatial Audio Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      {/* Interactive Studio & Cultural Modals */}
      <RangoliModal
        isOpen={rangoliOpen}
        grid={rangoliGrid}
        onUpdateGrid={setRangoliGrid}
        onClaimReward={(coinsDelta, xpDelta) => {
          handleRewardEarned(
            coinsDelta,
            xpDelta,
            'Symmetric Lotus Rangoli Stamp'
          );
          setKarmaOfferingCount((c) => c + 1);
        }}
        onClose={() => setRangoliOpen(false)}
      />

      <RhythmModal
        isOpen={rhythmOpen}
        onClaimReward={(coinsDelta, xpDelta, stamp) => {
          handleRewardEarned(coinsDelta, xpDelta, stamp);
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
          exitRide();
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
