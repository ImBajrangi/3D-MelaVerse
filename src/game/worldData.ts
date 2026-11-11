import type { FestivalWorldId } from './rules';
import type { LotusShieldSkinId } from '../store/useMelaStore';

export interface FestivalWorldMeta {
  id: string;
  worldNumber: string;
  title: string;
  region: string;
  hinduCalendarTithi: string;
  playableSceneId: FestivalWorldId;
  isMvpFlagship?: boolean;
  architectureStyle: string;
  signatureActivities: string[];
  featuredMinigames: string[];
  culturalCollectible: string;
  ambientAudioProfile: string;
  skyColorHex: string;
  fogColorHex: string;
  accentHex: string;
  summary: string;
}

export const TWELVE_FESTIVAL_WORLDS: FestivalWorldMeta[] = [
  {
    id: 'world_01_holi_braj',
    worldNumber: 'WORLD 01',
    title: 'Holi: Braj (Mathura, Vrindavan & Barsana)',
    region: 'Braj Region, Uttar Pradesh',
    hinduCalendarTithi: 'Phalguna Purnima (Lunar Full Moon)',
    playableSceneId: 'holi_braj',
    isMvpFlagship: true,
    architectureStyle:
      'Carved Braj Red Sandstone Havelis, Jharokha Balconies & Nagara Shikhara Mandir',
    signatureActivities: [
      'Lathmar & Phoolon ki Holi Courtyard Celebration',
      'Gulal Pichkari Multiplayer Color Challenge & Vat Refills',
      'Braj Mithai & Gujiya Halwai Tasting',
      'Sacred Temple Chowk Rangoli Creation',
    ],
    featuredMinigames: [
      'Holi Color Challenge',
      'Rangoli Studio',
      'Dhol Rhythm Circle',
    ],
    culturalCollectible: 'Brass Braj Pichkari & Bansuri Stamp',
    ambientAudioProfile:
      'Braj Dholak, Manjira Cymbals, Bansuri Flute & Joyful Chowk Crowd',
    skyColorHex: '#FCE7F3',
    fogColorHex: '#FBCFE8',
    accentHex: '#E11D48',
    summary:
      'Flagship vertical slice set in the sandstone temple streets of Barsana and Vrindavan, alive with organic gulal clouds, marigold torans, color vats, and community celebration.',
  },
  {
    id: 'world_02_diwali',
    worldNumber: 'WORLD 02',
    title: 'Diwali: Heritage Town & Deepotsav Ghat',
    region: 'Varanasi & Braj Riverside Heritage Ghat',
    hinduCalendarTithi: 'Kartika Amavasya (Dark Moon Night)',
    playableSceneId: 'diwali_ghat',
    architectureStyle:
      'Carved Sandstone River Ghats, Deepstambh Lamp Towers & Reflective Riverfront',
    signatureActivities: [
      'Rhythm & Diyas [R] Illumination along the Stepped Ghat',
      'Multi-Stage Aerial Fireworks [F] over Reflective River Water',
      'Floating River Diyas & Ascending Sky Lanterns',
    ],
    featuredMinigames: [
      'Diya Illumination Relay',
      'Rangoli Studio',
      'Sky Fireworks',
    ],
    culturalCollectible: 'Terracotta Panch-Arti Diya Stamp',
    ambientAudioProfile:
      'Evening Temple Conch (Shankh), Sitar Raga Yaman & Gentle River Lapping',
    skyColorHex: '#0F172A',
    fogColorHex: '#1E1B4B',
    accentHex: '#F59E0B',
    summary:
      'Golden nocturnal celebration where warm terracotta diyas, multi-stage fireworks, and floating sky lanterns reflect off stepped river ghats.',
  },
  {
    id: 'world_03_navratri_gujarat',
    worldNumber: 'WORLD 03',
    title: 'Mela Central Hub & Navratri Garba Chowk',
    region: 'Grand Indian Mela Grounds & Cultural Hub',
    hinduCalendarTithi: 'Ashvin Shukla Pratipada to Navami (9 Nights)',
    playableSceneId: 'mela_central',
    architectureStyle:
      'Aakash Jhula Giant Wheel, Festive Craft Stalls, Portals & Concentric Maidan',
    signatureActivities: [
      'Boarding the Aakash Jhula Giant Wheel [E] in 1st-Person',
      'Interactive Glowing Floor Rangoli Stamping [G]',
      'Balloon Shooting, Ring Toss & Prize Shop Bazaar',
    ],
    featuredMinigames: ['Balloon Shoot', 'Ring Toss', 'Rangoli Stamp Creator'],
    culturalCollectible: 'Abhla Mirror-Work Dandiya Sticks Stamp',
    ambientAudioProfile: 'Energetic Dhol, Calliope Organ & Clapping Garba Talis',
    skyColorHex: '#1E1024',
    fogColorHex: '#2E1437',
    accentHex: '#38BDF8',
    summary:
      'Grand Mela carnival hub featuring the illuminated Aakash Jhula Giant Wheel, playable mini-game stalls, glowing world portals, and live floor Rangoli stamping.',
  },
  {
    id: 'world_04_ganesh_chaturthi',
    worldNumber: 'WORLD 04',
    title: 'Ganesh Chaturthi: Maharashtra Utsav',
    region: 'Pune & Mumbai Heritage Quarters, Maharashtra',
    hinduCalendarTithi: 'Bhadrapada Shukla Chaturthi',
    playableSceneId: 'holi_braj',
    architectureStyle:
      'Wada Courtyards, Eco-Friendly Bamboo & Shadu Clay Pandal Pavilions',
    signatureActivities: [
      'Eco-Friendly Shadu Clay Pandal Decoration',
      'Ukadiache Modak Steaming & Preparation',
      'Dhol-Tasha Pathak Procession Rhythm',
    ],
    featuredMinigames: ['Modak Kitchen Master', 'Eco-Pandal Architect'],
    culturalCollectible: 'Swarna Modak & Hibiscus Garland Stamp',
    ambientAudioProfile:
      'Resonant Maharashtra Dhol-Tasha Ensemble & Zanj Cymbals',
    skyColorHex: '#FEF3C7',
    fogColorHex: '#FDE68A',
    accentHex: '#D97706',
    summary:
      'Community-driven celebration highlighting artistry, eco-conscious pandal craftsmanship, traditional Modak culinary arts, and Dhol-Tasha ensembles.',
  },
  {
    id: 'world_05_janmashtami',
    worldNumber: 'WORLD 05',
    title: 'Janmashtami: Vrindavan & Mathura',
    region: 'Braj Mandal, Uttar Pradesh',
    hinduCalendarTithi: 'Bhadrapada Krishna Ashtami (Midnight Rohini Nakshatra)',
    playableSceneId: 'diwali_ghat',
    architectureStyle:
      'Kadamba Groves, Yamuna Kesi Ghat Pavilions & Floral Jhanki Mandapas',
    signatureActivities: [
      'Cooperative 8-Player Dahi Handi Matki Pyramid',
      'Floral Jhanki & Swing (Hindola) Decoration',
      'Devotional Flute & Raas Storytelling Walks',
    ],
    featuredMinigames: ['Dahi Handi Co-op Pyramid', 'Jhanki Floral Craft'],
    culturalCollectible: 'Peacock Feather (Mor Pankh) & Makhan Matki Stamp',
    ambientAudioProfile:
      'Nocturnal Bansuri Raga Khamaj, Temple Bells & Yamuna Breeze',
    skyColorHex: '#0C192C',
    fogColorHex: '#172554',
    accentHex: '#38BDF8',
    summary:
      'Reverent cultural celebration of Krishna Janmashtami with cooperative Dahi Handi teamwork, floral Jhanki artistry, and serene temple-town exploration.',
  },
  {
    id: 'world_06_ram_navami',
    worldNumber: 'WORLD 06',
    title: 'Ram Navami: Ayodhya Heritage',
    region: 'Ayodhya & Sarayu Riverfront, Uttar Pradesh',
    hinduCalendarTithi: 'Chaitra Shukla Navami',
    playableSceneId: 'holi_braj',
    architectureStyle:
      'Grand Nagara Pink Sandstone Mandapas, Carved Pillars & Sarayu Ghats',
    signatureActivities: [
      'Heritage Architecture & Epics Storytelling Trail',
      'Sarayu Ghat Evening Deepdaan',
      'Traditional Chariot & Floral Toran Preparation',
    ],
    featuredMinigames: ['Heritage Epics Quiz & Trail', 'Floral Toran Weaver'],
    culturalCollectible: 'Carved Sandstone Kodanda Motif Stamp',
    ambientAudioProfile: 'Vedic Chants, Pakhawaj, Veena & Gentle River Winds',
    skyColorHex: '#FFEDD5',
    fogColorHex: '#FED7AA',
    accentHex: '#EA580C',
    summary:
      'Sunlit celebration of heritage architecture, educational storytelling missions, and community harmony along the ghats of Ayodhya.',
  },
  {
    id: 'world_07_durga_puja',
    worldNumber: 'WORLD 07',
    title: 'Durga Puja: Kolkata Art Pandals',
    region: 'Kumartuli & North Kolkata, West Bengal',
    hinduCalendarTithi: 'Ashvin Shukla Shashthi to Dashami',
    playableSceneId: 'mela_central',
    architectureStyle:
      'Terracotta Bishnupur Temples, Zamindari Thakur Dalans & Bamboo-Cloth Art Pandals',
    signatureActivities: [
      'Thematic Pandal Hopping & Photography Missions',
      'Dhak Drum & Dhunuchi Dance Rhythm Challenge',
      'Alpona Rice-Paste Floor Artistry',
    ],
    featuredMinigames: [
      'Dhak Rhythm & Dhunuchi',
      'Alpona Art Studio',
      'Pandal Photo Safari',
    ],
    culturalCollectible: 'Kashphool & Terracotta Dhunuchi Stamp',
    ambientAudioProfile:
      'Iconic Bengal Dhak Beats, Shankh Trio & Festive Pandal Murmur',
    skyColorHex: '#FFF1F2',
    fogColorHex: '#FFE4E6',
    accentHex: '#E11D48',
    summary:
      'UNESCO-recognized intangible cultural heritage brought to life through breathtaking artistic pandals, Dhak percussion, and Alpona designs.',
  },
  {
    id: 'world_08_onam_kerala',
    worldNumber: 'WORLD 08',
    title: 'Onam: Kerala Backwaters & Illam',
    region: 'Alappuzha & Aranmula, Kerala',
    hinduCalendarTithi: 'Thiruvonam Nakshatra in Chingam Month',
    playableSceneId: 'mela_central',
    architectureStyle:
      'Nalukettu Sloped Tile Courtyards, Palm-Fringed Backwaters & Chundan Vallam',
    signatureActivities: [
      '10-Ring Concentric Floral Pookalam Creation',
      'Multiplayer Vallam Kali (Snake Boat) Synchronized Rowing',
      '26-Dish Onam Sadhya Banana-Leaf Culinary Prep',
    ],
    featuredMinigames: [
      'Vallam Kali Boat Race',
      'Pookalam Floral Studio',
      'Sadhya Chef',
    ],
    culturalCollectible: 'Aranmula Kannadi Mirror & Vallam Oar Stamp',
    ambientAudioProfile:
      'Chenda Melam Percussion, Vanchipattu Boat Songs & Backwater Birds',
    skyColorHex: '#ECFDF5',
    fogColorHex: '#D1FAE5',
    accentHex: '#10B981',
    summary:
      'Lush tropical harvest festival featuring synchronized multiplayer snake-boat racing, floral Pookalam mandalas, and traditional Kerala architecture.',
  },
  {
    id: 'world_09_pongal_tamil_nadu',
    worldNumber: 'WORLD 09',
    title: 'Pongal: Tamil Nadu Harvest Village',
    region: 'Thanjavur & Madurai Region, Tamil Nadu',
    hinduCalendarTithi: 'Thai Month First Day (Uttarayana Sankranti)',
    playableSceneId: 'holi_braj',
    architectureStyle:
      'Agraharam Verandahs, Gopuram Gateways, Sugarcane Groves & Terracotta Courtyards',
    signatureActivities: [
      'Clay Pot Sakkarai Pongal Boil-Over ("Pongalo Pongal!") Timing',
      'Dot-Grid Sikku Kolam Rice-Flour Competition',
      'Respectful Harvest Village & Decorated Cart Celebration',
    ],
    featuredMinigames: ['Sakkarai Pongal Cook-Off', 'Sikku Kolam Grid Puzzle'],
    culturalCollectible: 'Turmeric-Tied Clay Pongal Pot Stamp',
    ambientAudioProfile:
      'Nadaswaram & Thavil Auspicious Music, Village Breeze & Temple Bells',
    skyColorHex: '#FEF9C3',
    fogColorHex: '#FEF08A',
    accentHex: '#CA8A04',
    summary:
      'Sun-drenched Tamil harvest celebration honoring agriculture, intricate mathematical Kolam dot-art, and overflowing clay pots of sweet Pongal.',
  },
  {
    id: 'world_10_makar_sankranti',
    worldNumber: 'WORLD 10',
    title: 'Makar Sankranti: Uttarayan Rooftops',
    region: 'Jaipur & Ahmedabad Pol Rooftops',
    hinduCalendarTithi: 'Solar Makara Rashi Transition (January 14/15)',
    playableSceneId: 'mela_central',
    architectureStyle:
      'Interconnected Sandstone & Pol Terraces, Wind Pavilions (Chhatris) & Sky Bridges',
    signatureActivities: [
      '3D Wind-Physics Kite (Patang) Crafting & Sky Duels',
      'Til-Gud Ladoo & Undhiyu Rooftop Feast',
      'Sunset Kandil Sky-Lantern Release',
    ],
    featuredMinigames: ['Uttarayan Kite Sky Tourney', 'Patang Workshop'],
    culturalCollectible: 'Firki Spool & Diamond Patang Stamp',
    ambientAudioProfile:
      'Crisp High-Altitude Wind, Joyful "Kai Po Che!" Rooftop Cheers & Dhol',
    skyColorHex: '#E0F2FE',
    fogColorHex: '#BAE6FD',
    accentHex: '#0284C7',
    summary:
      'Vertical rooftop playground across sun-warmed heritage terraces with hundreds of colorful kites dancing in realistic wind currents.',
  },
  {
    id: 'world_11_chhath_puja',
    worldNumber: 'WORLD 11',
    title: 'Chhath Puja: Ganga Riverbank Ghats',
    region: 'Patna & Munger Ghats, Bihar',
    hinduCalendarTithi: 'Kartika Shukla Shashthi & Saptami',
    playableSceneId: 'diwali_ghat',
    architectureStyle:
      'Expansive Stepped River Ghats, Bamboo Soop Canopies & Sugarcane Mandapas',
    signatureActivities: [
      'Ghat Cleanliness & Eco-Preparation Community Quest',
      'Thekua & Bamboo Soop (Winnowing Basket) Arrangement',
      'Sandhya & Usha Arghya (Sunset/Sunrise River Reflection) Experience',
    ],
    featuredMinigames: ['Ghat Community Restoration', 'Thekua & Soop Prep'],
    culturalCollectible: 'Woven Bamboo Soop & Rising Sun Stamp',
    ambientAudioProfile:
      'Soulful Maithili/Bhojpuri Folk Melodies, Gentle Ganga Flow & Dawn Birds',
    skyColorHex: '#31102F',
    fogColorHex: '#4A154B',
    accentHex: '#F97316',
    summary:
      'Deeply serene, eco-respectful riverside world celebrating solar gratitude, community ghat preparation, and golden sunrise reflections.',
  },
  {
    id: 'world_12_maha_shivratri',
    worldNumber: 'WORLD 12',
    title: 'Maha Shivratri: Varanasi Kashi Ghats',
    region: 'Varanasi (Kashi), Uttar Pradesh',
    hinduCalendarTithi: 'Phalguna Krishna Chaturdashi',
    playableSceneId: 'diwali_ghat',
    architectureStyle:
      'Ancient Kashi Riverfront Ghats, Stone Shikhara Spires & Bilva Courtyards',
    signatureActivities: [
      'Kashi Heritage Alley & Ghat Exploration',
      'Classical Rudra Veena & Damaru Acoustic Resonance Discovery',
      'Sacred Bilva Leaf & Brass Lamp Cultural Collection',
    ],
    featuredMinigames: ['Classical Raga Resonance', 'Kashi Heritage Trail'],
    culturalCollectible: 'Brass Damaru & Bilva Patra Stamp',
    ambientAudioProfile:
      'Deep Tanpura Drone, Rudra Veena, Damaru Percussion & Ganga Arti Bells',
    skyColorHex: '#090D16',
    fogColorHex: '#111827',
    accentHex: '#818CF8',
    summary:
      'Atmospheric nocturnal exploration of timeless Varanasi ghats, classical Indian instrumentation, and respectful spiritual storytelling.',
  },
];

