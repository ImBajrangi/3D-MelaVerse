import React from 'react';
import type { FestivalWorldId } from '../game/rules';

interface TitleScreenProps {
  activeWorld: FestivalWorldId;
  onStartGame: () => void;
  onOpenCharacterModal: () => void;
  onOpenBlueprintModal: () => void;
  onSelectWorld: (world: FestivalWorldId) => void;
}

const WORLD_PREVIEW_DETAILS: Record<
  FestivalWorldId,
  {
    badge: string;
    ctaLabel: string;
    subtitle: string;
    highlights: string;
  }
> = {
  holi_braj: {
    badge: 'WORLD 01 · HOLI — BRAJ',
    ctaLabel: 'Enter Holi — Braj Festival',
    subtitle:
      'Ornate Braj Mandap, Kadamba & Banyan Groves, Color Vats & Festive Revelers',
    highlights:
      '[Space/LMB] Fire Gulal & Fill NPC Joy Bars · [Q/RMB] Pink/Gold Lotus Shield · [Shift] Marigold Dash',
  },
  diwali_ghat: {
    badge: 'WORLD 02 · DIWALI — GHAT',
    ctaLabel: 'Enter Diwali — Ghat Festival',
    subtitle:
      'Stepped Riverside Ghat, Reflective Water, Floating Diyas & Sky Lanterns',
    highlights:
      '[R] Rhythm & Diyas Beat Ring · [F] Multi-Stage Palm, Chakra & Star Fireworks · River Reflections',
  },
  mela_central: {
    badge: 'MELA CENTRAL HUB',
    ctaLabel: 'Enter Mela Central Hub',
    subtitle:
      'Aakash Jhula Giant Wheel, Carnival Stalls, World Portals & Floor Rangoli',
    highlights:
      '[E] Board Giant Wheel Gondola · [G] Stamp Glowing Floor Rangoli · Balloon & Ring Toss Stalls',
  },
};

