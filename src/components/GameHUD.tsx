import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Flame,
  Shield,
  Volume2,
  VolumeX,
  Compass,
  Award,
  Zap,
  Music,
  Heart,
  Droplets,
  Wind,
  Crosshair,
  Ticket,
  Coins,
  FerrisWheel,
  Palette,
  Eye,
  Shirt,
  Sun,
  Sunrise,
  Sunset,
  Moon,
  Clock,
  Sliders,
  Menu,
  X,
  Grid,
  Camera,
} from 'lucide-react';
import {
  GULAL_WEAPONS,
  ARSENAL_MODES,
  MELA_RIDES,
  MELA_STALLS,
  calculatePlayerLevel,
  type ArsenalModeId,
  type FestivalWorldId,
  type GulalColorId,
  type DayNightCycleMode,
} from '../game/rules';
import {
  type RideId,
  type MiniGameStallId,
  type CameraPerspectiveMode,
} from '../store/useMelaStore';
import type { HudSnapshot } from '../game/MelaverseCanvas';
import { MinimapRadar } from './MinimapRadar';

export interface GameHUDProps {
  hud: HudSnapshot;
  activeWorld: FestivalWorldId;
  dayNightMode: DayNightCycleMode;
  onChangeDayNightMode: (mode: DayNightCycleMode) => void;
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
  onTriggerKarmaHelp: () => void;
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
  isPhotoMode?: boolean;
  isHudHidden?: boolean;
  onTogglePhotoMode?: () => void;
  onToggleHudHidden?: () => void;
}

const WORLD_PILLS: { id: FestivalWorldId; shortLabel: string; color: string }[] = [
  { id: 'holi_braj', shortLabel: 'Holi — Braj', color: '#ff2a85' },
  { id: 'diwali_ghat', shortLabel: 'Diwali — Ghat', color: '#ffaa00' },
  { id: 'mela_central', shortLabel: 'Mela Hub', color: '#00f5d4' },
];

const ARSENAL_SLOTS: {
  id: ArsenalModeId;
  key: string;
  label: string;
  sub: string;
  swatch: string;
}[] = [
  { id: 'pichkari', key: '1', label: 'Pichkari Jet', sub: 'Homing Stream', swatch: '#ff1e56' },
  { id: 'punch_kick', key: '2', label: 'Punch & Kick', sub: 'Spin Kick', swatch: '#ffaa00' },
  { id: 'balloon_throw', key: '3', label: 'Gubbara', sub: 'Splash Arc', swatch: '#00f5d4' },
  { id: 'hawai_rocket', key: '4', label: 'Hawai Rocket', sub: 'Sky Pyro', swatch: '#9b5de5' },
  { id: 'sutli_bomb', key: '5', label: 'Sutli Bomb', sub: 'Shockwave', swatch: '#10b981' },
];

const GULAL_COLORS: GulalColorId[] = ['gulabi', 'haldi', 'neel'];

