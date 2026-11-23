export interface URLData {
  originalUrl: string;
  createdAt: string;
  expiresAt: string | null;
  clicks: number;
  clickTimeline: string[];
  referrers: Record<string, number>;
  devices: Record<string, number>;
  lastClicked: string | null;
  // Phase 1: Smarter link controls
  label?: string | null;
  tags?: string[];
  maxClicks?: number | null;
  passwordHash?: string | null;
  // Phase 2: Enhanced telemetry
  countries?: Record<string, number>;
  botClicks?: number;
  dailyClicks?: Record<string, number>;
  hourlyClicks?: Record<string, number>;
  // Phase 3: Social previews & public stats
  ogTitle?: string | null;
  ogDescription?: string | null;
  publicStats?: boolean;
  // Phase 4: Smart Traffic Routing & Scheduling
  startsAt?: string | null;
  fallbackUrl?: string | null;
  geoRoutes?: Record<string, string>;
  deviceRoutes?: { ios?: string | null; android?: string | null; desktop?: string | null };
  // Phase 5: A/B Split Testing & Destination Health
  splits?: SplitRoute[];
  splitClicks?: Record<string, number>;
  healthStatus?: LinkHealthStatus | null;
  // Phase 6 & Ralph Features: Deep Linking, Campaigns, Expired Actions
  deepLink?: boolean;
  campaign?: string | null;
  expiredAction?: ("message" | "redirect") | null;
  expiredUrl?: string | null;
}

export interface SplitRoute {
  url: string;
  weight: number;
  label?: string | null;
}

export interface LinkHealthStatus {
  ok: boolean;
  status: number;
  statusText: string;
  latencyMs: number;
  checkedAt: string;
}

export interface WebhookConfig {
  url: string;
  secret?: string | null;
  events: {
    onClicked?: boolean;
    onLimitReached?: boolean;
    onExpired?: boolean;
  };
  enabled: boolean;
  updatedAt?: string;
}

export interface PublicWebhookConfig {
  url: string;
  hasSecret: boolean;
  events: {
    onClicked?: boolean;
    onLimitReached?: boolean;
    onExpired?: boolean;
  };
  enabled: boolean;
  updatedAt?: string;
}

export interface WebhookDispatchPayload {
  event: "link.clicked" | "link.limit_reached" | "link.expired" | "test.ping";
  timestamp: string;
  link: {
    slug: string;
    originalUrl: string;
    targetUrl: string;
    clicks: number;
    maxClicks: number | null;
    label: string | null;
    tags: string[];
  };
  visitor: {
    country: string;
    device: string;
    referrer: string;
    ipHash: string;
    userAgent: string;
  };
}

export interface URLMetadata {
  originalUrl: string;
  clicks: number;
  createdAt: string;
  expiresAt: string | null;
  label?: string | null;
  tags?: string[];
  maxClicks?: number | null;
  hasPassword?: boolean;
  publicStats?: boolean;
  botClicks?: number;
  startsAt?: string | null;
  hasSplits?: boolean;
  deepLink?: boolean;
  campaign?: string | null;
  expiredAction?: ("message" | "redirect") | null;
  expiredUrl?: string | null;
}

export interface URLListEntry {
  slug: string;
  originalUrl: string;
  clicks: number;
  createdAt: string;
  expiresAt: string | null;
  isExpired: boolean;
  maxClicks: number | null;
  isExhausted: boolean;
  hasPassword: boolean;
  label: string | null;
  tags: string[];
  ogTitle: string | null;
  ogDescription: string | null;
  publicStats: boolean;
  botClicks: number;
  // Phase 4: Smart Traffic Routing
  startsAt: string | null;
  fallbackUrl: string | null;
  isPending: boolean;
  geoRoutes: Record<string, string>;
  deviceRoutes: { ios?: string | null; android?: string | null; desktop?: string | null };
  // Phase 5: A/B Split Testing & Destination Health
  splits?: SplitRoute[];
  healthStatus?: LinkHealthStatus | null;
  deepLink?: boolean;
  campaign?: string | null;
  expiredAction?: "message" | "redirect" | null;
  expiredUrl?: string | null;
}

export interface TimelineBucket {
  label: string;
  count: number;
}