export const TitleScreen: React.FC<TitleScreenProps> = ({
  activeWorld,
  onStartGame,
  onOpenCharacterModal,
  onOpenBlueprintModal,
  onSelectWorld,
}) => {
  const worldDetail =
    WORLD_PREVIEW_DETAILS[activeWorld] ?? WORLD_PREVIEW_DETAILS.holi_braj;

  return (
    <div
      className="fixed inset-0 z-20 flex flex-col justify-between p-8 bg-gradient-to-r from-black/80 via-black/40 to-transparent pointer-events-none"
      data-testid="landing-menu-overlay"
    >
      {/* Top-Left World Stage Switcher (Aligned to 32px / p-8 outer screen margin grid) */}
      <div className="flex flex-wrap items-center justify-between gap-4 pointer-events-auto">
        <div
          className="inline-flex items-center gap-1 p-1.5 rounded-xl border border-white/15 bg-black/75 backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.65)]"
          role="group"
          aria-label="Live 3D Stage Destination Preview"
        >
          <button
            type="button"
            data-testid="world-pill-holi"
            onClick={() => onSelectWorld('holi_braj')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeWorld === 'holi_braj'
                ? 'bg-[#E11D48] text-white shadow-[0_0_12px_rgba(225,29,72,0.5)]'
                : 'text-[#FDE68A] hover:text-white hover:bg-white/10'
            }`}
          >
            World 01: Holi — Braj
          </button>
          <button
            type="button"
            data-testid="world-pill-diwali"
            onClick={() => onSelectWorld('diwali_ghat')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeWorld === 'diwali_ghat'
                ? 'bg-[#D97706] text-white shadow-[0_0_12px_rgba(217,119,6,0.5)]'
                : 'text-[#FDE68A] hover:text-white hover:bg-white/10'
            }`}
          >
            World 02: Diwali — Ghat
          </button>
          <button
            type="button"
            data-testid="world-pill-mela"
            onClick={() => onSelectWorld('mela_central')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeWorld === 'mela_central'
                ? 'bg-[#0284C7] text-white shadow-[0_0_12px_rgba(2,132,199,0.5)]'
                : 'text-[#FDE68A] hover:text-white hover:bg-white/10'
            }`}
          >
            Mela Central Hub
          </button>
        </div>
      </div>

      {/* Left 35% Editorial Column: Title Lockup, Subtle Brief & CTA Buttons (Right 65% Unobstructed 3D Focal Vista) */}
      <div className="my-auto w-full max-w-[520px] pointer-events-auto">
        <div className="mb-3">
          <svg
            viewBox="0 0 580 165"
            className="w-full max-w-[460px] h-auto drop-shadow-[0_6px_18px_rgba(0,0,0,0.9)]"
            role="img"
            aria-label="MELAVERSE — Celebrate Traditions. Explore India. Create Memories."
          >
            {/* Ornamental Sandstone & Brass Arch Crest */}
            <path
              d="M20 36 L155 36 L175 18 L195 36 L345 36 L365 18 L385 36 L520 36"
              fill="none"
              stroke="#F5B841"
              strokeWidth="2.5"
              strokeOpacity="0.85"
            />
            {/* Central Mandir Kalash & Lotus Crest */}
            <path
              d="M270 4 L282 20 L270 32 L258 20 Z"
              fill="#F5B841"
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
              stroke="#140C1C"
              strokeWidth="6"
              style={{ paintOrder: 'stroke fill' }}
            >
              MELAVERSE
            </text>

            {/* Sindoor & Haldi Rule */}
            <path d="M22 118 L355 118" stroke="#E11D48" strokeWidth="3.5" />
            <path d="M363 118 L520 118" stroke="#F5B841" strokeWidth="3.5" />

            {/* Cultural Tagline */}
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

        {/* Clean Editorial World Preview Caption (100% Contrast via Left Gradient Backdrop without Heavy Boxes) */}
        <div className="mb-5 pl-3.5 border-l-2 border-[#F5B841]/80">
          <div className="text-[11px] font-mono font-bold tracking-wider text-[#F5B841] uppercase mb-0.5">
            {worldDetail.badge} · ORBITAL 3D PREVIEW
          </div>
          <div className="text-sm font-semibold text-white mb-1 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
            {worldDetail.subtitle}
          </div>
          <div className="text-[11px] font-mono text-[#FDE68A]/90 drop-shadow-[0_1px_6px_rgba(0,0,0,0.9)]">
            {worldDetail.highlights}
          </div>
        </div>

        {/* Primary & Secondary CTA Buttons */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
          <button
            type="button"
            data-start="true"
            data-testid="enter-festival-btn"
            onClick={(e) => {
              e.currentTarget.blur();
              onStartGame();
            }}
            className="touch-target-action px-6 py-3.5 rounded-lg bg-[#E11D48] hover:bg-[#BE123C] active:translate-y-0.5 text-white font-semibold text-sm md:text-base tracking-wide shadow-[0_8px_24px_rgba(225,29,72,0.45)] border border-[#FDA4AF]/40 transition-all cursor-pointer whitespace-nowrap shrink-0"
          >
            {worldDetail.ctaLabel}
          </button>

          <button
            type="button"
            data-testid="open-character-modal-btn"
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenCharacterModal();
            }}
            className="touch-target-action px-4 py-3.5 rounded-lg bg-black/75 hover:bg-white/15 text-[#FFFBEB] font-medium text-sm border border-[#F5B841]/45 backdrop-blur-md transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Character &amp; Attire
          </button>

          <button
            type="button"
            data-testid="open-blueprint-modal-btn"
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenBlueprintModal();
            }}
            className="touch-target-action px-4 py-3.5 rounded-lg bg-black/75 hover:bg-white/15 text-[#FDE68A] font-medium text-sm border border-[#F5B841]/45 backdrop-blur-md transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Studio Blueprint
          </button>
        </div>
      </div>

      {/* Bottom Safe Margin (Aligned to 32px / p-8 outer screen margin grid) */}
      <div className="pt-2 flex items-center">
        <div
          data-testid="orbital-controls-badge"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/75 border border-white/15 text-[11px] font-mono text-[#FDE68A]/95 backdrop-blur-md shadow-[0_4px_12px_rgba(0,0,0,0.75)]"
        >
          <span className="w-2 h-2 rounded-full bg-[#10B981]" />
          <span>
            Ready: WASD Move · Space Fire · Q Shield · E Board Ride / Play Stall · G Rangoli
          </span>
        </div>
      </div>
    </div>
  );
};

