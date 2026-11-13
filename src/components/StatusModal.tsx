import React from 'react';
import type { GameState, GameOutcome } from '../game/rules';
import type { NpcCharacter } from '../game/worldData';
import { useDialogFocus } from '../utils/useDialogFocus';

interface StatusModalProps {
  gameState: GameState;
  outcome: GameOutcome;
  activeNpc: NpcCharacter | null;
  finalStats: {
    score: number;
    bestScore: number;
    revelersSplashed: number;
    targetRevelers: number;
    diyasLit: number;
    targetDiyas: number;
    clearTimeSec: number;
  };
  hasReplay?: boolean;
  onWatchReplay?: () => void;
  onResume: () => void;
  onRestart: () => void;
  onReturnToTitle: () => void;
  onCloseNpc: (npc: NpcCharacter) => void;
}

export const StatusModal: React.FC<StatusModalProps> = ({
  gameState,
  outcome,
  activeNpc,
  finalStats,
  hasReplay = false,
  onWatchReplay,
  onResume,
  onRestart,
  onReturnToTitle,
  onCloseNpc,
}) => {
  const isModalOpen =
    gameState === 'paused' || gameState === 'gameover' || activeNpc !== null;

  const handleDismiss = () => {
    if (activeNpc) {
      onCloseNpc(activeNpc);
    } else if (gameState === 'paused') {
      onResume();
    }
  };

  const { dialogRef, handleKeyDown } = useDialogFocus(isModalOpen, handleDismiss);

  if (!isModalOpen) return null;

  // 1. Cultural NPC Quest & Dialogue Modal
  if (activeNpc) {
    return (
      <div
        className="fixed inset-0 z-30 flex items-center justify-center p-4 pointer-events-auto"
        style={{ backgroundColor: 'rgba(12, 5, 4, 0.78)' }}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="npc-modal-title"
          onKeyDown={handleKeyDown}
          className="w-full max-w-lg rounded-xl border border-[#F59E0B]/55 p-6 shadow-2xl text-[#FFF8F0]"
          style={{ backgroundColor: '#1C0D0A' }}
        >
          <div className="text-xs font-mono text-[#F59E0B]">
            {activeNpc.role}
          </div>
          <h2
            id="npc-modal-title"
            className="text-xl font-display font-bold text-white mt-0.5"
          >
            {activeNpc.name}
          </h2>
          <p className="text-sm text-[#FFF8F0]/90 mt-3 leading-relaxed">
            “{activeNpc.greeting}”
          </p>

          <div className="mt-4 p-3.5 rounded-lg bg-[#120705] border border-[#F59E0B]/30 space-y-1.5">
            <div className="text-xs font-semibold text-[#FDE68A]">
              Cultural Mission: {activeNpc.questTitle}
            </div>
            <p className="text-xs text-[#FFF8F0]/85">{activeNpc.questDetail}</p>
            <div className="text-[11px] font-mono text-[#FBBF24] pt-1">
              Blessing Reward: +{activeNpc.rewardCoins} Coins · +{activeNpc.rewardXp} XP · {activeNpc.stampUnlocked}
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={() => onCloseNpc(activeNpc)}
              className="touch-target-action px-6 py-2.5 rounded-lg bg-[#E11D48] hover:bg-[#BE123C] text-white text-sm font-semibold cursor-pointer"
            >
              Accept Blessing &amp; Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Paused Modal
  if (gameState === 'paused') {
    return (
      <div
        className="fixed inset-0 z-30 flex items-center justify-center p-4 pointer-events-auto"
        style={{ backgroundColor: 'rgba(12, 5, 4, 0.82)' }}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="pause-modal-title"
          onKeyDown={handleKeyDown}
          className="w-full max-w-md rounded-xl border border-[#F59E0B]/55 p-6 shadow-2xl text-[#FFF8F0] text-center"
          style={{ backgroundColor: '#1C0D0A' }}
        >
          <div className="text-xs font-mono text-[#FDE68A] uppercase tracking-wider">
            MELAVERSE · BRAJ UTSAV
          </div>
          <h2
            id="pause-modal-title"
            className="text-2xl font-display font-bold text-white mt-1"
          >
            Festival Paused
          </h2>

          <div className="grid grid-cols-2 gap-3 my-5">
            <div className="p-3 rounded-lg bg-[#120705] border border-[#F59E0B]/30">
              <div className="text-[11px] text-[#FDE68A]/80">CURRENT SCORE</div>
              <div className="text-xl font-mono font-bold tabular-nums text-white mt-0.5">
                {Math.round(finalStats.score)}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-[#120705] border border-[#F59E0B]/30">
              <div className="text-[11px] text-[#FDE68A]/80">PROGRESS</div>
              <div className="text-xl font-mono font-bold tabular-nums text-[#FBBF24] mt-0.5">
                {finalStats.revelersSplashed}/{finalStats.targetRevelers}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onResume}
              className="touch-target-action w-full py-3 rounded-lg bg-[#E11D48] hover:bg-[#BE123C] text-white font-semibold text-sm cursor-pointer"
            >
              Resume Celebration
            </button>
            <button
              type="button"
              onClick={onRestart}
              className="touch-target-action w-full py-2.5 rounded-lg bg-[#2A1410] hover:bg-[#3F1E18] border border-[#F59E0B]/40 text-[#FFFBEB] font-medium text-sm cursor-pointer"
            >
              Restart Round
            </button>
            <button
              type="button"
              onClick={onReturnToTitle}
              className="touch-target-action w-full py-2.5 rounded-lg bg-[#120705] hover:bg-[#22100B] border border-[#F59E0B]/25 text-[#FDE68A] font-medium text-sm cursor-pointer"
            >
              Return to Title Screen
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Victory or Game Over Modal
  const isVictory = outcome === 'victory';

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4 pointer-events-auto"
      style={{ backgroundColor: 'rgba(12, 5, 4, 0.85)' }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="outcome-modal-title"
        onKeyDown={handleKeyDown}
        className="w-full max-w-md rounded-xl border border-[#F59E0B]/60 p-6 shadow-2xl text-[#FFF8F0] text-center"
        style={{ backgroundColor: '#1C0D0A' }}
      >
        <div className="text-xs font-mono text-[#F59E0B] uppercase tracking-wider">
          {isVictory ? 'UTSAV MASTERY COMPLETE' : 'UTSAV SPIRIT DEPLETED'}
        </div>
        <h2
          id="outcome-modal-title"
          className="text-2xl font-display font-bold text-white mt-1"
        >
          {isVictory ? 'Braj Holi Triumphant!' : 'Drenched in the Chowk!'}
        </h2>
        <p className="text-xs text-[#FDE68A]/85 mt-1.5">
          {isVictory
            ? 'Every sacred brass Diya shines and the entire courtyard celebrates in vibrant Gulal!'
            : 'Visit Mohanlal Halwai at the Gujiya Stall or use [Shift] Dash to evade telegraphed water splashes.'}
        </p>

        {/* 3 Tabular-Nums Mastery / Progress Stat Tiles */}
        <div className="grid grid-cols-3 gap-2.5 my-5">
          <div className="p-3 rounded-lg bg-[#120705] border border-[#F59E0B]/30">
            <div className="text-[10px] font-mono text-[#FDE68A]/80">
              SCORE / BEST
            </div>
            <div className="text-lg font-mono font-bold tabular-nums text-white mt-1">
              {Math.round(finalStats.score)} / {Math.round(finalStats.bestScore)}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-[#120705] border border-[#F59E0B]/30">
            <div className="text-[10px] font-mono text-[#FDE68A]/80">
              {isVictory ? 'CLEAR TIME' : 'COLORED'}
            </div>
            <div className="text-lg font-mono font-bold tabular-nums text-[#FBBF24] mt-1">
              {isVictory
                ? `${finalStats.clearTimeSec}s`
                : `${finalStats.revelersSplashed}/${finalStats.targetRevelers}`}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-[#120705] border border-[#F59E0B]/30">
            <div className="text-[10px] font-mono text-[#FDE68A]/80">
              DIYAS LIT
            </div>
            <div className="text-lg font-mono font-bold tabular-nums text-[#10B981] mt-1">
              {finalStats.diyasLit}/{finalStats.targetDiyas}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {hasReplay && onWatchReplay && (
            <button
              type="button"
              data-testid="watch-replay-btn"
              onClick={(e) => {
                e.currentTarget.blur();
                onWatchReplay();
              }}
              className="touch-target-action w-full py-3 rounded-lg bg-[#F59E0B] hover:bg-[#D97706] text-black font-bold text-sm cursor-pointer transition-colors"
            >
              Watch 30s Instant Replay
            </button>
          )}
          <button
            type="button"
            data-start="true"
            onClick={onRestart}
            className="touch-target-action w-full py-3 rounded-lg bg-[#E11D48] hover:bg-[#BE123C] text-white font-semibold text-sm cursor-pointer"
          >
            {isVictory ? 'Play Next Utsav Round' : 'Try Again'}
          </button>
          <button
            type="button"
            onClick={onReturnToTitle}
            className="touch-target-action w-full py-2.5 rounded-lg bg-[#120705] hover:bg-[#22100B] border border-[#F59E0B]/25 text-[#FDE68A] font-medium text-sm cursor-pointer"
          >
            Return to Title Screen
          </button>
        </div>
      </div>
    </div>
  );
};
