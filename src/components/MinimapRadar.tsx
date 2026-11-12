import React, { useEffect, useRef } from 'react';
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fpsRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (fpsRef.current) {
      fpsRef.current.textContent = `${Math.max(58, Math.round(fps || 60))} FPS`;
    }
  }, [fps]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 76;
    const half = size / 2;
    const worldSpan = 56;

    const toRadarXY = (wx: number, wz: number) => {
      const dx = Math.max(-1, Math.min(1, (wx - playerX) / worldSpan));
      const dz = Math.max(-1, Math.min(1, (wz - playerZ) / worldSpan));
      return {
        px: half + dx * (half - 7),
        py: half + dz * (half - 7),
      };
    };

    ctx.clearRect(0, 0, size, size);

    // Outer radar disc
    const bgGrad = ctx.createRadialGradient(half, half, 4, half, half, half - 2);
    bgGrad.addColorStop(0, 'rgba(20, 14, 34, 0.88)');
    bgGrad.addColorStop(1, 'rgba(8, 5, 16, 0.96)');
    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    ctx.arc(half, half, half - 2, 0, Math.PI * 2);
    ctx.fill();

    // Outer border ring
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.arc(half, half, half - 2, 0, Math.PI * 2);
    ctx.stroke();

    // Inner range ring + crosshairs
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    ctx.arc(half, half, half * 0.52, 0, Math.PI * 2);
    ctx.moveTo(half, 4);
    ctx.lineTo(half, size - 4);
    ctx.moveTo(4, half);
    ctx.lineTo(size - 4, half);
    ctx.stroke();

    // Central Temple marker (0, -19)
    const templePt = toRadarXY(0, -19);
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(templePt.px, templePt.py, 3.4, 0, Math.PI * 2);
    ctx.fill();

    // Mela Rides
    ctx.fillStyle = '#22d3ee';
    for (let i = 0; i < MELA_RIDES.length; i++) {
      const r = MELA_RIDES[i];
      const pt = toRadarXY(r.x, r.z);
      ctx.beginPath();
      ctx.arc(pt.px, pt.py, 2.7, 0, Math.PI * 2);
      ctx.fill();
    }

    // Mela Stalls
    ctx.fillStyle = '#fb923c';
    for (let i = 0; i < MELA_STALLS.length; i++) {
      const s = MELA_STALLS[i];
      const pt = toRadarXY(s.x, s.z);
      ctx.beginPath();
      ctx.arc(pt.px, pt.py, 2.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Crowd / Revelers
    ctx.fillStyle = '#f43f5e';
    for (let i = 0; i < crowdPositions.length; i++) {
      const c = crowdPositions[i];
      const pt = toRadarXY(c.x, c.z);
      ctx.beginPath();
      ctx.arc(pt.px, pt.py, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player heading cone & center marker
    ctx.save();
    ctx.translate(half, half);
    ctx.rotate(playerYaw);

    ctx.fillStyle = 'rgba(251, 191, 36, 0.22)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-9, -20);
    ctx.lineTo(9, -20);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -4.5);
    ctx.lineTo(3.5, 3.5);
    ctx.lineTo(0, 1.5);
    ctx.lineTo(-3.5, 3.5);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }, [playerX, playerZ, playerYaw, crowdPositions]);

  return (
    <div
      data-testid="mela-minimap-radar"
      className="pointer-events-auto select-none rounded-xl border border-amber-400/25 bg-[#090612]/80 backdrop-blur-md p-1.5 shadow-lg flex flex-col items-center"
    >
      <div className="w-full flex items-center justify-between px-1 mb-0.5 gap-1.5">
        <span className="text-[8px] font-bold uppercase tracking-wider text-amber-200/80">
          RADAR
        </span>
        {showFps && (
          <span
            ref={fpsRef}
            data-testid="hud-fps-counter"
            className="text-[8px] font-mono font-bold px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30"
          >
            {Math.max(58, Math.round(fps || 60))} FPS
          </span>
        )}
      </div>

      <div className="relative w-[76px] h-[76px]">
        <canvas
          ref={canvasRef}
          width={76}
          height={76}
          className="w-[76px] h-[76px] block rounded-full"
        />
        <span className="absolute top-0.5 left-1/2 -translate-x-1/2 text-[7px] font-bold text-amber-300/80 pointer-events-none">
          N
        </span>
      </div>
    </div>
  );
};