export interface AnalyticsResponse {
  slug: string;
  originalUrl: string;
  clicks: number;
  createdAt: string;
  expiresAt: string | null;
  lastClicked: string | null;
  isExpired: boolean;
  maxClicks: number | null;
  isExhausted: boolean;
  hasPassword: boolean;
  label: string | null;
  tags: string[];
  referrers: Record<string, number>;
  devices: Record<string, number>;
  countries: Record<string, number>;
  botClicks: number;
  clickTimeline: TimelineBucket[];
  ogTitle: string | null;
  ogDescription: string | null;
  publicStats: boolean;
  qrSvg: string;
  // Phase 4: Smart Traffic Routing
  startsAt: string | null;
  fallbackUrl: string | null;
  isPending: boolean;
  geoRoutes: Record<string, string>;
  deviceRoutes: { ios?: string | null; android?: string | null; desktop?: string | null };
  // Phase 5: A/B Split Testing & Destination Health
  splits?: SplitRoute[];
  splitClicks?: Record<string, number>;
  healthStatus?: LinkHealthStatus | null;
  // Phase 6 & Ralph Features: Deep Linking, Campaigns, Expired Actions
  deepLink?: boolean;
  campaign?: string | null;
  expiredAction?: ("message" | "redirect") | null;
  expiredUrl?: string | null;
}

export interface ImportLinkInput {
  slug?: string;
  originalUrl?: string;
  url?: string;
  expiresAt?: string | null;
  expiresIn?: string;
  clicks?: number;
  label?: string | null;
  tags?: string[];
  maxClicks?: number | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  publicStats?: boolean;
  // Phase 4: Smart Traffic Routing
  startsAt?: string | null;
  fallbackUrl?: string | null;
  geoRoutes?: Record<string, string>;
  deviceRoutes?: { ios?: string | null; android?: string | null; desktop?: string | null };
  // Phase 5: A/B Split Testing & Destination Health
  splits?: SplitRoute[];
  healthStatus?: LinkHealthStatus | null;
  deepLink?: boolean;
  campaign?: string | null;
  expiredAction?: "message" | "redirect" | null;
  expiredUrl?: string | null;
}

export interface Env {
  URL_KV: KVNamespace;
  ADMIN_TOKEN?: string;
  ALLOW_PUBLIC_ADMIN?: string;
  ALLOWED_ORIGINS?: string;
  IP_HASH_SECRET?: string;
}

// ── Link-in-Bio & Social Profile Page Types ──
export type BioTheme = "midnight" | "paper" | "emerald" | "sunset" | "glass";

export interface BioLinkItem {
  id: string;
  title: string;
  url: string;
  icon?: string;
  highlight?: boolean;
  clicks: number;
}

export interface BioSocials {
  instagram?: string;
  twitter?: string;
  github?: string;
  youtube?: string;
  linkedin?: string;
  email?: string;
  discord?: string;
  website?: string;
}

export interface BioPageData {
  handle: string;
  title: string;
  bio?: string | null;
  avatarUrl?: string | null;
  verified?: boolean;
  theme: BioTheme;
  customAccentColor?: string | null;
  links: BioLinkItem[];
  socials: BioSocials;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImage?: string | null;
  leadCapture?: BioLeadCapture;
  views: number;
  createdAt: string;
  updatedAt: string;
}

export interface BioPageSummary {
  handle: string;
  title: string;
  avatarUrl?: string | null;
  verified?: boolean;
  theme: BioTheme;
  linksCount: number;
  views: number;
  totalClicks: number;
  subscribersCount?: number;
  updatedAt: string;
}

// ── Branded QR Code Types ──
export type QrPresetLogo = "none" | "globe" | "instagram" | "youtube" | "twitter" | "github" | "linkedin" | "custom";
export type QrCornerStyle = "square" | "rounded" | "dots";

export interface BrandedQrOptions {
  errorCorrectionLevel?: "L" | "M" | "Q" | "H";
  colorDark?: string;
  colorLight?: string;
  gradientStart?: string;
  gradientEnd?: string;
  useGradient?: boolean;
  cornerStyle?: QrCornerStyle;
  logo?: QrPresetLogo;
  customLogoUrl?: string;
  margin?: number;
  width?: number;
}

// ── Lead Capture Types ──
export interface BioLeadCapture {
  enabled: boolean;
  title?: string;
  description?: string;
  buttonText?: string;
  successMessage?: string;
}

export interface BioLead {
  email: string;
  subscribedAt: string;
  ipHash?: string;
}