export interface NpcCharacter {
  id: string;
  name: string;
  role: string;
  x: number;
  z: number;
  kurtaColor: number;
  pagdiColor: number;
  greeting: string;
  questTitle: string;
  questDetail: string;
  rewardCoins: number;
  rewardXp: number;
  stampUnlocked: string;
}

export const COURT_NPCS: NpcCharacter[] = [
  {
    id: 'pandit_vishwanath',
    name: 'Acharya Vishwanath',
    role: 'Mandir Historian & Panchang Scholar',
    x: 0,
    z: -14.5,
    kurtaColor: 0xf59e0b,
    pagdiColor: 0xd97706,
    greeting:
      'Namaste, traveler! Welcome to Braj Mandal. On Phalguna Purnima, every courtyard becomes a living canvas of friendship and devotion.',
    questTitle: 'Sacred Illumination of Braj',
    questDetail:
      'Light at least 4 sacred brass Diyas around the courtyard (press [R] on the beat or [E] near a Diya) and celebrate with festival revelers.',
    rewardCoins: 120,
    rewardXp: 150,
    stampUnlocked: 'Braj Mandir Kalash Stamp',
  },
  {
    id: 'priya_rangoli',
    name: 'Priya Sharma',
    role: 'Master Rangoli & Alpona Artist',
    x: -10.5,
    z: -4.0,
    kurtaColor: 0xe11d48,
    pagdiColor: 0xfbbf24,
    greeting:
      'Look at the central Chowk! A traditional Rangoli welcomes auspiciousness into the village. Press [G] to stamp glowing Rangoli art or open the Rangoli Studio!',
    questTitle: 'Mandala of the Courtyard',
    questDetail:
      'Press [G] to stamp glowing geometric Rangoli art around the courtyard or customize your mandala in the Rangoli Studio.',
    rewardCoins: 100,
    rewardXp: 125,
    stampUnlocked: 'Symmetric Lotus Rangoli Stamp',
  },
  {
    id: 'ustad_kabir',
    name: 'Ustad Kabir Das',
    role: 'Braj Dholak & Folk Music Maestro',
    x: 10.5,
    z: -4.0,
    kurtaColor: 0x0284c7,
    pagdiColor: 0xf43f5e,
    greeting:
      'Hear the beat of the Dhol! Our village challengers—Sprinters, Matki Lobbers, and Dhol Captains—are ready for a friendly Holi color match!',
    questTitle: 'Rhythm of the Pichkari',
    questDetail:
      'Fire Gulal [Space/Click], summon your Lotus Shield [Q/Right-Click] for a speed boost on block, and refill your Gulal Tank at the 4 courtyard color vats!',
    rewardCoins: 110,
    rewardXp: 140,
    stampUnlocked: 'Braj Dholak & Manjira Stamp',
  },
  {
    id: 'halwai_mohan',
    name: 'Mohanlal Halwai',
    role: 'Traditional Braj Mithai & Thandai Artisan',
    x: -11.0,
    z: 8.5,
    kurtaColor: 0x10b981,
    pagdiColor: 0xf59e0b,
    greeting:
      'Fresh saffron Gujiyas, Kesar Thandai, and warm Malpuas! Talking to me restores your Utsav Spirit pips whenever you need a breather!',
    questTitle: 'Sweet Hospitality of Braj',
    questDetail:
      'Sample traditional Braj Gujiya and Saffron Thandai to restore full Utsav Spirit Pips and earn a Culinary Heritage stamp.',
    rewardCoins: 80,
    rewardXp: 100,
    stampUnlocked: 'Kesar Gujiya & Thandai Stamp',
  },
];

