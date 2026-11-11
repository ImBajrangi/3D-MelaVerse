import React, { useEffect, useState } from 'react';
import { evaluateComboVisualState } from '../game/rules';

interface ComboMultiplierBadgeProps {
  combo: number;
  comboStreak: number;
  comboTimerRatio: number;
}

export const ComboMultiplierBadge: React.FC<ComboMultiplierBadgeProps> = ({
  combo,
  comboStreak,
  comboTimerRatio,
}) => {
  const [hitPulse, setHitPulse] = useState(false);
  const visual = evaluateComboVisualState(combo, comboStreak, comboTimerRatio);

  // Trigger a punchy scale-up & glow surge whenever consecutive hits or multiplier increase
  useEffect(() => {
    if (comboStreak > 0 || combo > 1) {
      setHitPulse(true);
      const timer = window.setTimeout(() => setHitPulse(false), 210);
      return () => window.clearTimeout(timer);
    }
    setHitPulse(false);
  }, [combo, comboStreak]);

  const effectiveScale = visual.scaleFactor * (hitPulse ? 1.14 : 1.0);
  const outerGlowRadius = Math.round(14 + visual.glowIntensity * 28);
  const innerGlowRadius = Math.round(4 + visual.glowIntensity * 12);

  return (
    <div
      className="relative flex items-center gap-2.5 px-3 py-1.5 rounded-xl border transition-all duration-150 select-none"
      data-testid="combo-multiplier-badge"
      data-combo-tier={visual.tierId}
      data-combo-glowing={visual.isGlowing ? 'true' : 'false'}
      style={{
        backgroundColor: visual.isGlowing
          ? 'rgba(26, 10, 14, 0.95)'
          : 'rgba(20, 9, 7, 0.90)',
        borderColor: visual.isGlowing
          ? visual.accentHex
          : 'rgba(245, 158, 11, 0.38)',
        transform: `scale(${effectiveScale.toFixed(3)})`,
        transformOrigin: 'right center',
        boxShadow: visual.isGlowing
          ? `0 0 ${outerGlowRadius}px ${visual.glowRgba}, inset 0 0 ${innerGlowRadius}px ${visual.glowRgba}, 0 8px 20px rgba(0, 0, 0, 0.75)`
          : '0 6px 20px rgba(0, 0, 0, 0.65)',
      }}
      role="status"
      aria-live="polite"
      aria-label={`Combo Multiplier ${visual.multiplier}x, ${visual.streakHits} consecutive hits, ${visual.tierTitle}`}
    >
      {/* Animated Sacred Lotus / Sunburst Medallion that glows and spins with Combo Tier */}
      <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
        <svg
          viewBox="0 0 48 48"
          className={`w-10 h-10 transition-transform duration-300 ${
            visual.isGlowing ? 'animate-spin' : ''
          }`}
          style={{
            animationDuration:
              visual.multiplier >= 8
                ? '3.2s'
                : visual.multiplier >= 4
                ? '5.5s'
                : '9s',
            filter: visual.isGlowing
              ? `drop-shadow(0 0 ${Math.round(
                  6 + visual.glowIntensity * 10
                )}px ${visual.accentHex})`
              : 'none',
          }}
          aria-hidden="true"
        >
          {/* 8-Pointed Festival Sunburst Star */}
          <polygon
            points="24,2 29,14 42,9 35,21 46,24 35,27 42,39 29,34 24,46 19,34 6,39 13,27 2,24 13,21 6,9 19,14"
            fill={visual.isGlowing ? visual.accentHex : '#3A1B15'}
            fillOpacity={visual.isGlowing ? 0.28 : 0.45}
            stroke={visual.accentHex}
            strokeWidth={visual.isGlowing ? '2' : '1.4'}
          />
          <circle
            cx="24"
            cy="24"
            r="14"
            fill="#140907"
            stroke="#FFFBEB"
            strokeWidth="1.2"
            strokeOpacity={visual.isGlowing ? '0.9' : '0.4'}
          />
        </svg>

        {/* Center Multiplier Readout (×1 .. ×10) */}
        <span
          className="absolute inset-0 flex items-center justify-center font-mono font-extrabold text-sm tabular-nums tracking-tighter text-[#FFFBEB]"
          style={{
            textShadow: visual.isGlowing
              ? `0 0 10px ${visual.accentHex}, 0 1px 2px #000`
              : '0 1px 2px #000',
          }}
        >
          ×{visual.multiplier}
        </span>
      </div>

      {/* Right Column: Tier Title, Consecutive Hit Streak & Live Decay Fuse Bar */}
      <div className="flex flex-col min-w-[118px]">
        <div className="flex items-center justify-between gap-1.5">
          <span
            className="text-[10px] font-mono font-extrabold uppercase tracking-wider whitespace-nowrap"
            style={{
              color: visual.isGlowing ? visual.accentHex : '#FDE68A',
              textShadow: visual.isGlowing
                ? `0 0 8px ${visual.glowRgba}`
                : 'none',
            }}
          >
            {visual.tierTitle}
          </span>
          <span className="text-[10px] font-mono font-bold tabular-nums text-[#FFFBEB]/90">
            {visual.streakHits} {visual.streakHits === 1 ? 'HIT' : 'HITS'}
          </span>
        </div>

        {/* Multiplier Growth Label */}
        <div className="flex items-baseline justify-between gap-2 my-0.5">
          <span className="text-xs font-mono font-bold text-white tabular-nums">
            COMBO ×{visual.multiplier}
          </span>
          <span className="text-[9px] font-mono text-[#FDE68A]/85 uppercase">
            {visual.isGlowing ? `+${(visual.multiplier - 1) * 25}% BONUS` : 'HIT TARGETS'}
          </span>
        </div>

        {/* Draining Combo Streak Fuse Bar */}
        <div className="w-full h-1.5 rounded-full bg-[#120705] overflow-hidden border border-[#F59E0B]/25">
          <div
            className="h-full transition-all duration-100 rounded-full"
            style={{
              width: `${visual.isGlowing ? Math.max(8, visual.timerPct) : 0}%`,
              backgroundColor: visual.accentHex,
              boxShadow: visual.isGlowing
                ? `0 0 8px ${visual.accentHex}`
                : 'none',
            }}
          />
        </div>
      </div>
    </div>
  );
};
