
export interface Contact {
  id: string;
  name: string;
  phone: string;
  company?: string; // Added company field for custom personalization
  avatar?: string; // Base64 or URL
  tags: string[];
  lastInteraction: string; // ISO Date
  sentiment?: 'positive' | 'neutral' | 'negative';
}

export interface Campaign {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'completed' | 'scheduled';
  messageTemplate: string;
  targetSegment: string;
  sentCount: number;
  totalCount: number;
  scheduledFor?: string;
  recipientIds?: string[];
  image?: string | null;
}

export interface ChartData {
  name: string;
  sent: number;
  replies: number;
}

export interface UserProfile {
  name: string;
  email: string;
  avatar: string;
  company: string;
  plan: 'Free' | 'Pro' | 'Enterprise';
  // Business Details for CTAs
  businessPhone?: string;
  website?: string;
  locationUrl?: string;
}

export type ViewState = 'dashboard' | 'campaigns' | 'contacts';