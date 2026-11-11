import React, { useState, useEffect, useCallback } from 'react';
import { evaluateBalloonShotResult } from '../game/rules';
import { useDialogFocus } from '../utils/useDialogFocus';
import { melaverseAudio } from '../game/audio';

interface BalloonTarget {
  id: number;
  xPct: number;
  yPct: number;
  speedX: number;
  bobOffset: number;
  colorHex: string;
  label: string;
  points: number;
  popped: boolean;
}

const INITIAL_BALLOONS: BalloonTarget[] = [
  { id: 1, xPct: 15, yPct: 26, speedX: 14, bobOffset: 0.0, colorHex: '#F43F5E', label: 'Ruby Balloon', points: 20, popped: false },
  { id: 2, xPct: 32, yPct: 26, speedX: 14, bobOffset: 1.1, colorHex: '#FBBF24', label: 'Gold Balloon', points: 30, popped: false },
  { id: 3, xPct: 49, yPct: 26, speedX: 14, bobOffset: 2.2, colorHex: '#38BDF8', label: 'Neel Balloon', points: 20, popped: false },
  { id: 4, xPct: 66, yPct: 26, speedX: 14, bobOffset: 3.3, colorHex: '#A855F7', label: 'Royal Balloon', points: 25, popped: false },
  { id: 5, xPct: 83, yPct: 26, speedX: 14, bobOffset: 4.4, colorHex: '#10B981', label: 'Panna Balloon', points: 25, popped: false },
  { id: 6, xPct: 18, yPct: 52, speedX: -18, bobOffset: 0.7, colorHex: '#10B981', label: 'Emerald Balloon', points: 25, popped: false },
  { id: 7, xPct: 35, yPct: 52, speedX: -18, bobOffset: 1.9, colorHex: '#F43F5E', label: 'Gulabi Balloon', points: 20, popped: false },
  { id: 8, xPct: 52, yPct: 52, speedX: -18, bobOffset: 2.8, colorHex: '#FBBF24', label: 'Surya Balloon', points: 30, popped: false },
  { id: 9, xPct: 69, yPct: 52, speedX: -18, bobOffset: 4.1, colorHex: '#38BDF8', label: 'Indigo Balloon', points: 25, popped: false },
  { id: 10, xPct: 85, yPct: 52, speedX: -18, bobOffset: 5.2, colorHex: '#A855F7', label: 'Amethyst Balloon', points: 30, popped: false },
  { id: 11, xPct: 16, yPct: 76, speedX: 22, bobOffset: 1.4, colorHex: '#FBBF24', label: 'Jackpot Gold Balloon', points: 40, popped: false },
  { id: 12, xPct: 34, yPct: 76, speedX: 22, bobOffset: 2.6, colorHex: '#F43F5E', label: 'Crimson Balloon', points: 30, popped: false },
  { id: 13, xPct: 52, yPct: 76, speedX: 22, bobOffset: 3.9, colorHex: '#A855F7', label: 'Violet Balloon', points: 35, popped: false },
  { id: 14, xPct: 70, yPct: 76, speedX: 22, bobOffset: 4.8, colorHex: '#10B981', label: 'Jade Balloon', points: 30, popped: false },
  { id: 15, xPct: 86, yPct: 76, speedX: 22, bobOffset: 5.7, colorHex: '#38BDF8', label: 'Sapphire Balloon', points: 35, popped: false },
];

interface PopBurstEffect {
  id: number;
  xPct: number;
  yPct: number;
  colorHex: string;
}

interface BalloonShootModalProps {
  isOpen: boolean;
  onAwardTickets: (tickets: number, coins: number, xp: number) => void;
  onClose: () => void;
}

