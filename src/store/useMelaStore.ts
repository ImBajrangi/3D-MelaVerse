import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type GraphicsQualityPreset = 'low' | 'medium' | 'high';
export type CameraPerspectiveMode = 'third_person' | 'first_person';
export type RideId = 'giant_wheel' | 'carousel' | 'columbus_boat';
export type MiniGameStallId = 'balloon_shoot' | 'ring_toss' | 'prize_shop';
export type LotusShieldSkinId =
  | 'pink_gold_lotus'
  | 'sapphire_chakra'
  | 'emerald_marigold';

export interface GraphicsQualityConfig {
  preset: GraphicsQualityPreset;
  label: string;
  maxPixelRatio: number;
  shadowMapSize: number;
  shadowsEnabled: boolean;
  bloomEnabled: boolean;
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  crowdCount: number;
}

/**
 * Calibrated Post-Processing Bloom Presets (ACESFilmicToneMapping @ exposure 0.85):
 * High threshold (0.88) and restrained strength (0.40) prevent white/yellow glare
 * on sandstone architecture while allowing small light sources (diya flames,
 * fairy bulbs, firework sparks, shield rims) with emissive > 1.2 to glow crisply.
 */
export const GRAPHICS_PRESETS: Record<GraphicsQualityPreset, GraphicsQualityConfig> = {
  low: {
    preset: 'low',
    label: 'Low (Battery / 60 FPS Mobile)',
    maxPixelRatio: 1.0,
    shadowMapSize: 512,
    shadowsEnabled: false,
    bloomEnabled: false,
    bloomStrength: 0,
    bloomRadius: 0,
    bloomThreshold: 0.95,
    crowdCount: 28,
  },
  medium: {
    preset: 'medium',
    label: 'Medium (Balanced 60 FPS)',
    maxPixelRatio: 1.5,
    shadowMapSize: 1024,
    shadowsEnabled: true,
    bloomEnabled: true,
    bloomStrength: 0.32,
    bloomRadius: 0.45,
    bloomThreshold: 0.88,
    crowdCount: 34,
  },
  high: {
    preset: 'high',
    label: 'High (Calibrated ACES + Selective Bloom)',
    maxPixelRatio: 2.0,
    shadowMapSize: 2048,
    shadowsEnabled: true,
    bloomEnabled: true,
    bloomStrength: 0.4,
    bloomRadius: 0.5,
    bloomThreshold: 0.88,
    crowdCount: 40,
  },
};

export interface PrizeShopItem {
  id: string;
  name: string;
  category: 'powerup' | 'souvenir' | 'vip_pass';
  ticketCost: number;
  description: string;
  effectLabel: string;
  speedBoostMultiplier?: number;
  durationSec?: number;
  accentHex: string;
}

export const PRIZE_SHOP_CATALOG: PrizeShopItem[] = [
  {
    id: 'kesari_lassi_boost',
    name: 'Royal Kesari Lassi',
    category: 'powerup',
    ticketCost: 12,
    description:
      'Chilled saffron & pistachio clay-cup lassi that invigorates your festival stride.',
    effectLabel: '+35% Sprint & Walk Speed (60s) + Full Vitality',
    speedBoostMultiplier: 1.35,
    durationSec: 60,
    accentHex: '#FBBF24',
  },
  {
    id: 'banarasi_chaat_power',
    name: 'Banarasi Tamatar Chaat',
    category: 'powerup',
    ticketCost: 15,
    description:
      'Tangy, spiced earthen-pot chaat that supercharges your reflexes and Karma aura.',
    effectLabel: '+45% Speed Boost (75s) + Instant Divine Blessing',
    speedBoostMultiplier: 1.45,
    durationSec: 75,
    accentHex: '#F43F5E',
  },
  {
    id: 'brass_peacock_diya',
    name: 'Moradabad Brass Peacock Diya',
    category: 'souvenir',
    ticketCost: 20,
    description:
      'Hand-engraved artisanal brass oil lamp souvenir from the Grand Mela bazaar.',
    effectLabel: 'Permanent +15% Ticket Bonus in Mini-Games',
    accentHex: '#F59E0B',
  },
  {
    id: 'wooden_kathputli_pair',
    name: 'Rajasthani Kathputli Marionettes',
    category: 'souvenir',
    ticketCost: 28,
    description:
      'Traditional hand-painted wooden folk puppets dressed in mirror-work bandhani.',
    effectLabel: 'Unlocks Royal Folk Stamp & +100 XP',
    accentHex: '#A855F7',
  },
  {
    id: 'maharaja_vip_pass',
    name: 'Maharaja All-Access VIP Mela Pass',
    category: 'vip_pass',
    ticketCost: 40,
    description:
      'Golden silk wristband granting unlimited free boarding on all 3 Mela Rides & +20% permanent walk speed.',
    effectLabel: 'Free Rides Forever + Permanent +20% Speed',
    speedBoostMultiplier: 1.2,
    accentHex: '#38BDF8',
  },
];

