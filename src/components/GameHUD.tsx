import React, { useState } from 'react';
import {
  ARSENAL_MODES,
  DIVINE_BLESSINGS,
  GULAL_WEAPONS,
  MELA_RIDES,
  calculatePlayerLevel,
  type ArsenalModeId,
  type FestivalWorldId,
  type GulalColorId,
} from '../game/rules';
import type { HudSnapshot } from '../game/MelaverseCanvas';
import type {
  CameraPerspectiveMode,
  RideId,
  MiniGameStallId,
} from '../store/useMelaStore';
import { ComboMultiplierBadge } from './ComboMultiplierBadge';
import { MinimapRadar } from './MinimapRadar';

interface GameHUDProps {
  hud: HudSnapshot;
  activeWorld: FestivalWorldId;
  festivalCoins: number;
  rewardTickets: number;
  totalXp: number;
  unlockedStampsCount: number;
  isMuted: boolean;
  showFps: boolean;
  cameraMode: CameraPerspectiveMode;
  mountedRide: RideId | null;
  hasVipPass: boolean;
  foodBoostMultiplier: number;
  foodBoostRemainingSec: number;
  onSelectGulal: (color: GulalColorId) => void;
  onSelectArsenal: (mode: ArsenalModeId) => void;
  onToggleMute: () => void;
  onToggleCameraMode: () => void;
  onTriggerFire: () => void;
  onTriggerShield: () => void;
  onTriggerKarmaHelp?: () => void;
  onBoardRide: (rideId: RideId) => void;
  onExitRide: () => void;
  onOpenStallModal: (stallId: MiniGameStallId) => void;
  onOpenSettings: () => void;
  onOpenRangoli: () => void;
  onOpenRhythm: () => void;
  onTriggerFireworks: () => void;
  onOpenCharacter: () => void;
  onOpenWorldAtlas: () => void;
  onOpenBlueprint: () => void;
  onPauseGame: () => void;
  onRestartRound: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  hud,
  activeWorld,
  festivalCoins,
  rewardTickets,
  totalXp,
  isMuted,
  showFps,
  cameraMode,
  mountedRide,
  hasVipPass,
  foodBoostMultiplier,
  foodBoostRemainingSec,
  onSelectArsenal,
  onToggleMute,
  onToggleCameraMode,
  onTriggerFire,
  onTriggerShield,
  onTriggerKarmaHelp,
  onBoardRide,
  onExitRide,
  onOpenStallModal,
  onOpenSettings,
  onOpenRangoli,
  onOpenRhythm,
  onTriggerFireworks,
  onOpenCharacter,
  onOpenWorldAtlas,
  onOpenBlueprint,
  onPauseGame,
  onRestartRound,
}) => {
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);
  const levelInfo = calculatePlayerLevel(totalXp);
  const activeArsenalSpec =
    ARSENAL_MODES[hud.selectedArsenal] ?? ARSENAL_MODES.pichkari;

  const worldTitle =
    activeWorld === 'holi_braj'
      ? 'Holi: Braj Courtyard'
      : activeWorld === 'diwali_ghat'
      ? 'Diwali: Deepotsav Ghat'
      : 'Mela Central Hub';

  const revelerPct = Math.min(
    100,
    Math.round((hud.revelersSplashed / Math.max(1, hud.targetRevelers)) * 100)
  );
  const diyaPct = Math.min(
    100,
    Math.round((hud.diyasLit / Math.max(1, hud.targetDiyas)) * 100)
  );
  const karmaPct = Math.min(
    100,
    Math.round(
      ((hud.karma?.karmaPoints ?? 0) / Math.max(1, hud.karma?.maxKarma ?? 100)) *
        100
    )
  );
  const activeDivineBlessingSpec = hud.karma?.activeBlessingId
    ? DIVINE_BLESSINGS[hud.karma.activeBlessingId]
    : null;
  const blessingRemainingPct =
    activeDivineBlessingSpec && hud.karma
      ? Math.min(
          100,
          Math.max(
            0,
            Math.round(
              (hud.karma.blessingRemainingSec /
                Math.max(1, hud.karma.blessingTotalSec)) *
                100
            )
          )
        )
      : 0;

  return (
    <div
      className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-3.5 md:p-4"
      aria-label="In-Game Festival HUD"
    >
      {/* Subtle Peripheral Screen Vignette when Spirit Pips are critically low */}
      {hud.spiritPips <= 1 && (
        <div
          className="fixed inset-0 pointer-events-none transition-opacity duration-300"
          style={{
            boxShadow: 'inset 0 0 90px rgba(225, 29, 72, 0.55)',
          }}
        />
      )}

      {/* CLEAN SOFT-MAGNET TARGET RETICLE OVERLAY */}
      {hud.magnetLockInfo && !howToPlayOpen && !mountedRide && (
        <div
          className="fixed pointer-events-none transition-transform duration-75 ease-out flex flex-col items-center"
          style={{
            left: `${hud.magnetLockInfo.screenX}%`,
            top: `${hud.magnetLockInfo.screenY}%`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <svg
            viewBox="0 0 56 56"
            className="w-11 h-11 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]"
            aria-hidden="true"
          >
            <circle
              cx="28"
              cy="28"
              r={18 - hud.magnetLockInfo.magnetStrength * 3}
              fill="none"
              stroke={
                hud.magnetLockInfo.kind === 'diya'
                  ? '#FBBF24'
                  : hud.magnetLockInfo.weaknessColor
                  ? GULAL_WEAPONS[hud.magnetLockInfo.weaknessColor].hex
                  : '#F43F5E'
              }
              strokeWidth="2.2"
              strokeDasharray="6 4"
            />
            <path
              d="M12 19 V12 H19 M37 12 H44 V19 M44 37 V44 H37 M19 44 H12 V37"
              fill="none"
              stroke="#FFFBEB"
              strokeWidth="2"
            />
            <circle cx="28" cy="28" r="2.5" fill="#FFFBEB" />
          </svg>

          <div
            className="mt-0.5 px-2 py-0.5 rounded border border-[#FDE68A]/65 text-[10px] font-mono font-bold text-[#FFFBEB] tracking-wide whitespace-nowrap shadow-[0_4px_10px_rgba(0,0,0,0.85)]"
            style={{ backgroundColor: 'rgba(20, 9, 7, 0.92)' }}
          >
            {hud.magnetLockInfo.label} · [{activeArsenalSpec.shortLabel.toUpperCase()}]
          </div>
        </div>
      )}

      {/* TOP PERIMETER ROW: Top-Left Player Wallet, Vitality & Goals + Top-Right Radar, FPS, Combo & Settings */}
      <div className="flex items-start justify-between gap-3">
        {/* Top-Left Cluster: Player Avatar, Mela Coins, Reward Tickets, Vitality, Goals & Karma */}
        <div
          className="px-3.5 py-2.5 rounded-lg border border-[#F59E0B]/40 shadow-[0_6px_20px_rgba(0,0,0,0.65)] w-full max-w-[345px]"
          style={{ backgroundColor: 'rgba(20, 9, 7, 0.92)' }}
        >
          {/* Player Avatar + Mela Coins + Reward Tickets + Camera Toggle */}
          <div
            className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-[#F59E0B]/25"
            data-testid="hud-wallet-bar"
          >
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg border border-[#FBBF24] flex items-center justify-center bg-[#3A1B15] text-[#FDE68A] font-bold text-xs shrink-0"
                title="Player Festival Avatar"
              >
                ॐ
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-mono font-bold tracking-wider text-[#FDE68A] uppercase">
                    {worldTitle}
                  </span>
                  {hasVipPass && (
                    <span className="px-1 py-0.2 rounded bg-[#10B981]/25 border border-[#10B981] text-[9px] font-mono font-bold text-[#6EE7B7]">
                      VIP
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2.5 text-[11px] font-mono font-bold">
                  <span
                    className="text-[#FBBF24] tabular-nums"
                    data-testid="hud-coins-value"
                  >
                    🪙 {Math.round(festivalCoins)} Coins
                  </span>
                  <span
                    className="text-[#38BDF8] tabular-nums"
                    data-testid="hud-tickets-value"
                  >
                    🎟️ {Math.round(rewardTickets)} Tickets
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1 pointer-events-auto">
              <span className="px-1.5 py-0.5 rounded bg-[#3A1B15] border border-[#F59E0B]/40 text-[9px] font-mono font-bold text-[#FFFBEB]">
                WAVE {hud.activeWave}/3 · LVL {levelInfo.level}
              </span>
              <button
                type="button"
                tabIndex={-1}
                data-testid="camera-mode-toggle"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleCameraMode();
                }}
                className="px-1.5 py-0.5 rounded bg-[#172554] hover:bg-[#1E3A8A] border border-[#38BDF8]/50 text-[9px] font-mono font-bold text-[#BAE6FD] cursor-pointer"
                title="Toggle 1st-Person / 3rd-Person Camera [V]"
              >
                {cameraMode === 'first_person' ? '1st Cam [V]' : '3rd Cam [V]'}
              </button>
            </div>
          </div>

          {/* 6 Discrete Lotus Vitality Pips */}
          <div
            className="flex items-center justify-between gap-2 mb-2"
            role="meter"
            aria-label="Utsav Spirit Vitality"
            aria-valuenow={hud.spiritPips}
            aria-valuemin={0}
            aria-valuemax={hud.maxSpiritPips}
          >
            <div className="flex items-center gap-1">
              {Array.from({ length: hud.maxSpiritPips }).map((_, idx) => {
                const isFull = idx < hud.spiritPips;
                const isTrailingDamaged =
                  !isFull && idx < Math.ceil(hud.spiritTrail);

                return (
                  <svg
                    key={idx}
                    viewBox="0 0 24 24"
                    className="w-4 h-4 shrink-0"
                    aria-hidden="true"
                  >
                    <path
                      d="M12 2 L16.5 9.5 L22 12 L17 18.5 L12 22 L7 18.5 L2 12 L7.5 9.5 Z"
                      fill={
                        isFull
                          ? '#E11D48'
                          : isTrailingDamaged
                          ? '#F59E0B'
                          : '#2A1410'
                      }
                      stroke="#FFFBEB"
                      strokeWidth={isFull ? '1.6' : '1.1'}
                      strokeOpacity={isFull ? '0.95' : '0.35'}
                    />
                  </svg>
                );
              })}
            </div>

            <span
              className="px-1.5 py-0.5 rounded border border-[#F59E0B]/30 bg-[#1A0B08] text-[9px] font-mono font-semibold text-[#FDE68A] shrink-0"
              data-testid="adaptive-difficulty-badge"
              data-adaptive-tier={hud.adaptiveDifficulty.tierId}
            >
              {hud.adaptiveDifficulty.label.split(' · ')[0]}{' '}
              {hud.adaptiveDifficulty.movementSpeedScale.toFixed(2)}× ·{' '}
              {hud.adaptiveDifficulty.accuracyPct}% ACC
            </span>
          </div>

          {foodBoostRemainingSec > 0 && (
            <div className="mb-2 px-2 py-0.5 rounded bg-[#10B981]/20 border border-[#10B981]/50 text-[10px] font-mono font-bold text-[#6EE7B7] flex items-center justify-between">
              <span>⚡ Chaat/Lassi Speed Boost ({foodBoostMultiplier.toFixed(2)}×)</span>
              <span>{Math.ceil(foodBoostRemainingSec)}s</span>
            </div>
          )}

          {/* 2 Clean, Visual Objective Progress Bars */}
          <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-[#F59E0B]/20">
            <div>
              <div className="flex items-center justify-between text-[10px] font-mono text-[#FFF8F0] mb-1">
                <span>REVELERS</span>
                <span className="font-bold text-[#FDA4AF]">
                  {hud.revelersSplashed}/{hud.targetRevelers}
                </span>
              </div>
              <div className="w-full h-1.5 bg-[#120705] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#E11D48] transition-all duration-200"
                  style={{ width: `${revelerPct}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-[10px] font-mono text-[#FFF8F0] mb-1">
                <span>DIYAS LIT</span>
                <span className="font-bold text-[#FDE68A]">
                  {hud.diyasLit}/{hud.targetDiyas}
                </span>
              </div>
              <div className="w-full h-1.5 bg-[#120705] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#F59E0B] transition-all duration-200"
                  style={{ width: `${diyaPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* KARMA & DIVINE BLESSINGS TRACKER */}
          <div
            className="mt-2 pt-1.5 border-t border-[#F59E0B]/20"
            data-testid="karma-hud-panel"
            data-karma-points={hud.karma?.karmaPoints ?? 0}
            data-karma-deeds={hud.karma?.totalPositiveDeeds ?? 0}
            data-active-blessing={hud.karma?.activeBlessingId ?? 'none'}
          >
            <div className="flex items-center justify-between text-[10px] font-mono mb-1">
              <div className="flex items-center gap-1.5">
                <span className="font-bold tracking-wider text-[#FBBF24]">
                  KARMA
                </span>
                <span className="text-[#FFF8F0]/80 text-[9px]">
                  {hud.karma?.diyasLitDeeds ?? 0} Diyas ·{' '}
                  {hud.karma?.npcsHelpedDeeds ?? 0} Elders
                </span>
              </div>
              <div className="flex items-center gap-1.5 pointer-events-auto">
                <span className="font-bold text-[#FDE68A] tabular-nums">
                  {hud.karma?.karmaPoints ?? 0}/{hud.karma?.maxKarma ?? 100}
                </span>
                {onTriggerKarmaHelp && (
                  <button
                    type="button"
                    tabIndex={-1}
                    title="Offer Seva / Help Nearest Festival Elder [T]"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onTriggerKarmaHelp();
                    }}
                    className="px-1.5 py-0.5 rounded bg-[#2A1410] hover:bg-[#3F1E18] border border-[#FBBF24]/50 text-[9px] font-mono font-bold text-[#FDE68A] transition-colors cursor-pointer"
                  >
                    Seva [T]
                  </button>
                )}
              </div>
            </div>

            <div className="w-full h-1.5 bg-[#120705] rounded-full overflow-hidden mb-1.5">
              <div
                className="h-full transition-all duration-200"
                style={{
                  width: `${karmaPct}%`,
                  backgroundColor: activeDivineBlessingSpec
                    ? activeDivineBlessingSpec.accentHex
                    : '#FBBF24',
                }}
              />
            </div>

            {activeDivineBlessingSpec && hud.karma ? (
              <div
                className="px-2 py-1 rounded border flex flex-col gap-1 transition-all duration-200"
                data-testid="divine-blessing-banner"
                data-blessing-id={activeDivineBlessingSpec.id}
                style={{
                  backgroundColor: 'rgba(18, 10, 7, 0.94)',
                  borderColor: activeDivineBlessingSpec.accentHex,
                  boxShadow: `0 0 12px ${activeDivineBlessingSpec.accentHex}55`,
                }}
              >
                <div className="flex items-center justify-between gap-1 text-[10px] font-mono">
                  <span
                    className="font-bold tracking-wide truncate"
                    style={{ color: activeDivineBlessingSpec.accentHex }}
                  >
                    ✦ {activeDivineBlessingSpec.shortTitle}
                  </span>
                  <span className="font-bold text-[#FFFBEB] tabular-nums shrink-0">
                    {hud.karma.blessingRemainingSec.toFixed(1)}s
                  </span>
                </div>
                <div className="w-full h-1 bg-[#120705] rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all duration-100"
                    style={{
                      width: `${blessingRemainingPct}%`,
                      backgroundColor: activeDivineBlessingSpec.accentHex,
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="text-[9px] font-mono text-[#FDE68A]/75 flex items-center justify-between">
                <span>Light Diyas or help Elders [E/T] for Divine Blessings</span>
                <span className="text-[#FBBF24] font-semibold">
                  {hud.karma?.blessingsGrantedCount ?? 0} Blessed
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Top-Right Cluster: Combo Multiplier + Minimap Radar + Score + Settings/Utility Controls */}
        <div className="flex items-start gap-2.5">
          <ComboMultiplierBadge
            combo={hud.combo}
            comboStreak={hud.comboStreak}
            comboTimerRatio={hud.comboTimerRatio}
          />

          <div className="hidden sm:block">
            <MinimapRadar
              playerX={hud.playerX}
              playerZ={hud.playerZ}
              playerYaw={hud.playerYaw}
              crowdPositions={hud.crowdPositions}
              fps={hud.fps}
              showFps={showFps}
            />
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <div
              className="px-3 py-1.5 rounded-lg border border-[#F59E0B]/40 shadow-[0_6px_20px_rgba(0,0,0,0.65)] flex items-center gap-3"
              style={{ backgroundColor: 'rgba(20, 9, 7, 0.92)' }}
            >
              <div>
                <div className="text-[9px] font-mono uppercase tracking-wider text-[#FDE68A]">
                  SCORE
                </div>
                <div
                  className="text-lg font-mono font-bold tabular-nums text-white leading-tight"
                  style={{ paintOrder: 'stroke fill' }}
                >
                  {Math.round(hud.score)}
                </div>
              </div>

              {showFps && (
                <div
                  className="border-l border-[#F59E0B]/25 pl-2.5"
                  data-testid="hud-fps-counter"
                >
                  <div className="text-[9px] font-mono uppercase tracking-wider text-[#6EE7B7]">
                    FPS
                  </div>
                  <div className="text-sm font-mono font-bold tabular-nums text-[#10B981] leading-tight">
                    {hud.fps}
                  </div>
                </div>
              )}
            </div>

            {/* Top-Right Utility Controls: Settings [O], Help [?], Mute [M], Pause [P], Restart [R] */}
            <div className="flex items-center gap-1.5 pointer-events-auto">
              <button
                type="button"
                tabIndex={-1}
                data-testid="open-settings-btn"
                aria-label="Graphics and Audio Settings (O)"
                title="Graphics & Audio Settings [O]"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onOpenSettings();
                }}
                className="h-9 px-2.5 rounded-lg border border-[#F59E0B]/45 text-[#FDE68A] hover:bg-[#3A1B15] flex items-center justify-center font-mono text-xs font-bold transition-colors cursor-pointer"
                style={{ backgroundColor: 'rgba(20, 9, 7, 0.92)' }}
              >
                ⚙ Settings
              </button>

              <button
                type="button"
                tabIndex={-1}
                aria-label="How to Play Guide"
                title="How to Play Guide [?]"
                onClick={(e) => {
                  e.currentTarget.blur();
                  setHowToPlayOpen((prev) => !prev);
                }}
                className={`h-9 px-2 rounded-lg border flex items-center justify-center font-mono text-xs font-bold transition-colors cursor-pointer ${
                  howToPlayOpen
                    ? 'bg-[#E11D48] border-white text-white'
                    : 'border-[#F59E0B]/45 text-[#FDE68A] hover:bg-[#3A1B15]'
                }`}
                style={
                  howToPlayOpen
                    ? undefined
                    : { backgroundColor: 'rgba(20, 9, 7, 0.92)' }
                }
              >
                ? Help
              </button>

              <button
                type="button"
                tabIndex={-1}
                aria-label={isMuted ? 'Unmute Audio (M)' : 'Mute Audio (M)'}
                title="Mute / Unmute Audio [M]"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleMute();
                }}
                className="w-9 h-9 rounded-lg border border-[#F59E0B]/40 flex items-center justify-center text-[#FFFBEB] hover:bg-[#3A1B15] transition-colors cursor-pointer"
                style={{ backgroundColor: 'rgba(20, 9, 7, 0.92)' }}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  {isMuted ? (
                    <path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6" />
                  ) : (
                    <path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                  )}
                </svg>
              </button>

              <button
                type="button"
                tabIndex={-1}
                aria-label="Pause Game (P or Escape)"
                title="Pause Game [P / Esc]"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onPauseGame();
                }}
                className="w-9 h-9 rounded-lg border border-[#F59E0B]/40 flex items-center justify-center text-[#FFFBEB] hover:bg-[#3A1B15] transition-colors cursor-pointer"
                style={{ backgroundColor: 'rgba(20, 9, 7, 0.92)' }}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                >
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              </button>

              <button
                type="button"
                tabIndex={-1}
                aria-label="Restart Celebration Round (R)"
                title="Restart Round [R]"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onRestartRound();
                }}
                className="w-9 h-9 rounded-lg border border-[#F59E0B]/40 flex items-center justify-center text-[#FFFBEB] hover:bg-[#3A1B15] transition-colors cursor-pointer"
                style={{ backgroundColor: 'rgba(20, 9, 7, 0.92)' }}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* VISUAL BEGINNER GUIDE MODAL (Opened via "? Help") */}
      {howToPlayOpen && (
        <div
          className="pointer-events-auto mx-auto my-auto max-w-xl w-full p-5 rounded-xl border border-[#FBBF24] shadow-[0_16px_45px_rgba(0,0,0,0.92)] text-[#FFFBEB]"
          style={{ backgroundColor: 'rgba(20, 9, 7, 0.97)' }}
          role="dialog"
          aria-label="How to Play Melaverse"
        >
          <div className="flex items-center justify-between border-b border-[#F59E0B]/30 pb-3 mb-4">
            <div>
              <h2 className="text-base font-bold text-[#FDE68A] tracking-wide">
                HOW TO PLAY — GRAND MELA RIDES, STALLS &amp; 5 WEAPONS
              </h2>
              <p className="text-xs text-[#FFF8F0]/80">
                WASD to walk · Space to fire · V for 1st/3rd camera · E to ride or play mini-games
              </p>
            </div>
            <button
              type="button"
              onClick={() => setHowToPlayOpen(false)}
              className="px-3 py-1 rounded bg-[#E11D48] hover:bg-[#BE123C] text-xs font-bold text-white cursor-pointer"
            >
              Resume
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-[#2A1410] border border-[#F59E0B]/35 space-y-1">
              <div className="font-mono font-bold text-[#FBBF24]">
                1. 5-MODE ARSENAL [1–5]
              </div>
              <p className="text-[#FFF8F0]/90 leading-relaxed">
                Press <strong>[1] Pichkari</strong>, <strong>[2] Punch/Kick</strong>,{' '}
                <strong>[3] Balloon Throw</strong>, <strong>[4] Hawai Rocket</strong>,
                or <strong>[5] Sutli Bomb</strong>!
              </p>
            </div>

            <div className="p-3 rounded-lg bg-[#2A1410] border border-[#F59E0B]/35 space-y-1">
              <div className="font-mono font-bold text-[#38BDF8]">
                2. MELA RIDES &amp; STALLS
              </div>
              <p className="text-[#FFF8F0]/90 leading-relaxed">
                Board the <strong>Giant Wheel</strong>, <strong>Carousel</strong>, or{' '}
                <strong>Columbus Boat</strong> in 1st-person, and win Tickets at{' '}
                <strong>Balloon Shoot</strong> &amp; <strong>Ring Toss</strong>!
              </p>
            </div>

            <div className="p-3 rounded-lg bg-[#2A1410] border border-[#F59E0B]/35 space-y-1">
              <div className="font-mono font-bold text-[#F43F5E]">
                3. PRIZE SHOP &amp; KARMA
              </div>
              <p className="text-[#FFF8F0]/90 leading-relaxed">
                Redeem Tickets at the <strong>Prize Shop</strong> for Chaat/Lassi
                speed boosts &amp; VIP Passes. Light 6 Diyas &amp; splash 12 Revelers!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM PERIMETER: Mounted Ride Banner + Context-Sensitive Prompt + Grand Mela Action Dock */}
      <div className="flex flex-col items-center gap-2">
        {/* Active 1st-Person Mounted Ride Banner */}
        {mountedRide && (
          <div
            data-testid="mounted-ride-banner"
            className="pointer-events-auto px-4 py-2 rounded-xl border border-[#FBBF24] shadow-[0_8px_24px_rgba(0,0,0,0.85)] flex items-center gap-3"
            style={{ backgroundColor: 'rgba(20, 9, 7, 0.96)' }}
          >
            <span className="text-xs font-mono font-bold text-[#FDE68A]">
              🎡 Riding{' '}
              {MELA_RIDES.find((r) => r.id === mountedRide)?.name ?? mountedRide}{' '}
              (1st-Person Cabin View)
            </span>
            <button
              type="button"
              data-testid="exit-ride-btn"
              onClick={onExitRide}
              className="px-3 py-1 rounded-lg bg-[#E11D48] hover:bg-[#BE123C] text-xs font-mono font-bold text-white cursor-pointer"
            >
              Exit Ride [Esc]
            </button>
          </div>
        )}

        {/* Context-Sensitive Proximity Prompt (`Press E to ...`) */}
        {hud.nearbyPrompt && !mountedRide && (
          <button
            type="button"
            data-testid="context-interaction-prompt"
            onClick={() => {
              const p = hud.nearbyPrompt;
              if (!p) return;
              if (p.type === 'ride') {
                onBoardRide(p.targetId as RideId);
              } else if (p.type === 'stall') {
                onOpenStallModal(p.targetId as MiniGameStallId);
              }
            }}
            className="pointer-events-auto px-3.5 py-1.5 rounded-lg border border-[#FBBF24] text-xs font-medium text-[#FFFBEB] shadow-[0_6px_18px_rgba(0,0,0,0.75)] flex items-center gap-2 cursor-pointer hover:bg-[#3A1B15]"
            style={{ backgroundColor: 'rgba(42, 18, 12, 0.95)' }}
          >
            <span className="px-1.5 py-0.5 rounded bg-[#F59E0B] text-[#180B08] font-mono font-bold text-xs">
              Press E
            </span>
            <span>{hud.nearbyPrompt.label}</span>
          </button>
        )}

        <div className="pointer-events-auto flex flex-col items-center">
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              setDockCollapsed((prev) => !prev);
            }}
            className="px-3 py-0.5 rounded-t-md border border-b-0 border-[#F59E0B]/40 text-[10px] font-mono text-[#FDE68A] hover:text-white transition-colors cursor-pointer"
            style={{ backgroundColor: 'rgba(20, 9, 7, 0.92)' }}
          >
            {dockCollapsed
              ? '▴ Rides, Stalls & Arsenal [H]'
              : '▾ Hide Dock [H]'}
          </button>

          {!dockCollapsed && (
            <div
              className="px-2.5 py-1.5 rounded-xl border border-[#F59E0B]/45 shadow-[0_10px_28px_rgba(0,0,0,0.85)] flex flex-col gap-1.5 items-center"
              style={{ backgroundColor: 'rgba(20, 9, 7, 0.94)' }}
            >
              {/* Row 1: Grand Mela Rides & Mini-Game Stalls Quick Bar */}
              <div className="flex flex-wrap items-center justify-center gap-1 pb-1 border-b border-[#F59E0B]/20 w-full">
                <span className="text-[9px] font-mono uppercase tracking-wider text-[#FDE68A]/75 mr-1 hidden sm:inline">
                  Rides (10🪙):
                </span>
                <button
                  type="button"
                  tabIndex={-1}
                  data-testid="ride-giant-wheel-btn"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onBoardRide('giant_wheel');
                  }}
                  className={`px-2 py-0.5 rounded border text-[10px] font-mono font-bold cursor-pointer transition-colors ${
                    mountedRide === 'giant_wheel'
                      ? 'bg-[#E11D48] border-white text-white'
                      : 'bg-[#2A1410] hover:bg-[#3F1E18] border-[#F59E0B]/40 text-[#FDE68A]'
                  }`}
                >
                  🎡 Giant Wheel
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  data-testid="ride-carousel-btn"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onBoardRide('carousel');
                  }}
                  className={`px-2 py-0.5 rounded border text-[10px] font-mono font-bold cursor-pointer transition-colors ${
                    mountedRide === 'carousel'
                      ? 'bg-[#E11D48] border-white text-white'
                      : 'bg-[#2A1410] hover:bg-[#3F1E18] border-[#F59E0B]/40 text-[#FDE68A]'
                  }`}
                >
                  🎠 Carousel
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  data-testid="ride-columbus-btn"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onBoardRide('columbus_boat');
                  }}
                  className={`px-2 py-0.5 rounded border text-[10px] font-mono font-bold cursor-pointer transition-colors ${
                    mountedRide === 'columbus_boat'
                      ? 'bg-[#E11D48] border-white text-white'
                      : 'bg-[#2A1410] hover:bg-[#3F1E18] border-[#F59E0B]/40 text-[#FDE68A]'
                  }`}
                >
                  ⛵ Columbus Boat
                </button>

                <div className="h-3.5 w-px bg-[#F59E0B]/25 mx-1 hidden sm:block" />

                <span className="text-[9px] font-mono uppercase tracking-wider text-[#38BDF8]/85 mr-1 hidden sm:inline">
                  Stalls:
                </span>
                <button
                  type="button"
                  tabIndex={-1}
                  data-testid="stall-balloon-shoot-btn"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onOpenStallModal('balloon_shoot');
                  }}
                  className="px-2 py-0.5 rounded bg-[#172554] hover:bg-[#1E3A8A] border border-[#38BDF8]/50 text-[10px] font-mono font-bold text-[#BAE6FD] cursor-pointer"
                >
                  🎈 Balloon Shoot
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  data-testid="stall-ring-toss-btn"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onOpenStallModal('ring_toss');
                  }}
                  className="px-2 py-0.5 rounded bg-[#172554] hover:bg-[#1E3A8A] border border-[#38BDF8]/50 text-[10px] font-mono font-bold text-[#BAE6FD] cursor-pointer"
                >
                  ⭕ Ring Toss
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  data-testid="stall-prize-shop-btn"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onOpenStallModal('prize_shop');
                  }}
                  className="px-2 py-0.5 rounded bg-[#065F46] hover:bg-[#047857] border border-[#10B981]/60 text-[10px] font-mono font-bold text-[#A7F3D0] cursor-pointer"
                >
                  🎁 Prize Shop ({Math.round(rewardTickets)}🎟️)
                </button>
              </div>

              {/* Row 2: 5 Festival Arsenal Buttons + Combat Triggers + Cultural Studios */}
              <div className="flex flex-wrap xl:flex-nowrap items-center justify-center gap-1">
                <div className="flex items-center gap-1">
                  {(
                    [
                      'pichkari',
                      'punch_kick',
                      'balloon_throw',
                      'hawai_rocket',
                      'sutli_bomb',
                    ] as ArsenalModeId[]
                  ).map((modeId) => {
                    const spec = ARSENAL_MODES[modeId];
                    const isSelected = hud.selectedArsenal === modeId;
                    return (
                      <button
                        key={modeId}
                        type="button"
                        tabIndex={-1}
                        title={`${spec.name}: ${spec.roleClue}`}
                        onClick={(e) => {
                          e.currentTarget.blur();
                          onSelectArsenal(modeId);
                        }}
                        className={`px-2 py-1 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                          isSelected
                            ? 'border-white bg-[#3A1B15] text-white shadow-[0_0_10px_rgba(251,191,36,0.3)]'
                            : 'border-[#F59E0B]/25 bg-[#160A07] text-[#FDE68A]/85 hover:border-[#F59E0B]/60'
                        }`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded flex items-center justify-center font-mono text-[10px] font-bold text-white shrink-0"
                          style={{ backgroundColor: spec.hex }}
                        >
                          {spec.key}
                        </span>
                        <span className="whitespace-nowrap">
                          {spec.shortLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="h-4 w-px bg-[#F59E0B]/25 hidden sm:block mx-0.5" />

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onTriggerFire();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#E11D48] hover:bg-[#BE123C] border border-[#FDA4AF]/60 text-[11px] font-bold text-white shadow-[0_4px_12px_rgba(225,29,72,0.4)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Fire {activeArsenalSpec.shortLabel} [Space]
                  </button>

                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onTriggerShield();
                    }}
                    className={`px-2 py-1 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      hud.shieldActive
                        ? 'bg-[#0284C7] border-[#7DD3FC] text-white'
                        : 'bg-[#172554] hover:bg-[#1E3A8A] border-[#38BDF8]/50 text-[#BAE6FD]'
                    }`}
                  >
                    {hud.shieldActive ? 'Shield ON' : 'Shield [Q]'}
                  </button>
                </div>

                <div className="h-4 w-px bg-[#F59E0B]/25 hidden sm:block mx-0.5" />

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onOpenRhythm();
                    }}
                    className="px-2 py-1 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] border border-[#7DD3FC]/40 text-[11px] font-semibold text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Dhol [F]
                  </button>

                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onOpenRangoli();
                    }}
                    className="px-2 py-1 rounded-lg bg-[#2A1410] hover:bg-[#3F1E18] border border-[#F59E0B]/40 text-[11px] font-medium text-[#FFFBEB] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Rangoli [G]
                  </button>

                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onTriggerFireworks();
                    }}
                    className="px-2 py-1 rounded-lg bg-[#B45309] hover:bg-[#D97706] border border-[#FDE68A]/50 text-[11px] font-semibold text-[#FFFBEB] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Fireworks
                  </button>

                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onOpenCharacter();
                    }}
                    className="px-2 py-1 rounded-lg bg-[#2A1410] hover:bg-[#3F1E18] border border-[#F59E0B]/40 text-[11px] font-medium text-[#FFFBEB] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Attire [C]
                  </button>

                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onOpenWorldAtlas();
                    }}
                    className="px-2 py-1 rounded-lg bg-[#2A1410] hover:bg-[#3F1E18] border border-[#F59E0B]/40 text-[11px] font-medium text-[#FFFBEB] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Worlds [K]
                  </button>

                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onOpenBlueprint();
                    }}
                    className="px-2 py-1 rounded-lg bg-[#2A1410] hover:bg-[#3F1E18] border border-[#F59E0B]/40 text-[11px] font-medium text-[#FDE68A] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Codex [B]
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
