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
  onSelectWorld: (world: FestivalWorldId) => void;
  onSelectGulal: (color: GulalColorId) => void;
  onSelectArsenal: (mode: ArsenalModeId) => void;
  onToggleMute: () => void;
  onToggleCameraMode: () => void;
  onTriggerFire: () => void;
  onTriggerShield: () => void;
  onTriggerDash: () => void;
  onTriggerRhythmDiyas: () => void;
  onTriggerStampRangoli: () => void;
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
  onSelectWorld,
  onSelectArsenal,
  onToggleMute,
  onToggleCameraMode,
  onTriggerFire,
  onTriggerShield,
  onTriggerDash,
  onTriggerRhythmDiyas,
  onTriggerStampRangoli,
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
      ? 'World 01: Holi — Braj'
      : activeWorld === 'diwali_ghat'
      ? 'World 02: Diwali — Ghat'
      : 'Mela Central Hub';

  const revelerPct = Math.min(
    100,
    Math.round((hud.revelersSplashed / Math.max(1, hud.targetRevelers)) * 100)
  );
  const diyaPct = Math.min(
    100,
    Math.round((hud.diyasLit / Math.max(1, hud.targetDiyas)) * 100)
  );
  const gulalTankPct = Math.min(100, Math.max(0, Math.round(hud.gulalTankPct ?? 100)));
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
      data-testid="active-gameplay-hud"
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

      {/* CENTER-SCREEN DYNAMIC CROSSHAIR + FLOATING HIT/SCORE CALLOUTS */}
      {!howToPlayOpen && !mountedRide && (
        <div
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center gap-1.5"
          data-testid="center-crosshair-overlay"
        >
          <svg
            viewBox="0 0 36 36"
            className="w-7 h-7 opacity-80 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]"
            aria-hidden="true"
          >
            <circle
              cx="18"
              cy="18"
              r="9"
              fill="none"
              stroke="#FFFBEB"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
            <circle
              cx="18"
              cy="18"
              r="2"
              fill={GULAL_WEAPONS[hud.selectedGulal]?.hex ?? '#F43F5E'}
            />
          </svg>

          {/* Floating Hit / Score / Rhythm Callout */}
          {hud.floatingCallout && (
            <div
              key={hud.floatingCallout.id}
              data-testid="floating-hit-indicator"
              className="px-3 py-1 rounded-full bg-black/80 border border-white/25 text-xs font-mono font-bold tracking-wide shadow-[0_4px_16px_rgba(0,0,0,0.9)] animate-bounce whitespace-nowrap"
              style={{ color: hud.floatingCallout.colorHex }}
            >
              {hud.floatingCallout.text}
            </div>
          )}
        </div>
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

          <div className="mt-0.5 px-2 py-0.5 rounded bg-black/85 border border-white/20 text-[10px] font-mono font-bold text-[#FFFBEB] tracking-wide whitespace-nowrap shadow-[0_4px_10px_rgba(0,0,0,0.85)]">
            {hud.magnetLockInfo.label} · [
            {activeArsenalSpec.shortLabel.toUpperCase()}]
          </div>
        </div>
      )}

      {/* TOP PERIMETER ROW: Top-Left Player Wallet, World Switcher, Gulal Tank & Goals + Top-Right Radar, FPS, Combo & Settings */}
      <div className="flex items-start justify-between gap-3">
        {/* Top-Left Cluster: High-Contrast Glassmorphic HUD Panel */}
        <div
          className="px-3.5 py-2.5 rounded-xl bg-black/70 backdrop-blur-md border border-white/15 shadow-[0_8px_24px_rgba(0,0,0,0.75)] w-full max-w-[365px]"
          data-testid="hud-top-left-panel"
        >
          {/* Row 1: Player Avatar + Festival Joy / XP Level + Coins + Tickets + [ESC] Menu */}
          <div
            className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-white/15"
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
                  <span className="text-[11px] font-mono font-bold tracking-wider text-[#FFFBEB] uppercase">
                    {worldTitle}
                  </span>
                  <span
                    className="px-1.5 py-0.2 rounded bg-[#F59E0B]/20 border border-[#F59E0B]/50 text-[9px] font-mono font-bold text-[#FDE68A]"
                    data-testid="hud-xp-level"
                  >
                    JOY LVL {levelInfo.level}
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
              <button
                type="button"
                tabIndex={-1}
                data-testid="hud-esc-menu-btn"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onPauseGame();
                }}
                className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 border border-white/20 text-[9px] font-mono font-bold text-[#FFFBEB] cursor-pointer"
                title="Pause / World Menu [ESC]"
              >
                [ESC] Menu
              </button>
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

          {/* Row 2: Instant World Switcher Pills inside Active HUD */}
          <div className="flex items-center gap-1 mb-2 pointer-events-auto">
            {(
              [
                { id: 'holi_braj', label: '01: Holi Braj', color: 'bg-[#E11D48]' },
                {
                  id: 'diwali_ghat',
                  label: '02: Diwali Ghat',
                  color: 'bg-[#D97706]',
                },
                { id: 'mela_central', label: 'Mela Hub', color: 'bg-[#0284C7]' },
              ] as const
            ).map((w) => {
              const active = activeWorld === w.id;
              return (
                <button
                  key={w.id}
                  type="button"
                  tabIndex={-1}
                  data-testid={`hud-world-switch-${w.id}`}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onSelectWorld(w.id);
                  }}
                  className={`flex-1 py-1 px-1.5 rounded text-[9px] font-mono font-bold transition-colors cursor-pointer truncate ${
                    active
                      ? `${w.color} text-white border border-white/40`
                      : 'bg-white/5 hover:bg-white/15 text-[#FDE68A]/85 border border-white/10'
                  }`}
                >
                  {w.label}
                </button>
              );
            })}
          </div>

          {/* Row 3: 6 Discrete Lotus Vitality Pips + Gulal Tank Bar (Refills at Courtyard Color Vats) */}
          <div
            className="flex items-center justify-between gap-2 mb-1.5"
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
              className="px-1.5 py-0.5 rounded border border-white/15 bg-black/50 text-[9px] font-mono font-semibold text-[#FDE68A] shrink-0"
              data-testid="adaptive-difficulty-badge"
              data-adaptive-tier={hud.adaptiveDifficulty.tierId}
            >
              {hud.adaptiveDifficulty.label.split(' · ')[0]}{' '}
              {hud.adaptiveDifficulty.movementSpeedScale.toFixed(2)}× ·{' '}
              {hud.adaptiveDifficulty.accuracyPct}% ACC
            </span>
          </div>

          {/* Gulal Tank Bar (Refills at Courtyard Color Vats) */}
          <div className="mb-2" data-testid="gulal-tank-bar">
            <div className="flex items-center justify-between text-[9px] font-mono mb-0.5">
              <span className="text-[#FDA4AF] font-bold">
                GULAL TANK ({GULAL_WEAPONS[hud.selectedGulal]?.name.split(' ')[0]})
              </span>
              <span className="text-[#FFFBEB] font-bold tabular-nums">
                {gulalTankPct}% {gulalTankPct < 30 ? '· Refill at Color Vat!' : ''}
              </span>
            </div>
            <div className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden border border-white/10">
              <div
                className="h-full transition-all duration-150"
                style={{
                  width: `${gulalTankPct}%`,
                  backgroundColor:
                    GULAL_WEAPONS[hud.selectedGulal]?.hex ?? '#F43F5E',
                }}
              />
            </div>
          </div>

          {foodBoostRemainingSec > 0 && (
            <div className="mb-2 px-2 py-0.5 rounded bg-[#10B981]/20 border border-[#10B981]/50 text-[10px] font-mono font-bold text-[#6EE7B7] flex items-center justify-between">
              <span>
                ⚡ Chaat/Lassi Speed Boost ({foodBoostMultiplier.toFixed(2)}×)
              </span>
              <span>{Math.ceil(foodBoostRemainingSec)}s</span>
            </div>
          )}

          {/* 2 Clean, Visual Objective Progress Bars */}
          <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-white/15">
            <div>
              <div className="flex items-center justify-between text-[10px] font-mono text-[#FFF8F0] mb-1">
                <span>REVELERS JOY</span>
                <span className="font-bold text-[#FDA4AF]">
                  {hud.revelersSplashed}/{hud.targetRevelers}
                </span>
              </div>
              <div className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden">
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
              <div className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#F59E0B] transition-all duration-200"
                  style={{ width: `${diyaPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* KARMA & DIVINE BLESSINGS TRACKER */}
          <div
            className="mt-2 pt-1.5 border-t border-white/15"
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
                    className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 border border-[#FBBF24]/50 text-[9px] font-mono font-bold text-[#FDE68A] transition-colors cursor-pointer"
                  >
                    Seva [T]
                  </button>
                )}
              </div>
            </div>

            <div className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden mb-1">
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
                className="px-2 py-1 rounded border flex flex-col gap-1 transition-all duration-200 bg-black/80"
                data-testid="divine-blessing-banner"
                data-blessing-id={activeDivineBlessingSpec.id}
                style={{
                  borderColor: activeDivineBlessingSpec.accentHex,
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
                <div className="w-full h-1 bg-black/60 rounded-full overflow-hidden">
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
              <div className="text-[9px] font-mono text-[#FDE68A]/80 flex items-center justify-between">
                <span>Press [R] Rhythm Diyas or [E] Elders</span>
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
            <div className="px-3 py-1.5 rounded-xl bg-black/70 backdrop-blur-md border border-white/15 shadow-[0_6px_20px_rgba(0,0,0,0.65)] flex items-center gap-3">
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
                  className="border-l border-white/15 pl-2.5"
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

            {/* Top-Right Utility Controls: Settings [O], Help [?], Mute [M], Pause [ESC] */}
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
                className="h-9 px-2.5 rounded-lg bg-black/70 backdrop-blur-md border border-white/15 text-[#FDE68A] hover:bg-white/15 flex items-center justify-center font-mono text-xs font-bold transition-colors cursor-pointer"
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
                    : 'bg-black/70 backdrop-blur-md border-white/15 text-[#FDE68A] hover:bg-white/15'
                }`}
              >
                ? Help
              </button>

              <button
                type="button"
                tabIndex={-1}
                data-testid="hud-mute-toggle-btn"
                aria-label={isMuted ? 'Unmute Audio (M)' : 'Mute Audio (M)'}
                title="Mute / Unmute Audio [M]"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleMute();
                }}
                className="w-9 h-9 rounded-lg bg-black/70 backdrop-blur-md border border-white/15 flex items-center justify-center text-[#FFFBEB] hover:bg-white/15 transition-colors cursor-pointer"
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
                className="w-9 h-9 rounded-lg bg-black/70 backdrop-blur-md border border-white/15 flex items-center justify-center text-[#FFFBEB] hover:bg-white/15 transition-colors cursor-pointer"
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
                aria-label="Restart Celebration Round"
                title="Restart Round"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onRestartRound();
                }}
                className="w-9 h-9 rounded-lg bg-black/70 backdrop-blur-md border border-white/15 flex items-center justify-center text-[#FFFBEB] hover:bg-white/15 transition-colors cursor-pointer"
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
          className="pointer-events-auto mx-auto my-auto max-w-xl w-full p-5 rounded-xl bg-black/90 backdrop-blur-md border border-white/20 shadow-[0_16px_45px_rgba(0,0,0,0.92)] text-[#FFFBEB]"
          role="dialog"
          aria-label="How to Play Melaverse"
        >
          <div className="flex items-center justify-between border-b border-white/15 pb-3 mb-4">
            <div>
              <h2 className="text-base font-bold text-[#FDE68A] tracking-wide">
                HOW TO PLAY — 3 FESTIVAL WORLDS &amp; ACTION HOTBAR
              </h2>
              <p className="text-xs text-[#FFF8F0]/80">
                WASD to walk · Space/LMB Fire · Q/RMB Lotus Shield · Shift Dash · R Rhythm Diyas · F Fireworks · G Rangoli
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
            <div className="p-3 rounded-lg bg-white/5 border border-white/15 space-y-1">
              <div className="font-mono font-bold text-[#F43F5E]">
                1. HOLI — BRAJ
              </div>
              <p className="text-[#FFF8F0]/90 leading-relaxed">
                Fire Gulal <strong>[Space/Click]</strong> to splash ground decals &amp; fill NPC Joy Bars. Summon <strong>[Q] Lotus Shield</strong> (3s dome + speed boost on block) &amp; refill at Color Vats!
              </p>
            </div>

            <div className="p-3 rounded-lg bg-white/5 border border-white/15 space-y-1">
              <div className="font-mono font-bold text-[#FBBF24]">
                2. DIWALI — GHAT
              </div>
              <p className="text-[#FFF8F0]/90 leading-relaxed">
                Explore the stepped riverside ghat! Press <strong>[R] Rhythm &amp; Diyas</strong> on the beat to light clay diyas &amp; floating river lamps, and <strong>[F] Fireworks</strong> for multi-stage shells!
              </p>
            </div>

            <div className="p-3 rounded-lg bg-white/5 border border-white/15 space-y-1">
              <div className="font-mono font-bold text-[#38BDF8]">
                3. MELA CENTRAL HUB
              </div>
              <p className="text-[#FFF8F0]/90 leading-relaxed">
                Board the <strong>[E] Giant Wheel</strong> gondola, play Balloon &amp; Ring Toss stalls, and press <strong>[G] Rangoli</strong> to stamp glowing geometric mandalas onto the tiles!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM PERIMETER: Mounted Ride Banner + Context-Sensitive Prompt + Action Hotbar */}
      <div className="flex flex-col items-center gap-2">
        {/* Active 1st-Person Mounted Ride Banner */}
        {mountedRide && (
          <div
            data-testid="mounted-ride-banner"
            className="pointer-events-auto px-4 py-2 rounded-xl bg-black/80 backdrop-blur-md border border-[#FBBF24] shadow-[0_8px_24px_rgba(0,0,0,0.85)] flex items-center gap-3"
          >
            <span className="text-xs font-mono font-bold text-[#FDE68A]">
              🎡 Riding{' '}
              {MELA_RIDES.find((r) => r.id === mountedRide)?.name ?? mountedRide}{' '}
              · Drag Mouse or A/D to Look 360° (+50 Joy XP)
            </span>
            <button
              type="button"
              data-testid="exit-ride-btn"
              onClick={onExitRide}
              className="px-3 py-1 rounded-lg bg-[#E11D48] hover:bg-[#BE123C] text-xs font-mono font-bold text-white cursor-pointer"
            >
              [E / Esc] Exit Gondola
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
              } else if (p.type === 'portal') {
                onSelectWorld(p.targetId as FestivalWorldId);
              }
            }}
            className="pointer-events-auto px-3.5 py-1.5 rounded-lg bg-black/80 backdrop-blur-md border border-[#FBBF24] text-xs font-medium text-[#FFFBEB] shadow-[0_6px_18px_rgba(0,0,0,0.75)] flex items-center gap-2 cursor-pointer hover:bg-white/15"
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
            className="px-3 py-0.5 rounded-t-md bg-black/70 backdrop-blur-md border border-b-0 border-white/15 text-[10px] font-mono text-[#FDE68A] hover:text-white transition-colors cursor-pointer"
          >
            {dockCollapsed
              ? '▴ Show Action Hotbar & Mela Dock [H]'
              : '▾ Hide Dock [H]'}
          </button>

          {!dockCollapsed && (
            <div
              className="px-3 py-2 rounded-xl bg-black/70 backdrop-blur-md border border-white/15 shadow-[0_10px_28px_rgba(0,0,0,0.85)] flex flex-col gap-2 items-center"
              data-testid="bottom-action-hotbar"
            >
              {/* Row 1: Primary 7-Slot Action Hotbar with Cooldown Overlays */}
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                {/* 1. [Space/LMB] Fire Gulal */}
                <button
                  type="button"
                  tabIndex={-1}
                  data-testid="hotbar-fire-gulal"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onTriggerFire();
                  }}
                  className="relative overflow-hidden px-3 py-1.5 rounded-lg bg-black/80 hover:bg-[#E11D48]/30 border border-[#FDA4AF]/50 text-xs font-mono font-bold text-white flex items-center gap-1.5 cursor-pointer"
                >
                  <div
                    className="absolute inset-y-0 left-0 bg-[#E11D48]/35 pointer-events-none transition-all duration-75"
                    style={{ width: `${100 - hud.cooldownPct}%` }}
                  />
                  <span className="relative px-1.5 py-0.5 rounded bg-[#E11D48] text-[10px] text-white font-bold">
                    Space/LMB
                  </span>
                  <span className="relative">Fire Gulal ({gulalTankPct}%)</span>
                </button>

                {/* 2. [Q/RMB] Lotus Shield (3s active / 6s cooldown) */}
                <button
                  type="button"
                  tabIndex={-1}
                  data-testid="hotbar-lotus-shield"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onTriggerShield();
                  }}
                  className={`relative overflow-hidden px-3 py-1.5 rounded-lg border text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer ${
                    hud.shieldActive
                      ? 'bg-[#E11D48]/40 border-[#FBBF24] text-[#FFFBEB] shadow-[0_0_12px_rgba(244,63,94,0.6)]'
                      : 'bg-black/80 hover:bg-white/10 border-white/20 text-[#FDE68A]'
                  }`}
                >
                  <div
                    className="absolute inset-y-0 left-0 bg-[#F43F5E]/30 pointer-events-none transition-all duration-75"
                    style={{ width: `${100 - hud.shieldCooldownPct}%` }}
                  />
                  <span className="relative px-1.5 py-0.5 rounded bg-[#F43F5E] text-[10px] text-white font-bold">
                    Q/RMB
                  </span>
                  <span className="relative">
                    {hud.shieldActive
                      ? 'Lotus Shield (3s)'
                      : hud.shieldCooldownPct > 0
                      ? `Shield (${Math.ceil((hud.shieldCooldownPct / 100) * 6)}s)`
                      : 'Lotus Shield'}
                  </span>
                </button>

                {/* 3. [Shift] Dash */}
                <button
                  type="button"
                  tabIndex={-1}
                  data-testid="hotbar-dash"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onTriggerDash();
                  }}
                  className="relative overflow-hidden px-3 py-1.5 rounded-lg bg-black/80 hover:bg-white/10 border border-white/20 text-xs font-mono font-bold text-[#FDE68A] flex items-center gap-1.5 cursor-pointer"
                >
                  <div
                    className="absolute inset-y-0 left-0 bg-[#F59E0B]/30 pointer-events-none transition-all duration-75"
                    style={{ width: `${100 - hud.dashCooldownPct}%` }}
                  />
                  <span className="relative px-1.5 py-0.5 rounded bg-[#D97706] text-[10px] text-white font-bold">
                    Shift
                  </span>
                  <span className="relative">Dash</span>
                </button>

                {/* 4. [R] Rhythm & Diyas */}
                <button
                  type="button"
                  tabIndex={-1}
                  data-testid="hotbar-rhythm-diyas"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onTriggerRhythmDiyas();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-black/80 hover:bg-[#F59E0B]/25 border border-[#FBBF24]/50 text-xs font-mono font-bold text-[#FDE68A] flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="px-1.5 py-0.5 rounded bg-[#F59E0B] text-[10px] text-[#1C0D0A] font-bold">
                    R
                  </span>
                  <span>Rhythm &amp; Diyas</span>
                </button>

                {/* 5. [F] Fireworks */}
                <button
                  type="button"
                  tabIndex={-1}
                  data-testid="hotbar-fireworks"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onTriggerFireworks();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-black/80 hover:bg-[#A855F7]/25 border border-[#C084FC]/50 text-xs font-mono font-bold text-[#F3E8FF] flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="px-1.5 py-0.5 rounded bg-[#9333EA] text-[10px] text-white font-bold">
                    F
                  </span>
                  <span>Fireworks</span>
                </button>

                {/* 6. [G] Rangoli (Stamp + Studio) */}
                <button
                  type="button"
                  tabIndex={-1}
                  data-testid="hotbar-rangoli"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onTriggerStampRangoli();
                    onOpenRangoli();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-black/80 hover:bg-[#10B981]/25 border border-[#34D399]/50 text-xs font-mono font-bold text-[#D1FAE5] flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="px-1.5 py-0.5 rounded bg-[#10B981] text-[10px] text-[#052E16] font-bold">
                    G
                  </span>
                  <span>Rangoli</span>
                </button>

                {/* 7. [B] Blueprint */}
                <button
                  type="button"
                  tabIndex={-1}
                  data-testid="hotbar-blueprint"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onOpenBlueprint();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-black/80 hover:bg-white/15 border border-white/20 text-xs font-mono font-bold text-[#FDE68A] flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="px-1.5 py-0.5 rounded bg-white/20 text-[10px] text-white font-bold">
                    B
                  </span>
                  <span>Blueprint</span>
                </button>
              </div>

              {/* Row 2: Grand Mela Rides, Stalls, Arsenal [1-5] & Wardobe/Atlas Quick Bar */}
              <div className="flex flex-wrap items-center justify-center gap-1 pt-1.5 border-t border-white/15 w-full">
                <span className="text-[9px] font-mono uppercase tracking-wider text-[#FDE68A]/75 mr-0.5 hidden sm:inline">
                  Rides:
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
                      : 'bg-black/60 hover:bg-white/15 border-white/15 text-[#FDE68A]'
                  }`}
                >
                  🎡 Giant Wheel [E]
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
                      : 'bg-black/60 hover:bg-white/15 border-white/15 text-[#FDE68A]'
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
                      : 'bg-black/60 hover:bg-white/15 border-white/15 text-[#FDE68A]'
                  }`}
                >
                  ⛵ Columbus Boat
                </button>

                <div className="h-3.5 w-px bg-white/15 mx-0.5 hidden sm:block" />

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

                <div className="h-3.5 w-px bg-white/15 mx-0.5 hidden sm:block" />

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
                      className={`px-1.5 py-0.5 rounded border text-[10px] font-mono font-semibold transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                        isSelected
                          ? 'border-white bg-white/20 text-white'
                          : 'border-white/10 bg-black/50 text-[#FDE68A]/80 hover:border-white/30'
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded flex items-center justify-center font-mono text-[9px] font-bold text-white shrink-0"
                        style={{ backgroundColor: spec.hex }}
                      >
                        {spec.key}
                      </span>
                      <span className="hidden md:inline">{spec.shortLabel}</span>
                    </button>
                  );
                })}

                <div className="h-3.5 w-px bg-white/15 mx-0.5 hidden sm:block" />

                <button
                  type="button"
                  tabIndex={-1}
                  data-testid="hud-open-character-btn"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onOpenCharacter();
                  }}
                  className="px-2 py-0.5 rounded bg-black/60 hover:bg-white/15 border border-white/15 text-[10px] font-mono font-bold text-[#FFFBEB] cursor-pointer"
                >
                  👕 Attire [C]
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onOpenRhythm();
                  }}
                  className="px-2 py-0.5 rounded bg-black/60 hover:bg-white/15 border border-white/15 text-[10px] font-mono text-[#BAE6FD] cursor-pointer"
                >
                  🥁 Dhol Studio
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onOpenWorldAtlas();
                  }}
                  className="px-2 py-0.5 rounded bg-black/60 hover:bg-white/15 border border-white/15 text-[10px] font-mono text-[#FDE68A] cursor-pointer"
                >
                  🗺️ 12 Worlds [K]
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