export interface MelaStoreState {
  coins: number;
  tickets: number;
  totalXp: number;
  highScore: number;
  unlockedStamps: string[];
  ownedPrizeIds: string[];
  unlockedAttireIds: string[];
  equippedAttireId: string;
  equippedTrailColorHex: string;
  equippedShieldSkin: LotusShieldSkinId;
  activeFoodBoostMultiplier: number;
  activeFoodBoostRemainingSec: number;
  activeFoodBoostName: string | null;
  hasVipPass: boolean;
  graphicsPreset: GraphicsQualityPreset;
  showFps: boolean;
  masterVolume: number;
  isMuted: boolean;
  cameraMode: CameraPerspectiveMode;
  mountedRide: RideId | null;
  activeStallModal: MiniGameStallId | null;
  mobileControlsVisible: boolean;

  // Actions
  addCoins: (delta: number) => void;
  spendCoins: (amount: number) => boolean;
  addTickets: (delta: number) => void;
  spendTickets: (amount: number) => boolean;
  addXp: (delta: number) => void;
  updateHighScore: (score: number) => void;
  unlockStamp: (stamp: string) => void;
  unlockAttire: (attireId: string, costCoins: number) => boolean;
  setEquippedAttireId: (attireId: string) => void;
  setEquippedTrailColorHex: (hex: string) => void;
  setEquippedShieldSkin: (skin: LotusShieldSkinId) => void;
  redeemPrize: (item: PrizeShopItem) => { ok: boolean; reason?: string };
  stepFoodBoostTimer: (dt: number) => void;
  setGraphicsPreset: (preset: GraphicsQualityPreset) => void;
  toggleShowFps: () => void;
  setMasterVolume: (volume: number) => void;
  setIsMuted: (muted: boolean) => void;
  toggleCameraMode: () => void;
  setCameraMode: (mode: CameraPerspectiveMode) => void;
  mountRide: (
    rideId: RideId,
    ticketCost: number
  ) => { ok: boolean; reason?: string };
  exitRide: () => void;
  openStallModal: (stall: MiniGameStallId | null) => void;
  setMobileControlsVisible: (visible: boolean) => void;
}

