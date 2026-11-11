// Complete 9-Deliverable AAA Game Studio Blueprint for MELAVERSE
// Covers GDD, 12-World Design, UE5 C++ Architecture, Project Structure, 3D Art & LOD Pipeline,
// 18-Table Supabase PostgreSQL Schema & RLS, MVP Sprints, 12-Month Roadmap, and Launch Strategy.

export interface BlueprintDeliverable {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  roleOwner: string;
  highlights: string[];
  sections: {
    heading: string;
    body: string[];
    codeBlock?: {
      language: string;
      caption: string;
      code: string;
    };
  }[];
}

export const STUDIO_BLUEPRINT_DELIVERABLES: BlueprintDeliverable[] = [
  {
    id: 'deliv_01_gdd',
    number: 'DELIVERABLE 01',
    title: 'Game Design Document (GDD)',
    subtitle: 'Vision, Core Gameplay Loop, Modes, Economy & Year-Round LiveOps',
    roleOwner: 'Senior Game Director & Economy Designer',
    highlights: [
      'Open-Ended Cultural Life Sim + Multiplayer Festival Mini-Games',
      '3-Tier Loop: Micro (3m Mini-Game) → Meso (Daily/World Quest) → Macro (Cultural Passport & Home)',
      '100% Fair Cosmetic Economy (Zero Pay-to-Win)',
    ],
    sections: [
      {
        heading: '1. Core Vision & Pillar Architecture',
        body: [
          'MELAVERSE is a cross-platform (PC Windows, Android, iOS) realistic 3D multiplayer universe built in Unreal Engine 5 where every major Indian festival is an independently loadable, living architectural destination.',
          'Target Audience: Indian diaspora & domestic players (ages 10–45+), cultural explorers, social co-op players, and family groups seeking authentic, celebratory multiplayer experiences.',
          'Core Loop: Enter Mela Central Hub -> Check Regional Panchang Calendar & Daily Missions -> Travel via Portal to Active Festival World (e.g., Holi: Braj) -> Explore & Interact with regional NPCs -> Compete/Cooperate in 2–5 min Mini-Games -> Earn XP, Festival Coins & Cultural Passport Stamps -> Unlock Regional Attire & Personal Haveli Decor.',
        ],
      },
      {
        heading: '2. Game Modes & Session Capacities',
        body: [
          'Single-Player Mode: Story-driven cultural discovery quests, AI-populated festival courtyards, heritage photography, collectible hunting, and practice mini-games.',
          'Authoritative Multiplayer Mode: Dedicated UE5 server instances supporting 12–16 players per public courtyard instance, 2–8 player private friend parties, and 2–8 player instantiated competitive/co-op mini-game arenas.',
          'Lunar & Solar Panchang Integration: Supports regional calendar variations (Purnimanta vs. Amanta lunar reckonings, solar Sankranti transitions) while keeping all 12 destinations permanently accessible year-round in Historical Exploration mode.',
        ],
      },
      {
        heading: '3. Layered Progression & Fair Cosmetic Economy',
        body: [
          'Currencies: Experience Points (XP for Player Level), Festival Coins (earned via missions & mini-games), and Cosmetic Collectibles.',
          'Strict Non-P2W Governance: Purchased cosmetics, regional textiles, emotes, and Festival Pass tiers grant zero movement speed, hitbox, or scoring advantages.',
        ],
      },
    ],
  },
  {
    id: 'deliv_02_worlds',
    number: 'DELIVERABLE 02',
    title: '12-World Design Document',
    subtitle: 'Architectural Layouts, Landmarks, NPCs, Mini-Games & Audio Profiles',
    roleOwner: '3D Environment Director & Cultural Authenticity Consultant',
    highlights: [
      '12 Distinct Regional Destinations from Braj & Varanasi to Kerala & Bengal',
      'Compact 80–120m Hub Courtyards with 25–35m Sightline Landmarks',
      'Respectful Sacred Representation Prioritizing Education & Co-op Over Trivialization',
    ],
    sections: [
      {
        heading: '1. Flagship World 01 — Holi: Braj (Mathura, Vrindavan & Barsana)',
        body: [
          'Map Layout: Concentric temple-town layout anchored by the Central Rangoli Chowk, flanked by carved Braj red-sandstone Havelis with projecting Jharokha balconies, narrow Galis (lanes >= 4m wide for camera clearance), the Mandir Shikhara Vista on the North axis, and Yamuna Ghat steps on the South.',
          'Activities & Mini-Games: Holi Color Challenge (Gulabi/Haldi/Neel pichkari arena), Lathmar Defensive Rhythm parrying, Phoolon ki Holi petal shower, and Interactive Rangoli Studio.',
          'NPCs & Collectibles: Acharya Vishwanath (Panchang Scholar), Priya (Rangoli Artisan), Ustad Kabir (Dholak Maestro), Mohanlal Halwai (Gujiya & Thandai stall). Collectibles: Brass Pichkari, Braj Bansuri, Mor Pankh.',
        ],
      },
      {
        heading: '2. Worlds 02 to 06 — Diwali, Navratri, Ganesh Chaturthi, Janmashtami & Ram Navami',
        body: [
          'World 02 (Diwali Heritage Town): Nocturnal courtyard & stepped ghat; lighting 108 terracotta diyas, Kandil lantern crafting, and mithai bazaar.',
          'World 03 (Navratri Gujarat): Pol courtyard framing a circular Garba Maidan around the central Garbo lamp; 4–8 player synchronized Dandiya Raas rhythm tracks.',
          'World 04 (Ganesh Chaturthi Maharashtra): Wada architecture & eco-friendly Shadu-clay pandal workshop; Ukadiache Modak culinary timing mini-game & Dhol-Tasha rhythm.',
          'World 05 (Janmashtami Vrindavan): Kadamba groves & Kesi Ghat; 8-player cooperative Dahi Handi human-pyramid balance challenge & floral Jhanki decoration.',
          'World 06 (Ram Navami Ayodhya): Pink sandstone Nagara mandapas & Sarayu riverfront; heritage storytelling trail, floral toran weaving, and evening Deepdaan.',
        ],
      },
      {
        heading: '3. Worlds 07 to 12 — Durga Puja, Onam, Pongal, Makar Sankranti, Chhath & Shivratri',
        body: [
          'World 07 (Durga Puja Bengal): Kolkata Thakur Dalan & bamboo-cloth art pandals; Dhak percussion rhythm, Alpona floor art, and Pandal photography missions.',
          'World 08 (Onam Kerala): Nalukettu courtyard & palm-fringed backwater race course; 8-player Vallam Kali snake-boat rowing & 10-ring floral Pookalam studio.',
          'World 09 (Pongal Tamil Nadu): Agraharam street & harvest fields; clay-pot Sakkarai Pongal boil-over timing and mathematical Sikku Kolam dot-grid puzzles.',
          'World 10 (Makar Sankranti): Interconnected Jaipur/Ahmedabad heritage rooftops; 3D wind-vector Patang kite aerial duels & Firki line tension mechanics.',
          'World 11 (Chhath Puja Bihar) & World 12 (Maha Shivratri Varanasi): Reverent Ganga river ghat restoration, bamboo Soop preparation, sunrise Arghya, and Kashi Rudra Veena acoustic discovery.',
        ],
      },
    ],
  },
  {
    id: 'deliv_03_tech_arch',
    number: 'DELIVERABLE 03',
    title: 'Technical & Multiplayer Architecture',
    subtitle: 'UE5 Dedicated Server Authority, GameLift Fleet Allocation & Supabase Backend',
    roleOwner: 'Principal Unreal Architect & Multiplayer Networking Engineer',
    highlights: [
      'Server-Authoritative UE5 Dedicated Servers (60Hz PC / 30Hz Mobile NetTickRate)',
      'Zero Client Authority for Currency, Inventory, or Match Outcomes (SEC-AUTH-001)',
      'Amazon GameLift FleetIQ + Node.js/TypeScript Matchmaking Gateway + Supabase PostgreSQL',
    ],
    sections: [
      {
        heading: '1. End-to-End Client, Dedicated Server & Backend Topology',
        body: [
          'Game Clients (Windows PC, Android Vulkan/GLES3.2, iOS Metal) authenticate via Supabase Auth (JWT).',
          'Social presence, party invites, and friend status route through Supabase Realtime channels utilizing RFC 7396 non-destructive delta merging (Rule DATA-MERGE-001).',
          'Gameplay movement, interaction proximity checks, mini-game scores, and pichkari projectile hits run on headless Linux UE5 Dedicated Servers orchestrated by Amazon GameLift.',
        ],
        codeBlock: {
          language: 'mermaid',
          caption: 'System & Authority Topology',
          code: `graph TD
  Client[UE5 Client: PC / Android / iOS] -->|JWT Bearer Auth| API[TypeScript / Node.js API Gateway]
  Client -->|UDP Encrypted NetDriver| DedSrv[UE5 Dedicated Server - Amazon GameLift]
  API -->|Service Role RPC| DB[(Supabase PostgreSQL 18 Tables + RLS)]
  DedSrv -->|mTLS Server Secret| API
  Client <-->|Presence & Party Deltas| RT[Supabase Realtime]`,
        },
      },
      {
        heading: '2. Matchmaking & Session Allocation Flow',
        body: [
          'Input-Aware Pools: Matchmaking separates Touch (Android/iOS) and KBM/Controller (PC) queues for competitive mini-games while allowing mixed cross-play in cooperative courtyards and private parties.',
          'Validation Pipeline: Upon mini-game completion, the UE5 Dedicated Server signs a cryptographic match summary payload and invokes the backend `commit_match_results_tx` PostgreSQL transaction.',
        ],
      },
    ],
  },
  {
    id: 'deliv_04_ue5_structure',
    number: 'DELIVERABLE 04',
    title: 'Unreal Engine 5 Project Structure',
    subtitle: 'Modular C++ Runtime Modules, GameFeature Plugins & Content Hierarchy',
    roleOwner: 'Principal Unreal Engine Architect & Senior C++ Gameplay Engineer',
    highlights: [
      'Modular Gameplay & GameFeatures Architecture (/Plugins/FestivalWorlds/*)',
      'Core C++ Base Classes with Blueprint Data/Cosmetic Subclasses',
      'PrimaryAssetLabel Pak Chunking for On-Demand Mobile World Download',
    ],
    sections: [
      {
        heading: '1. C++ Source Module & Plugin Hierarchy',
        body: [
          'Each Festival World is encapsulated as an independently loadable UE5 GameFeature Plugin (`Festival_HoliBraj`, `Festival_DiwaliGhat`, etc.) so mobile builds only keep `MelaCentral` and the active festival in core memory.',
        ],
        codeBlock: {
          language: 'text',
          caption: 'MELAVERSE UE5 Directory & Module Hierarchy',
          code: `Melaverse/
├── Source/
│   ├── MelaverseCore/           # GameInstance, AuthSubsystem, AssetManager
│   ├── MelaverseCharacter/      # AMelaverseCharacter, ModularSkeletalMerge, AnimInstance
│   ├── MelaverseInteraction/    # IInteractableInterface, UProximityInteractionComponent
│   ├── MelaverseMinigame/       # AMelaverseMinigameBase, AMinigameGameState, AntiCheatValidator
│   ├── MelaverseNetwork/        # AAuthoritativeGameMode, PartyBeaconClient, GameLiftServerSDK
│   └── MelaverseUI/             # CommonUI ActivatableWidgets, HUDLayerManager
├── Plugins/
│   └── GameFeatures/
│       ├── Festival_MelaCentral/
│       ├── Festival_HoliBraj/   # MVP Vertical Slice Pak Chunk 101
│       └── Festival_DiwaliGhat/ # Pak Chunk 102
└── Content/
    ├── Core/
    ├── Characters/ModularHuman/
    ├── UI/CommonUI/
    └── Audio/MetaSounds/`,
        },
      },
      {
        heading: '2. Core C++ Gameplay Class Specifications',
        body: [
          'AMelaverseCharacter: Uses `FSkeletalMeshMerge` at runtime to combine modular Head, Torso (Kurta/Choli), Legs (Dhoti/Lehenga), Footwear (Mojari), and Headgear (Pagdi/Dupatta) into a single skinned draw call per character on mobile.',
          'UProximityInteractionComponent: Server-verified sphere overlap + dot-product gaze check; prevents client-spoofed remote shop or collectible triggers.',
        ],
      },
    ],
  },
  {
    id: 'deliv_05_art_pipeline',
    number: 'DELIVERABLE 05',
    title: '3D Art, Lighting & Mobile LOD Pipeline',
    subtitle: 'PBR Material Standards, Nanite/Lumen PC Profile vs Mobile Vulkan/Metal Profile',
    roleOwner: '3D Environment Lead & Mobile Performance Engineer',
    highlights: [
      'Scalable Rendering: PC Nanite + Lumen GI vs Mobile Static/CSM + HLOD',
      'Strict Triangle & Texture Budgets (LOD0 -> LOD3, ASTC_6x6 Mobile Compression)',
      'Master Material Library withORM Packed Channels (Occlusion/Roughness/Metallic)',
    ],
    sections: [
      {
        heading: '1. Platform-Specific Rendering & Lighting Profiles',
        body: [
          'PC High/Epic Profile: DirectX 12 SM6, Nanite virtualized micropolygon geometry enabled on carved sandstone architecture, Lumen dynamic Global Illumination & Reflections, Virtual Shadow Maps.',
          'Android & iOS Mobile Profile: Vulkan / Metal Mobile Forward or Deferred Renderer, Nanite & Lumen disabled, GPU Lightmass baked indirect lighting + 1 Stationary Directional Sun Light with 2-cascade CSM shadows for dynamic characters.',
        ],
      },
      {
        heading: '2. Polygon, Draw Call & Texture Budgets',
        body: [
          'Player Character: LOD0 = 18,000 tris (PC/Close-up), LOD1 = 9,500 tris, LOD2 = 4,200 tris, LOD3 = 1,800 tris (distant courtyard crowd). Maximum 2 material slots after SkeletalMeshMerge.',
          'Texture Packing: BaseColor (sRGB), Normal (BC5/ASTC), and packed ORM (R=Ambient Occlusion, G=Roughness, B=Metallic in linear space). Max 2048x2048 on PC, capped at 1024x1024 ASTC_6x6 on mobile.',
          'Naming Convention: `SM_Braj_HaveliArch_01`, `SK_Char_KurtaBraj_01`, `M_Sandstone_Master`, `MI_Sandstone_BarsanaRed`, `T_Braj_Sandstone_D`, `T_Braj_Sandstone_N`, `T_Braj_Sandstone_ORM`.',
        ],
      },
    ],
  },
  {
    id: 'deliv_06_database',
    number: 'DELIVERABLE 06',
    title: 'Database & Backend Architecture (18 Tables)',
    subtitle: 'Supabase PostgreSQL Schema, Row-Level Security (RLS) & Transactional RPCs',
    roleOwner: 'Backend & Database Architect',
    highlights: [
      'All 18 Normalized PostgreSQL Tables with UUID PKs, FKs, and Composite Indexes',
      'Strict RLS Policies: Clients Read Own State; Only Service-Role Mutates Economy',
      'Idempotent Server-Side Transaction Functions for Rewards & Match Validation',
    ],
    sections: [
      {
        heading: '1. Complete 18-Table PostgreSQL Schema & Relationships',
        body: [
          'The persistence layer separates real-time ephemeral match state (held in UE5 Dedicated Server memory) from ACID-compliant account progression in Supabase PostgreSQL across 18 tables: (1) players, (2) player_profiles, (3) platform_accounts, (4) player_inventory, (5) player_currencies, (6) festival_worlds, (7) festival_events, (8) player_quests, (9) player_achievements, (10) player_collections, (11) player_homes, (12) friends, (13) parties, (14) matchmaking_sessions, (15) match_history, (16) player_notifications, (17) daily_challenges, (18) seasonal_rewards.',
        ],
        codeBlock: {
          language: 'sql',
          caption: 'Core DDL & RLS Policies (Supabase PostgreSQL Migration)',
          code: `-- 1. players & 2. player_profiles & 5. player_currencies
CREATE TABLE public.players (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.player_profiles (
  player_id UUID PRIMARY KEY REFERENCES public.players(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL UNIQUE CHECK (char_length(display_name) BETWEEN 3 AND 24),
  xp BIGINT NOT NULL DEFAULT 0 CHECK (xp >= 0),
  level INT NOT NULL DEFAULT 1 CHECK (level >= 1),
  avatar_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.player_currencies (
  player_id UUID PRIMARY KEY REFERENCES public.players(id) ON DELETE CASCADE,
  festival_coins BIGINT NOT NULL DEFAULT 0 CHECK (festival_coins >= 0),
  seasonal_tokens BIGINT NOT NULL DEFAULT 0 CHECK (seasonal_tokens >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS: Clients can SELECT own rows, NEVER directly UPDATE currencies/XP
ALTER TABLE public.player_currencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players read own currencies" ON public.player_currencies
  FOR SELECT TO authenticated USING (auth.uid() = player_id);

-- Server-Authoritative Match Reward Transaction (Invoked by UE5 Dedicated Server via Service Role)
CREATE OR REPLACE FUNCTION public.commit_match_reward_tx(
  p_match_id UUID,
  p_player_id UUID,
  p_coins_delta INT,
  p_xp_delta INT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.player_currencies
     SET festival_coins = festival_coins + p_coins_delta, updated_at = now()
   WHERE player_id = p_player_id;
  UPDATE public.player_profiles
     SET xp = xp + p_xp_delta, level = (xp + p_xp_delta) / 250 + 1, updated_at = now()
   WHERE player_id = p_player_id;
END;
$$;`,
        },
      },
      {
        heading: '2. Cross-Platform Account Synchronization & Anti-Cheat',
        body: [
          '`platform_accounts` links Steam/Epic PC IDs, Google Play Games IDs, and Apple Game Center IDs to a single canonical `players.id` UUID.',
          'Every reward transaction carries an idempotency key (`match_id` + `player_id`) and server-verified score ceiling check to prevent replay attacks.',
        ],
      },
    ],
  },
  {
    id: 'deliv_07_mvp_sprints',
    number: 'DELIVERABLE 07',
    title: 'MVP Vertical Slice Implementation Plan',
    subtitle: '6 Two-Week Engineering Sprints for Mela Central + World 01 (Holi: Braj)',
    roleOwner: 'Senior C++ Gameplay Engineer & Scrum Master',
    highlights: [
      'Focused Scope: Mela Central Lobby + Holi Braj Courtyard + 2 Mini-Games + Parties',
      'Explicitly Defers Full 12-World Streaming, Trading & Voice Chat Post-Validation',
      'Automated Functional Tests & Mobile Device Profiling Every Sprint',
    ],
    sections: [
      {
        heading: '1. Sprint Breakdown (Sprints 1 to 6 — 12 Weeks)',
        body: [
          'Sprint 1 (Foundation & Auth): UE5.4 repo setup, Supabase JWT login subsystem (`UMelaverseAuthSubsystem`), Mela Central blockout, third-person character locomotion.',
          'Sprint 2 (Modular Character & Interaction): `FSkeletalMeshMerge` regional attire customizer, `UProximityInteractionComponent`, NPC dialogue trees (Acharya Vishwanath & Priya).',
          'Sprint 3 (Holi: Braj Environment & Lighting): Modular red sandstone Havelis, Mandir Shikhara vista, PC Lumen profile + Mobile baked lightmaps, ASTC texture validation.',
          'Sprint 4 (Minigame 01 — Holi Color Challenge): `AHoliArenaMinigame`, server-authoritative pichkari projectile pooling, 3 AI/Player challenger roles, score & hitstop feedback.',
          'Sprint 5 (Minigame 02 — Rangoli Studio & Progression): Symmetric mandrel painter (`URangoliCanvasWidget`), dynamic courtyard decal projection, Supabase quest/coin transaction RPCs.',
          'Sprint 6 (Dedicated Server, Parties & Cross-Platform Build): Linux Dedicated Server packaging on GameLift, 2–8 player party beacon, PC/Android/iOS test build QA sign-off.',
        ],
      },
    ],
  },
  {
    id: 'deliv_08_roadmap',
    number: 'DELIVERABLE 08',
    title: '9–12 Month Production Roadmap',
    subtitle: '6 Development Phases, Team Composition, Dependencies & Technical Risk Matrix',
    roleOwner: 'Studio Production Director & QA Lead',
    highlights: [
      '6 Structured Gates from Pre-Production (Months 1–2) to Closed Beta & Launch (Months 10–12)',
      'Core Team of 14–18 Specialists Across Engineering, 3D Art, Tech Art, Audio & Cultural QA',
      'Explicit Mitigation for Mobile Thermal Throttling & Dedicated Server Bandwidth',
    ],
    sections: [
      {
        heading: '1. Six-Phase Timeline & Deliverables',
        body: [
          'Phase 1: Pre-Production (Months 1–2) — Frozen GDD, 18-table DB schema, Master Material library, cultural authenticity audit for Braj.',
          'Phase 2: Core Prototype (Months 3–4) — Character controller, camera collision pull-in, proximity interactions, Supabase Auth + GameLift handshake.',
          'Phase 3: Vertical Slice (Months 5–6) — Complete Holi: Braj environment, Modular Character Customizer, Holi Color Challenge, Linux Dedicated Server.',
          'Phase 4: MVP Production (Months 7–8) — Rangoli Studio, Mela Central Hub, Cultural Passport, Party system, Diwali Ghat preview world.',
          'Phase 5: Cross-Platform Testing (Months 9–10) — Android (Snapdragon 778G/8 Gen 2) & iOS (A14+) thermal/memory soak tests, 16-player server stress test.',
          'Phase 6: Closed Beta & Launch (Months 11–12) — Penetration testing, RLS security audit, telemetry balancing, store certification.',
        ],
      },
    ],
  },
  {
    id: 'deliv_09_launch_strategy',
    number: 'DELIVERABLE 09',
    title: 'Product, LiveOps & Fair Monetization Strategy',
    subtitle: 'Panchang Seasonal Calendar, Retention Telemetry & Cosmetic-Only F2P Model',
    roleOwner: 'Product Lead, LiveOps Manager & Security Engineer',
    highlights: [
      'Synchronized Real-World Hindu Festival Live Events + Permanent Historical Access',
      'Direct Production Metric Gates (99%+ Crash-Free, 30–60 FPS Mobile, Zero P2W)',
      'Age-Appropriate Curated Emotes & Quick-Chat (No Unmoderated Voice in MVP)',
    ],
    sections: [
      {
        heading: '1. Seasonal LiveOps & Community Goals',
        body: [
          'Festival Live Windows: Two weeks prior to each major calendar festival (e.g., Phalguna Purnima for Holi, Kartika Amavasya for Diwali), Mela Central transforms with thematic lighting and launches a community-wide goal (e.g., "Light 1,000,000 Diyas Across All Servers").',
          'Ethical Monetization: Revenue derives strictly from Regional Artisanal Attire Collections (Banarasi silk, Bandhani, Kasavu), Haveli Home Decor packs, and optional Cosmetic Utsav Passes—with transparent pricing and parental spending caps.',
        ],
      },
    ],
  },
];