export interface CharacterAttirePreset {
  id: string;
  name: string;
  regionOrigin: string;
  kurtaHex: string;
  dhotiHex: string;
  pagdiHex: string;
  skinHex: string;
  unlockCostCoins: number;
  perkLabel?: string;
}

export const ATTIRE_PRESETS: CharacterAttirePreset[] = [
  {
    id: 'braj_utsav_kesar',
    name: 'Braj Kurta (Saffron & Crimson Pagdi)',
    regionOrigin: 'Mathura & Vrindavan, UP',
    kurtaHex: '#F59E0B',
    dhotiHex: '#FFFBEB',
    pagdiHex: '#E11D48',
    skinHex: '#D99B72',
    unlockCostCoins: 0,
    perkLabel: 'Starter Festive Attire',
  },
  {
    id: 'royal_sherwani',
    name: 'Royal Sherwani (Indigo & Gold Zari)',
    regionOrigin: 'Jaipur & Lucknow Heritage',
    kurtaHex: '#1D4ED8',
    dhotiHex: '#FDE047',
    pagdiHex: '#F59E0B',
    skinHex: '#C6865A',
    unlockCostCoins: 80,
    perkLabel: '+15% Gulal Tank Capacity',
  },
  {
    id: 'festive_lehenga',
    name: 'Festive Lehenga (Rani Rose & Kundan)',
    regionOrigin: 'Barsana & Jodhpur Utsav',
    kurtaHex: '#E11D48',
    dhotiHex: '#FDE68A',
    pagdiHex: '#10B981',
    skinHex: '#E0AC69',
    unlockCostCoins: 120,
    perkLabel: '+20% Marigold Dash Speed',
  },
  {
    id: 'neon_mela_jacket',
    name: 'Neon Mela Jacket (Electric Peacock)',
    regionOrigin: 'Contemporary Grand Mela Edition',
    kurtaHex: '#0284C7',
    dhotiHex: '#1E1B4B',
    pagdiHex: '#F43F5E',
    skinHex: '#D99B72',
    unlockCostCoins: 160,
    perkLabel: '+25% Lotus Shield Aura',
  },
];

