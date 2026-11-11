import React, { useState, useEffect } from 'react';
import {
  simulateRingTossTrajectory,
  type RingTossPeg,
} from '../game/rules';
import { useDialogFocus } from '../utils/useDialogFocus';
import { melaverseAudio } from '../game/audio';

export const MELA_RING_PEGS: RingTossPeg[] = [
  { id: 'peg_rose_bottle', label: 'Rooh Afza Glass Bottle', x: -1.25, z: 2.4, ticketValue: 6, accentHex: '#F43F5E' },
  { id: 'peg_brass_kalash', label: 'Brass Kalash Peg', x: 0.0, z: 2.5, ticketValue: 8, accentHex: '#FBBF24' },
  { id: 'peg_neel_vase', label: 'Jaipur Blue Pottery Peg', x: 1.25, z: 2.4, ticketValue: 6, accentHex: '#38BDF8' },
  { id: 'peg_royal_elephant', label: 'Meenakari Elephant Peg', x: -0.75, z: 3.7, ticketValue: 12, accentHex: '#A855F7' },
  { id: 'peg_emerald_peacock', label: 'Panna Peacock Peg', x: 0.75, z: 3.7, ticketValue: 12, accentHex: '#10B981' },
  { id: 'peg_maharaja_crown', label: 'Golden Jackpot Crown Peg', x: 0.0, z: 4.7, ticketValue: 20, accentHex: '#F59E0B' },
];

interface RingTossModalProps {
  isOpen: boolean;
  onAwardTickets: (tickets: number, coins: number, xp: number) => void;
  onClose: () => void;
}

