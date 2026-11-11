import React from 'react';
import type { AssetLoadProgress } from '../game/assetLoader';

interface LoadingScreenProps {
  progress: AssetLoadProgress;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ progress }) => {
  if (progress.isComplete) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 text-[#FFFBEB]"
      style={{ backgroundColor: '#120705' }}
      role="status"
      aria-live="polite"
      aria-label="Loading Grand Mela 3D Assets"
      data-testid="mela-loading-screen"
    >
      <div className="max-w-md w-full p-6 rounded-2xl border border-[#F59E0B]/45 bg-[#1E0D09] shadow-[0_20px_50px_rgba(0,0,0,0.9)] flex flex-col items-center text-center">
        <svg
          viewBox="0 0 64 64"
          className="w-14 h-14 mb-3 text-[#FBBF24]"
          aria-hidden="true"
        >
          <circle
            cx="32"
            cy="32"
            r="26"
            fill="none"
            stroke="#F59E0B"
            strokeWidth="2.5"
            strokeDasharray="6 4"
          />
          <circle
            cx="32"
            cy="32"
            r="16"
            fill="none"
            stroke="#F43F5E"
            strokeWidth="2"
          />
          <path
            d="M32 6 V58 M6 32 H58 M13.6 13.6 L50.4 50.4 M50.4 13.6 L13.6 50.4"
            stroke="#FDE68A"
            strokeWidth="1.5"
          />
          <circle cx="32" cy="32" r="5" fill="#FBBF24" />
        </svg>

        <h2 className="text-lg font-bold tracking-wide text-[#FDE68A]">
          GRAND MELA 3D ENGINE
        </h2>
        <p className="text-xs text-[#FFF8F0]/80 mt-1 mb-4 font-mono">
          {progress.currentStageLabel}
        </p>

        <div className="w-full h-2.5 bg-[#120705] rounded-full overflow-hidden border border-[#F59E0B]/35 mb-2">
          <div
            className="h-full bg-[#F59E0B] transition-all duration-150"
            style={{ width: `${progress.progressPct}%` }}
          />
        </div>

        <div className="w-full flex items-center justify-between text-[11px] font-mono text-[#FDE68A]">
          <span>
            ASSET STAGE {progress.loadedItems}/{progress.totalItems}
          </span>
          <span className="font-bold tabular-nums">{progress.progressPct}%</span>
        </div>
      </div>
    </div>
  );
};
