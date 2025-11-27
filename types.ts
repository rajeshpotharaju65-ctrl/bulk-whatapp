
export interface Contact {
  id: string;
  name: string;
  phone: string;
  company?: string;
  avatar?: string;
  tags: string[];
  lastInteraction: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
}

export interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  variables: string[]; // e.g. ['name', 'company']
  type: 'text' | 'image' | 'button';
  mediaUrl?: string; // Optional image URL for image templates
  buttons?: {
    type: 'url' | 'phone' | 'location';
    label: string;
    value: string;
  }[];
}

export interface LogEntry {
  id: string;
  timestamp: string;
  campaignId: string;
  contactName: string;
  contactPhone: string;
  status: 'queued' | 'sending' | 'sent' | 'failed';
  message?: string;
}

export interface Campaign {
  id: string;
  name: string;
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed';
  templateId: string;
  audienceType: 'tag' | 'all' | 'manual';
  targetTags: string[]; // Used if audienceType is 'tag'
  targetContactIds: string[]; // Used if audienceType is 'manual'
  scheduleDate?: string; // ISO String
  recurring?: 'none' | 'daily' | 'weekly';
  progress: {
    total: number;
    sent: number;
    failed: number;
  };
  createdAt: string;
}

export interface UserProfile {
  username: string; // Login ID
  password?: string; // Login Password
  name: string;
  email: string;
  company: string;
  avatar: string;
  settings: {
    delaySeconds: number; // e.g., 3 seconds
    autoRetry: boolean;
  };
}

export interface ChartData {
  name: string;
  sent: number;
  replies: number;
}

export interface ContactFilters {
  search: string;
  tag: string | 'all';
  sentiment: string | 'all';
}

export type ViewState = 'dashboard' | 'campaigns' | 'contacts' | 'templates' | 'logs' | 'settings';
