import type { FestivalWorldId } from './rules';

export type WeatherType =
  | 'clear_sun'
  | 'braj_monsoon_rain'
  | 'ghat_river_breeze'
  | 'mela_gusts';

export interface WeatherState {
  activeWorld: FestivalWorldId;
  weatherId: WeatherType;
  label: string;
  shortBadge: string;
  rainIntensity: number; // 0..1
  windX: number; // m/s lateral wind
  windZ: number; // m/s longitudinal wind
  windSpeed: number; // m/s magnitude
  washRateMultiplier: number; // 1.0 dry -> up to 3.6 heavy rain
  airDragMultiplier: number; // 1.0 dry -> up to 1.8 heavy rain
  characterDragMultiplier: number; // 1.0 dry -> down to 0.88 heavy rain
  cycleElapsedSec: number;
  cycleDurationSec: number;
}

interface WorldWeatherTarget {
  weatherId: WeatherType;
  label: string;
  shortBadge: string;
  rainIntensity: number;
  baseWindX: number;
  baseWindZ: number;
  gustAmpX: number;
  gustAmpZ: number;
  gustFreq: number;
}

function getWorldWeatherProfile(
  activeWorld: FestivalWorldId,
  cycleProgress: number
): WorldWeatherTarget {
  if (activeWorld === 'holi_braj') {
    // Holi Braj cycles between active Braj Monsoon Showers (first 65% of cycle) and Sunlit Courtyard
    if (cycleProgress < 0.65) {
      return {
        weatherId: 'braj_monsoon_rain',
        label: 'Braj Monsoon Shower',
        shortBadge: 'Rain · Fast Wash',
        rainIntensity: 0.78,
        baseWindX: 1.6,
        baseWindZ: 1.1,
        gustAmpX: 0.9,
        gustAmpZ: 0.6,
        gustFreq: 0.42,
      };
    }
    return {
      weatherId: 'clear_sun',
      label: 'Sunlit Braj Courtyard',
      shortBadge: 'Clear · Calm',
      rainIntensity: 0,
      baseWindX: 0.45,
      baseWindZ: -0.25,
      gustAmpX: 0.3,
      gustAmpZ: 0.25,
      gustFreq: 0.28,
    };
  }

  if (activeWorld === 'diwali_ghat') {
    // Diwali Ghat has a steady Ganga river breeze that swells in gusts along the riverfront
    const strongBreeze = cycleProgress < 0.7;
    return {
      weatherId: 'ghat_river_breeze',
      label: strongBreeze ? 'Ganga River Breeze' : 'Gentle Ghat Zephyr',
      shortBadge: strongBreeze ? 'River Breeze' : 'Light Breeze',
      rainIntensity: 0,
      baseWindX: strongBreeze ? 5.2 : 2.8,
      baseWindZ: strongBreeze ? -1.8 : -0.9,
      gustAmpX: strongBreeze ? 1.8 : 0.9,
      gustAmpZ: strongBreeze ? 0.95 : 0.5,
      gustFreq: 0.55,
    };
  }

  // Mela Central Hub: swirling festive evening gusts
  const briskGusts = cycleProgress < 0.65;
  return {
    weatherId: briskGusts ? 'mela_gusts' : 'clear_sun',
    label: briskGusts ? 'Mela Courtyard Gusts' : 'Calm Festive Sky',
    shortBadge: briskGusts ? 'Wind Gusts' : 'Clear Sky',
    rainIntensity: 0,
    baseWindX: briskGusts ? -3.4 : 0.8,
    baseWindZ: briskGusts ? 2.4 : 0.4,
    gustAmpX: briskGusts ? 2.4 : 0.4,
    gustAmpZ: briskGusts ? 1.6 : 0.3,
    gustFreq: 0.64,
  };
}

function buildDerivedWeatherMetrics(
  rainIntensity: number,
  windX: number,
  windZ: number
): Pick<
  WeatherState,
  | 'windSpeed'
  | 'washRateMultiplier'
  | 'airDragMultiplier'
  | 'characterDragMultiplier'
> {
  const safeRain = Math.max(0, Math.min(1, rainIntensity));
  const windSpeed = Math.hypot(windX, windZ);
  const washRateMultiplier = Number((1.0 + safeRain * 2.8).toFixed(3));
  const airDragMultiplier = Number((1.0 + safeRain * 0.82).toFixed(3));
  const characterDragMultiplier = Number((1.0 - safeRain * 0.12).toFixed(3));

  return {
    windSpeed: Number(windSpeed.toFixed(3)),
    washRateMultiplier,
    airDragMultiplier,
    characterDragMultiplier,
  };
}

export function createInitialWeatherState(
  activeWorld: FestivalWorldId
): WeatherState {
  const cycleDurationSec = 40.0;
  const target = getWorldWeatherProfile(activeWorld, 0);
  const derived = buildDerivedWeatherMetrics(
    target.rainIntensity,
    target.baseWindX,
    target.baseWindZ
  );

  return {
    activeWorld,
    weatherId: target.weatherId,
    label: target.label,
    shortBadge: target.shortBadge,
    rainIntensity: target.rainIntensity,
    windX: target.baseWindX,
    windZ: target.baseWindZ,
    ...derived,
    cycleElapsedSec: 0,
    cycleDurationSec,
  };
}

export function stepWeatherSystem(
  state: WeatherState,
  params: {
    dt: number;
    elapsedSec: number;
    activeWorld: FestivalWorldId;
  }
): WeatherState {
  const safeDt = Math.max(0.001, Math.min(0.1, Number.isFinite(params.dt) ? params.dt : 0.016));
  const worldChanged = state.activeWorld !== params.activeWorld;
  const nextCycleElapsed = worldChanged
    ? 0
    : (state.cycleElapsedSec + safeDt) % state.cycleDurationSec;
  const cycleProgress = nextCycleElapsed / state.cycleDurationSec;

  const target = getWorldWeatherProfile(params.activeWorld, cycleProgress);
  const gustWaveA = Math.sin(params.elapsedSec * target.gustFreq);
  const gustWaveB = Math.cos(params.elapsedSec * target.gustFreq * 0.73 + 1.1);
  const targetWindX = target.baseWindX + gustWaveA * target.gustAmpX;
  const targetWindZ = target.baseWindZ + gustWaveB * target.gustAmpZ;

  // Frame-rate independent smooth transition on world change or weather phase change
  const blendRate = worldChanged ? 1.0 : 1 - Math.exp(-1.6 * safeDt);
  const nextRain =
    state.rainIntensity + (target.rainIntensity - state.rainIntensity) * blendRate;
  const nextWindX = state.windX + (targetWindX - state.windX) * blendRate;
  const nextWindZ = state.windZ + (targetWindZ - state.windZ) * blendRate;

  const derived = buildDerivedWeatherMetrics(nextRain, nextWindX, nextWindZ);

  return {
    activeWorld: params.activeWorld,
    weatherId: target.weatherId,
    label: target.label,
    shortBadge: target.shortBadge,
    rainIntensity: Number(nextRain.toFixed(4)),
    windX: Number(nextWindX.toFixed(4)),
    windZ: Number(nextWindZ.toFixed(4)),
    ...derived,
    cycleElapsedSec: nextCycleElapsed,
    cycleDurationSec: state.cycleDurationSec,
  };
}
