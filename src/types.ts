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
}

export interface Env {
  URL_KV: KVNamespace;
  ADMIN_TOKEN?: string;
}
