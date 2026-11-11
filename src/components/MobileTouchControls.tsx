import React, { useState, useRef } from 'react';

interface MobileTouchControlsProps {
  visible: boolean;
  onMoveVector: (dx: number, dz: number, sprinting: boolean) => void;
  onCameraLookDelta: (deltaYaw: number) => void;
  onJump: () => void;
  onInteract: () => void;
  onFire: () => void;
  onToggleCamera: () => void;
}

export const MobileTouchControls: React.FC<MobileTouchControlsProps> = ({
  visible,
  onMoveVector,
  onCameraLookDelta,
  onJump,
  onInteract,
  onFire,
  onToggleCamera,
}) => {
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [sprinting, setSprinting] = useState<boolean>(false);
  const joyCenterRef = useRef<{ x: number; y: number } | null>(null);
  const lookDragXRef = useRef<number | null>(null);

  if (!visible) return null;

  const maxRadius = 38;

  const updateJoystick = (clientX: number, clientY: number) => {
    if (!joyCenterRef.current) return;
    const rawX = clientX - joyCenterRef.current.x;
    const rawY = clientY - joyCenterRef.current.y;
    const dist = Math.hypot(rawX, rawY);
    const clampedDist = Math.min(maxRadius, dist);
    const angle = Math.atan2(rawY, rawX);
    const kx = Math.cos(angle) * clampedDist;
    const ky = Math.sin(angle) * clampedDist;
    setKnobOffset({ x: kx, y: ky });

    const normX = kx / maxRadius;
    const normZ = -ky / maxRadius;
    onMoveVector(normX, normZ, sprinting);
  };

  return (
    <div
      className="fixed inset-x-0 bottom-20 z-20 pointer-events-none flex items-end justify-between px-5"
      data-testid="mobile-touch-controls"
    >
      {/* Left Virtual Thumbstick + Sprint Toggle */}
      <div className="pointer-events-auto flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => setSprinting((s) => !s)}
          className={`px-2.5 py-1 rounded-lg border font-mono text-[10px] font-bold cursor-pointer ${
            sprinting
              ? 'bg-[#F59E0B] border-white text-[#180B08]'
              : 'bg-[#1A0B08]/90 border-[#F59E0B]/45 text-[#FDE68A]'
          }`}
        >
          {sprinting ? 'SPRINTING [SHIFT]' : 'WALK / SPRINT'}
        </button>

        <div
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            const rect = e.currentTarget.getBoundingClientRect();
            joyCenterRef.current = {
              x: rect.left + rect.width / 2,
              y: rect.top + rect.height / 2,
            };
            updateJoystick(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (!joyCenterRef.current) return;
            updateJoystick(e.clientX, e.clientY);
          }}
          onPointerUp={() => {
            joyCenterRef.current = null;
            setKnobOffset({ x: 0, y: 0 });
            onMoveVector(0, 0, false);
          }}
          className="w-24 h-24 rounded-full border-2 border-[#F59E0B]/60 flex items-center justify-center touch-none select-none"
          style={{ backgroundColor: 'rgba(20, 9, 7, 0.85)' }}
        >
          <div
            className="w-10 h-10 rounded-full bg-[#F59E0B] border-2 border-[#FFFBEB] shadow-md"
            style={{
              transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
            }}
          />
        </div>
      </div>

      {/* Right Touch-Drag Camera Zone + Action Buttons */}
      <div className="pointer-events-auto flex flex-col items-end gap-2">
        <div
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            lookDragXRef.current = e.clientX;
          }}
          onPointerMove={(e) => {
            if (lookDragXRef.current === null) return;
            const dx = e.clientX - lookDragXRef.current;
            lookDragXRef.current = e.clientX;
            onCameraLookDelta(-dx * 0.008);
          }}
          onPointerUp={() => {
            lookDragXRef.current = null;
          }}
          className="px-3 py-1.5 rounded-lg border border-[#38BDF8]/40 text-[10px] font-mono text-[#BAE6FD] touch-none select-none cursor-ew-resize"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.85)' }}
        >
          ⇄ Drag to Look
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={onJump}
            className="w-12 h-11 rounded-xl bg-[#0284C7] border border-white/50 text-[10px] font-mono font-bold text-white cursor-pointer"
          >
            JUMP
          </button>
          <button
            type="button"
            onClick={onInteract}
            className="w-12 h-11 rounded-xl bg-[#F59E0B] border border-white/50 text-[10px] font-mono font-bold text-[#180B08] cursor-pointer"
          >
            USE [E]
          </button>
          <button
            type="button"
            onClick={onFire}
            className="w-12 h-11 rounded-xl bg-[#E11D48] border border-white/50 text-[10px] font-mono font-bold text-white cursor-pointer"
          >
            FIRE
          </button>
          <button
            type="button"
            onClick={onToggleCamera}
            className="w-12 h-11 rounded-xl bg-[#2A1410] border border-[#F59E0B]/50 text-[10px] font-mono font-bold text-[#FDE68A] cursor-pointer"
          >
            CAM [V]
          </button>
        </div>
      </div>
    </div>
  );
};
