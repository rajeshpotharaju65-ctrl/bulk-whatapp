
export interface Contact {
  id: string;
  name: string;
  phone: string;
  avatar?: string; // Base64 or URL
  tags: string[];
  lastInteraction: string; // ISO Date
  sentiment?: 'positive' | 'neutral' | 'negative';
}

export interface Campaign {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'completed';
  messageTemplate: string;
  targetSegment: string;
  sentCount: number;
  totalCount: number;
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
}

export type ViewState = 'dashboard' | 'campaigns' | 'contacts';