export const useMelaStore = create<MelaStoreState>()(
  persist(
    (set, get) => ({
      coins: 350,
      tickets: 25,
      totalXp: 280,
      highScore: 1850,
      unlockedStamps: ['Brass Braj Pichkari & Bansuri Stamp'],
      ownedPrizeIds: [],
      unlockedAttireIds: ['braj_utsav_kesar'],
      equippedAttireId: 'braj_utsav_kesar',
      equippedTrailColorHex: '#F59E0B',
      equippedShieldSkin: 'pink_gold_lotus',
      activeFoodBoostMultiplier: 1.0,
      activeFoodBoostRemainingSec: 0,
      activeFoodBoostName: null,
      hasVipPass: false,
      graphicsPreset: 'high',
      showFps: true,
      masterVolume: 0.8,
      isMuted: false,
      cameraMode: 'third_person',
      mountedRide: null,
      activeStallModal: null,
      mobileControlsVisible: false,

      addCoins: (delta) =>
        set((state) => ({
          coins: Math.max(0, Math.round(state.coins + delta)),
        })),

      spendCoins: (amount) => {
        const current = get().coins;
        if (current < amount) return false;
        set({ coins: Math.max(0, current - amount) });
        return true;
      },

      addTickets: (delta) =>
        set((state) => {
          const bonusMultiplier = state.ownedPrizeIds.includes(
            'brass_peacock_diya'
          )
            ? 1.15
            : 1.0;
          const gained = Math.max(0, Math.round(delta * bonusMultiplier));
          return { tickets: state.tickets + gained };
        }),

      spendTickets: (amount) => {
        const current = get().tickets;
        if (current < amount) return false;
        set({ tickets: Math.max(0, current - amount) });
        return true;
      },

      addXp: (delta) =>
        set((state) => ({
          totalXp: Math.max(0, Math.round(state.totalXp + delta)),
        })),

      updateHighScore: (score) =>
        set((state) => ({
          highScore: Math.max(state.highScore, Math.round(score)),
        })),

      unlockStamp: (stamp) =>
        set((state) => ({
          unlockedStamps: state.unlockedStamps.includes(stamp)
            ? state.unlockedStamps
            : [...state.unlockedStamps, stamp],
        })),

      unlockAttire: (attireId, costCoins) => {
        const state = get();
        if (state.unlockedAttireIds.includes(attireId)) {
          set({ equippedAttireId: attireId });
          return true;
        }
        if (state.coins < costCoins) {
          return false;
        }
        set({
          coins: state.coins - costCoins,
          unlockedAttireIds: [...state.unlockedAttireIds, attireId],
          equippedAttireId: attireId,
        });
        return true;
      },

      setEquippedAttireId: (attireId) => set({ equippedAttireId: attireId }),

      setEquippedTrailColorHex: (hex) => set({ equippedTrailColorHex: hex }),

      setEquippedShieldSkin: (skin) => set({ equippedShieldSkin: skin }),

      redeemPrize: (item) => {
        const state = get();
        if (state.tickets < item.ticketCost) {
          return {
            ok: false,
            reason: `Need ${item.ticketCost} Tickets (you have ${state.tickets})`,
          };
        }
        if (
          item.category !== 'powerup' &&
          state.ownedPrizeIds.includes(item.id)
        ) {
          return {
            ok: false,
            reason: 'Already owned in your Mela collection!',
          };
        }

        const nextOwned = state.ownedPrizeIds.includes(item.id)
          ? state.ownedPrizeIds
          : [...state.ownedPrizeIds, item.id];

        const isVip = item.id === 'maharaja_vip_pass' || state.hasVipPass;
        const nextFoodMult =
          item.category === 'powerup' && item.speedBoostMultiplier
            ? item.speedBoostMultiplier
            : state.activeFoodBoostMultiplier;
        const nextFoodSec =
          item.category === 'powerup' && item.durationSec
            ? item.durationSec
            : state.activeFoodBoostRemainingSec;
        const nextFoodName =
          item.category === 'powerup' ? item.name : state.activeFoodBoostName;

        set({
          tickets: state.tickets - item.ticketCost,
          ownedPrizeIds: nextOwned,
          hasVipPass: isVip,
          activeFoodBoostMultiplier: nextFoodMult,
          activeFoodBoostRemainingSec: nextFoodSec,
          activeFoodBoostName: nextFoodName,
          totalXp: state.totalXp + 100,
        });

        return { ok: true };
      },

      stepFoodBoostTimer: (dt) => {
        const state = get();
        if (state.activeFoodBoostRemainingSec <= 0) return;
        const nextRem = Math.max(0, state.activeFoodBoostRemainingSec - dt);
        set({
          activeFoodBoostRemainingSec: nextRem,
          activeFoodBoostMultiplier:
            nextRem > 0 ? state.activeFoodBoostMultiplier : 1.0,
          activeFoodBoostName: nextRem > 0 ? state.activeFoodBoostName : null,
        });
      },

      setGraphicsPreset: (preset) => set({ graphicsPreset: preset }),
      toggleShowFps: () => set((state) => ({ showFps: !state.showFps })),
      setMasterVolume: (volume) =>
        set({ masterVolume: Math.max(0, Math.min(1, volume)) }),
      setIsMuted: (muted) => set({ isMuted: muted }),
      toggleCameraMode: () =>
        set((state) => ({
          cameraMode:
            state.cameraMode === 'third_person'
              ? 'first_person'
              : 'third_person',
        })),
      setCameraMode: (mode) => set({ cameraMode: mode }),

      mountRide: (rideId, ticketCost) => {
        const state = get();
        const effectiveCost = state.hasVipPass ? 0 : ticketCost;
        if (state.coins < effectiveCost) {
          return {
            ok: false,
            reason: `Need ${effectiveCost} Coins to board (you have ${state.coins} Coins)`,
          };
        }
        set({
          coins: state.coins - effectiveCost,
          mountedRide: rideId,
          cameraMode: 'first_person',
          activeStallModal: null,
        });
        return { ok: true };
      },

      exitRide: () =>
        set({
          mountedRide: null,
          cameraMode: 'third_person',
        }),

      openStallModal: (stall) =>
        set({
          activeStallModal: stall,
          mountedRide: stall ? null : get().mountedRide,
        }),

      setMobileControlsVisible: (visible) =>
        set({ mobileControlsVisible: visible }),
    }),
    {
      name: 'melaverse-grand-mela-wallet-v3',
      partialize: (state) => ({
        coins: state.coins,
        tickets: state.tickets,
        totalXp: state.totalXp,
        highScore: state.highScore,
        unlockedStamps: state.unlockedStamps,
        ownedPrizeIds: state.ownedPrizeIds,
        unlockedAttireIds: state.unlockedAttireIds,
        equippedAttireId: state.equippedAttireId,
        equippedTrailColorHex: state.equippedTrailColorHex,
        equippedShieldSkin: state.equippedShieldSkin,
        hasVipPass: state.hasVipPass,
        graphicsPreset: state.graphicsPreset,
        showFps: state.showFps,
        masterVolume: state.masterVolume,
      }),
    }
  )
);