export const GameHUD: React.FC<GameHUDProps> = ({
  hud,
  activeWorld,
  dayNightMode,
  onChangeDayNightMode,
  festivalCoins,
  rewardTickets,
  totalXp,
  isMuted,
  showFps,
  cameraMode,
  mountedRide,
  onSelectWorld,
  onSelectGulal,
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
  isPhotoMode,
  isHudHidden,
  onTogglePhotoMode,
  onToggleHudHidden,
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [wheelOpen, setWheelOpen] = useState(false);
  const [wheelTab, setWheelTab] = useState<'rides' | 'weapons' | 'attire' | 'dhol'>('rides');

  const gulalBarRef = useRef<HTMLDivElement | null>(null);
  const joyPctRef = useRef<HTMLSpanElement | null>(null);

  const activeWorldMeta =
    WORLD_PILLS.find((w) => w.id === activeWorld) ?? WORLD_PILLS[0];
  const levelInfo = calculatePlayerLevel(totalXp);

  const joyProgressPct =
    activeWorld === 'diwali_ghat'
      ? Math.round((hud.diyasLit / Math.max(1, hud.targetDiyas)) * 100)
      : Math.round((hud.revelersSplashed / Math.max(1, hud.targetRevelers)) * 100);

  // Direct DOM ref update for progress bar width
  useEffect(() => {
    if (gulalBarRef.current) {
      gulalBarRef.current.style.width = `${Math.min(
        100,
        Math.max(4, hud.gulalTankPct)
      )}%`;
    }
    if (joyPctRef.current) {
      joyPctRef.current.textContent = `${Math.round(hud.gulalTankPct)}% · ${joyProgressPct}%`;
    }
  }, [hud.gulalTankPct, joyProgressPct]);

  // Toggle Slide-Out Drawer on [Tab] key
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        setDrawerOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (isHudHidden) {
    return (
      <div className="fixed top-4 right-4 z-40">
        <button
          type="button"
          onClick={onToggleHudHidden}
          className="px-3 py-1.5 rounded-full bg-black/80 backdrop-blur-md border border-white/20 text-xs text-amber-400 hover:text-white flex items-center gap-1.5 transition-colors shadow-xl pointer-events-auto"
          title="Restore Festival HUD [H]"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Show HUD [H]</span>
        </button>
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-2.5 sm:p-3.5 select-none overflow-hidden">
      {/* ─── TOP BAR: 1 COMPACT LEFT PILL (MAX-WIDTH 220PX) + COMPACT RIGHT RADAR ─── */}
      <div className="flex items-start justify-between gap-2 w-full">
        <div className="flex items-start gap-2">
          {/* Compact Left Pill (max-width: 220px) */}
          <div
            data-testid="hud-top-left-panel"
            className="pointer-events-auto w-[220px] max-w-[224px] rounded-2xl border border-amber-400/30 bg-[#090612]/80 backdrop-blur-md px-3 py-2 shadow-xl"
          >
            {/* Row 1: Current World Title + Photo [P] + Menu [Tab] Toggle */}
            <div className="flex items-center justify-between gap-1 mb-1.5">
              <div className="flex items-center gap-1 min-w-0">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: activeWorldMeta.color }}
                />
                <h1
                  data-testid="hud-festival-title"
                  className="font-display text-[11px] font-bold text-white tracking-tight truncate max-w-[85px]"
                >
                  {activeWorldMeta.shortLabel}
                </h1>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  data-testid="hud-photo-mode-btn"
                  onClick={onTogglePhotoMode}
                  aria-label="Toggle Cinematic Photo Studio (P)"
                  className={`touch-target-compact px-1.5 py-0.5 rounded-md border text-[9px] font-mono font-bold flex items-center gap-1 shrink-0 transition ${
                    isPhotoMode
                      ? 'bg-amber-400 text-black border-amber-300'
                      : 'bg-white/10 hover:bg-amber-400/20 border-white/15 text-amber-200'
                  }`}
                  title="Cinematic Photo Studio [P]"
                >
                  <Camera className="w-2.5 h-2.5" />
                  <span>[P]</span>
                </button>
                <button
                  type="button"
                  data-testid="hud-drawer-toggle-btn"
                  onClick={() => setDrawerOpen((v) => !v)}
                  aria-label="Toggle Festival Drawer (Tab)"
                  className="touch-target-compact px-1.5 py-0.5 rounded-md bg-white/10 hover:bg-amber-400/20 border border-white/15 text-[9px] font-mono font-bold text-amber-200 flex items-center gap-1 shrink-0 transition"
                >
                  <Menu className="w-2.5 h-2.5" />
                  <span>[Tab]</span>
                </button>
              </div>
            </div>

            {/* Row 2: Coins & Tickets */}
            <div className="flex items-center justify-between gap-1.5 mb-1.5 text-[10px]">
              <div
                data-testid="hud-wallet-coins"
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-400/30 text-amber-200 font-bold"
              >
                <Coins className="w-3 h-3 text-amber-400 shrink-0" />
                <span data-testid="hud-coins-value" className="font-mono">
                  {festivalCoins}
                </span>
              </div>
              <div
                data-testid="hud-wallet-tickets"
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-pink-500/15 border border-pink-400/30 text-pink-200 font-bold"
              >
                <Ticket className="w-3 h-3 text-pink-400 shrink-0" />
                <span data-testid="hud-tickets-value" className="font-mono">
                  {rewardTickets}
                </span>
              </div>
              <span
                data-testid="hud-score-value"
                className="font-mono text-[9px] text-amber-300/90 font-bold"
              >
                Lv.{levelInfo.level}
              </span>
            </div>

            {/* Row 3: Compact Gulal / Joy Progress Bar */}
            <div>
              <div className="flex items-center justify-between text-[9px] mb-0.5">
                <span className="text-amber-100/80 font-semibold flex items-center gap-1">
                  <Droplets className="w-2.5 h-2.5 text-pink-400" />
                  Gulal / Joy
                </span>
                <span ref={joyPctRef} className="font-mono font-bold text-white">
                  {Math.round(hud.gulalTankPct)}% · {joyProgressPct}%
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-black/60 overflow-hidden p-0.2 border border-white/10">
                <div
                  ref={gulalBarRef}
                  data-testid="gulal-tank-bar"
                  className="h-full rounded-full transition-all duration-150"
                  style={{
                    width: `${Math.min(100, Math.max(4, hud.gulalTankPct))}%`,
                    background: 'linear-gradient(90deg, #ff1e56, #ffaa00, #00f5d4)',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Slide-Out Drawer (Toggled by pressing [Tab] or clicking Menu [Tab]) */}
          <div
            data-testid="hud-slide-drawer"
            aria-hidden={!drawerOpen}
            className={`transition-all duration-200 origin-top-left ${
              drawerOpen
                ? 'pointer-events-auto opacity-100 translate-x-0 scale-100'
                : 'pointer-events-none opacity-0 -translate-x-4 scale-95 w-0 h-0 overflow-hidden'
            }`}
          >
            <div className="w-[295px] rounded-2xl border border-amber-400/35 bg-[#090612]/95 backdrop-blur-xl p-3 shadow-2xl space-y-2.5">
              <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-300">
                  Mela Drawer [Tab]
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    data-testid="hud-esc-menu-btn"
                    onClick={onPauseGame}
                    className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[9px] font-mono text-white"
                  >
                    Menu [Esc]
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    className="p-1 rounded bg-white/5 hover:bg-white/15 text-slate-300"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* World Switcher */}
              <div data-testid="hud-world-switcher">
                <div className="text-[9px] uppercase tracking-wider text-amber-200/75 font-bold mb-1">
                  World Switcher
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {WORLD_PILLS.map((w) => {
                    const active = w.id === activeWorld;
                    return (
                      <button
                        key={w.id}
                        type="button"
                        data-testid={`hud-world-switch-${w.id}`}
                        onClick={() => onSelectWorld(w.id)}
                        className={`px-2 py-1 rounded-lg text-[9px] font-bold transition truncate border ${
                          active
                            ? 'bg-gradient-to-r from-amber-500/35 to-pink-500/35 border-amber-300 text-white'
                            : 'bg-white/5 border-white/10 text-slate-300 hover:text-white'
                        }`}
                      >
                        {w.shortLabel}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time of Day (Auto / Dawn / Day / Dusk / Night) */}
              <div
                data-testid="day-night-hud-bar"
                className="rounded-xl bg-white/5 border border-white/10 p-2"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-amber-200 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-300" />
                    <span data-testid="hud-clock-label">{hud.dayNight.clockLabel}</span>
                  </span>
                  <span
                    data-testid="hud-phase-label"
                    className="text-[9px] font-semibold text-sky-200"
                  >
                    {hud.dayNight.shortPhaseLabel}
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {(
                    [
                      { id: 'auto', label: 'Auto', icon: Clock },
                      { id: 'dawn', label: 'Dawn', icon: Sunrise },
                      { id: 'day', label: 'Day', icon: Sun },
                      { id: 'dusk', label: 'Dusk', icon: Sunset },
                      { id: 'night', label: 'Night', icon: Moon },
                    ] as {
                      id: DayNightCycleMode;
                      label: string;
                      icon: React.ComponentType<{ className?: string }>;
                    }[]
                  ).map((item) => {
                    const Icon = item.icon;
                    const isSelected = dayNightMode === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        data-testid={`hud-phase-btn-${item.id}`}
                        onClick={() => onChangeDayNightMode(item.id)}
                        className={`px-1 py-1 rounded text-[9px] font-bold flex flex-col items-center gap-0.5 border transition ${
                          isSelected
                            ? 'bg-amber-400/25 border-amber-300 text-amber-100'
                            : 'bg-black/40 border-white/10 text-slate-300 hover:text-white'
                        }`}
                      >
                        <Icon className="w-2.5 h-2.5" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Spirit Vitality, Revelers Joy & Karma / Seva */}
              <div className="space-y-1.5 text-[10px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 flex items-center gap-1">
                    <Heart className="w-3 h-3 text-rose-400" /> Spirit
                  </span>
                  <div className="flex items-center gap-1" data-testid="player-spirit-bar">
                    {Array.from({ length: hud.maxSpiritPips }).map((_, idx) => (
                      <div
                        key={idx}
                        className={`h-2 w-4 rounded-full ${
                          idx < hud.spiritPips ? 'bg-rose-500' : 'bg-white/15'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-300 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-300" /> Revelers Joy
                  </span>
                  <span className="font-mono font-bold text-white">
                    {hud.revelersSplashed}/{hud.targetRevelers} · Diyas {hud.diyasLit}/
                    {hud.targetDiyas}
                  </span>
                </div>

                <div
                  data-testid="karma-hud-panel"
                  className="flex items-center justify-between pt-1 border-t border-white/10"
                >
                  <div>
                    <div className="text-[9px] font-bold text-emerald-300">
                      Karma: {hud.karma.karmaPoints}/{hud.karma.maxKarma}
                    </div>
                    <div className="text-[8px] text-slate-400">
                      Deeds: {hud.karma.totalPositiveDeeds}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onTriggerKarmaHelp}
                    className="px-2 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-[9px] font-bold hover:bg-emerald-500/30"
                  >
                    Seva [T]
                  </button>
                </div>
              </div>

              {/* Camera, Audio & Settings Quick Controls */}
              <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-white/10">
                <button
                  type="button"
                  data-testid="camera-mode-toggle"
                  onClick={onToggleCameraMode}
                  className="flex-1 py-1 px-2 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-[9px] font-bold text-sky-200 flex items-center justify-center gap-1"
                >
                  <Eye className="w-3 h-3" />
                  {cameraMode === 'first_person' ? '1st Cam [V]' : '3rd Cam [V]'}
                </button>
                <button
                  type="button"
                  onClick={onToggleMute}
                  aria-label={isMuted ? 'Unmute Festival Audio' : 'Mute Festival Audio'}
                  className="py-1 px-2 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-[9px] font-bold text-amber-200 flex items-center gap-1"
                >
                  {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                </button>
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="py-1 px-2 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-[9px] font-bold text-slate-200"
                >
                  [O]
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Top-Right Compact Radar */}
        <div className="flex items-start gap-1.5">
          {hud.combo > 1 && (
            <div className="pointer-events-auto rounded-xl border border-amber-400/40 bg-[#090612]/80 px-2.5 py-1 text-right">
              <div className="text-[8px] uppercase tracking-wider text-amber-300 font-bold">
                Combo
              </div>
              <div className="font-display text-sm font-extrabold text-amber-300">
                {hud.combo}x
              </div>
            </div>
          )}
          <MinimapRadar
            playerX={hud.playerX}
            playerZ={hud.playerZ}
            playerYaw={hud.playerYaw}
            crowdPositions={hud.crowdPositions}
            fps={hud.fps}
            showFps={showFps}
          />
        </div>
      </div>

      {/* ─── CENTER INTERACTION CALLOUT / PROXIMITY PROMPT ─── */}
      <div className="flex flex-col items-center justify-center pointer-events-none my-auto">
        {hud.floatingCallout && (
          <div
            data-testid="hud-active-callout"
            className="mb-2 px-3.5 py-1 rounded-full border border-amber-300/50 bg-[#090612]/85 backdrop-blur-md text-amber-100 font-display text-xs font-bold shadow-lg"
          >
            {hud.floatingCallout.text}
          </div>
        )}
        {mountedRide && (
          <div
            data-testid="active-ride-banner"
            className="mb-2 pointer-events-auto flex items-center gap-2 px-3.5 py-1 rounded-full border border-cyan-400/50 bg-[#090612]/90 text-cyan-200 text-[11px] font-bold shadow-lg"
          >
            <FerrisWheel className="w-3.5 h-3.5 text-cyan-300 animate-spin" />
            <span>
              Riding{' '}
              {mountedRide === 'giant_wheel'
                ? 'Giant Wheel'
                : mountedRide === 'carousel'
                ? 'Royal Carousel'
                : 'Columbus Ship'}
            </span>
            <button
              type="button"
              onClick={onExitRide}
              className="px-2 py-0.5 rounded bg-cyan-500/25 border border-cyan-300/40 text-white text-[9px] font-mono"
            >
              Exit [Esc]
            </button>
          </div>
        )}
        {hud.nearbyPrompt && (
          <div
            data-testid="hud-nearby-prompt"
            className="px-3 py-1 rounded-xl border border-amber-400/40 bg-[#090612]/85 text-amber-200 text-[10px] font-medium shadow-md"
          >
            [E] {hud.nearbyPrompt.label}
          </div>
        )}
      </div>

      {/* ─── QUICK-TRAVEL & TOYS WHEEL MODAL (OPENED VIA [K] WHEEL BUTTON) ─── */}
      <div
        data-testid="quick-toys-wheel-modal"
        aria-hidden={!wheelOpen}
        className={`transition-all duration-200 mx-auto mb-2 ${
          wheelOpen
            ? 'pointer-events-auto opacity-100 translate-y-0 scale-100'
            : 'pointer-events-none opacity-0 translate-y-3 scale-95 h-0 overflow-hidden'
        }`}
      >
        <div className="w-[340px] sm:w-[440px] rounded-2xl border border-amber-400/40 bg-[#090612]/95 backdrop-blur-xl p-3 shadow-2xl">
          {/* Modal Header Tabs */}
          <div className="flex items-center justify-between gap-1 border-b border-white/10 pb-2 mb-2.5">
            <div className="flex items-center gap-1">
              {(
                [
                  { id: 'rides', label: 'Rides & Stalls', icon: FerrisWheel },
                  { id: 'weapons', label: 'Weapons (1-5)', icon: Crosshair },
                  { id: 'attire', label: 'Attire [C]', icon: Shirt },
                  { id: 'dhol', label: 'Dhol Studio', icon: Sliders },
                ] as const
              ).map((t) => {
                const Icon = t.icon;
                const active = wheelTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setWheelTab(t.id)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition ${
                      active
                        ? 'bg-amber-400/25 text-amber-200 border border-amber-400/50'
                        : 'bg-white/5 text-slate-300 hover:text-white'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setWheelOpen(false)}
              className="p-1 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Tab 1: Rides (Giant Wheel, Carousel, Columbus) & Stalls */}
          <div className={wheelTab === 'rides' ? 'space-y-2' : 'hidden'}>
            <div className="grid grid-cols-3 gap-1.5">
              {MELA_RIDES.map((ride) => (
                <button
                  key={ride.id}
                  type="button"
                  data-testid={`ride-btn-${ride.id.replace('_', '-')}`}
                  onClick={() => {
                    onBoardRide(ride.id);
                    setWheelOpen(false);
                  }}
                  className="p-2 rounded-xl border border-cyan-400/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-left transition"
                >
                  <div className="text-[10px] font-bold text-cyan-200 truncate">
                    {ride.name.split('(')[0].trim()}
                  </div>
                  <div className="text-[8px] text-cyan-300/75 font-mono">Ride [E]</div>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {MELA_STALLS.map((stall) => (
                <button
                  key={stall.id}
                  type="button"
                  data-testid={`stall-btn-${stall.id.replace('_', '-')}`}
                  onClick={() => {
                    onOpenStallModal(stall.id);
                    setWheelOpen(false);
                  }}
                  className="p-2 rounded-xl border border-pink-400/30 bg-pink-500/10 hover:bg-pink-500/20 text-left transition"
                >
                  <div className="text-[10px] font-bold text-pink-200 truncate">
                    {stall.name}
                  </div>
                  <div className="text-[8px] text-pink-300/75 font-mono">Play Stall</div>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-white/10">
              <button
                type="button"
                data-testid="hotbar-stamp-rangoli"
                onClick={() => {
                  onTriggerStampRangoli();
                  onOpenRangoli();
                  setWheelOpen(false);
                }}
                className="py-1.5 px-2 rounded-lg bg-white/5 hover:bg-white/15 text-[9px] font-bold text-pink-200 flex items-center justify-center gap-1"
              >
                <Palette className="w-3 h-3" /> Rangoli [G]
              </button>
              <button
                type="button"
                onClick={() => {
                  setWheelOpen(false);
                  onOpenWorldAtlas();
                }}
                className="py-1.5 px-2 rounded-lg bg-white/5 hover:bg-white/15 text-[9px] font-bold text-amber-200 flex items-center justify-center gap-1"
              >
                <Compass className="w-3 h-3" /> 12 Worlds [K]
              </button>
              <button
                type="button"
                onClick={() => {
                  setWheelOpen(false);
                  onOpenBlueprint();
                }}
                className="py-1.5 px-2 rounded-lg bg-white/5 hover:bg-white/15 text-[9px] font-bold text-cyan-200 flex items-center justify-center gap-1"
              >
                <Award className="w-3 h-3" /> Blueprint [B]
              </button>
            </div>
          </div>

          {/* Tab 2: Weapons (1-5) & Gulal Swatches */}
          <div
            data-testid="weapon-selector-bar"
            className={wheelTab === 'weapons' ? 'space-y-2' : 'hidden'}
          >
            <div className="grid grid-cols-5 gap-1.5">
              {ARSENAL_SLOTS.map((w) => {
                const selected = hud.selectedArsenal === w.id;
                return (
                  <button
                    key={w.id}
                    type="button"
                    data-testid={`weapon-slot-${w.id}`}
                    onClick={() => {
                      onSelectArsenal(w.id);
                      setWheelOpen(false);
                    }}
                    className={`p-2 rounded-xl border text-left transition ${
                      selected
                        ? 'bg-amber-400/20 border-amber-300 text-white'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: w.swatch }}
                      />
                      <span className="text-[9px] font-mono text-amber-300">[{w.key}]</span>
                    </div>
                    <div className="text-[10px] font-bold truncate">{w.label}</div>
                    <div className="text-[8px] text-slate-400 truncate">{w.sub}</div>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-white/10">
              <span className="text-[9px] text-amber-200/80 font-bold">Gulal Powder:</span>
              <div className="flex items-center gap-1.5">
                {GULAL_COLORS.map((cId) => {
                  const spec = GULAL_WEAPONS[cId];
                  const active = hud.selectedGulal === cId;
                  return (
                    <button
                      key={cId}
                      type="button"
                      onClick={() => onSelectGulal(cId)}
                      className={`px-2 py-0.5 rounded-full text-[9px] font-bold flex items-center gap-1 border ${
                        active ? 'border-white text-white bg-white/15' : 'border-white/15 text-slate-300'
                      }`}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: spec.hex }}
                      />
                      <span>{spec.name.split(' ')[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Tab 3: Attire [C] */}
          <div
            data-testid="attire-wardrobe-popover"
            className={wheelTab === 'attire' ? 'flex items-center justify-between gap-2' : 'hidden'}
          >
            <div className="text-[10px] text-slate-300">
              Customize your royal Kurta, Pagdi turban, and Lotus Shield skin in the 3D Wardrobe Studio.
            </div>
            <button
              type="button"
              onClick={() => {
                setWheelOpen(false);
                onOpenCharacter();
              }}
              className="px-3 py-1.5 rounded-xl bg-amber-500/25 border border-amber-400/50 text-amber-100 text-[10px] font-bold shrink-0"
            >
              Open Wardrobe [C]
            </button>
          </div>

          {/* Tab 4: Dhol Studio */}
          <div className={wheelTab === 'dhol' ? 'flex items-center justify-between gap-2' : 'hidden'}>
            <div className="text-[10px] text-slate-300">
              Play live 8-beat Kaharwa Taal on the Braj Dhol & ignite sacred Diyas in sync.
            </div>
            <button
              type="button"
              onClick={() => {
                setWheelOpen(false);
                onOpenRhythm();
              }}
              className="px-3 py-1.5 rounded-xl bg-amber-500/25 border border-amber-400/50 text-amber-100 text-[10px] font-bold shrink-0"
            >
              Open Dhol Studio
            </button>
          </div>
        </div>
      </div>

      {/* ─── BOTTOM-CENTER SLEEK 1-ROW ICONIC ACTION BAR (5 SKILL SLOTS + 1 [K] WHEEL BUTTON) ─── */}
      <div className="flex items-center justify-center w-full">
        <div
          data-testid="bottom-action-hotbar"
          className="pointer-events-auto flex items-center gap-1.5 rounded-2xl border border-amber-400/30 bg-[#090612]/80 backdrop-blur-md px-2.5 py-1.5 shadow-xl"
        >
          {/* Slot 1: [LMB] Gulal / Weapon */}
          <button
            type="button"
            data-testid="hotbar-fire-gulal"
            onClick={onTriggerFire}
            className="touch-target-compact group flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gradient-to-b from-pink-500/25 to-amber-500/15 hover:from-pink-500/40 hover:to-amber-500/30 border border-pink-400/40 text-white transition active:scale-95"
          >
            <Flame className="w-3.5 h-3.5 text-pink-400 shrink-0" />
            <div className="text-left leading-tight">
              <div className="text-[10px] font-bold">
                {ARSENAL_MODES[hud.selectedArsenal].name.split(' ')[0]}
              </div>
              <div className="text-[8px] font-mono text-amber-200/80">[LMB]</div>
            </div>
          </button>

          {/* Slot 2: [Q] Lotus Shield */}
          <button
            type="button"
            data-testid="hotbar-lotus-shield"
            onClick={onTriggerShield}
            className={`touch-target-compact flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition active:scale-95 ${
              hud.shieldActive
                ? 'bg-cyan-500/35 border-cyan-300 text-white'
                : 'bg-white/5 hover:bg-white/15 border-white/15 text-slate-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
            <div className="text-left leading-tight">
              <div className="text-[10px] font-bold">Shield</div>
              <div className="text-[8px] font-mono text-cyan-200/80">[Q]</div>
            </div>
          </button>

          {/* Slot 3: [Shift] Dash */}
          <button
            type="button"
            data-testid="hotbar-dash"
            onClick={onTriggerDash}
            className="touch-target-compact flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/15 border border-white/15 text-slate-200 transition active:scale-95"
          >
            <Wind className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
            <div className="text-left leading-tight">
              <div className="text-[10px] font-bold">Dash</div>
              <div className="text-[8px] font-mono text-emerald-200/80">[Shift]</div>
            </div>
          </button>

          {/* Slot 4: [R] Rhythm / Interact */}
          <button
            type="button"
            data-testid="hotbar-rhythm-diyas"
            onClick={onTriggerRhythmDiyas}
            className="touch-target-compact flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/15 border border-white/15 text-slate-200 transition active:scale-95"
          >
            <Music className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <div className="text-left leading-tight">
              <div className="text-[10px] font-bold">Rhythm</div>
              <div className="text-[8px] font-mono text-amber-200/80">[R]</div>
            </div>
          </button>

          {/* Slot 5: [F] Fireworks */}
          <button
            type="button"
            data-testid="hotbar-fireworks"
            onClick={onTriggerFireworks}
            className="touch-target-compact flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/15 border border-white/15 text-slate-200 transition active:scale-95"
          >
            <Zap className="w-3.5 h-3.5 text-orange-400 shrink-0" />
            <div className="text-left leading-tight">
              <div className="text-[10px] font-bold">Fireworks</div>
              <div className="text-[8px] font-mono text-orange-200/80">[F]</div>
            </div>
          </button>

          <div className="h-6 w-px bg-white/15 mx-0.5" />

          {/* Button 6: [K] Quick-Travel & Toys Wheel */}
          <button
            type="button"
            data-testid="quick-wheel-toggle-btn"
            onClick={() => setWheelOpen((v) => !v)}
            className={`touch-target-compact flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition active:scale-95 ${
              wheelOpen
                ? 'bg-amber-400/30 border-amber-300 text-white'
                : 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-400/40 text-amber-100'
            }`}
          >
            <Grid className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <div className="text-left leading-tight">
              <div className="text-[10px] font-bold">Toys & Travel</div>
              <div className="text-[8px] font-mono text-amber-200">[K] Wheel</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
