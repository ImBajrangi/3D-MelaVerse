import React from 'react';
import type { FestivalWorldId } from '../game/rules';

interface TitleScreenProps {
  activeWorld: FestivalWorldId;
  onStartGame: () => void;
  onOpenCharacterModal: () => void;
  onOpenBlueprintModal: () => void;
  onSelectWorld: (world: FestivalWorldId) => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  activeWorld,
  onStartGame,
  onOpenCharacterModal,
  onOpenBlueprintModal,
  onSelectWorld,
}) => {
  return (
    <div
      className="fixed inset-0 z-20 flex flex-col justify-between p-6 md:p-12 pointer-events-none"
      style={{
        background:
          'linear-gradient(90deg, rgba(18, 8, 6, 0.78) 0%, rgba(18, 8, 6, 0.34) 36%, rgba(18, 8, 6, 0.0) 54%, rgba(18, 8, 6, 0.0) 100%)',
      }}
    >
      {/* Top-Left World Stage Switcher (Interactive 3D Live World Preview) */}
      <div className="flex flex-wrap items-center justify-between gap-4 pointer-events-auto">
        <div
          className="inline-flex items-center gap-1 p-1 rounded-lg border border-[#F59E0B]/35"
          style={{ backgroundColor: 'rgba(26, 12, 9, 0.90)' }}
          role="group"
          aria-label="Live 3D Stage Destination Preview"
        >
          <button
            type="button"
            onClick={() => onSelectWorld('holi_braj')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeWorld === 'holi_braj'
                ? 'bg-[#E11D48] text-white'
                : 'text-[#FDE68A] hover:text-white'
            }`}
          >
            World 01: Holi — Braj
          </button>
          <button
            type="button"
            onClick={() => onSelectWorld('diwali_ghat')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeWorld === 'diwali_ghat'
                ? 'bg-[#D97706] text-white'
                : 'text-[#FDE68A] hover:text-white'
            }`}
          >
            World 02: Diwali — Ghat
          </button>
          <button
            type="button"
            onClick={() => onSelectWorld('mela_central')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeWorld === 'mela_central'
                ? 'bg-[#0284C7] text-white'
                : 'text-[#FDE68A] hover:text-white'
            }`}
          >
            Mela Central Hub
          </button>
        </div>
      </div>

      {/* Asymmetric Left-Third Title Lockup & <= 3 Menu Actions over Calm Negative Space */}
      <div className="my-auto max-w-xl pointer-events-auto">
        {/* Bespoke Inline SVG Title Emblem Lockup */}
        <div className="mb-6">
          <svg
            viewBox="0 0 580 165"
            className="w-full max-w-[540px] h-auto drop-shadow-[0_6px_18px_rgba(0,0,0,0.85)]"
            role="img"
            aria-label="MELAVERSE — Celebrate Traditions. Explore India. Create Memories."
          >
            {/* Ornamental Sandstone & Brass Arch Crest */}
            <path
              d="M20 36 L155 36 L175 18 L195 36 L345 36 L365 18 L385 36 L520 36"
              fill="none"
              stroke="#F59E0B"
              strokeWidth="2.5"
              strokeOpacity="0.85"
            />
            {/* Central Mandir Kalash & Lotus Crest */}
            <path
              d="M270 4 L282 20 L270 32 L258 20 Z"
              fill="#F59E0B"
              stroke="#FFFBEB"
              strokeWidth="1.5"
            />
            <circle cx="242" cy="22" r="4" fill="#E11D48" />
            <circle cx="298" cy="22" r="4" fill="#38BDF8" />

            {/* Main Carved Title Wordmark */}
            <text
              x="20"
              y="102"
              fontFamily="Cinzel, Georgia, serif"
              fontSize="62"
              fontWeight="800"
              letterSpacing="5"
              fill="#FFFBEB"
              stroke="#2A110D"
              strokeWidth="6"
              style={{ paintOrder: 'stroke fill' }}
            >
              MELAVERSE
            </text>

            {/* Sindoor & Haldi Rule */}
            <path
              d="M22 118 L355 118"
              stroke="#E11D48"
              strokeWidth="3.5"
            />
            <path
              d="M363 118 L520 118"
              stroke="#F59E0B"
              strokeWidth="3.5"
            />

            {/* Cultural Tagline (Fully Contained within viewBox) */}
            <text
              x="22"
              y="146"
              fontFamily="Plus Jakarta Sans, sans-serif"
              fontSize="13"
              fontWeight="600"
              letterSpacing="1.6"
              fill="#FDE68A"
            >
              CELEBRATE TRADITIONS · EXPLORE INDIA · CREATE MEMORIES
            </text>
          </svg>
        </div>

        {/* <= 3 Primary & Secondary Actions on a Clean Single Row */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 mt-4">
          <button
            type="button"
            data-start="true"
            onClick={(e) => {
              e.currentTarget.blur();
              onStartGame();
            }}
            className="touch-target-action px-6 py-3.5 rounded-lg bg-[#E11D48] hover:bg-[#BE123C] active:translate-y-0.5 text-white font-semibold text-sm md:text-base tracking-wide shadow-[0_8px_24px_rgba(225,29,72,0.45)] border border-[#FDA4AF]/40 transition-all cursor-pointer whitespace-nowrap shrink-0"
          >
            Enter Braj Festival
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenCharacterModal();
            }}
            className="touch-target-action px-4 py-3.5 rounded-lg bg-[#27120E] hover:bg-[#3A1B15] text-[#FFFBEB] font-medium text-sm border border-[#F59E0B]/45 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Character &amp; Attire
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenBlueprintModal();
            }}
            className="touch-target-action px-4 py-3.5 rounded-lg bg-[#1E142B] hover:bg-[#2D1E40] text-[#FDE68A] font-medium text-sm border border-[#F59E0B]/45 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Studio Blueprint (9 Docs)
          </button>
        </div>
      </div>

      {/* Bottom Safe Margin: Single Flat Borderless Inline Control Hint Line */}
      <div className="pt-4">
        <p className="text-xs md:text-sm font-mono text-[#FDE68A]/95 tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
          WASD Move · Space / Click Fire Gulal · Q / Right-Click Lotus Shield · Shift Dash · F Rhythm &amp; Kites · V Fireworks · G Rangoli · B Blueprint
        </p>
      </div>
    </div>
  );
};
