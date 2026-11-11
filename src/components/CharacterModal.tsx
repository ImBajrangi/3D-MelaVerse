import React, { useState } from 'react';
import {
  ATTIRE_PRESETS,
  GULAL_TRAIL_SWATCHES,
  LOTUS_SHIELD_SKINS,
  type CharacterAttirePreset,
} from '../game/worldData';
import { useMelaStore } from '../store/useMelaStore';
import { useDialogFocus } from '../utils/useDialogFocus';
import { melaverseAudio } from '../game/audio';

interface CharacterModalProps {
  isOpen: boolean;
  attire: CharacterAttirePreset;
  onChangeAttire: (next: CharacterAttirePreset) => void;
  onClose: () => void;
}

const KURTA_SWATCHES = [
  '#F59E0B',
  '#E11D48',
  '#1D4ED8',
  '#10B981',
  '#9333EA',
  '#0284C7',
];
const PAGDI_SWATCHES = ['#E11D48', '#F59E0B', '#0284C7', '#10B981', '#BE123C'];
const SKIN_SWATCHES = ['#F1C27D', '#E0AC69', '#D99B72', '#C6865A', '#8D5524'];

export const CharacterModal: React.FC<CharacterModalProps> = ({
  isOpen,
  attire,
  onChangeAttire,
  onClose,
}) => {
  const { dialogRef, handleKeyDown } = useDialogFocus(isOpen, onClose);
  const coins = useMelaStore((s) => s.coins);
  const unlockedAttireIds = useMelaStore((s) => s.unlockedAttireIds);
  const unlockAttire = useMelaStore((s) => s.unlockAttire);
  const equippedTrailColorHex = useMelaStore((s) => s.equippedTrailColorHex);
  const setEquippedTrailColorHex = useMelaStore(
    (s) => s.setEquippedTrailColorHex
  );
  const equippedShieldSkin = useMelaStore((s) => s.equippedShieldSkin);
  const setEquippedShieldSkin = useMelaStore((s) => s.setEquippedShieldSkin);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4 pointer-events-auto"
      style={{ backgroundColor: 'rgba(10, 5, 4, 0.84)' }}
      data-testid="character-attire-modal"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="char-modal-title"
        onKeyDown={handleKeyDown}
        className="w-full max-w-2xl rounded-xl border border-[#F59E0B]/50 p-6 shadow-2xl text-[#FFF8F0] max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: '#190B08' }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#F59E0B]/25 pb-4 mb-5">
          <div>
            <h2
              id="char-modal-title"
              className="text-xl md:text-2xl font-display font-bold text-[#FFFBEB]"
            >
              Character &amp; Attire · Festival Wardrobe
            </h2>
            <p className="text-xs text-[#FDE68A]/85 mt-1">
              Spend earned Mela Coins to unlock outfits, Gulal dash trails, and
              Sacred Lotus Shield skins on your 3D character mesh.
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <span
              className="px-3 py-1.5 rounded-lg bg-[#2A1410] border border-[#FBBF24]/50 text-xs font-mono font-bold text-[#FBBF24]"
              data-testid="char-modal-coins"
            >
              🪙 {Math.round(coins)} Coins
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Character Customizer"
              className="touch-target-compact px-3 py-1.5 rounded-lg border border-[#F59E0B]/40 text-xs font-mono text-[#FDE68A] hover:bg-[#3A1B15] cursor-pointer"
            >
              ESC
            </button>
          </div>
        </div>

        {statusMsg && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-[#10B981]/20 border border-[#10B981] text-xs font-mono font-bold text-[#A7F3D0]">
            {statusMsg}
          </div>
        )}

        {/* 1. Unlockable Regional Festival Outfits */}
        <div className="mb-5">
          <div className="text-xs font-mono font-bold uppercase tracking-wider text-[#FDE68A] mb-2.5">
            1. Festive Outfits (Kurta, Sherwani, Lehenga, Neon Jacket)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {ATTIRE_PRESETS.map((preset) => {
              const isUnlocked =
                preset.unlockCostCoins === 0 ||
                unlockedAttireIds.includes(preset.id);
              const isSelected = attire.id === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  data-testid={`attire-preset-${preset.id}`}
                  onClick={() => {
                    if (isUnlocked) {
                      melaverseAudio.playUiClick();
                      unlockAttire(preset.id, 0);
                      onChangeAttire(preset);
                      setStatusMsg(`Equipped ${preset.name}!`);
                    } else {
                      const ok = unlockAttire(
                        preset.id,
                        preset.unlockCostCoins
                      );
                      if (ok) {
                        melaverseAudio.playCoinCollect();
                        onChangeAttire(preset);
                        setStatusMsg(
                          `Unlocked & Equipped ${preset.name} (-${preset.unlockCostCoins} Coins)!`
                        );
                      } else {
                        melaverseAudio.playUiClick();
                        setStatusMsg(
                          `Need ${preset.unlockCostCoins} Coins to unlock ${preset.name}.`
                        );
                      }
                    }
                  }}
                  className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'border-white bg-[#3A1B15] shadow-[0_0_14px_rgba(245,158,11,0.3)]'
                      : 'border-[#F59E0B]/30 bg-[#120705] hover:border-[#F59E0B]/70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-white/40 shrink-0"
                        style={{ backgroundColor: preset.kurtaHex }}
                      />
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-white/40 shrink-0"
                        style={{ backgroundColor: preset.pagdiHex }}
                      />
                      <span className="text-xs font-semibold text-white truncate">
                        {preset.name}
                      </span>
                    </div>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 ${
                        isSelected
                          ? 'bg-[#10B981] text-[#052E16]'
                          : isUnlocked
                          ? 'bg-white/10 text-[#FDE68A]'
                          : 'bg-[#F59E0B]/20 text-[#FBBF24] border border-[#F59E0B]/40'
                      }`}
                    >
                      {isSelected
                        ? 'EQUIPPED'
                        : isUnlocked
                        ? 'OWNED'
                        : `🪙 ${preset.unlockCostCoins}`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[#FDE68A]/80">
                    <span>{preset.regionOrigin}</span>
                    {preset.perkLabel && (
                      <span className="text-[#38BDF8] font-mono text-[10px]">
                        {preset.perkLabel}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Lotus Shield Skins */}
        <div className="mb-5 border-t border-[#F59E0B]/20 pt-4">
          <div className="text-xs font-mono font-bold uppercase tracking-wider text-[#FDE68A] mb-2.5">
            2. Sacred Lotus Shield Skin ([Q / Right-Click])
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {LOTUS_SHIELD_SKINS.map((skin) => {
              const active = equippedShieldSkin === skin.id;
              return (
                <button
                  key={skin.id}
                  type="button"
                  data-testid={`shield-skin-${skin.id}`}
                  onClick={() => {
                    melaverseAudio.playUiClick();
                    setEquippedShieldSkin(skin.id);
                    setStatusMsg(`Selected ${skin.name} Shield Skin!`);
                  }}
                  className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                    active
                      ? 'border-white bg-[#2E1510]'
                      : 'border-[#F59E0B]/25 bg-[#120705] hover:border-[#F59E0B]/60'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="w-4 h-4 rounded-full border-2 shrink-0"
                      style={{
                        backgroundColor: skin.domeHex,
                        borderColor: skin.rimHex,
                      }}
                    />
                    <span className="text-xs font-semibold text-white truncate">
                      {skin.name}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-[#FDE68A]/75">
                    {active ? 'Active Dome Skin' : 'Click to Equip'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Gulal Dash Trail & Custom Dye Swatches */}
        <div className="space-y-3.5 border-t border-[#F59E0B]/25 pt-4">
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs font-medium text-[#FDE68A]">
              Marigold &amp; Gulal Dash Trail Color ([Shift])
            </span>
            <div className="flex items-center gap-2">
              {GULAL_TRAIL_SWATCHES.map((swatch) => (
                <button
                  key={swatch.id}
                  type="button"
                  data-testid={`trail-color-${swatch.id}`}
                  aria-label={`Dash trail ${swatch.label}`}
                  onClick={() => {
                    melaverseAudio.playUiClick();
                    setEquippedTrailColorHex(swatch.hex);
                  }}
                  className={`w-6 h-6 rounded-full border-2 cursor-pointer transition-transform ${
                    equippedTrailColorHex === swatch.hex
                      ? 'border-white scale-115'
                      : 'border-transparent'
                  }`}
                  style={{ backgroundColor: swatch.hex }}
                  title={swatch.label}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-[#FDE68A]">
              Custom Kurta / Sherwani Dye
            </span>
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
                    attire.kurtaHex === hex
                      ? 'border-white scale-110'
                      : 'border-transparent'
                  }`}
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-[#FDE68A]">
              Pagdi / Dupatta Zari Crest
            </span>
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
                    attire.pagdiHex === hex
                      ? 'border-white scale-110'
                      : 'border-transparent'
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
                    attire.skinHex === hex
                      ? 'border-white scale-110'
                      : 'border-transparent'
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
            data-testid="close-character-modal-btn"
            onClick={onClose}
            className="touch-target-action px-6 py-2.5 rounded-lg bg-[#E11D48] hover:bg-[#BE123C] text-white text-sm font-semibold cursor-pointer"
          >
            Save &amp; Return to Festival
          </button>
        </div>
      </div>
    </div>
  );
};
