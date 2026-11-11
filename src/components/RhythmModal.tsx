import React, { useState, useEffect } from 'react';
import { evaluateRhythmTap } from '../game/rules';
import { useDialogFocus } from '../utils/useDialogFocus';
import { melaverseAudio } from '../game/audio';

interface RhythmModalProps {
  isOpen: boolean;
  onClaimReward: (coins: number, xp: number, stamp: string) => void;
  onTriggerSkyFireworks: () => void;
  onClose: () => void;
}

interface FloatingKite {
  id: number;
  label: string;
  color: string;
  xPct: number;
  yPct: number;
  caught: boolean;
}

const INITIAL_KITES: FloatingKite[] = [
  { id: 1, label: 'Surya Gold Patang', color: '#F59E0B', xPct: 18, yPct: 28, caught: false },
  { id: 2, label: 'Gulabi Jaipur Kite', color: '#E11D48', xPct: 48, yPct: 20, caught: false },
  { id: 3, label: 'Neel Sabarmati Kite', color: '#38BDF8', xPct: 76, yPct: 34, caught: false },
  { id: 4, label: 'Panna Harvest Kite', color: '#10B981', xPct: 32, yPct: 62, caught: false },
  { id: 5, label: 'Kesar Royal Patang', color: '#A855F7', xPct: 66, yPct: 58, caught: false },
];