export const GULAL_TRAIL_SWATCHES = [
  { id: 'marigold', label: 'Marigold Gold', hex: '#F59E0B', threeHex: 0xf59e0b },
  { id: 'gulabi', label: 'Gulabi Rose', hex: '#F43F5E', threeHex: 0xf43f5e },
  { id: 'neel', label: 'Neel Cyan', hex: '#38BDF8', threeHex: 0x38bdf8 },
  { id: 'panna', label: 'Panna Emerald', hex: '#10B981', threeHex: 0x10b981 },
  { id: 'violet', label: 'Utsav Violet', hex: '#A855F7', threeHex: 0xa855f7 },
];

export const LOTUS_SHIELD_SKINS: {
  id: LotusShieldSkinId;
  name: string;
  domeHex: string;
  rimHex: string;
  threeDomeHex: number;
  threeRimHex: number;
}[] = [
  {
    id: 'pink_gold_lotus',
    name: 'Pink & Gold Sacred Lotus',
    domeHex: '#F43F5E',
    rimHex: '#FBBF24',
    threeDomeHex: 0xf43f5e,
    threeRimHex: 0xfbbf24,
  },
  {
    id: 'sapphire_chakra',
    name: 'Neel Sapphire Sudarshan',
    domeHex: '#38BDF8',
    rimHex: '#E0F2FE',
    threeDomeHex: 0x38bdf8,
    threeRimHex: 0xe0f2fe,
  },
  {
    id: 'emerald_marigold',
    name: 'Panna Emerald & Marigold',
    domeHex: '#10B981',
    rimHex: '#F59E0B',
    threeDomeHex: 0x10b981,
    threeRimHex: 0xf59e0b,
  },
];

