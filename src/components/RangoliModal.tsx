import React, { useState } from 'react';
import { RANGOLI_PIGMENTS, DEFAULT_RANGOLI_GRID } from '../game/worldData';
import { scoreRangoliSymmetry } from '../game/rules';
import { useDialogFocus } from '../utils/useDialogFocus';
import { melaverseAudio } from '../game/audio';

interface RangoliModalProps {
  isOpen: boolean;
  grid: number[][];
  onUpdateGrid: (newGrid: number[][]) => void;
  onClaimReward: (coins: number, xp: number) => void;
  onClose: () => void;
}

const PRESET_PEACOCK_CHAKRA: number[][] = [
  [0, 4, 4, 2, 1, 2, 4, 4, 0],
  [4, 2, 6, 5, 2, 5, 6, 2, 4],
  [4, 6, 1, 2, 5, 2, 1, 6, 4],
  [2, 5, 2, 4, 6, 4, 2, 5, 2],
  [1, 2, 5, 6, 5, 6, 5, 2, 1],
  [2, 5, 2, 4, 6, 4, 2, 5, 2],
  [4, 6, 1, 2, 5, 2, 1, 6, 4],
  [4, 2, 6, 5, 2, 5, 6, 2, 4],
  [0, 4, 4, 2, 1, 2, 4, 4, 0],
];

const PRESET_DIYA_STAR: number[][] = [
  [0, 0, 2, 0, 1, 0, 2, 0, 0],
  [0, 2, 5, 2, 5, 2, 5, 2, 0],
  [2, 5, 1, 5, 2, 5, 1, 5, 2],
  [0, 2, 5, 6, 5, 6, 5, 2, 0],
  [1, 5, 2, 5, 1, 5, 2, 5, 1],
  [0, 2, 5, 6, 5, 6, 5, 2, 0],
  [2, 5, 1, 5, 2, 5, 1, 5, 2],
  [0, 2, 5, 2, 5, 2, 5, 2, 0],
  [0, 0, 2, 0, 1, 0, 2, 0, 0],
];

const PRESET_BRAJ_GEOMETRIC: number[][] = [
  [5, 0, 5, 0, 3, 0, 5, 0, 5],
  [0, 3, 5, 3, 5, 3, 5, 3, 0],
  [5, 5, 1, 5, 2, 5, 1, 5, 5],
  [0, 3, 5, 6, 5, 6, 5, 3, 0],
  [3, 5, 2, 5, 5, 5, 2, 5, 3],
  [0, 3, 5, 6, 5, 6, 5, 3, 0],
  [5, 5, 1, 5, 2, 5, 1, 5, 5],
  [0, 3, 5, 3, 5, 3, 5, 3, 0],
  [5, 0, 5, 0, 3, 0, 5, 0, 5],
];

