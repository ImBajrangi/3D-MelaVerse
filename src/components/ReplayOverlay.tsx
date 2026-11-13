import React, { useEffect } from 'react';
import type {
  ReplayCameraStyle,
  ReplayRecording,
} from '../game/replaySystem';

interface ReplayOverlayProps {
  isOpen: boolean;
  recording: ReplayRecording | null;
  currentTimeSec: number;
  isPlaying: boolean;
  speed: 0.5 | 1 | 2;
  cameraStyle: ReplayCameraStyle;
  onTogglePlay: () => void;
  onSeek: (timeSec: number) => void;
  onChangeSpeed: (speed: 0.5 | 1 | 2) => void;
  onChangeCameraStyle: (style: ReplayCameraStyle) => void;
  onRestartReplay: () => void;
  onExit: () => void;
}

const WORLD_NAMES: Record<ReplayRecording['world'], string> = {
  holi_braj: 'Holi — Braj Courtyard',
  diwali_ghat: 'Diwali — Sacred Ghat',
  mela_central: 'Mela Central Hub',
};

function formatTime(sec: number): string {
  const clamped = Math.max(0, sec);
  const mins = Math.floor(clamped / 60);
  const remSec = (clamped % 60).toFixed(1).padStart(4, '0');
  return `${String(mins).padStart(2, '0')}:${remSec}`;
}

export const ReplayOverlay: React.FC<ReplayOverlayProps> = ({
  isOpen,
  recording,
  currentTimeSec,
  isPlaying,
  speed,
  cameraStyle,
  onTogglePlay,
  onSeek,
  onChangeSpeed,
  onChangeCameraStyle,
  onRestartReplay,
  onExit,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onExit();
      } else if (e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        onTogglePlay();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [isOpen, onExit, onTogglePlay]);

  if (!isOpen || !recording) return null;

  const duration = Math.max(0.1, recording.durationSec);
  const progressPct = Math.min(100, Math.max(0, (currentTimeSec / duration) * 100));
  const worldLabel = WORLD_NAMES[recording.world] ?? 'Mela Festival';

  return (
    <div
      className="fixed inset-0 z-40 pointer-events-none flex flex-col justify-between"
      data-testid="replay-overlay"
      role="region"
      aria-label="Instant Cinematic Replay Player"
    >
      {/* Top Cinema Letterbox Bar */}
      <div
        className="w-full px-6 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-[#F59E0B]/30 pointer-events-auto"
        style={{ backgroundColor: 'rgba(12, 5, 4, 0.90)' }}
      >
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[#E11D48]/25 border border-[#E11D48]/60 text-[11px] font-mono font-bold uppercase tracking-wider text-[#FDA4AF]">
            <span className="w-2 h-2 rounded-full bg-[#F43F5E] animate-pulse" />
            INSTANT REPLAY · {Math.round(duration)}S WINDOW
          </span>
          <span className="text-xs font-semibold text-[#FFFBEB]">
            {worldLabel}
          </span>
          <span className="hidden sm:inline text-[11px] font-mono text-[#FDE68A]/80 tabular-nums">
            {recording.actions.length} Action Highlights
          </span>
        </div>

        <button
          type="button"
          data-testid="exit-replay-btn"
          onClick={(e) => {
            e.currentTarget.blur();
            onExit();
          }}
          className="touch-target-action px-4 py-1.5 rounded-lg bg-[#2A1410] hover:bg-[#3F1E18] border border-[#F59E0B]/45 text-xs font-mono font-semibold text-[#FFFBEB] cursor-pointer transition-colors"
        >
          Exit Replay [Esc]
        </button>
      </div>

      {/* Bottom Cinema Letterbox & Transport Bar */}
      <div
        className="w-full px-6 py-3.5 border-t border-[#F59E0B]/30 pointer-events-auto"
        style={{ backgroundColor: 'rgba(12, 5, 4, 0.92)' }}
      >
        {/* Timeline Scrubber with Highlight Action Ticks */}
        <div className="max-w-5xl mx-auto mb-2.5">
          <div className="relative flex items-center gap-3">
            <span
              className="text-xs font-mono font-bold tabular-nums text-[#FBBF24] min-w-[116px]"
              data-testid="replay-timecode"
            >
              {formatTime(currentTimeSec)} / {formatTime(duration)}
            </span>

            <div className="relative flex-1 flex items-center h-6">
              <div className="w-full h-1.5 rounded-full bg-white/15 overflow-hidden pointer-events-none">
                <div
                  className="h-full bg-[#F59E0B]"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              {/* Action highlight ticks along timeline */}
              {recording.actions.map((act, idx) => {
                const leftPct = Math.min(99, Math.max(1, (act.t / duration) * 100));
                return (
                  <span
                    key={`${act.type}-${idx}`}
                    aria-hidden="true"
                    className="absolute top-1/2 -translate-y-1/2 w-1.5 h-3 rounded-full bg-[#F43F5E] pointer-events-none"
                    style={{ left: `${leftPct}%` }}
                  />
                );
              })}

              <input
                type="range"
                aria-label="Replay timeline scrubber"
                min={0}
                max={duration}
                step={0.05}
                value={Math.min(duration, Math.max(0, currentTimeSec))}
                onChange={(e) => onSeek(parseFloat(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Transport Controls, Speed & Camera Angle */}
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="replay-play-pause-btn"
              onClick={(e) => {
                e.currentTarget.blur();
                onTogglePlay();
              }}
              className="touch-target-action px-4 py-1.5 rounded-lg bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-semibold cursor-pointer transition-colors"
            >
              {isPlaying ? 'Pause [Space]' : 'Play [Space]'}
            </button>

            <button
              type="button"
              data-testid="replay-restart-btn"
              onClick={(e) => {
                e.currentTarget.blur();
                onRestartReplay();
              }}
              className="touch-target-action px-3 py-1.5 rounded-lg bg-[#1C0D0A] hover:bg-[#2A1410] border border-[#F59E0B]/35 text-[#FDE68A] text-xs font-mono cursor-pointer transition-colors"
            >
              Replay From 0s
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Speed Selector */}
            <div
              className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#120705] border border-white/10"
              role="group"
              aria-label="Replay Speed"
            >
              {([0.5, 1, 2] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  data-testid={`replay-speed-${s}`}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onChangeSpeed(s);
                  }}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold cursor-pointer transition-colors ${
                    speed === s
                      ? 'bg-[#F59E0B] text-black'
                      : 'text-[#FDE68A]/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {s === 0.5 ? '0.5x Slow' : `${s}x`}
                </button>
              ))}
            </div>

            {/* Camera Angle Selector */}
            <div
              className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#120705] border border-white/10"
              role="group"
              aria-label="Replay Camera Angle"
            >
              {(
                [
                  { id: 'cinematic', label: 'Cinematic Orbit' },
                  { id: 'low_hero', label: 'Low Hero' },
                  { id: 'chase', label: 'Action Chase' },
                ] as const
              ).map((cam) => (
                <button
                  key={cam.id}
                  type="button"
                  data-testid={`replay-cam-${cam.id}`}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onChangeCameraStyle(cam.id);
                  }}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold cursor-pointer transition-colors ${
                    cameraStyle === cam.id
                      ? 'bg-[#E11D48] text-white'
                      : 'text-[#FDE68A]/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {cam.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