export const RANGOLI_PIGMENTS = [
  { id: 0, name: 'Clear Sandstone', hex: '#2A1610' },
  { id: 1, name: 'Gulabi Rose', hex: '#F43F5E' },
  { id: 2, name: 'Haldi Marigold', hex: '#F59E0B' },
  { id: 3, name: 'Neel Peacock', hex: '#38BDF8' },
  { id: 4, name: 'Panna Emerald', hex: '#10B981' },
  { id: 5, name: 'Chandan Ivory', hex: '#FFFBEB' },
  { id: 6, name: 'Kumkum Vermilion', hex: '#EA580C' },
];

export const DEFAULT_RANGOLI_GRID: number[][] = [
  [0, 0, 2, 0, 1, 0, 2, 0, 0],
  [0, 2, 5, 2, 6, 2, 5, 2, 0],
  [2, 5, 1, 3, 5, 3, 1, 5, 2],
  [0, 2, 3, 4, 2, 4, 3, 2, 0],
  [1, 6, 5, 2, 5, 2, 5, 6, 1],
  [0, 2, 3, 4, 2, 4, 3, 2, 0],
  [2, 5, 1, 3, 5, 3, 1, 5, 2],
  [0, 2, 5, 2, 6, 2, 5, 2, 0],
  [0, 0, 2, 0, 1, 0, 2, 0, 0],
];
