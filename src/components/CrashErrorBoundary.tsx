import React from 'react';
import {
  clearRecoverySnapshotFromStorage,
  formatRecoveryAge,
  loadRecoverySnapshotFromStorage,
} from '../game/sessionRecovery';

interface CrashErrorBoundaryProps {
  children: React.ReactNode;
}

interface CrashErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class CrashErrorBoundary extends React.Component<
  CrashErrorBoundaryProps,
  CrashErrorBoundaryState
> {
  constructor(props: CrashErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
    };
  }

  static getDerivedStateFromError(error: unknown): CrashErrorBoundaryState {
    const message =
      error instanceof Error ? error.message : 'Unexpected runtime error';
    return {
      hasError: true,
      errorMessage: message,
    };
  }

  componentDidCatch(error: unknown) {
    console.error('MELAVERSE runtime crash caught by CrashErrorBoundary:', error);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const savedSnapshot = loadRecoverySnapshotFromStorage();

    return (
      <main
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ backgroundColor: '#120705' }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="crash-boundary-title"
          className="w-full max-w-md rounded-xl border border-[#E11D48]/60 p-6 shadow-2xl text-[#FFF8F0]"
          style={{ backgroundColor: '#1C0D0A' }}
        >
          <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#F43F5E]">
            UNEXPECTED RUNTIME INTERRUPTION
          </div>
          <h1
            id="crash-boundary-title"
            className="text-xl font-display font-bold text-white mt-1.5"
          >
            Festival Session Interrupted
          </h1>
          <p className="text-xs text-[#FDE68A]/90 mt-2 leading-relaxed">
            {savedSnapshot
              ? `Your last autosave (${formatRecoveryAge(
                  savedSnapshot.savedAt
                )}) is safely preserved in local storage.`
              : 'An unexpected error occurred while rendering the festival world.'}
          </p>

          {this.state.errorMessage && (
            <div className="mt-3 p-2.5 rounded-lg bg-[#120705] border border-white/10 text-[11px] font-mono text-[#FDA4AF] break-words">
              {this.state.errorMessage}
            </div>
          )}

          <div className="mt-5 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="touch-target-action w-full py-3 rounded-lg bg-[#E11D48] hover:bg-[#BE123C] text-white font-semibold text-sm cursor-pointer"
            >
              {savedSnapshot ? 'Reload & Restore Session' : 'Reload Application'}
            </button>
            {savedSnapshot && (
              <button
                type="button"
                onClick={() => {
                  clearRecoverySnapshotFromStorage();
                  window.location.href = '/';
                }}
                className="touch-target-action w-full py-2.5 rounded-lg bg-[#120705] hover:bg-[#2A1410] border border-[#F59E0B]/35 text-[#FDE68A] font-medium text-sm cursor-pointer"
              >
                Discard Checkpoint &amp; Restart
              </button>
            )}
          </div>
        </div>
      </main>
    );
  }
}
