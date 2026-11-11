import React, { useState } from 'react';
import {
  STUDIO_BLUEPRINT_DELIVERABLES,
  type BlueprintDeliverable,
} from '../game/blueprintData';
import { useDialogFocus } from '../utils/useDialogFocus';

interface BlueprintModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BlueprintModal: React.FC<BlueprintModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [selectedDoc, setSelectedDoc] = useState<BlueprintDeliverable>(
    STUDIO_BLUEPRINT_DELIVERABLES[0]
  );
  const { dialogRef, handleKeyDown } = useDialogFocus(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4 pointer-events-auto"
      style={{ backgroundColor: 'rgba(10, 4, 3, 0.88)' }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="blueprint-modal-title"
        onKeyDown={handleKeyDown}
        className="w-full max-w-5xl max-h-[90vh] flex flex-col rounded-xl border border-[#F59E0B]/55 p-6 shadow-2xl text-[#FFF8F0]"
        style={{ backgroundColor: '#180B08' }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#F59E0B]/25 pb-4 mb-4 shrink-0">
          <div>
            <h2
              id="blueprint-modal-title"
              className="text-xl md:text-2xl font-display font-bold text-[#FFFBEB]"
            >
              MELAVERSE — AAA Studio Master Development Blueprint (All 9 Deliverables)
            </h2>
            <p className="text-xs text-[#FDE68A]/85 mt-1">
              Complete production specification across Unreal Engine 5 C++, 12 Festival Worlds, Mobile LOD Pipelines, and 18-Table Supabase PostgreSQL RLS Architecture.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Studio Blueprint"
            className="touch-target-compact px-3 py-1.5 rounded-lg border border-[#F59E0B]/40 text-xs font-mono text-[#FDE68A] hover:bg-[#3A1B15] cursor-pointer"
          >
            ESC
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 overflow-hidden flex-1">
          {/* Left 4 Cols: 9 Deliverable Navigation Tabs */}
          <div className="md:col-span-4 space-y-1.5 overflow-y-auto pr-1">
            {STUDIO_BLUEPRINT_DELIVERABLES.map((doc) => {
              const isSelected = selectedDoc.id === doc.id;
              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => setSelectedDoc(doc)}
                  className={`w-full px-3.5 py-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'border-white bg-[#3A1B15]'
                      : 'border-[#F59E0B]/25 bg-[#120705] hover:border-[#F59E0B]/60'
                  }`}
                >
                  <div className="text-[10px] font-mono text-[#F59E0B]">
                    {doc.number}
                  </div>
                  <div className="text-xs font-semibold text-white truncate">
                    {doc.title}
                  </div>
                  <div className="text-[11px] text-[#FDE68A]/75 truncate">
                    {doc.roleOwner}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right 8 Cols: Active Deliverable Technical Specification */}
          <div className="md:col-span-8 p-5 rounded-xl bg-[#110604] border border-[#F59E0B]/35 overflow-y-auto space-y-5">
            <div className="border-b border-[#F59E0B]/20 pb-3.5">
              <div className="text-xs font-mono text-[#F59E0B]">
                {selectedDoc.number} · {selectedDoc.roleOwner}
              </div>
              <h3 className="text-xl font-display font-bold text-white mt-1">
                {selectedDoc.title}
              </h3>
              <p className="text-xs text-[#FDE68A]/90 mt-1">
                {selectedDoc.subtitle}
              </p>
              <div className="mt-3 space-y-1">
                {selectedDoc.highlights.map((h) => (
                  <div key={h} className="text-xs text-[#10B981] font-medium">
                    ✓ {h}
                  </div>
                ))}
              </div>
            </div>

            {selectedDoc.sections.map((sec) => (
              <div key={sec.heading} className="space-y-2">
                <h4 className="text-sm font-semibold text-[#FDE68A]">
                  {sec.heading}
                </h4>
                <div className="space-y-2 text-xs text-[#FFF8F0]/90 leading-relaxed">
                  {sec.body.map((paragraph, pIdx) => (
                    <p key={pIdx}>{paragraph}</p>
                  ))}
                </div>
                {sec.codeBlock && (
                  <div className="mt-2 rounded-lg border border-[#F59E0B]/30 bg-[#0A0302] p-3">
                    <div className="text-[11px] font-mono text-[#FBBF24] mb-1.5">
                      {sec.codeBlock.caption}
                    </div>
                    <pre className="text-[11px] font-mono text-[#E2E8F0] overflow-x-auto leading-snug">
                      <code>{sec.codeBlock.code}</code>
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
