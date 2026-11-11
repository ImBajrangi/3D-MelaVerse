import React from 'react';
import { MELA_RIDES, MELA_STALLS } from '../game/rules';

interface MinimapRadarProps {
  playerX: number;
  playerZ: number;
  playerYaw: number;
  crowdPositions: { x: number; z: number }[];
  fps: number;
  showFps: boolean;
}

export const MinimapRadar: React.FC<MinimapRadarProps> = ({
  playerX,
  playerZ,
  playerYaw,
  crowdPositions,
  fps,
  showFps,
}) => {
  // Map world coordinates [-40..40] to radar SVG [0..100]
  const toRadar = (wx: number, wz: number) => ({
    cx: Math.max(6, Math.min(94, 50 + (wx / 40) * 44)),
    cy: Math.max(6, Math.min(94, 50 + (wz / 40) * 44)),
  });

  const pPos = toRadar(playerX, playerZ);
  const headingDeg = ((playerYaw * 180) / Math.PI).toFixed(0);

  return (
    <div
      className="p-2 rounded-xl border border-[#F59E0B]/45 shadow-[0_6px_20px_rgba(0,0,0,0.75)] flex flex-col items-center gap-1"
      style={{ backgroundColor: 'rgba(20, 9, 7, 0.92)' }}
      data-testid="mela-minimap-radar"
    >
      <div className="w-full flex items-center justify-between text-[9px] font-mono text-[#FDE68A] px-0.5">
        <span>MELA RADAR</span>
        {showFps && (
          <span
            className="text-[#34D399] font-bold tabular-nums"
            data-testid="hud-fps-counter"
          >
            {Math.round(fps)} FPS
          </span>
        )}
      </div>

      <svg
        viewBox="0 0 100 100"
        className="w-24 h-24 rounded-full border border-[#F59E0B]/40 bg-[#120705]"
        aria-label="Mela Grounds Minimap Radar"
      >
        {/* Concentric Mela Promenade Rings */}
        <circle
          cx="50"
          cy="50"
          r="44"
          fill="none"
          stroke="#F59E0B"
          strokeOpacity="0.22"
          strokeWidth="1"
        />
        <circle
          cx="50"
          cy="50"
          r="24"
          fill="none"
          stroke="#F59E0B"
          strokeOpacity="0.18"
          strokeDasharray="3 2"
          strokeWidth="0.8"
        />
        {/* Central Rangoli Stage */}
        <circle cx="50" cy="50" r="6" fill="#F59E0B" fillOpacity="0.28" />

        {/* Autonomous Crowd Visitors (subtle gold dots) */}
        {crowdPositions.slice(0, 32).map((c, idx) => {
          const pt = toRadar(c.x, c.z);
          return (
            <circle
              key={idx}
              cx={pt.cx}
              cy={pt.cy}
              r="1.3"
              fill="#FDE68A"
              fillOpacity="0.55"
            />
          );
        })}

        {/* 3 Major Mela Rides (Cyan diamonds) */}
        {MELA_RIDES.map((ride) => {
          const pt = toRadar(ride.x, ride.z);
          return (
            <g key={ride.id}>
              <circle
                cx={pt.cx}
                cy={pt.cy}
                r="3.2"
                fill="#38BDF8"
                stroke="#FFFBEB"
                strokeWidth="0.8"
              />
            </g>
          );
        })}

        {/* 3 Mini-Game & Prize Stalls (Rose squares) */}
        {MELA_STALLS.map((stall) => {
          const pt = toRadar(stall.x, stall.z);
          return (
            <rect
              key={stall.id}
              x={pt.cx - 2.5}
              y={pt.cy - 2.5}
              width="5"
              height="5"
              rx="1"
              fill="#F43F5E"
              stroke="#FFFBEB"
              strokeWidth="0.7"
            />
          );
        })}

        {/* Player Position & Heading Cone */}
        <g
          transform={`translate(${pPos.cx}, ${pPos.cy}) rotate(${headingDeg})`}
        >
          <polygon
            points="0,5 -3.5,-3.5 3.5,-3.5"
            fill="#FBBF24"
            stroke="#120705"
            strokeWidth="0.8"
          />
        </g>
      </svg>

      <div className="flex items-center gap-2 text-[8px] font-mono text-[#FFF8F0]/75">
        <span className="text-[#38BDF8]">● Rides</span>
        <span className="text-[#F43F5E]">■ Stalls</span>
      </div>
    </div>
  );
};