export const RangoliModal: React.FC<RangoliModalProps> = ({
  isOpen,
  grid,
  onUpdateGrid,
  onClaimReward,
  onClose,
}) => {
  const [selectedPigment, setSelectedPigment] = useState<number>(1);
  const [mirrorSymmetry, setMirrorSymmetry] = useState<boolean>(true);
  const [rewardClaimed, setRewardClaimed] = useState<boolean>(false);
  const { dialogRef, handleKeyDown } = useDialogFocus(isOpen, onClose);

  if (!isOpen) return null;

  const stats = scoreRangoliSymmetry(grid);

  const handleCellClick = (r: number, c: number) => {
    const next = grid.map((row) => [...row]);
    const size = next.length;
    next[r][c] = selectedPigment;
    if (mirrorSymmetry) {
      next[r][size - 1 - c] = selectedPigment;
      next[size - 1 - r][c] = selectedPigment;
      next[size - 1 - r][size - 1 - c] = selectedPigment;
    }
    onUpdateGrid(next);
    melaverseAudio.playFootstep();
  };

  const handleApplyAndReward = () => {
    melaverseAudio.playSacredChime();
    if (!rewardClaimed) {
      setRewardClaimed(true);
      onClaimReward(stats.coinsReward, stats.xpReward);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4 pointer-events-auto"
      style={{ backgroundColor: 'rgba(12, 5, 4, 0.82)' }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rangoli-modal-title"
        onKeyDown={handleKeyDown}
        data-testid="rangoli-studio-modal"
        className="w-full max-w-3xl rounded-xl border border-[#F59E0B]/50 p-6 shadow-2xl text-[#FFF8F0]"
        style={{ backgroundColor: '#1C0D0A' }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#F59E0B]/25 pb-4 mb-5">
          <div>
            <h2
              id="rangoli-modal-title"
              className="text-xl md:text-2xl font-display font-bold text-[#FFFBEB]"
            >
              Sacred Rangoli 4-Pattern Selector &amp; Mandala Studio
            </h2>
            <p className="text-xs text-[#FDE68A]/85 mt-1">
              Choose one of the 4 sacred Rangoli patterns or paint custom symmetric mandalas. Your design stamps onto the 3D floor in real time!
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Rangoli Studio"
            className="touch-target-compact px-3 py-1.5 rounded-lg border border-[#F59E0B]/40 text-xs font-mono text-[#FDE68A] hover:bg-[#3A1B15] cursor-pointer"
          >
            ESC
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* Left 6 Cols: Interactive 9x9 Mandala Grid */}
          <div className="md:col-span-6 flex flex-col items-center">
            <div
              className="grid grid-cols-9 gap-1.5 p-3 rounded-xl border border-[#F59E0B]/40 bg-[#120705]"
              role="grid"
              aria-label="9 by 9 Rangoli Mandala Grid"
            >
              {grid.map((row, rIdx) =>
                row.map((val, cIdx) => {
                  const pigment = RANGOLI_PIGMENTS[val] || RANGOLI_PIGMENTS[0];
                  return (
                    <button
                      key={`${rIdx}-${cIdx}`}
                      type="button"
                      onClick={() => handleCellClick(rIdx, cIdx)}
                      aria-label={`Row ${rIdx + 1} Column ${cIdx + 1} (${pigment.name})`}
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-[#F59E0B]/30 transition-transform hover:scale-110 cursor-pointer flex items-center justify-center"
                      style={{ backgroundColor: pigment.hex }}
                    >
                      {val > 0 && (
                        <span className="w-2 h-2 rounded-full bg-[#FFFBEB]/80" />
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* 4-Pattern Quick Rangoli Selector */}
            <div className="grid grid-cols-2 gap-2 mt-3 w-full">
              <button
                type="button"
                data-testid="rangoli-pattern-lotus"
                onClick={() => {
                  melaverseAudio.playUiClick();
                  onUpdateGrid(DEFAULT_RANGOLI_GRID);
                }}
                className="px-2.5 py-1.5 rounded bg-[#2A1410] hover:bg-[#3F1E18] border border-[#F59E0B]/40 text-xs font-semibold text-[#FDE68A] cursor-pointer whitespace-nowrap"
              >
                1. Lotus Mandala
              </button>
              <button
                type="button"
                data-testid="rangoli-pattern-peacock"
                onClick={() => {
                  melaverseAudio.playUiClick();
                  onUpdateGrid(PRESET_PEACOCK_CHAKRA);
                }}
                className="px-2.5 py-1.5 rounded bg-[#2A1410] hover:bg-[#3F1E18] border border-[#F59E0B]/40 text-xs font-semibold text-[#FDE68A] cursor-pointer whitespace-nowrap"
              >
                2. Peacock Chakra
              </button>
              <button
                type="button"
                data-testid="rangoli-pattern-diya"
                onClick={() => {
                  melaverseAudio.playUiClick();
                  onUpdateGrid(PRESET_DIYA_STAR);
                }}
                className="px-2.5 py-1.5 rounded bg-[#2A1410] hover:bg-[#3F1E18] border border-[#F59E0B]/40 text-xs font-semibold text-[#FDE68A] cursor-pointer whitespace-nowrap"
              >
                3. Diya Star
              </button>
              <button
                type="button"
                data-testid="rangoli-pattern-braj"
                onClick={() => {
                  melaverseAudio.playUiClick();
                  onUpdateGrid(PRESET_BRAJ_GEOMETRIC);
                }}
                className="px-2.5 py-1.5 rounded bg-[#2A1410] hover:bg-[#3F1E18] border border-[#F59E0B]/40 text-xs font-semibold text-[#FDE68A] cursor-pointer whitespace-nowrap"
              >
                4. Braj Geometric
              </button>
            </div>
          </div>

          {/* Right 6 Cols: Pigment Swatches, Symmetry Toggle & Score */}
          <div className="md:col-span-6 space-y-4">
            <div>
              <div className="text-xs font-semibold text-[#FDE68A] mb-2">
                Select Traditional Pigment
              </div>
              <div className="grid grid-cols-2 gap-2">
                {RANGOLI_PIGMENTS.slice(1).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPigment(p.id)}
                    className={`px-3 py-2 rounded-lg border text-left flex items-center gap-2 text-xs cursor-pointer transition-colors ${
                      selectedPigment === p.id
                        ? 'border-white bg-[#3A1B15] font-semibold'
                        : 'border-[#F59E0B]/25 bg-[#120705] hover:border-[#F59E0B]/60'
                    }`}
                  >
                    <span
                      className="w-4 h-4 rounded-full shrink-0 border border-white/40"
                      style={{ backgroundColor: p.hex }}
                    />
                    <span className="whitespace-nowrap">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2.5 text-xs text-[#FFFBEB] cursor-pointer">
              <input
                type="checkbox"
                checked={mirrorSymmetry}
                onChange={(e) => setMirrorSymmetry(e.target.checked)}
                className="rounded accent-[#E11D48] w-4 h-4"
              />
              <span>4-Quadrant Mandala Mirror Brush</span>
            </label>

            {/* Live Symmetry & Reward Metrics */}
            <div className="p-3.5 rounded-lg bg-[#120705] border border-[#F59E0B]/30 space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-[#FDE68A]/80">Mandala Symmetry</span>
                <span className="font-mono font-bold tabular-nums text-white whitespace-nowrap">
                  {stats.symmetryScore}%
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-[#FDE68A]/80">Artisan Reward</span>
                <span className="font-mono font-bold tabular-nums text-[#FBBF24] whitespace-nowrap">
                  +{stats.coinsReward} Coins · +{stats.xpReward} XP
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleApplyAndReward}
              className="touch-target-action w-full py-3 px-4 rounded-lg bg-[#E11D48] hover:bg-[#BE123C] text-white font-semibold text-sm shadow-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              Bind to 3D Courtyard &amp; Claim Reward
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
