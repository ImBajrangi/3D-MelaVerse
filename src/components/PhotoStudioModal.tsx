import React, { useState } from 'react';
import type { FestivalWorldId } from '../game/rules';

interface PhotoStudioModalProps {
  isOpen: boolean;
  activeWorld: FestivalWorldId;
  photoFov: number;
  photoAspectRatio: '16:9' | '1:1' | '2.39:1';
  photoDepthBlur: number;
  photoWatermark: boolean;
  isHudHidden: boolean;
  onChangeFov: (fov: number) => void;
  onChangeAspectRatio: (ratio: '16:9' | '1:1' | '2.39:1') => void;
  onChangeDepthBlur: (blur: number) => void;
  onChangeWatermark: (watermark: boolean) => void;
  onToggleHud: () => void;
  onCaptureSnapshot: (watermark: boolean, aspect: '16:9' | '1:1' | '2.39:1') => void;
  onClose: () => void;
}

const LENS_PRESETS = [
  { mm: '24mm', fov: 70, label: 'Wide Landscape' },
  { mm: '35mm', fov: 54, label: 'Street Cinema' },
  { mm: '50mm', fov: 45, label: 'Standard Prime' },
  { mm: '85mm', fov: 28, label: 'Portrait Tele' },
];

export const PhotoStudioModal: React.FC<PhotoStudioModalProps> = ({
  isOpen,
  activeWorld,
  photoFov,
  photoAspectRatio,
  photoDepthBlur,
  photoWatermark,
  isHudHidden,
  onChangeFov,
  onChangeAspectRatio,
  onChangeDepthBlur,
  onChangeWatermark,
  onToggleHud,
  onCaptureSnapshot,
  onClose,
}) => {
  const [showGrid, setShowGrid] = useState(true);
  const [justSnapped, setJustSnapped] = useState(false);

  if (!isOpen) return null;

  const worldTitle =
    activeWorld === 'holi_braj'
      ? 'Holi — Braj Haveli'
      : activeWorld === 'diwali_ghat'
      ? 'Diwali — Sacred Ghat'
      : 'Grand Mela Central Hub';

  const handleCapture = () => {
    setJustSnapped(true);
    onCaptureSnapshot(photoWatermark, photoAspectRatio);
    setTimeout(() => setJustSnapped(false), 900);
  };

  return (
    <div
      className="fixed inset-0 z-50 pointer-events-none select-none"
      role="dialog"
      aria-modal="true"
      aria-label="Cinematic Photo Studio"
    >
      {/* 1. Aspect Ratio Mask Overlays */}
      {photoAspectRatio === '2.39:1' && (
        <>
          <div className="absolute top-0 left-0 right-0 h-[11%] bg-black/95 z-10 pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 h-[11%] bg-black/95 z-10 pointer-events-none" />
        </>
      )}
      {photoAspectRatio === '1:1' && (
        <>
          <div className="absolute top-0 bottom-0 left-0 w-[calc(50vw-50vh)] bg-black/95 z-10 pointer-events-none" />
          <div className="absolute top-0 bottom-0 right-0 w-[calc(50vw-50vh)] bg-black/95 z-10 pointer-events-none" />
        </>
      )}

      {/* 2. Composition Rule-of-Thirds Grid */}
      {showGrid && !isHudHidden && (
        <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-8 opacity-35">
          <div className="w-full h-full border border-white/20 grid grid-cols-3 grid-rows-3">
            <div className="border-r border-b border-white/25" />
            <div className="border-r border-b border-white/25" />
            <div className="border-b border-white/25" />
            <div className="border-r border-b border-white/25" />
            <div className="border-r border-b border-white/25" />
            <div className="border-b border-white/25" />
            <div className="border-r border-white/25" />
            <div className="border-r border-white/25" />
            <div />
          </div>
        </div>
      )}

      {/* 3. Subtle Depth Blur / Vignette Scrim */}
      {photoDepthBlur > 0 && (
        <div
          className="absolute inset-0 z-10 pointer-events-none transition-opacity duration-300"
          style={{
            boxShadow: `inset 0 0 ${photoDepthBlur * 160}px rgba(0,0,0,${photoDepthBlur * 0.75})`,
          }}
        />
      )}

      {/* 4. Postcard Shutter Flash feedback */}
      {justSnapped && (
        <div className="absolute inset-0 bg-white/70 z-50 pointer-events-none transition-opacity duration-500 animate-out fade-out" />
      )}

      {/* 5. Minimal Top Status Banner */}
      {!isHudHidden && (
        <header className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto flex items-center gap-4 px-5 py-2.5 rounded-full bg-black/75 backdrop-blur-md border border-white/15 text-xs text-stone-200 shadow-xl">
          <span className="font-semibold tracking-wide text-amber-400">
            CINEMATIC PHOTO STUDIO
          </span>
          <span aria-hidden="true" className="text-stone-500">
            ·
          </span>
          <span className="text-stone-300">{worldTitle}</span>
          <span aria-hidden="true" className="text-stone-500">
            ·
          </span>
          <span className="font-mono text-stone-400">
            Drag to Orbit · Scroll to Dolly
          </span>
        </header>
      )}

      {/* 6. Floating Photo Director Dock (Bottom-Center) */}
      {!isHudHidden && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-auto w-[92vw] max-w-2xl bg-black/80 backdrop-blur-md border border-white/15 rounded-2xl p-4 shadow-2xl flex flex-col gap-3 text-xs text-stone-200">
          {/* Top Row: Lens Presets & Aspect Ratio Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-stone-400 uppercase tracking-wider">
                Lens Prime
              </span>
              <div className="flex items-center gap-1 bg-white/10 p-1 rounded-lg">
                {LENS_PRESETS.map((p) => {
                  const active = Math.abs(photoFov - p.fov) < 3;
                  return (
                    <button
                      key={p.mm}
                      onClick={() => onChangeFov(p.fov)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                        active
                          ? 'bg-amber-400 text-black shadow-sm'
                          : 'text-stone-300 hover:text-white hover:bg-white/10'
                      }`}
                      title={p.label}
                    >
                      {p.mm}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-stone-400 uppercase tracking-wider">
                Frame
              </span>
              <div className="flex items-center gap-1 bg-white/10 p-1 rounded-lg">
                {(['16:9', '1:1', '2.39:1'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => onChangeAspectRatio(r)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                      photoAspectRatio === r
                        ? 'bg-amber-400 text-black shadow-sm'
                        : 'text-stone-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Middle Row: Depth Blur Slider & Composition Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 py-1">
            <div className="flex items-center gap-3 min-w-[200px] flex-1">
              <span className="text-[11px] font-medium text-stone-400 uppercase tracking-wider whitespace-nowrap">
                Focal Depth
              </span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={photoDepthBlur}
                onChange={(e) => onChangeDepthBlur(parseFloat(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer h-1.5 bg-white/20 rounded-lg appearance-none"
                aria-label="Focal Depth Blur"
              />
              <span className="font-mono text-stone-400 w-8 text-right">
                {Math.round(photoDepthBlur * 100)}%
              </span>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer text-stone-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={(e) => setShowGrid(e.target.checked)}
                  className="rounded border-white/20 text-amber-400 focus:ring-amber-400 accent-amber-400"
                />
                <span className="text-[11px] font-medium">Grid (3×3)</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer text-stone-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={photoWatermark}
                  onChange={(e) => onChangeWatermark(e.target.checked)}
                  className="rounded border-white/20 text-amber-400 focus:ring-amber-400 accent-amber-400"
                />
                <span className="text-[11px] font-medium">Stamp Watermark</span>
              </label>
            </div>
          </div>

          {/* Bottom Row: Actions */}
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/10">
            <div className="flex items-center gap-2">
              <button
                onClick={onToggleHud}
                className="px-3 py-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-stone-200 transition-colors flex items-center gap-1.5 text-xs font-medium"
                title="Hide all UI controls to inspect frame (Press H to restore)"
              >
                <span>Preview Frame [H]</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 text-stone-300 transition-colors text-xs font-semibold"
              >
                Exit [Esc]
              </button>

              <button
                onClick={handleCapture}
                className="px-5 py-2 rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-stone-950 font-bold transition-all shadow-lg shadow-amber-500/20 active:scale-95 flex items-center gap-2 text-xs"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span>Snap Postcard</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Quick restore button when HUD is hidden */}
      {isHudHidden && (
        <button
          onClick={onToggleHud}
          className="absolute top-5 right-5 z-30 pointer-events-auto px-4 py-2 rounded-full bg-black/80 backdrop-blur-md border border-white/20 text-xs font-semibold text-amber-400 hover:bg-black transition-all shadow-xl"
        >
          Show Photo Controls [H]
        </button>
      )}
    </div>
  );
};