export const RingTossModal: React.FC<RingTossModalProps> = ({
  isOpen,
  onAwardTickets,
  onClose,
}) => {
  const { dialogRef, handleKeyDown } = useDialogFocus(isOpen, onClose);
  const [angleDeg, setAngleDeg] = useState<number>(0);
  const [powerPct, setPowerPct] = useState<number>(52);
  const [ringsLeft, setRingsLeft] = useState<number>(6);
  const [ticketsEarned, setTicketsEarned] = useState<number>(0);
  const [capturedPegIds, setCapturedPegIds] = useState<string[]>([]);
  const [lastTossResult, setLastTossResult] = useState<{
    landingX: number;
    landingZ: number;
    message: string;
    isHit: boolean;
  } | null>(null);
  const [claimed, setClaimed] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setAngleDeg(0);
      setPowerPct(52);
      setRingsLeft(6);
      setTicketsEarned(0);
      setCapturedPegIds([]);
      setLastTossResult(null);
      setClaimed(false);
    }
  }, [isOpen]);

  const handleAimAtPeg = (peg: RingTossPeg) => {
    // Compute exact angle and power to land on the chosen peg so clicking a peg or tuning sliders both work smoothly
    const targetAngleRad = Math.atan2(peg.x, peg.z);
    const computedAngleDeg = Math.round((targetAngleRad * 180) / Math.PI);
    const dist = Math.hypot(peg.x, peg.z);
    const computedPower = Math.round(((dist - 1.4) / 4.2) * 100);
    setAngleDeg(Math.max(-35, Math.min(35, computedAngleDeg)));
    setPowerPct(Math.max(10, Math.min(100, computedPower)));
  };

  const handleTossRing = () => {
    if (ringsLeft <= 0) return;

    const result = simulateRingTossTrajectory(
      angleDeg,
      powerPct,
      MELA_RING_PEGS,
      0.52
    );

    setRingsLeft((r) => r - 1);

    if (result.capturedPeg) {
      melaverseAudio.playRingTossClink(true);
      const won = result.ticketsWon;
      setTicketsEarned((t) => t + won);
      setCapturedPegIds((prev) =>
        prev.includes(result.capturedPeg!.id)
          ? prev
          : [...prev, result.capturedPeg!.id]
      );
      setLastTossResult({
        landingX: result.landingX,
        landingZ: result.landingZ,
        message: `RING ON PEG! Captured ${result.capturedPeg.label} (+${won} Tickets)`,
        isHit: true,
      });
    } else {
      melaverseAudio.playRingTossClink(false);
      // Consolation 2 tickets so every toss feels rewarding
      setTicketsEarned((t) => t + 2);
      setLastTossResult({
        landingX: result.landingX,
        landingZ: result.landingZ,
        message: `Near Rim at (${result.landingX}m, ${result.landingZ}m) · +2 Participation Tickets`,
        isHit: false,
      });
    }
  };

  const handleClaimAndExit = () => {
    if (!claimed && ticketsEarned > 0) {
      melaverseAudio.playCoinCollect();
      onAwardTickets(ticketsEarned, capturedPegIds.length * 10, 60);
      setClaimed(true);
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
        aria-labelledby="ring-toss-title"
        data-testid="ring-toss-modal"
        className="w-full max-w-2xl rounded-2xl border border-[#38BDF8]/60 p-5 text-[#FFFBEB] shadow-[0_20px_60px_rgba(0,0,0,0.95)]"
        style={{ backgroundColor: '#160B09' }}
      >
        <div className="flex items-center justify-between border-b border-[#F59E0B]/30 pb-3 mb-4">
          <div>
            <h2
              id="ring-toss-title"
              className="text-lg font-bold tracking-wide text-[#7DD3FC]"
            >
              CHALLA PHEKO — PHYSICS RING TOSS STALL
            </h2>
            <p className="text-xs text-[#FFF8F0]/80">
              Select a prize bottle/peg or tune Throw Angle &amp; Power Bar, then toss your bamboo rings!
            </p>
          </div>
          <button
            type="button"
            onClick={handleClaimAndExit}
            className="px-3 py-1.5 rounded-lg bg-[#2A1410] hover:bg-[#3F1E18] border border-[#F59E0B]/45 text-xs font-semibold text-[#FDE68A] cursor-pointer"
          >
            Claim &amp; Exit [Esc]
          </button>
        </div>

        {/* Status Counters */}
        <div className="grid grid-cols-3 gap-3 mb-4 text-center font-mono">
          <div className="p-2 rounded-lg bg-[#24110D] border border-[#F59E0B]/30">
            <div className="text-[10px] text-[#FDE68A]">RINGS REMAINING</div>
            <div
              className="text-lg font-bold tabular-nums text-white"
              data-testid="rings-left-count"
            >
              {ringsLeft}/6
            </div>
          </div>
          <div className="p-2 rounded-lg bg-[#24110D] border border-[#F59E0B]/30">
            <div className="text-[10px] text-[#FDE68A]">PEGS RINGED</div>
            <div className="text-lg font-bold tabular-nums text-[#7DD3FC]">
              {capturedPegIds.length}/6
            </div>
          </div>
          <div className="p-2 rounded-lg bg-[#24110D] border border-[#FBBF24]/50">
            <div className="text-[10px] text-[#FBBF24]">TICKETS WON</div>
            <div
              className="text-lg font-bold tabular-nums text-[#FBBF24]"
              data-testid="ring-tickets-won"
            >
              +{ticketsEarned} Tickets
            </div>
          </div>
        </div>

        {/* Visual Peg Board (Click any peg to auto-calibrate angle & power, or use sliders below) */}
        <div
          className="relative w-full h-56 rounded-xl border border-[#38BDF8]/40 p-4 mb-4 flex flex-col justify-between overflow-hidden"
          style={{
            background:
              'radial-gradient(circle at 50% 85%, #2A1410 0%, #140806 85%)',
          }}
        >
          <div className="text-[10px] font-mono text-[#FDE68A]/80 text-center">
            CLICK ANY PRIZE PEG TO AIM, THEN PRESS &ldquo;TOSS RING&rdquo;
          </div>

          <div className="relative flex-1 w-full">
            {MELA_RING_PEGS.map((peg) => {
              const isCaptured = capturedPegIds.includes(peg.id);
              const leftPct = 50 + (peg.x / 2.0) * 38;
              const topPct = 90 - ((peg.z - 1.8) / 3.4) * 72;

              return (
                <button
                  key={peg.id}
                  type="button"
                  data-testid={`ring-peg-${peg.id}`}
                  onClick={() => handleAimAtPeg(peg)}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all cursor-pointer flex flex-col items-center gap-0.5 ${
                    isCaptured
                      ? 'bg-[#065F46] border-[#34D399] text-white scale-105'
                      : 'bg-[#1F0F0B]/95 border-[#F59E0B]/50 text-[#FFFBEB] hover:scale-105 hover:border-white'
                  }`}
                  style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                >
                  <span style={{ color: peg.accentHex }}>
                    {isCaptured ? '◎ RINGED!' : `● ${peg.label}`}
                  </span>
                  <span className="text-[10px] text-[#FDE68A]">
                    +{peg.ticketValue} Tickets
                  </span>
                </button>
              );
            })}
          </div>

          {lastTossResult && (
            <div
              className={`text-center text-xs font-mono py-1 px-3 rounded border ${
                lastTossResult.isHit
                  ? 'bg-[#065F46]/80 border-[#34D399] text-[#A7F3D0]'
                  : 'bg-[#2A1410]/90 border-[#F59E0B]/40 text-[#FDE68A]'
              }`}
            >
              {lastTossResult.message}
            </div>
          )}
        </div>

        {/* Angle & Power Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="p-3 rounded-xl bg-[#24110D] border border-[#F59E0B]/30">
            <label
              htmlFor="ring-angle-slider"
              className="flex items-center justify-between text-xs font-mono text-[#FDE68A] mb-1.5"
            >
              <span>THROW ANGLE</span>
              <span className="font-bold text-white">{angleDeg}°</span>
            </label>
            <input
              id="ring-angle-slider"
              type="range"
              min={-35}
              max={35}
              value={angleDeg}
              onChange={(e) => setAngleDeg(Number(e.target.value))}
              className="w-full accent-[#38BDF8] cursor-pointer"
            />
          </div>

          <div className="p-3 rounded-xl bg-[#24110D] border border-[#F59E0B]/30">
            <label
              htmlFor="ring-power-slider"
              className="flex items-center justify-between text-xs font-mono text-[#FDE68A] mb-1.5"
            >
              <span>THROW POWER BAR</span>
              <span className="font-bold text-[#FBBF24]">{powerPct}%</span>
            </label>
            <input
              id="ring-power-slider"
              type="range"
              min={10}
              max={100}
              value={powerPct}
              onChange={(e) => setPowerPct(Number(e.target.value))}
              className="w-full accent-[#F59E0B] cursor-pointer"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={ringsLeft <= 0}
            data-testid="toss-ring-btn"
            onClick={handleTossRing}
            className={`px-5 py-2.5 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer ${
              ringsLeft > 0
                ? 'bg-[#0284C7] hover:bg-[#0369A1] text-white shadow-[0_4px_16px_rgba(2,132,199,0.5)]'
                : 'bg-[#2A1410] text-[#FFF8F0]/40 cursor-not-allowed'
            }`}
          >
            {ringsLeft > 0
              ? `Toss Bamboo Ring (${ringsLeft} Left)`
              : 'All Rings Tossed!'}
          </button>

          <button
            type="button"
            data-testid="claim-ring-tickets-btn"
            onClick={handleClaimAndExit}
            className="px-4 py-2.5 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-xs font-bold text-white cursor-pointer"
          >
            Collect +{ticketsEarned} Tickets &amp; Exit
          </button>
        </div>
      </div>
    </div>
  );
};
