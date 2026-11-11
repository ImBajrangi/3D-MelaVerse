import React from 'react';
import {
  GRAPHICS_PRESETS,
  useMelaStore,
  type GraphicsQualityPreset,
} from '../store/useMelaStore';
import { useDialogFocus } from '../utils/useDialogFocus';
import { melaverseAudio } from '../game/audio';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { dialogRef, handleKeyDown } = useDialogFocus(isOpen, onClose);
  const graphicsPreset = useMelaStore((s) => s.graphicsPreset);
  const setGraphicsPreset = useMelaStore((s) => s.setGraphicsPreset);
  const showFps = useMelaStore((s) => s.showFps);
  const toggleShowFps = useMelaStore((s) => s.toggleShowFps);
  const masterVolume = useMelaStore((s) => s.masterVolume);
  const setMasterVolume = useMelaStore((s) => s.setMasterVolume);
  const isMuted = useMelaStore((s) => s.isMuted);
  const setIsMuted = useMelaStore((s) => s.setIsMuted);
  const cameraMode = useMelaStore((s) => s.cameraMode);
  const toggleCameraMode = useMelaStore((s) => s.toggleCameraMode);
  const mobileControlsVisible = useMelaStore((s) => s.mobileControlsVisible);
  const setMobileControlsVisible = useMelaStore(
    (s) => s.setMobileControlsVisible
  );

  if (!isOpen) return null;

  const activeConfig = GRAPHICS_PRESETS[graphicsPreset];

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(12, 5, 4, 0.88)' }}
    >
      <div
        ref={dialogRef}
        onKeyDown={handleKeyDown}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        data-testid="settings-modal"
        className="w-full max-w-lg rounded-2xl border border-[#F59E0B]/60 p-5 text-[#FFFBEB] shadow-[0_20px_60px_rgba(0,0,0,0.95)]"
        style={{ backgroundColor: '#1A0B08' }}
      >
        <div className="flex items-center justify-between border-b border-[#F59E0B]/30 pb-3 mb-4">
          <div>
            <h2
              id="settings-modal-title"
              className="text-base font-bold tracking-wide text-[#FDE68A]"
            >
              GRAPHICS QUALITY, CAMERA &amp; 3D SPATIAL AUDIO
            </h2>
            <p className="text-xs text-[#FFF8F0]/75">
              Tune Selective UnrealBloomPass, Shadow Map Resolution, Pixel Ratio, and Audio
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-[#E11D48] hover:bg-[#BE123C] text-xs font-bold text-white cursor-pointer"
          >
            Done
          </button>
        </div>

        {/* 1. Graphics Quality Presets */}
        <div className="mb-4">
          <div className="text-xs font-mono font-bold text-[#FDE68A] mb-2">
            GRAPHICS QUALITY PRESET
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(['low', 'medium', 'high'] as GraphicsQualityPreset[]).map(
              (preset) => {
                const cfg = GRAPHICS_PRESETS[preset];
                const isSelected = graphicsPreset === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    data-testid={`graphics-preset-${preset}`}
                    onClick={() => {
                      melaverseAudio.playUiClick();
                      setGraphicsPreset(preset);
                    }}
                    className={`p-2.5 rounded-xl border text-left font-mono transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#3A1B15] border-[#FBBF24] text-white'
                        : 'bg-[#24100C] border-[#F59E0B]/30 text-[#FDE68A]/80 hover:border-[#F59E0B]'
                    }`}
                  >
                    <div className="text-xs font-bold uppercase">{preset}</div>
                    <div className="text-[10px] text-[#FFF8F0]/75 mt-0.5">
                      PR {cfg.maxPixelRatio}× · {cfg.shadowMapSize}px
                    </div>
                    <div className="text-[10px] text-[#38BDF8]">
                      {cfg.bloomEnabled ? 'UnrealBloom ON' : 'Bloom OFF'}
                    </div>
                  </button>
                );
              }
            )}
          </div>
          <div className="mt-1.5 text-[11px] font-mono text-[#FFF8F0]/70">
            Active Pipeline: {activeConfig.label} · Crowd: {activeConfig.crowdCount} AI Visitors
          </div>
        </div>

        {/* 2. 3D Spatial Audio Master Volume & Mute */}
        <div className="mb-4 p-3 rounded-xl bg-[#24100C] border border-[#F59E0B]/30">
          <div className="flex items-center justify-between mb-2">
            <label
              htmlFor="master-volume-slider"
              className="text-xs font-mono font-bold text-[#FDE68A]"
            >
              3D SPATIAL AUDIO MASTER VOLUME ({Math.round(masterVolume * 100)}%)
            </label>
            <button
              type="button"
              onClick={() => {
                const next = melaverseAudio.toggleMute();
                setIsMuted(next);
              }}
              className="px-2.5 py-1 rounded bg-[#3A1B15] border border-[#F59E0B]/40 text-xs font-mono font-semibold text-[#FFFBEB] cursor-pointer"
            >
              {isMuted ? 'Unmute Audio' : 'Mute Audio'}
            </button>
          </div>
          <input
            id="master-volume-slider"
            type="range"
            min={0}
            max={100}
            value={Math.round(masterVolume * 100)}
            onChange={(e) => {
              const v = Number(e.target.value) / 100;
              setMasterVolume(v);
              melaverseAudio.setMasterVolume(v);
            }}
            className="w-full accent-[#F59E0B] cursor-pointer"
          />
        </div>

        {/* 3. Camera Perspective, FPS Counter & Mobile Touch Controls */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            data-testid="toggle-camera-mode-btn"
            onClick={() => {
              melaverseAudio.playUiClick();
              toggleCameraMode();
            }}
            className="p-2.5 rounded-xl bg-[#24100C] hover:bg-[#341812] border border-[#F59E0B]/40 text-xs font-mono font-semibold text-[#FFFBEB] cursor-pointer"
          >
            Camera [V]:{' '}
            <span className="text-[#38BDF8] font-bold">
              {cameraMode === 'first_person' ? '1ST PERSON' : '3RD PERSON'}
            </span>
          </button>

          <button
            type="button"
            data-testid="toggle-fps-btn"
            onClick={() => {
              melaverseAudio.playUiClick();
              toggleShowFps();
            }}
            className="p-2.5 rounded-xl bg-[#24100C] hover:bg-[#341812] border border-[#F59E0B]/40 text-xs font-mono font-semibold text-[#FFFBEB] cursor-pointer"
          >
            FPS Meter:{' '}
            <span className="text-[#FBBF24] font-bold">
              {showFps ? 'VISIBLE' : 'HIDDEN'}
            </span>
          </button>

          <button
            type="button"
            data-testid="toggle-mobile-touch-btn"
            onClick={() => {
              melaverseAudio.playUiClick();
              setMobileControlsVisible(!mobileControlsVisible);
            }}
            className="p-2.5 rounded-xl bg-[#24100C] hover:bg-[#341812] border border-[#F59E0B]/40 text-xs font-mono font-semibold text-[#FFFBEB] cursor-pointer"
          >
            Touch Pad:{' '}
            <span className="text-[#FDA4AF] font-bold">
              {mobileControlsVisible ? 'ON' : 'AUTO'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