export const RhythmModal: React.FC<RhythmModalProps> = ({
  isOpen,
  onClaimReward,
  onTriggerSkyFireworks,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'dhol_raas' | 'kite_duel'>('dhol_raas');
  const [beatPhase, setBeatPhase] = useState<number>(0);
  const [streak, setStreak] = useState<number>(1);
  const [sessionCoins, setSessionCoins] = useState<number>(0);
  const [sessionXp, setSessionXp] = useState<number>(0);
  const [lastFeedback, setLastFeedback] = useState<string>(
    'Tap any Dhol or Dandiya button in rhythm to build your Utsav Streak!'
  );
  const [kites, setKites] = useState<FloatingKite[]>(INITIAL_KITES);

  const { dialogRef, handleKeyDown } = useDialogFocus(isOpen, onClose);

  useEffect(() => {
    if (!isOpen) return;
    let animId = 0;
    const start = performance.now();
    const step = (now: number) => {
      const elapsed = (now - start) / 1000;
      setBeatPhase((elapsed * 1.15) % 1);
      animId = requestAnimationFrame(step);
    };
    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDrumStrike = (instrumentName: string) => {
    const result = evaluateRhythmTap(beatPhase, streak);
    setStreak(result.nextStreak);
    setSessionCoins((c) => c + result.coins);
    setSessionXp((x) => x + result.xp);

    if (result.grade === 'SAM_PERFECT') {
      melaverseAudio.playHeavySplash(true);
      setLastFeedback(
        `SAM PERFECT on ${instrumentName}! ×${result.nextStreak} Streak (+${result.coins} Coins · +${result.xp} XP)`
      );
    } else if (result.grade === 'TAAL_GOOD') {
      melaverseAudio.playHeavySplash(false);
      setLastFeedback(
        `TAAL SYNC on ${instrumentName}! ×${result.nextStreak} Streak (+${result.coins} Coins · +${result.xp} XP)`
      );
    } else {
      melaverseAudio.playGulalThrow('haldi');
      setLastFeedback(
        `${instrumentName} Beat! (+${result.coins} Coins · +${result.xp} XP)`
      );
    }

    onClaimReward(
      result.coins,
      result.xp,
      'Abhla Mirror-Work Dandiya Sticks Stamp'
    );
  };

  const handleCatchKite = (kiteId: number) => {
    setKites((prev) =>
      prev.map((k) => (k.id === kiteId ? { ...k, caught: true } : k))
    );
    melaverseAudio.playSacredChime();
    setSessionCoins((c) => c + 40);
    setSessionXp((x) => x + 55);
    setLastFeedback('KAI PO CHE! Soaring Uttarayan Kite Mastered (+40 Coins · +55 XP)');
    onClaimReward(40, 55, 'Firki Spool & Diamond Patang Stamp');
  };

  const handleResetKites = () => {
    setKites(INITIAL_KITES.map((k) => ({ ...k, caught: false })));
    melaverseAudio.playDashOrJump();
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4 pointer-events-auto"
      style={{ backgroundColor: 'rgba(12, 5, 4, 0.84)' }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rhythm-modal-title"
        onKeyDown={handleKeyDown}
        className="w-full max-w-2xl rounded-xl border border-[#F59E0B]/55 p-6 shadow-2xl text-[#FFF8F0]"
        style={{ backgroundColor: '#1C0D0A' }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#F59E0B]/25 pb-4 mb-4">
          <div>
            <h2
              id="rhythm-modal-title"
              className="text-xl md:text-2xl font-display font-bold text-[#FFFBEB]"
            >
              Mela Mini-Games: Dhol Raas &amp; Uttarayan Kites
            </h2>
            <p className="text-xs text-[#FDE68A]/85 mt-1">
              Play celebratory rhythm beats or soar across Makar Sankranti rooftops to earn instant Coins, XP, and Cultural Stamps.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Festival Mini-Games"
            className="touch-target-compact px-3 py-1.5 rounded-lg border border-[#F59E0B]/40 text-xs font-mono text-[#FDE68A] hover:bg-[#3A1B15] cursor-pointer"
          >
            ESC
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="inline-flex p-1 rounded-lg bg-[#120705] border border-[#F59E0B]/30">
            <button
              type="button"
              onClick={() => setActiveTab('dhol_raas')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'dhol_raas'
                  ? 'bg-[#E11D48] text-white'
                  : 'text-[#FDE68A] hover:text-white'
              }`}
            >
              1. Dhol &amp; Dandiya Raas
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('kite_duel')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'kite_duel'
                  ? 'bg-[#0284C7] text-white'
                  : 'text-[#FDE68A] hover:text-white'
              }`}
            >
              2. Uttarayan Sky Kites
            </button>
          </div>

          <div className="text-xs font-mono tabular-nums text-[#FBBF24]">
            Session Earned: +{sessionCoins} Coins · +{sessionXp} XP
          </div>
        </div>

        {activeTab === 'dhol_raas' ? (
          <div className="space-y-5">
            {/* Visual Taal Beat Meter */}
            <div className="p-4 rounded-xl bg-[#120705] border border-[#F59E0B]/35">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-mono text-[#FDE68A]">
                  TAAL RHYTHM RING (STREAK ×{streak})
                </span>
                <span className="font-mono text-[#10B981]">
                  GOLDEN ZONE = BONUS MULTIPLIER
                </span>
              </div>

              <div className="relative w-full h-7 rounded-full bg-[#24100B] border border-[#F59E0B]/40 overflow-hidden flex items-center">
                {/* Center & Edge Golden Beat Zones */}
                <div className="absolute left-0 w-[14%] h-full bg-[#F59E0B]/30" />
                <div className="absolute left-[43%] w-[14%] h-full bg-[#F59E0B]/40 border-x border-[#FBBF24]" />
                <div className="absolute right-0 w-[14%] h-full bg-[#F59E0B]/30" />

                {/* Moving Taal Indicator */}
                <div
                  className="w-5 h-5 rounded-full bg-[#FFFBEB] shadow-[0_0_12px_#F59E0B] border-2 border-[#E11D48]"
                  style={{
                    transform: `translateX(${Math.round(beatPhase * 520)}px)`,
                  }}
                />
              </div>

              <p className="text-xs text-[#FFF8F0]/90 mt-3 text-center font-medium">
                {lastFeedback}
              </p>
            </div>

            {/* 3 Easy One-Tap Traditional Percussion Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => handleDrumStrike('Braj Dholak')}
                className="touch-target-action flex flex-col items-center justify-center p-4 rounded-xl bg-[#2A1410] hover:bg-[#3F1E18] active:scale-95 border border-[#F59E0B]/50 transition-all cursor-pointer"
              >
                <span className="text-sm font-bold text-[#FBBF24]">
                  Strike Braj Dhol
                </span>
                <span className="text-[11px] text-[#FFF8F0]/80 mt-0.5">
                  Deep Bass Taal (Dha-Dhin)
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleDrumStrike('Garba Dandiya')}
                className="touch-target-action flex flex-col items-center justify-center p-4 rounded-xl bg-[#3A1222] hover:bg-[#521930] active:scale-95 border border-[#F43F5E]/50 transition-all cursor-pointer"
              >
                <span className="text-sm font-bold text-[#FDA4AF]">
                  Clash Dandiya Sticks
                </span>
                <span className="text-[11px] text-[#FFF8F0]/80 mt-0.5">
                  Navratri Raas Beat
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleDrumStrike('Temple Manjira')}
                className="touch-target-action flex flex-col items-center justify-center p-4 rounded-xl bg-[#132838] hover:bg-[#1B3950] active:scale-95 border border-[#38BDF8]/50 transition-all cursor-pointer"
              >
                <span className="text-sm font-bold text-[#7DD3FC]">
                  Ring Brass Manjira
                </span>
                <span className="text-[11px] text-[#FFF8F0]/80 mt-0.5">
                  High Chime Resonance
                </span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative w-full h-56 rounded-xl bg-gradient-to-b from-[#0C2D48] via-[#144272] to-[#2C1810] border border-[#38BDF8]/40 overflow-hidden p-4">
              <div className="text-xs font-mono text-[#BAE6FD]">
                Click the soaring Makar Sankranti Kites to reel them in (&ldquo;Kai Po Che!&rdquo;)
              </div>

              {kites.map((kite) =>
                !kite.caught ? (
                  <button
                    key={kite.id}
                    type="button"
                    onClick={() => handleCatchKite(kite.id)}
                    style={{
                      left: `${kite.xPct}%`,
                      top: `${kite.yPct}%`,
                      backgroundColor: kite.color,
                    }}
                    className="absolute w-12 h-12 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-sm border-2 border-white shadow-lg hover:scale-110 transition-transform cursor-pointer flex items-center justify-center"
                    aria-label={`Catch ${kite.label}`}
                  >
                    <span className="-rotate-45 text-[10px] font-mono font-bold text-white drop-shadow">
                      KITE
                    </span>
                  </button>
                ) : null
              )}

              {kites.every((k) => k.caught) && (
                <div className="inset-0 absolute flex flex-col items-center justify-center bg-black/50 p-4 text-center">
                  <div className="text-base font-display font-bold text-[#FBBF24]">
                    All 5 Uttarayan Sky Kites Captured!
                  </div>
                  <button
                    type="button"
                    onClick={handleResetKites}
                    className="mt-2 px-4 py-2 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-xs font-semibold text-white cursor-pointer"
                  >
                    Launch New Kite Wave
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-5 pt-4 border-t border-[#F59E0B]/25 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              onTriggerSkyFireworks();
              onClose();
            }}
            className="touch-target-action px-4 py-2.5 rounded-lg bg-[#D97706] hover:bg-[#B45309] text-white text-xs font-semibold cursor-pointer"
          >
            Launch 3D Courtyard Fireworks &amp; Return
          </button>

          <button
            type="button"
            onClick={onClose}
            className="touch-target-action px-5 py-2.5 rounded-lg bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-semibold cursor-pointer"
          >
            Done Playing
          </button>
        </div>
      </div>
    </div>
  );
};
