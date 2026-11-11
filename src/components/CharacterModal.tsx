import React from 'react';
import {
  ATTIRE_PRESETS,
  type CharacterAttirePreset,
} from '../game/worldData';
import { useDialogFocus } from '../utils/useDialogFocus';
import { melaverseAudio } from '../game/audio';

interface CharacterModalProps {
  isOpen: boolean;
  attire: CharacterAttirePreset;
  onChangeAttire: (next: CharacterAttirePreset) => void;
  onClose: () => void;
}

const KURTA_SWATCHES = ['#F59E0B', '#E11D48', '#1D4ED8', '#10B981', '#9333EA', '#FFFBEB'];
const PAGDI_SWATCHES = ['#E11D48', '#F59E0B', '#0284C7', '#10B981', '#BE123C'];
const SKIN_SWATCHES = ['#F1C27D', '#E0AC69', '#D99B72', '#C6865A', '#8D5524'];

export const CharacterModal: React.FC<CharacterModalProps> = ({
  isOpen,
  attire,
  onChangeAttire,
  onClose,
}) => {
  const { dialogRef, handleKeyDown } = useDialogFocus(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4 pointer-events-auto"
      style={{ backgroundColor: 'rgba(12, 5, 4, 0.82)' }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="char-modal-title"
        onKeyDown={handleKeyDown}
        className="w-full max-w-xl rounded-xl border border-[#F59E0B]/50 p-6 shadow-2xl text-[#FFF8F0]"
        style={{ backgroundColor: '#1C0D0A' }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#F59E0B]/25 pb-4 mb-5">
          <div>
            <h2
              id="char-modal-title"
              className="text-xl md:text-2xl font-display font-bold text-[#FFFBEB]"
            >
              Modular 3D Character &amp; Regional Attire
            </h2>
            <p className="text-xs text-[#FDE68A]/85 mt-1">
              Customize regional festival silhouettes (Kurta, Kediyu, Kasavu, Pagdi) rendered live on your 3D character mesh.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Character Customizer"
            className="touch-target-compact px-3 py-1.5 rounded-lg border border-[#F59E0B]/40 text-xs font-mono text-[#FDE68A] hover:bg-[#3A1B15] cursor-pointer"
          >
            ESC
          </button>
        </div>

        {/* Regional Collection Presets */}
        <div className="mb-5">
          <div className="text-xs font-semibold text-[#FDE68A] mb-2.5">
            Regional Festival Collections
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {ATTIRE_PRESETS.map((preset) => {
              const isSelected = attire.id === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    melaverseAudio.playFootstep();
                    onChangeAttire(preset);
                  }}
                  className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'border-white bg-[#3A1B15]'
                      : 'border-[#F59E0B]/30 bg-[#120705] hover:border-[#F59E0B]/70'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="w-4 h-4 rounded-full border border-white/40 shrink-0"
                      style={{ backgroundColor: preset.kurtaHex }}
                    />
                    <span
                      className="w-4 h-4 rounded-full border border-white/40 shrink-0"
                      style={{ backgroundColor: preset.pagdiHex }}
                    />
                    <span className="text-xs font-semibold text-white truncate">
                      {preset.name}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#FDE68A]/80">
                    {preset.regionOrigin}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Fine-Grained Modular Swatches */}
        <div className="space-y-4 border-t border-[#F59E0B]/25 pt-4">
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-[#FDE68A]">Kurta / Angarkha Silk Dye</span>
            <div className="flex items-center gap-2">
              {KURTA_SWATCHES.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  aria-label={`Kurta color ${hex}`}
                  onClick={() =>
                    onChangeAttire({ ...attire, id: 'custom', kurtaHex: hex })
                  }
                  className={`w-6 h-6 rounded-full border-2 cursor-pointer ${
                    attire.kurtaHex === hex ? 'border-white scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-[#FDE68A]">Pagdi / Dupatta Zari Crest</span>
            <div className="flex items-center gap-2">
              {PAGDI_SWATCHES.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  aria-label={`Pagdi color ${hex}`}
                  onClick={() =>
                    onChangeAttire({ ...attire, id: 'custom', pagdiHex: hex })
                  }
                  className={`w-6 h-6 rounded-full border-2 cursor-pointer ${
                    attire.pagdiHex === hex ? 'border-white scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-[#FDE68A]">Skin Tone</span>
            <div className="flex items-center gap-2">
              {SKIN_SWATCHES.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  aria-label={`Skin tone ${hex}`}
                  onClick={() =>
                    onChangeAttire({ ...attire, id: 'custom', skinHex: hex })
                  }
                  className={`w-6 h-6 rounded-full border-2 cursor-pointer ${
                    attire.skinHex === hex ? 'border-white scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="touch-target-action px-6 py-2.5 rounded-lg bg-[#E11D48] hover:bg-[#BE123C] text-white text-sm font-semibold cursor-pointer"
          >
            Save &amp; Return to Courtyard
          </button>
        </div>
      </div>
    </div>
  );
};
