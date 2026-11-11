import React, { useState } from 'react';
import {
  PRIZE_SHOP_CATALOG,
  useMelaStore,
  type PrizeShopItem,
} from '../store/useMelaStore';
import { useDialogFocus } from '../utils/useDialogFocus';
import { melaverseAudio } from '../game/audio';

interface PrizeShopModalProps {
  isOpen: boolean;
  onActivatePowerupBlessing: (itemName: string) => void;
  onClose: () => void;
}

export const PrizeShopModal: React.FC<PrizeShopModalProps> = ({
  isOpen,
  onActivatePowerupBlessing,
  onClose,
}) => {
  const { dialogRef, handleKeyDown } = useDialogFocus(isOpen, onClose);
  const tickets = useMelaStore((s) => s.tickets);
  const coins = useMelaStore((s) => s.coins);
  const ownedPrizeIds = useMelaStore((s) => s.ownedPrizeIds);
  const hasVipPass = useMelaStore((s) => s.hasVipPass);
  const redeemPrize = useMelaStore((s) => s.redeemPrize);

  const [statusMessage, setStatusMessage] = useState<string>(
    'Redeem your earned Mini-Game Tickets for Chaat/Lassi speed boosts, souvenirs, or the VIP Mela Pass!'
  );

  if (!isOpen) return null;

  const handleRedeem = (item: PrizeShopItem) => {
    const res = redeemPrize(item);
    if (res.ok) {
      melaverseAudio.playSacredChime();
      setStatusMessage(`Redeemed ${item.name}! (${item.effectLabel})`);
      if (item.category === 'powerup' || item.category === 'vip_pass') {
        onActivatePowerupBlessing(item.name);
      }
    } else {
      melaverseAudio.playUiClick();
      setStatusMessage(res.reason ?? 'Unable to redeem item');
    }
  };

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
        aria-labelledby="prize-shop-title"
        data-testid="prize-shop-modal"
        className="w-full max-w-3xl rounded-2xl border border-[#FBBF24]/65 p-5 text-[#FFFBEB] shadow-[0_20px_60px_rgba(0,0,0,0.95)] max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: '#1A0B08' }}
      >
        <div className="flex items-center justify-between border-b border-[#F59E0B]/30 pb-3 mb-4">
          <div>
            <h2
              id="prize-shop-title"
              className="text-lg font-bold tracking-wide text-[#FDE68A]"
            >
              SHAHI INAM GHAR — MELA PRIZE &amp; CHAAT BAZAAR
            </h2>
            <p className="text-xs text-[#FFF8F0]/80">{statusMessage}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 rounded-lg bg-[#2A1410] border border-[#FBBF24]/50 font-mono text-xs font-bold text-[#FBBF24]">
              TICKETS: <span data-testid="shop-ticket-balance">{tickets}</span> · COINS: {coins}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-[#E11D48] hover:bg-[#BE123C] text-xs font-bold text-white cursor-pointer"
            >
              Close [Esc]
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {PRIZE_SHOP_CATALOG.map((item) => {
            const isOwned =
              item.category !== 'powerup' && ownedPrizeIds.includes(item.id);
            const canAfford = tickets >= item.ticketCost;

            return (
              <div
                key={item.id}
                className="p-4 rounded-xl bg-[#26110C] border border-[#F59E0B]/35 flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span
                      className="text-sm font-bold"
                      style={{ color: item.accentHex }}
                    >
                      {item.name}
                    </span>
                    <span className="font-mono text-xs font-bold text-[#FDE68A]">
                      {item.ticketCost} Tickets
                    </span>
                  </div>
                  <p className="text-xs text-[#FFF8F0]/85 leading-relaxed mb-2">
                    {item.description}
                  </p>
                  <div className="text-[11px] font-mono text-[#7DD3FC]">
                    Effect: {item.effectLabel}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isOwned || !canAfford}
                  data-testid={`redeem-prize-${item.id}`}
                  onClick={() => handleRedeem(item)}
                  className={`w-full py-2 rounded-lg font-mono text-xs font-bold transition-colors cursor-pointer ${
                    isOwned
                      ? 'bg-[#065F46] text-[#A7F3D0] cursor-default'
                      : canAfford
                      ? 'bg-[#F59E0B] hover:bg-[#D97706] text-[#180B08]'
                      : 'bg-[#180B08] text-[#FFF8F0]/40 border border-[#F59E0B]/20 cursor-not-allowed'
                  }`}
                >
                  {isOwned
                    ? '✓ Owned in Collection'
                    : canAfford
                    ? `Redeem for ${item.ticketCost} Tickets`
                    : `Need ${item.ticketCost} Tickets`}
                </button>
              </div>
            );
          })}
        </div>

        {hasVipPass && (
          <div className="mt-4 p-3 rounded-xl bg-[#0C4A6E]/60 border border-[#38BDF8] text-xs font-mono text-[#E0F2FE] text-center">
            ★ MAHARAJA VIP PASS ACTIVE: All Mela Rides (Giant Wheel, Carousel, Columbus Boat) are FREE to board!
          </div>
        )}
      </div>
    </div>
  );
};
