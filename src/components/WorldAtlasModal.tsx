import React, { useState } from 'react';
import { TWELVE_FESTIVAL_WORLDS, type FestivalWorldMeta } from '../game/worldData';
import type { FestivalWorldId } from '../game/rules';
import { useDialogFocus } from '../utils/useDialogFocus';
import { melaverseAudio } from '../game/audio';

interface WorldAtlasModalProps {
  isOpen: boolean;
  activeWorld: FestivalWorldId;
  unlockedStamps: string[];
  onTravelToWorld: (sceneId: FestivalWorldId, stampToAward: string) => void;
  onClose: () => void;
}

export const WorldAtlasModal: React.FC<WorldAtlasModalProps> = ({
  isOpen,
  unlockedStamps,
  onTravelToWorld,
  onClose,
}) => {
  const [selectedDest, setSelectedDest] = useState<FestivalWorldMeta>(
    TWELVE_FESTIVAL_WORLDS[0]
  );
  const { dialogRef, handleKeyDown } = useDialogFocus(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4 pointer-events-auto"
      style={{ backgroundColor: 'rgba(12, 5, 4, 0.85)' }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="atlas-modal-title"
        onKeyDown={handleKeyDown}
        className="w-full max-w-4xl max-h-[88vh] flex flex-col rounded-xl border border-[#F59E0B]/50 p-6 shadow-2xl text-[#FFF8F0]"
        style={{ backgroundColor: '#1C0D0A' }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#F59E0B]/25 pb-4 mb-4 shrink-0">
          <div>
            <h2
              id="atlas-modal-title"
              className="text-xl md:text-2xl font-display font-bold text-[#FFFBEB]"
            >
              Mela Central Portal &amp; 12-World Cultural Passport
            </h2>
            <p className="text-xs text-[#FDE68A]/85 mt-1">
              Explore all 12 interconnected Indian festival destinations, Hindu Panchang lunar/solar dates, regional architecture, and collected stamps ({unlockedStamps.length}/12).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close 12-World Atlas"
            className="touch-target-compact px-3 py-1.5 rounded-lg border border-[#F59E0B]/40 text-xs font-mono text-[#FDE68A] hover:bg-[#3A1B15] cursor-pointer"
          >
            ESC
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 overflow-y-auto pr-1">
          {/* Left 5 Cols: 12 Worlds Selector List */}
          <div className="md:col-span-5 space-y-1.5">
            {TWELVE_FESTIVAL_WORLDS.map((w) => {
              const isSelected = selectedDest.id === w.id;
              const hasStamp = unlockedStamps.includes(w.culturalCollectible);
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setSelectedDest(w)}
                  className={`w-full px-3.5 py-2.5 rounded-lg border text-left transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'border-white bg-[#3A1B15]'
                      : 'border-[#F59E0B]/25 bg-[#120705] hover:border-[#F59E0B]/60'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-[10px] font-mono text-[#FDE68A]/80">
                      {w.worldNumber} · {w.region}
                    </div>
                    <div className="text-xs font-semibold text-white truncate">
                      {w.title}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-mono shrink-0 ${
                      hasStamp ? 'text-[#10B981]' : 'text-[#FDE68A]/50'
                    }`}
                  >
                    {hasStamp ? 'STAMPED' : 'EXPLORE'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right 7 Cols: Selected Destination Detail & Travel Portal */}
          <div className="md:col-span-7 p-5 rounded-xl bg-[#120705] border border-[#F59E0B]/35 flex flex-col justify-between space-y-4">
            <div className="space-y-3.5">
              <div>
                <div className="text-xs font-mono text-[#F59E0B]">
                  {selectedDest.worldNumber} · {selectedDest.region} · {selectedDest.hinduCalendarTithi}
                </div>
                <h3 className="text-xl font-display font-bold text-white mt-1">
                  {selectedDest.title}
                </h3>
                <p className="text-xs text-[#FFF8F0]/85 mt-2 leading-relaxed">
                  {selectedDest.summary}
                </p>
              </div>

              <div className="space-y-2 border-t border-[#F59E0B]/20 pt-3 text-xs">
                <div>
                  <span className="font-semibold text-[#FDE68A]">
                    Regional Architecture:{' '}
                  </span>
                  <span className="text-[#FFF8F0]/90">
                    {selectedDest.architectureStyle}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-[#FDE68A]">
                    Ambient Audio Soundscape:{' '}
                  </span>
                  <span className="text-[#FFF8F0]/90">
                    {selectedDest.ambientAudioProfile}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-[#FDE68A]">
                    Cultural Passport Collectible:{' '}
                  </span>
                  <span className="text-[#FBBF24] font-medium">
                    {selectedDest.culturalCollectible}
                  </span>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-[#FDE68A] mb-1.5">
                  Signature Festival Experiences &amp; Mini-Games
                </div>
                <ul className="space-y-1 text-xs text-[#FFF8F0]/90 list-disc list-inside">
                  {selectedDest.signatureActivities.map((act) => (
                    <li key={act}>{act}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="pt-3 border-t border-[#F59E0B]/25 flex items-center justify-between gap-3">
              <div className="text-[11px] font-mono text-[#FDE68A]/80">
                Loads 3D Environment Profile &amp; Stamps Cultural Passport
              </div>
              <button
                type="button"
                onClick={() => {
                  melaverseAudio.playSacredChime();
                  onTravelToWorld(
                    selectedDest.playableSceneId,
                    selectedDest.culturalCollectible
                  );
                  onClose();
                }}
                className="touch-target-action px-5 py-2.5 rounded-lg bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
              >
                Travel to Destination Portal
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
