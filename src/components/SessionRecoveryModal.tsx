import React from 'react';
import {
  formatRecoveryAge,
  type SessionRecoverySnapshot,
} from '../game/sessionRecovery';
import { useDialogFocus } from '../utils/useDialogFocus';

interface SessionRecoveryModalProps {
  snapshot: SessionRecoverySnapshot | null;
  onRestore: (snapshot: SessionRecoverySnapshot) => void;
  onDiscard: () => void;
}

const WORLD_LABELS: Record<SessionRecoverySnapshot['activeWorld'], string> = {
  holi_braj: 'World 01 · Holi — Braj',
  diwali_ghat: 'World 02 · Diwali — Ghat',
  mela_central: 'Mela Central Hub',
};

export const SessionRecoveryModal: React.FC<SessionRecoveryModalProps> = ({
  snapshot,
  onRestore,
  onDiscard,
}) => {
  const isOpen = snapshot !== null;
  const { dialogRef, handleKeyDown } = useDialogFocus(isOpen, onDiscard);

  if (!snapshot) return null;

  const worldLabel = WORLD_LABELS[snapshot.activeWorld] ?? 'Holi — Braj';
  const savedAgeLabel = formatRecoveryAge(snapshot.savedAt);
  const stateLabel =
    snapshot.gameState === 'paused' ? 'Paused Session' : 'Active Gameplay';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-auto"
      style={{ backgroundColor: 'rgba(12, 5, 4, 0.86)' }}
      data-testid="session-recovery-backdrop"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-recovery-title"
        data-testid="session-recovery-modal"
        onKeyDown={handleKeyDown}
        className="w-full max-w-md rounded-xl border border-[#F59E0B]/65 p-6 shadow-2xl text-[#FFF8F0]"
        style={{ backgroundColor: '#1C0D0A' }}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#F59E0B]">
            SESSION RECOVERY · CRASH PROTECTION
          </span>
          <span className="text-[11px] font-mono text-[#FDE68A]/85 tabular-nums">
            {savedAgeLabel}
          </span>
        </div>

        <h2
          id="session-recovery-title"
          className="text-xl font-display font-bold text-white mt-1.5"
        >
          Restore Previous Festival Session?
        </h2>
        <p className="text-xs text-[#FDE68A]/90 mt-1.5 leading-relaxed">
          An autosaved checkpoint was preserved before your previous session ended unexpectedly. Restore your exact world position and state or start fresh.
        </p>

        <div className="grid grid-cols-2 gap-2.5 my-5">
          <div className="p-3 rounded-lg bg-[#120705] border border-[#F59E0B]/30">
            <div className="text-[10px] font-mono uppercase text-[#FDE68A]/75">
              DESTINATION
            </div>
            <div className="text-xs font-semibold text-white mt-1">
              {worldLabel}
            </div>
            <div className="text-[11px] font-mono text-[#FBBF24] mt-0.5">
              State: {stateLabel}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-[#120705] border border-[#F59E0B]/30">
            <div className="text-[10px] font-mono uppercase text-[#FDE68A]/75">
              SAVED COORDINATES
            </div>
            <div
              className="text-xs font-mono font-bold tabular-nums text-white mt-1"
              data-testid="recovery-coords"
            >
              X {snapshot.playerPosition.x.toFixed(1)} · Y{' '}
              {snapshot.playerPosition.y.toFixed(1)} · Z{' '}
              {snapshot.playerPosition.z.toFixed(1)}
            </div>
            <div className="text-[11px] font-mono tabular-nums text-[#10B981] mt-0.5">
              Score {Math.round(snapshot.score)} · Diyas {snapshot.diyasLit}/8
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            data-testid="restore-session-btn"
            onClick={(e) => {
              e.currentTarget.blur();
              onRestore(snapshot);
            }}
            className="touch-target-action w-full py-3 rounded-lg bg-[#E11D48] hover:bg-[#BE123C] text-white font-semibold text-sm cursor-pointer transition-colors"
          >
            Restore Session
          </button>
          <button
            type="button"
            data-testid="discard-session-btn"
            onClick={(e) => {
              e.currentTarget.blur();
              onDiscard();
            }}
            className="touch-target-action w-full py-2.5 rounded-lg bg-[#120705] hover:bg-[#2A1410] border border-[#F59E0B]/35 text-[#FDE68A] font-medium text-sm cursor-pointer transition-colors"
          >
            Discard &amp; Start Fresh
          </button>
        </div>
      </div>
    </div>
  );
};