export const BalloonShootModal: React.FC<BalloonShootModalProps> = ({
  isOpen,
  onAwardTickets,
  onClose,
}) => {
  const { dialogRef, handleKeyDown } = useDialogFocus(isOpen, onClose);
  const [balloons, setBalloons] = useState<BalloonTarget[]>(INITIAL_BALLOONS);
  const [ammoLeft, setAmmoLeft] = useState<number>(10);
  const [shotsFired, setShotsFired] = useState<number>(0);
  const [balloonsPopped, setBalloonsPopped] = useState<number>(0);
  const [currentStreak, setCurrentStreak] = useState<number>(0);
  const [bestStreak, setBestStreak] = useState<number>(0);
  const [timeLeftSec, setTimeLeftSec] = useState<number>(25);
  const [popBursts, setPopBursts] = useState<PopBurstEffect[]>([]);
  const [crosshairPos, setCrosshairPos] = useState<{ x: number; y: number }>({
    x: 50,
    y: 50,
  });
  const [roundFinished, setRoundFinished] = useState<boolean>(false);
  const [ticketsClaimed, setTicketsClaimed] = useState<boolean>(false);

  const resetBooth = useCallback(() => {
    setBalloons(INITIAL_BALLOONS.map((b) => ({ ...b, popped: false })));
    setAmmoLeft(10);
    setShotsFired(0);
    setBalloonsPopped(0);
    setCurrentStreak(0);
    setBestStreak(0);
    setTimeLeftSec(25);
    setPopBursts([]);
    setRoundFinished(false);
    setTicketsClaimed(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      resetBooth();
    }
  }, [isOpen, resetBooth]);

  // Animate moving balloons & countdown timer
  useEffect(() => {
    if (!isOpen || roundFinished) return;

    const interval = window.setInterval(() => {
      setTimeLeftSec((prev) => {
        if (prev <= 0.1) {
          setRoundFinished(true);
          return 0;
        }
        return Number((prev - 0.1).toFixed(1));
      });

      setBalloons((prev) =>
        prev.map((b) => {
          if (b.popped) return b;
          let nextX = b.xPct + b.speedX * 0.06;
          if (nextX > 88) nextX = 12;
          if (nextX < 12) nextX = 88;
          return {
            ...b,
            xPct: nextX,
            bobOffset: b.bobOffset + 0.18,
          };
        })
      );
    }, 100);

    return () => window.clearInterval(interval);
  }, [isOpen, roundFinished]);

  const handlePopBalloon = (balloonId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (roundFinished || ammoLeft <= 0) return;

    melaverseAudio.playBalloonGunshotPop(true);
    const hitTarget = balloons.find((b) => b.id === balloonId);
    if (hitTarget) {
      const burstId = Date.now() + balloonId;
      setPopBursts((prev) => [
        ...prev,
        {
          id: burstId,
          xPct: hitTarget.xPct,
          yPct: hitTarget.yPct,
          colorHex: hitTarget.colorHex,
        },
      ]);
      window.setTimeout(() => {
        setPopBursts((prev) => prev.filter((p) => p.id !== burstId));
      }, 450);
    }

    const nextAmmo = ammoLeft - 1;
    const nextShots = shotsFired + 1;
    const nextPopped = balloonsPopped + 1;
    const nextStreak = currentStreak + 1;
    const nextBest = Math.max(bestStreak, nextStreak);

    setAmmoLeft(nextAmmo);
    setShotsFired(nextShots);
    setBalloonsPopped(nextPopped);
    setCurrentStreak(nextStreak);
    setBestStreak(nextBest);

    setBalloons((prev) => {
      const updated = prev.map((b) =>
        b.id === balloonId ? { ...b, popped: true } : b
      );
      const allPopped = updated.every((b) => b.popped);
      if (allPopped || nextAmmo <= 0) {
        setRoundFinished(true);
      }
      return updated;
    });
  };

  const handleMissedShot = () => {
    if (roundFinished || ammoLeft <= 0) return;
    melaverseAudio.playBalloonGunshotPop(false);
    const nextAmmo = ammoLeft - 1;
    setAmmoLeft(nextAmmo);
    setShotsFired((s) => s + 1);
    setCurrentStreak(0);
    if (nextAmmo <= 0) {
      setRoundFinished(true);
    }
  };

  const summary = evaluateBalloonShotResult(
    shotsFired,
    balloonsPopped,
    bestStreak
  );

  const handleClaimAndFinish = () => {
    if (!ticketsClaimed) {
      melaverseAudio.playCoinCollect();
      onAwardTickets(summary.ticketsAwarded, summary.coinsBonus, 65);
      setTicketsClaimed(true);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(12, 5, 4, 0.88)' }}
    >
      <div
        ref={dialogRef}
        onKeyDown={handleKeyDown}
        role="dialog"
        aria-modal="true"
        aria-labelledby="balloon-stall-title"
        data-testid="balloon-shoot-modal"
        className="w-full max-w-2xl rounded-2xl border border-[#F59E0B]/60 p-5 text-[#FFFBEB] shadow-[0_20px_60px_rgba(0,0,0,0.95)]"
        style={{ backgroundColor: '#1A0B08' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#F59E0B]/30 pb-3 mb-4">
          <div>
            <h2
              id="balloon-stall-title"
              className="text-lg font-bold tracking-wide text-[#FDE68A]"
            >
              GUBBARA NISHANA — BALLOON SHOOTING STALL
            </h2>
            <p className="text-xs text-[#FFF8F0]/80">
              Aim with the booth crosshair and click 15 oscillating balloons with 10 darts before the 25s timer runs out!
            </p>
          </div>
          <button
            type="button"
            onClick={handleClaimAndFinish}
            className="px-3 py-1.5 rounded-lg bg-[#2A1410] hover:bg-[#3F1E18] border border-[#F59E0B]/45 text-xs font-semibold text-[#FDE68A] cursor-pointer"
          >
            Claim &amp; Exit [Esc]
          </button>
        </div>

        {/* Live Telemetry Strip: Ammo, Timer, Popped, Accuracy, Tickets */}
        <div className="grid grid-cols-4 gap-2.5 mb-4 text-center font-mono">
          <div className="p-2 rounded-lg bg-[#28120D] border border-[#F59E0B]/30">
            <div className="text-[10px] text-[#FDE68A]">DARTS / AMMO</div>
            <div
              className="text-lg font-bold tabular-nums text-white"
              data-testid="balloon-ammo-left"
            >
              {ammoLeft}/10
            </div>
          </div>
          <div className="p-2 rounded-lg bg-[#28120D] border border-[#F59E0B]/30">
            <div className="text-[10px] text-[#FDE68A]">BOOTH TIMER</div>
            <div className="text-lg font-bold tabular-nums text-[#38BDF8]">
              {timeLeftSec.toFixed(1)}s
            </div>
          </div>
          <div className="p-2 rounded-lg bg-[#28120D] border border-[#F59E0B]/30">
            <div className="text-[10px] text-[#FDE68A]">POPPED / STREAK</div>
            <div
              className="text-lg font-bold tabular-nums text-[#FDA4AF]"
              data-testid="balloons-popped-count"
            >
              {balloonsPopped}/15 · ×{bestStreak}
            </div>
          </div>
          <div className="p-2 rounded-lg bg-[#28120D] border border-[#FBBF24]/50">
            <div className="text-[10px] text-[#FBBF24]">TICKET PAYOUT</div>
            <div
              className="text-lg font-bold tabular-nums text-[#FBBF24]"
              data-testid="balloon-tickets-earned"
            >
              +{summary.ticketsAwarded} Tickets
            </div>
          </div>
        </div>

        {/* Shooting Booth Interactive Board */}
        <div
          onClick={handleMissedShot}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            setCrosshairPos({ x, y });
          }}
          className="relative w-full h-72 rounded-xl border-2 border-[#F59E0B]/50 overflow-hidden cursor-crosshair select-none"
          style={{
            background:
              'radial-gradient(circle at 50% 30%, #1E293B 0%, #0F172A 70%, #090D16 100%)',
          }}
        >
          {/* Rack Lines */}
          {[26, 52, 76].map((rowY) => (
            <div
              key={rowY}
              className="absolute left-4 right-4 h-0.5 bg-[#F59E0B]/30"
              style={{ top: `${rowY}%` }}
            />
          ))}

          {/* Moving Balloons */}
          {balloons.map((b) => {
            if (b.popped) return null;
            const bobY = b.yPct + Math.sin(b.bobOffset) * 3.2;
            return (
              <button
                key={b.id}
                type="button"
                aria-label={`Shoot ${b.label}`}
                data-testid={`balloon-target-${b.id}`}
                onClick={(e) => handlePopBalloon(b.id, e)}
                className="absolute w-12 h-14 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center cursor-crosshair transition-transform active:scale-125"
                style={{
                  left: `${b.xPct}%`,
                  top: `${bobY}%`,
                }}
              >
                <svg viewBox="0 0 44 54" className="w-11 h-13 drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]">
                  <ellipse cx="22" cy="22" rx="17" ry="20" fill={b.colorHex} stroke="#FFFBEB" strokeWidth="1.5" />
                  <ellipse cx="16" cy="14" rx="4" ry="7" fill="#FFFFFF" fillOpacity="0.45" />
                  <polygon points="22,42 18,47 26,47" fill={b.colorHex} />
                  <line x1="22" y1="47" x2="22" y2="54" stroke="#FDE68A" strokeWidth="1.5" />
                </svg>
              </button>
            );
          })}

          {/* Particle Bursts on Balloon Pop */}
          {popBursts.map((burst) => (
            <div
              key={burst.id}
              data-testid="balloon-pop-burst"
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 animate-ping"
              style={{ left: `${burst.xPct}%`, top: `${burst.yPct}%` }}
            >
              <svg viewBox="0 0 60 60" className="w-14 h-14">
                <circle
                  cx="30"
                  cy="30"
                  r="18"
                  fill="none"
                  stroke={burst.colorHex}
                  strokeWidth="3"
                  strokeDasharray="5 5"
                />
                <circle cx="30" cy="10" r="3.5" fill="#FDE68A" />
                <circle cx="50" cy="30" r="3.5" fill={burst.colorHex} />
                <circle cx="30" cy="50" r="3.5" fill="#FFFBEB" />
                <circle cx="10" cy="30" r="3.5" fill={burst.colorHex} />
              </svg>
            </div>
          ))}

          {/* Custom Booth Crosshair Reticle */}
          <div
            className="pointer-events-none absolute w-9 h-9 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${crosshairPos.x}%`, top: `${crosshairPos.y}%` }}
          >
            <svg viewBox="0 0 36 36" className="w-full h-full">
              <circle cx="18" cy="18" r="13" fill="none" stroke="#FBBF24" strokeWidth="1.8" />
              <line x1="18" y1="2" x2="18" y2="34" stroke="#F43F5E" strokeWidth="1.5" />
              <line x1="2" y1="18" x2="34" y2="18" stroke="#F43F5E" strokeWidth="1.5" />
              <circle cx="18" cy="18" r="2.2" fill="#FFFBEB" />
            </svg>
          </div>
        </div>

        {/* Footer Controls */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-mono text-[#FDE68A]">
            Accuracy: <strong>{summary.accuracyPct}%</strong> · Grade:{' '}
            <strong className="text-white">{summary.gradeLabel}</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetBooth}
              className="px-3.5 py-2 rounded-lg bg-[#2A1410] hover:bg-[#3F1E18] border border-[#F59E0B]/40 text-xs font-semibold text-[#FFFBEB] cursor-pointer"
            >
              Reload Booth
            </button>
            <button
              type="button"
              data-testid="claim-balloon-tickets-btn"
              onClick={handleClaimAndFinish}
              className="px-4 py-2 rounded-lg bg-[#E11D48] hover:bg-[#BE123C] text-xs font-bold text-white shadow-[0_4px_14px_rgba(225,29,72,0.5)] cursor-pointer"
            >
              Collect +{summary.ticketsAwarded} Tickets &amp; +{summary.coinsBonus} Coins
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
