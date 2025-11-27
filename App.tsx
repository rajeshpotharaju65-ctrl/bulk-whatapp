
import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, Users, MessageSquare, Plus, Search, 
  Settings, LogOut, Menu, Bell, Link as LinkIcon,
  Sparkles, Send, Globe, MapPin, FileText, Download,
  Upload, Play, StopCircle, Clock, Trash2, CheckCircle,
  AlertTriangle, Save, Loader2, Phone, CheckSquare,
  ImageIcon, FastForward, UploadCloud, RefreshCw, X, UserPlus, CreditCard,
  Edit, Lock, CheckCircle as CheckDouble 
} from './components/Icons';
import { DashboardChart } from './components/DashboardChart';
import { FormInput, FormTextArea } from './components/FormInput';
import { generateCampaignMessage, analyzeSegments } from './services/geminiService';
import { Contact, Campaign, ViewState, UserProfile, MessageTemplate, LogEntry, ContactFilters, ChartData } from './types';

// --- INITIAL DATA ---
const INITIAL_CONTACTS: Contact[] = [
  { id: '1', name: 'Alice Johnson', phone: '+1234567890', tags: ['vip'], lastInteraction: '2023-10-25', sentiment: 'positive', company: 'Acme Corp', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice' },
  { id: '2', name: 'Bob Smith', phone: '+1987654321', tags: ['lead'], lastInteraction: '2023-10-24', sentiment: 'neutral', company: 'Global Tech', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob' },
  { id: '3', name: 'Charlie Brown', phone: '+1122334455', tags: ['inactive'], lastInteraction: '2023-10-20', sentiment: 'negative', company: 'Local Shop', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Charlie' },
  { id: '4', name: 'David Lee', phone: '+1555666777', tags: ['vip', 'wholesale'], lastInteraction: '2023-10-28', sentiment: 'positive', company: 'Lee Imports', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=David' },
  { id: '5', name: 'Eva Green', phone: '+1999888777', tags: ['new'], lastInteraction: '2023-11-01', sentiment: 'neutral', company: 'Green Gardens', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Eva' },
];

const INITIAL_TEMPLATES: MessageTemplate[] = [
  { 
    id: 't1', 
    name: 'Welcome Message', 
    content: 'Hi {{name}}, thanks for joining us at {{company}}! Check out our latest collection.', 
    variables: ['name', 'company'], 
    type: 'button',
    buttons: [
      { type: 'url', label: 'Visit Website', value: 'https://myshop.com' },
      { type: 'location', label: 'Find Store', value: 'https://maps.google.com' }
    ] 
  },
  {
    id: 't2',
    name: 'Product Showcase',
    content: 'Hello {{name}}, take a look at our new arrival! 👇',
    variables: ['name'],
    type: 'image',
    mediaUrl: '' // Empty by default so user can upload
  }
];

const INITIAL_USER: UserProfile = {
  username: 'admin',
  password: '123',
  name: 'Admin User',
  email: 'admin@whatsappmanager.com',
  company: 'Business Pro',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin',
  settings: { delaySeconds: 3, autoRetry: true }
};

// --- HELPER COMPONENTS ---

const StatusBadge = ({ status }: { status: string }) => {
  const colors: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-600',
    scheduled: 'bg-blue-100 text-blue-700',
    running: 'bg-emerald-100 text-emerald-700 animate-pulse',
    paused: 'bg-amber-100 text-amber-700',
    completed: 'bg-purple-100 text-purple-700',
    sent: 'bg-slate-200 text-slate-700',
    delivered: 'bg-blue-100 text-blue-700',
    read: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    queued: 'bg-gray-50 text-gray-500',
    sending: 'bg-yellow-50 text-yellow-600'
  };
  
  const icon = {
      sent: '✓',
      delivered: '✓✓',
      read: '✓✓',
      failed: '!',
      running: '•••'
  }[status];

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium uppercase tracking-wide flex items-center gap-1 ${colors[status] || colors.draft}`}>
      {status} {icon && <span className={status === 'read' ? 'text-blue-500 font-bold' : ''}>{icon}</span>}
    </span>
  );
};

// Helper to replace variables
const fillTemplate = (content: string, contact: Contact) => {
  let text = content;
  text = text.replace(/{{name}}/g, contact.name);
  text = text.replace(/{{phone}}/g, contact.phone);
  text = text.replace(/{{company}}/g, contact.company || '');
  // Generic fallback for other keys
  text = text.replace(/{{(\w+)}}/g, (match, key) => {
    return (contact as any)[key] || match;
  });
  return text;
};

// Helper to convert Base64 to Blob for clipboard
const dataURItoBlob = (dataURI: string) => {
  try {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], {type: mimeString});
  } catch (e) {
    console.error("Failed to convert image", e);
    return null;
  }
}

// Helper for local storage
const getStorageData = <T,>(key: string, initialValue: T): T => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : initialValue;
  } catch (e) {
    console.error(`Error loading ${key}`, e);
    return initialValue;
  }
};

// --- MAIN APP ---

const App: React.FC = () => {
  // --- STATE ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState('');
  
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  
  // Data State with Persistence
  const [user, setUser] = useState<UserProfile>(() => getStorageData('wapp_user', INITIAL_USER));
  const [contacts, setContacts] = useState<Contact[]>(() => getStorageData('wapp_contacts', INITIAL_CONTACTS));
  const [templates, setTemplates] = useState<MessageTemplate[]>(() => getStorageData('wapp_templates', INITIAL_TEMPLATES));
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => getStorageData('wapp_campaigns', []));
  const [logs, setLogs] = useState<LogEntry[]>(() => getStorageData('wapp_logs', []));

  // Persistence Effects
  useEffect(() => { localStorage.setItem('wapp_user', JSON.stringify(user)); }, [user]);
  useEffect(() => { localStorage.setItem('wapp_contacts', JSON.stringify(contacts)); }, [contacts]);
  useEffect(() => { localStorage.setItem('wapp_templates', JSON.stringify(templates)); }, [templates]);
  useEffect(() => { localStorage.setItem('wapp_campaigns', JSON.stringify(campaigns)); }, [campaigns]);
  useEffect(() => { localStorage.setItem('wapp_logs', JSON.stringify(logs)); }, [logs]);

  // Selection & Filter State
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<ContactFilters>({ search: '', tag: 'all', sentiment: 'all' });
  
  // View Specific State (Lifted up to prevent re-render loss)
  const [pasteText, setPasteText] = useState(''); // For Contacts Import
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Template View State
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [draftTemplate, setDraftTemplate] = useState<Partial<MessageTemplate>>({ type: 'text', variables: [], buttons: [] });
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  // Campaign View State
  const [campaignStep, setCampaignStep] = useState(1);
  const [draftCampaign, setDraftCampaign] = useState<Partial<Campaign>>({ 
    name: '', 
    status: 'draft',
    audienceType: 'tag',
    targetTags: [],
    targetContactIds: [],
    customButtons: []
  });
  const [wizardAiPrompt, setWizardAiPrompt] = useState('');
  const [isWizardGenerating, setIsWizardGenerating] = useState(false);
  const [wizardTab, setWizardTab] = useState<'select' | 'generate'>('select');
  const [scheduledDate, setScheduledDate] = useState('');

  // Engine State
  const engineRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  // --- DERIVED DATA ---
  const getFilteredContacts = () => {
    return contacts.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(filters.search.toLowerCase()) || c.phone.includes(filters.search);
      const matchesTag = filters.tag === 'all' || c.tags.includes(filters.tag);
      const matchesSentiment = filters.sentiment === 'all' || c.sentiment === filters.sentiment;
      return matchesSearch && matchesTag && matchesSentiment;
    });
  };
  const filteredContacts = getFilteredContacts();
  const allTags = Array.from(new Set(contacts.flatMap(c => c.tags)));

  // --- CHART DATA GENERATION (REAL TIME) ---
  const chartData = React.useMemo(() => {
    const data: ChartData[] = [];
    const today = new Date();
    
    // Generate last 7 days
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dateStr = d.toDateString();
        const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
        
        const dayLogs = logs.filter(l => new Date(l.timestamp).toDateString() === dateStr);
        
        data.push({
            name: dayName,
            sent: dayLogs.length,
            replies: dayLogs.filter(l => l.status === 'read').length
        });
    }
    return data;
  }, [logs]);

  // --- LOGIN LOGIC ---
  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const u = formData.get('username') as string;
    const p = formData.get('password') as string;

    if (u === user.username && p === user.password) {
      setIsAuthenticated(true);
      setLoginError('');
    } else {
      setLoginError('Invalid username or password');
    }
  };

  // --- STATUS SIMULATION ENGINE ---
  useEffect(() => {
    if (statusRef.current) clearInterval(statusRef.current);

    // Simulate status progression: Sent -> Delivered -> Read
    statusRef.current = setInterval(() => {
        setLogs(prevLogs => {
            let logsChanged = false;
            const now = Date.now();
            
            const newLogs = prevLogs.map(log => {
                const timeDiff = now - new Date(log.timestamp).getTime();
                
                // Randomly mark as delivered after ~10-20 seconds
                if (log.status === 'sent' && timeDiff > 10000 && Math.random() > 0.3) {
                    logsChanged = true;
                    return { ...log, status: 'delivered' as const };
                }
                
                // Randomly mark as read after ~30-60 seconds
                if (log.status === 'delivered' && timeDiff > 30000 && Math.random() > 0.4) {
                    logsChanged = true;
                    return { ...log, status: 'read' as const };
                }
                
                return log;
            });

            if (logsChanged) {
                 // Update Campaign Counts based on new logs
                 setCampaigns(prevCampaigns => prevCampaigns.map(c => {
                     // Recalculate stats for this campaign
                     const cLogs = newLogs.filter(l => l.campaignId === c.id);
                     if (cLogs.length === 0) return c;

                     const sent = cLogs.filter(l => l.status === 'sent').length;
                     const delivered = cLogs.filter(l => l.status === 'delivered').length;
                     const read = cLogs.filter(l => l.status === 'read').length;
                     const failed = cLogs.filter(l => l.status === 'failed').length;
                     
                     return {
                         ...c,
                         progress: {
                             ...c.progress,
                             sent: sent,
                             delivered: delivered,
                             read: read,
                             failed: failed
                         }
                     };
                 }));
                 return newLogs;
            }
            return prevLogs;
        });
    }, 5000); // Check statuses every 5 seconds

    return () => {
        if (statusRef.current) clearInterval(statusRef.current);
    }
  }, []);

  // --- ENGINE LOGIC (Realtime Injection) ---
  useEffect(() => {
    if (engineRef.current) clearInterval(engineRef.current);

    engineRef.current = setInterval(() => {
      setCampaigns(prevCampaigns => {
        // First check if any scheduled campaigns should be activated
        const now = new Date();
        const campaignsToActivate = prevCampaigns.map(c => {
            if (c.status === 'scheduled' && c.scheduleDate && new Date(c.scheduleDate) <= now) {
                return { ...c, status: 'running' as const };
            }
            return c;
        });

        const activeCampaigns = campaignsToActivate.filter(c => c.status === 'running');
        
        // If nothing changed and no active campaigns, return previous state to avoid rerenders
        const hasActivation = campaignsToActivate.some((c, i) => c.status !== prevCampaigns[i].status);
        if (!hasActivation && activeCampaigns.length === 0) return prevCampaigns;

        // Process running campaigns
        return campaignsToActivate.map(campaign => {
          if (campaign.status !== 'running') return campaign;

          // Resolve Target Audience
          let targetAudience: Contact[] = [];
          if (campaign.audienceType === 'all') targetAudience = contacts;
          else if (campaign.audienceType === 'tag') targetAudience = contacts.filter(c => c.tags.some(t => campaign.targetTags.includes(t)));
          else if (campaign.audienceType === 'manual') targetAudience = contacts.filter(c => campaign.targetContactIds.includes(c.id));

          // Calculate current index based on total processed
          const currentProgress = campaign.progress.sent + campaign.progress.delivered + campaign.progress.read + campaign.progress.failed;
          
          if (currentProgress >= targetAudience.length) {
             return { ...campaign, status: 'completed' };
          }

          const contact = targetAudience[currentProgress];
          const template = templates.find(t => t.id === campaign.templateId);

          if (contact && template) {
            // 1. Prepare Message
            let message = fillTemplate(template.content, contact);
            
            // 2. Handle Image
            if (template.type === 'image' && template.mediaUrl && template.mediaUrl.startsWith('data:')) {
               const blob = dataURItoBlob(template.mediaUrl);
               if (blob) {
                  try {
                      const item = new ClipboardItem({ [blob.type]: blob });
                      navigator.clipboard.write([item]).catch(e => console.log("Auto-copy blocked by browser policy"));
                  } catch (e) {
                      console.log("Clipboard API not available");
                  }
               }
            } else if (template.type === 'image' && template.mediaUrl) {
                message += `\n\n${template.mediaUrl}`;
            }

            // 3. Attach Buttons (Custom Campaign Buttons OVERRIDE Template Buttons if present)
            const buttonsToUse = (campaign.customButtons && campaign.customButtons.length > 0) 
                                 ? campaign.customButtons 
                                 : template.buttons;

            if (buttonsToUse && buttonsToUse.length > 0) {
                message += '\n'; // Spacer
                buttonsToUse.forEach(btn => {
                   let icon = '';
                   if (btn.type === 'url') icon = '🌐';
                   if (btn.type === 'location') icon = '📍';
                   if (btn.type === 'phone') icon = '📞';
                   message += `\n${icon} ${btn.label}: ${btn.value}`;
                });
            }

            const encodedMessage = encodeURIComponent(message);
            
            // 4. Inject to WhatsApp
            const url = `https://web.whatsapp.com/send?phone=${contact.phone.replace(/[^0-9]/g, '')}&text=${encodedMessage}`;
            window.open(url, '_blank');

            // 5. Log Result
            const logEntry: LogEntry = {
              id: Date.now().toString(),
              timestamp: new Date().toISOString(),
              campaignId: campaign.id,
              contactName: contact.name,
              contactPhone: contact.phone,
              status: 'sent'
            };
            setLogs(prev => [logEntry, ...prev].slice(0, 200)); 

            // 6. Update Progress (Increment Sent)
            return {
              ...campaign,
              progress: {
                ...campaign.progress,
                sent: campaign.progress.sent + 1
              }
            };
          }

          return {
             ...campaign,
             progress: { ...campaign.progress, failed: campaign.progress.failed + 1 }
          };
        });
      });

    }, user.settings.delaySeconds * 1000);

    return () => {
      if (engineRef.current) clearInterval(engineRef.current);
    };
  }, [campaigns, contacts, user.settings.delaySeconds, templates, user.password, user.username]);

  // --- CONTACT ACTIONS ---
  const handleSelectAll = () => {
    if (selectedContactIds.size === filteredContacts.length) {
      setSelectedContactIds(new Set());
    } else {
      setSelectedContactIds(new Set(filteredContacts.map(c => c.id)));
    }
  };

  const handleSelectRandom = (count: number) => {
    const shuffled = [...filteredContacts].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, count).map(c => c.id);
    setSelectedContactIds(new Set(selected));
  };

  const toggleSelection = (id: string) => {
    setSelectedContactIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const handleDeleteContacts = () => {
    if (selectedContactIds.size === 0) return;
    const contactsToDelete = contacts.filter(c => selectedContactIds.has(c.id));
    const phonesToDelete = new Set(contactsToDelete.map(c => c.phone));
    const idsToDelete = new Set(contactsToDelete.map(c => c.id));
    setContacts(prev => prev.filter(c => !selectedContactIds.has(c.id)));
    setLogs(prev => prev.filter(l => !phonesToDelete.has(l.contactPhone)));
    setDraftCampaign(prev => ({
      ...prev,
      targetContactIds: prev.targetContactIds?.filter(id => !idsToDelete.has(id)) || []
    }));
    setSelectedContactIds(new Set());
  };

  const handleDeleteSingleContact = (id: string) => {
    const contactToDelete = contacts.find(c => c.id === id);
    setContacts(prev => prev.filter(c => c.id !== id));
    setSelectedContactIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
    if (contactToDelete) {
      setLogs(prev => prev.filter(l => l.contactPhone !== contactToDelete.phone));
    }
    setDraftCampaign(prev => ({
      ...prev,
      targetContactIds: prev.targetContactIds?.filter(cid => cid !== id) || []
    }));
  };

  const handleDeleteLog = (logId: string) => {
    setLogs(prev => prev.filter(l => l.id !== logId));
  };

  const handleBulkImport = (text: string) => {
    const lines = text.split('\n');
    const newContacts: Contact[] = lines.map((line, idx) => {
      const parts = line.split(/[,\t;]+/); 
      const phone = parts.length > 1 ? parts[1].trim() : parts[0].trim();
      const name = parts.length > 1 ? parts[0].trim() : `Contact ${contacts.length + idx + 1}`;
      if (phone.length < 5) return null;
      return {
        id: `import-${Date.now()}-${idx}`,
        name: name || 'Unknown',
        phone: phone,
        tags: ['imported'],
        lastInteraction: new Date().toISOString(),
        sentiment: 'neutral' as const
      };
    }).filter(Boolean) as Contact[];
    setContacts(prev => [...prev, ...newContacts]);
    setIsBulkImportOpen(false);
    setPasteText('');
  };

  const handleAddSingleContact = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newContact: Contact = {
      id: `manual-${Date.now()}`,
      name: formData.get('name') as string,
      phone: formData.get('phone') as string,
      tags: (formData.get('tags') as string).split(',').map(t => t.trim()).filter(Boolean),
      lastInteraction: new Date().toISOString(),
      sentiment: 'neutral',
      company: formData.get('company') as string || '',
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Date.now()}`
    };
    setContacts(prev => [...prev, newContact]);
    setIsContactModalOpen(false);
  };

  // --- TEMPLATE ACTIONS ---
  
  const handleTemplateAI = async () => {
    setIsAiGenerating(true);
    const content = await generateCampaignMessage('Marketing', aiPrompt);
    setDraftTemplate(prev => ({ ...prev, content }));
    setIsAiGenerating(false);
  };

  const handleTemplateImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setDraftTemplate(prev => ({...prev, mediaUrl: ev.target?.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const saveTemplate = () => {
    if (draftTemplate.name && draftTemplate.content) {
      if (editingTemplateId) {
        setTemplates(prev => prev.map(t => t.id === editingTemplateId ? { ...draftTemplate, id: editingTemplateId } as MessageTemplate : t));
      } else {
        setTemplates(prev => [...prev, { ...draftTemplate, id: Date.now().toString() } as MessageTemplate]);
      }
      setIsCreatingTemplate(false);
      setDraftTemplate({ type: 'text', variables: [], buttons: [] });
      setEditingTemplateId(null);
    }
  };

  const handleCreateNewTemplate = () => {
      setDraftTemplate({ type: 'text', variables: [], buttons: [], name: '', content: '' });
      setEditingTemplateId(null);
      setIsCreatingTemplate(true);
  };

  const handleEditTemplate = (t: MessageTemplate) => {
    setDraftTemplate(t);
    setEditingTemplateId(t.id);
    setIsCreatingTemplate(true);
  };

  const handleDeleteTemplate = (id: string) => {
    if (window.confirm('Delete template?')) {
      setTemplates(prev => prev.filter(t => t.id !== id));
      setCampaigns(prev => prev.filter(c => c.templateId !== id));
      if (editingTemplateId === id) {
        setIsCreatingTemplate(false);
        setEditingTemplateId(null);
        setDraftTemplate({ type: 'text', variables: [], buttons: [] });
      }
    }
  };

  // --- CAMPAIGN ACTIONS ---

  const handleDeleteCampaign = (id: string) => {
    if (window.confirm('Delete campaign and logs?')) {
      setCampaigns(prev => prev.filter(c => c.id !== id));
      setLogs(prev => prev.filter(l => l.campaignId !== id));
    }
  };

  const finalizeCampaign = (status: 'running' | 'scheduled', startDate?: string) => {
    let total = 0;
    if (draftCampaign.audienceType === 'all') total = contacts.length;
    if (draftCampaign.audienceType === 'tag') total = contacts.filter(c => c.tags.some(t => draftCampaign.targetTags?.includes(t))).length;
    if (draftCampaign.audienceType === 'manual') total = draftCampaign.targetContactIds?.length || 0;

    const newCampaign: Campaign = {
       id: Date.now().toString(),
       name: draftCampaign.name || 'Untitled',
       status: status, 
       templateId: draftCampaign.templateId!,
       audienceType: draftCampaign.audienceType || 'tag',
       targetTags: draftCampaign.targetTags || [],
       targetContactIds: draftCampaign.targetContactIds || [],
       scheduleDate: startDate || new Date().toISOString(),
       recurring: 'none',
       customButtons: draftCampaign.customButtons || [],
       progress: { total, sent: 0, delivered: 0, read: 0, failed: 0 },
       createdAt: new Date().toISOString()
    };
    setCampaigns(prev => [newCampaign, ...prev]);
    setCampaignStep(1);
    setCurrentView('dashboard');
    if (draftCampaign.audienceType === 'manual') setSelectedContactIds(new Set());
    setScheduledDate('');
    // Reset draft buttons
    setDraftCampaign(prev => ({...prev, customButtons: []}));
  };

  const handleWizardAiGenerate = async () => {
    setIsWizardGenerating(true);
    const content = await generateCampaignMessage('Promotional', wizardAiPrompt);
    const tempTemplate: MessageTemplate = {
        id: `ai-gen-${Date.now()}`,
        name: `AI Generated: ${wizardAiPrompt.slice(0, 15)}...`,
        content: content,
        type: 'text',
        variables: ['name']
    };
    setTemplates(prev => [tempTemplate, ...prev]);
    setDraftCampaign(prev => ({ ...prev, templateId: tempTemplate.id }));
    setIsWizardGenerating(false);
    setWizardAiPrompt('');
    setCampaignStep(3);
  };

  // --- DATA MIGRATION ---
  const handleBackup = () => {
    const data = { version: '1.0', timestamp: new Date().toISOString(), user, contacts, templates, campaigns, logs };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `whatsapp-manager-backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.contacts) setContacts(data.contacts);
        if (data.templates) setTemplates(data.templates);
        if (data.campaigns) setCampaigns(data.campaigns);
        if (data.user) setUser(data.user);
        alert('Data restored successfully!');
      } catch (err) {
        alert('Failed to restore data.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- QUICK BLAST ---
  const handleQuickSend = (qText: string, qMsg: string) => {
      const lines = qText.split('\n').filter(l => l.trim().length > 5);
      if (lines.length === 0 || !qMsg) return;

      const tempIds: string[] = [];
      const tempContacts: Contact[] = lines.map((line, idx) => {
        const id = `quick-${Date.now()}-${idx}`;
        tempIds.push(id);
        return {
           id,
           name: `Quick Contact ${idx+1}`,
           phone: line.trim(),
           tags: ['quick-blast'],
           lastInteraction: new Date().toISOString()
        };
      });

      const tempTemplate: MessageTemplate = {
         id: `temp-tpl-${Date.now()}`,
         name: 'Quick Blast',
         content: qMsg,
         type: 'text',
         variables: []
      };

      setContacts(prev => [...prev, ...tempContacts]);
      setTemplates(prev => [...prev, tempTemplate]);
      
      const campaign: Campaign = {
        id: `quick-camp-${Date.now()}`,
        name: `Quick Send (${new Date().toLocaleTimeString()})`,
        status: 'running',
        templateId: tempTemplate.id,
        audienceType: 'manual',
        targetTags: [],
        targetContactIds: tempIds,
        createdAt: new Date().toISOString(),
        progress: { total: tempIds.length, sent: 0, delivered: 0, read: 0, failed: 0 }
      };

      setCampaigns(prev => [campaign, ...prev]);
      alert(`Started background sending engine for ${tempIds.length} numbers.`);
  };

  const QuickPasteModal = () => {
    const [qText, setQText] = useState('');
    const [qMsg, setQMsg] = useState('');
    return (
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6">
         <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2"><FastForward className="w-4 h-4 text-emerald-600"/> Quick Blast (Bulk Auto-Send)</h3>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <textarea 
              className="p-3 border rounded-lg text-sm h-32 font-mono resize-none focus:ring-2 focus:ring-emerald-500/20 outline-none" 
              placeholder="Paste numbers here (one per line)..."
              value={qText}
              onChange={e => setQText(e.target.value)}
            />
            <div className="flex flex-col gap-2 h-32">
              <textarea 
                className="p-3 border rounded-lg text-sm flex-1 resize-none focus:ring-2 focus:ring-emerald-500/20 outline-none" 
                placeholder="Type your message here..."
                value={qMsg}
                onChange={e => setQMsg(e.target.value)}
              />
              <button onClick={() => { handleQuickSend(qText, qMsg); setQText(''); setQMsg(''); }} disabled={!qText || !qMsg} className="bg-emerald-600 text-white py-2 rounded-lg font-bold hover:bg-emerald-700 disabled:opacity-50">
                 Start Bulk Sending
              </button>
            </div>
         </div>
      </div>
    );
  };

  const SidebarItem = ({ view, icon: Icon, label }: { view: ViewState, icon: any, label: string }) => (
    <button 
      onClick={() => setCurrentView(view)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${currentView === view ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
    >
      <Icon className="w-5 h-5" />
      {isSidebarOpen && <span>{label}</span>}
    </button>
  );

  // --- RENDER ---

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md animate-in zoom-in duration-300">
           <div className="flex justify-center mb-6">
              <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center text-white">
                 <MessageSquare className="w-7 h-7" />
              </div>
           </div>
           <h2 className="text-2xl font-bold text-center text-slate-800 mb-2">WhatsApp Manager V3</h2>
           <p className="text-center text-slate-500 text-sm mb-6">Enter your credentials to continue</p>
           <form onSubmit={handleLogin} className="space-y-4">
              <FormInput label="Username" name="username" defaultValue="admin" required />
              <FormInput label="Password" name="password" type="password" defaultValue="123" required />
              {loginError && <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">{loginError}</div>}
              <button className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-lg shadow-emerald-500/20 transition-all">
                 Login
              </button>
           </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900">
      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-white border-r border-slate-200 transition-all duration-300 flex flex-col z-20`}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-600 font-bold text-xl overflow-hidden whitespace-nowrap">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white flex-shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            {isSidebarOpen && <span>AutoWApp</span>}
          </div>
          <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-1 hover:bg-slate-100 rounded-md lg:hidden">
            <Menu className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 px-4 space-y-2 mt-4">
          <SidebarItem view="dashboard" icon={LayoutDashboard} label="Dashboard" />
          <SidebarItem view="contacts" icon={Users} label="Contacts" />
          <SidebarItem view="templates" icon={FileText} label="Templates" />
          <SidebarItem view="campaigns" icon={Send} label="Campaigns" />
        </nav>
        {isSidebarOpen && (
          <div className="px-6 py-4 space-y-2">
             <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <h5 className="text-xs font-bold text-slate-500 uppercase mb-3">Backup Data</h5>
                <button onClick={handleBackup} className="w-full py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium hover:bg-slate-100 flex items-center justify-center gap-1 mb-2">
                   <Download className="w-3 h-3"/> Download JSON
                </button>
                <div className="relative">
                   <button className="w-full py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium hover:bg-slate-100 flex items-center justify-center gap-1">
                      <Upload className="w-3 h-3"/> Restore JSON
                   </button>
                   <input type="file" ref={fileInputRef} onChange={handleRestore} className="absolute inset-0 opacity-0 cursor-pointer" accept=".json"/>
                </div>
             </div>
          </div>
        )}
        <div className="p-4 border-t border-slate-100">
           <button onClick={() => setIsAuthenticated(false)} className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg mt-1">
             <LogOut className="w-5 h-5" />
             {isSidebarOpen && <span>Logout</span>}
           </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto flex flex-col">
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
          <h1 className="text-2xl font-bold text-slate-800 capitalize">{currentView}</h1>
          <div className="flex items-center gap-4">
             {campaigns.some(c => c.status === 'running') && (
                <div className="hidden md:flex items-center gap-2 text-xs font-medium bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-100">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  Sending Active
                </div>
             )}
            <button onClick={() => setIsProfileModalOpen(true)} className="w-10 h-10 bg-slate-200 rounded-full overflow-hidden border-2 border-white shadow-sm hover:ring-2 ring-emerald-500 transition-all">
               <img src={user.avatar} alt="User" className="w-full h-full object-cover"/>
            </button>
          </div>
        </header>

        <main className="p-8 flex-1 max-w-7xl mx-auto w-full">
          {currentView === 'dashboard' && (
            <div className="space-y-6 animate-in fade-in duration-500">
               <QuickPasteModal />
               
               {/* Active Campaigns Widget */}
               {campaigns.some(c => c.status === 'running') && (
                  <div className="mb-6 bg-emerald-50 border border-emerald-100 rounded-xl p-4 animate-in fade-in slide-in-from-top-4">
                      <h3 className="font-bold text-emerald-800 mb-3 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin"/> Active Campaigns</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {campaigns.filter(c => c.status === 'running').map(c => {
                               const total = c.progress.total;
                               // Use total of processed statuses
                               const sent = c.progress.sent;
                               const delivered = c.progress.delivered;
                               const read = c.progress.read;
                               const failed = c.progress.failed;
                               const processed = sent + delivered + read + failed;
                               const sentPercent = total > 0 ? (processed / total) * 100 : 0;
                               return (
                                  <div key={c.id} className="bg-white p-3 rounded-lg border border-emerald-200 shadow-sm">
                                      <div className="flex justify-between mb-2">
                                           <span className="font-medium text-slate-700 truncate">{c.name}</span>
                                           <span className="text-xs font-bold text-emerald-600">{Math.round(sentPercent)}%</span>
                                      </div>
                                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                           <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${sentPercent}%` }} />
                                      </div>
                                       <div className="flex justify-between mt-1 text-[10px] text-slate-500">
                                          <span>{processed} processed</span>
                                          <span>{total - processed} left</span>
                                      </div>
                                  </div>
                               )
                          })}
                      </div>
                  </div>
               )}

               <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10"><Play className="w-16 h-16 text-emerald-600"/></div>
                  <p className="text-slate-500 text-sm font-medium">Running Campaigns</p>
                  <h3 className="text-3xl font-bold text-slate-800 mt-1">{campaigns.filter(c => c.status === 'running').length}</h3>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10"><MessageSquare className="w-16 h-16 text-blue-600"/></div>
                  <p className="text-slate-500 text-sm font-medium">Delivered Today</p>
                  <h3 className="text-3xl font-bold text-blue-600 mt-1">
                      {logs.filter(l => new Date(l.timestamp).toDateString() === new Date().toDateString() && (l.status === 'delivered' || l.status === 'read')).length}
                  </h3>
                </div>
                {/* ... other stats ... */}
                <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10"><Users className="w-16 h-16 text-purple-600"/></div>
                  <p className="text-slate-500 text-sm font-medium">Total Contacts</p>
                  <h3 className="text-3xl font-bold text-slate-800 mt-1">{contacts.length}</h3>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10"><Settings className="w-16 h-16 text-slate-600"/></div>
                  <p className="text-slate-500 text-sm font-medium">Speed Setting</p>
                  <h3 className="text-3xl font-bold text-slate-800 mt-1">{user.settings.delaySeconds}s</h3>
                  <p className="text-xs text-slate-400 mt-1">Delay per message</p>
                </div>
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <DashboardChart data={chartData} />
                </div>
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 overflow-hidden flex flex-col h-[400px]">
                  <div className="flex justify-between items-center mb-4">
                     <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 text-emerald-600" /> Live Delivery Log
                     </h3>
                     {logs.length > 0 && (
                        <button onClick={() => setLogs([])} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                           <Trash2 className="w-3 h-3"/> Clear Logs
                        </button>
                     )}
                  </div>
                  <div className="space-y-3 overflow-y-auto pr-2 flex-1">
                    {logs.length === 0 && <div className="text-center text-slate-400 mt-10">Waiting for campaigns...</div>}
                    {logs.map(log => (
                      <div key={log.id} className="flex items-center justify-between text-sm p-3 rounded-lg bg-slate-50 border border-slate-100 transition-all hover:bg-slate-100 group">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-700">{log.contactName}</span>
                          <span className="text-xs text-slate-400">{log.contactPhone}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex flex-col items-end">
                                <StatusBadge status={log.status} />
                                <span className="text-[10px] text-slate-400 mt-1">{new Date(log.timestamp).toLocaleTimeString()}</span>
                            </div>
                            <button onClick={() => handleDeleteLog(log.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1">
                                <X className="w-4 h-4"/>
                            </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
               </div>
            </div>
          )}

          {currentView === 'contacts' && (
             <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in h-full flex flex-col">
               {/* Contact View Content (keeping existing) */}
               <div className="p-4 border-b border-slate-100 space-y-4">
                 <div className="flex flex-wrap gap-4 justify-between items-center">
                    <div className="flex items-center gap-2">
                       <div className="relative w-64">
                         <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                         <input 
                           type="text" 
                           placeholder="Search by name or phone..." 
                           className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                           value={filters.search}
                           onChange={(e) => setFilters({...filters, search: e.target.value})}
                         />
                       </div>
                       <select 
                          className="px-3 py-2 border rounded-lg bg-slate-50 text-sm focus:outline-none"
                          value={filters.tag}
                          onChange={(e) => setFilters({...filters, tag: e.target.value})}
                       >
                          <option value="all">All Tags</option>
                          {allTags.map(t => <option key={t} value={t}>{t}</option>)}
                       </select>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setIsBulkImportOpen(true)} className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm">
                        <UploadCloud className="w-4 h-4" /> Import / Paste
                      </button>
                      <button onClick={() => setIsContactModalOpen(true)} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm">
                        <Plus className="w-4 h-4" /> New
                      </button>
                    </div>
                 </div>
                 
                 <div className="flex flex-wrap gap-2 items-center text-sm py-2 bg-slate-50 px-4 rounded-lg border border-slate-100">
                    <span className="font-medium text-slate-600 mr-2">{selectedContactIds.size} Selected</span>
                    <div className="h-4 w-px bg-slate-300 mx-2"></div>
                    <button onClick={handleSelectAll} className="hover:text-emerald-600">
                       {selectedContactIds.size === filteredContacts.length ? 'Deselect All' : 'Select All'}
                    </button>
                    <button onClick={() => handleSelectRandom(10)} className="hover:text-emerald-600">Random 10</button>
                    <button onClick={() => handleSelectRandom(50)} className="hover:text-emerald-600">Random 50</button>
                    {selectedContactIds.size > 0 && (
                      <>
                        <div className="h-4 w-px bg-slate-300 mx-2"></div>
                        <button onClick={handleDeleteContacts} className="text-red-500 hover:text-red-700 flex items-center gap-1">
                           <Trash2 className="w-3 h-3"/> Remove Selected
                        </button>
                        <button onClick={() => {
                          setDraftCampaign(prev => ({ ...prev, audienceType: 'manual', targetContactIds: Array.from(selectedContactIds) }));
                          setCampaignStep(1);
                          setCurrentView('campaigns');
                        }} className="text-emerald-600 hover:text-emerald-800 font-bold flex items-center gap-1 ml-auto">
                           Create Campaign <FastForward className="w-3 h-3"/>
                        </button>
                      </>
                    )}
                 </div>
               </div>

               <div className="overflow-auto flex-1">
                 <table className="w-full text-left">
                   <thead className="bg-slate-50 text-slate-600 text-sm font-medium sticky top-0 z-10">
                     <tr>
                       <th className="px-6 py-3 w-10">
                         <input 
                           type="checkbox" 
                           checked={selectedContactIds.size === filteredContacts.length && filteredContacts.length > 0}
                           onChange={handleSelectAll}
                           className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" 
                         />
                       </th>
                       <th className="px-6 py-3">Name</th>
                       <th className="px-6 py-3">Phone</th>
                       <th className="px-6 py-3">Tags</th>
                       <th className="px-6 py-3">Status</th>
                       <th className="px-6 py-3">Action</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                     {filteredContacts.map(contact => (
                       <tr key={contact.id} className={`hover:bg-slate-50 ${selectedContactIds.has(contact.id) ? 'bg-emerald-50/50' : ''}`}>
                         <td className="px-6 py-4">
                           <input 
                             type="checkbox" 
                             checked={selectedContactIds.has(contact.id)}
                             onChange={() => toggleSelection(contact.id)}
                             className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" 
                           />
                         </td>
                         <td className="px-6 py-4 font-medium text-slate-900 flex items-center gap-2">
                           <img src={contact.avatar} alt="" className="w-6 h-6 rounded-full bg-slate-200" />
                           {contact.name}
                         </td>
                         <td className="px-6 py-4 text-slate-600 font-mono text-xs">{contact.phone}</td>
                         <td className="px-6 py-4">
                           <div className="flex gap-1">
                             {contact.tags.map(t => <span key={t} className="px-2 py-0.5 bg-white border border-slate-200 text-slate-600 rounded text-[10px] uppercase tracking-wider">{t}</span>)}
                           </div>
                         </td>
                         <td className="px-6 py-4">
                           <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${contact.sentiment === 'positive' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                             {contact.sentiment}
                           </span>
                         </td>
                         <td className="px-6 py-4 flex items-center gap-2">
                            <a href={`https://wa.me/${contact.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="text-emerald-600 hover:bg-emerald-50 p-1.5 rounded-md inline-block">
                               <Send className="w-4 h-4" />
                            </a>
                            <button onClick={() => handleDeleteSingleContact(contact.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-md" title="Remove Contact">
                               <Trash2 className="w-4 h-4" />
                            </button>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
               {/* Modals are unchanged, reuse logic */}
               {isBulkImportOpen && (
                 <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                   <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 animate-in zoom-in-95 duration-200">
                      <div className="flex justify-between items-center mb-4">
                         <h3 className="text-xl font-bold">Bulk Import Contacts</h3>
                         <button onClick={() => setIsBulkImportOpen(false)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600"/></button>
                      </div>
                      <p className="text-sm text-slate-500 mb-4">Paste contacts (Name, Phone) or just Numbers. One per line.</p>
                      <textarea 
                         className="w-full h-48 p-3 border rounded-lg font-mono text-sm mb-4 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                         placeholder={"John Doe, +123456789\nJane Smith, +987654321\n+1122334455"}
                         value={pasteText}
                         onChange={(e) => setPasteText(e.target.value)}
                      />
                      <div className="flex justify-end gap-3">
                         <button onClick={() => setIsBulkImportOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                         <button onClick={() => handleBulkImport(pasteText)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold">Import Contacts</button>
                      </div>
                   </div>
                 </div>
               )}

               {isContactModalOpen && (
                 <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                   <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
                      <div className="flex justify-between items-center mb-4">
                         <h3 className="text-xl font-bold">Add New Contact</h3>
                         <button onClick={() => setIsContactModalOpen(false)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600"/></button>
                      </div>
                      <form onSubmit={handleAddSingleContact} className="space-y-4">
                         <FormInput label="Name" name="name" required placeholder="Jane Doe" />
                         <FormInput label="Phone Number" name="phone" required placeholder="+123456789" />
                         <FormInput label="Company" name="company" placeholder="Business Name (Optional)" />
                         <FormInput label="Tags" name="tags" placeholder="vip, new lead (comma separated)" />
                         <div className="flex justify-end gap-3 mt-6">
                           <button type="button" onClick={() => setIsContactModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                           <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold">Add Contact</button>
                         </div>
                      </form>
                   </div>
                 </div>
               )}
             </div>
          )}

          {currentView === 'templates' && (
             // Template View Logic (keeping existing)
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in">
              <div className="lg:col-span-1 space-y-4">
                <button onClick={handleCreateNewTemplate} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-2">
                  <Plus className="w-5 h-5" /> Create New Template
                </button>
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                   <div className="p-3 bg-slate-50 border-b border-slate-200 font-bold text-slate-700">My Templates</div>
                   <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                     {templates.map(t => (
                       <div key={t.id} className="p-4 hover:bg-slate-50 cursor-pointer group relative">
                          <div className="flex justify-between items-start">
                             <h4 className="font-bold text-slate-800">{t.name}</h4>
                             <div className="flex items-center gap-1">
                               {t.type === 'image' && <ImageIcon className="w-4 h-4 text-purple-500" />}
                               <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={(e) => { e.stopPropagation(); handleEditTemplate(t); }} className="p-1 text-blue-500 hover:bg-blue-50 rounded"><Edit className="w-3 h-3"/></button>
                                  <button onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(t.id); }} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-3 h-3"/></button>
                               </div>
                             </div>
                          </div>
                          <p className="text-xs text-slate-500 line-clamp-2 mt-1">{t.content}</p>
                       </div>
                     ))}
                   </div>
                </div>
              </div>

              <div className="lg:col-span-2">
                {isCreatingTemplate ? (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h3 className="font-bold text-xl mb-6">{editingTemplateId ? 'Edit Template' : 'Create Template'}</h3>
                    {/* ... (AI Prompt, Type Selector, etc) ... */}
                    <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 mb-6">
                       <div className="flex gap-2">
                         <input className="flex-1 px-3 py-2 rounded-lg border border-purple-200" placeholder="Ask AI to write your message..." value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} />
                         <button onClick={handleTemplateAI} disabled={isAiGenerating} className="px-4 py-2 bg-purple-600 text-white rounded-lg">{isAiGenerating ? <Loader2 className="animate-spin"/> : 'Generate'}</button>
                       </div>
                    </div>

                    <div className="space-y-4">
                      <FormInput label="Template Name" value={draftTemplate.name || ''} onChange={e => setDraftTemplate({...draftTemplate, name: e.target.value})} />
                      <div className="flex gap-4 mb-2">
                         <label className="flex items-center gap-2">
                            <input type="radio" name="type" checked={draftTemplate.type === 'text' || !draftTemplate.type} onChange={() => setDraftTemplate({...draftTemplate, type: 'text'})} /> Text
                         </label>
                         <label className="flex items-center gap-2">
                            <input type="radio" name="type" checked={draftTemplate.type === 'image'} onChange={() => setDraftTemplate({...draftTemplate, type: 'image'})} /> Image + Caption
                         </label>
                      </div>

                      {draftTemplate.type === 'image' && (
                        <div className="space-y-2">
                          <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => imgInputRef.current?.click()}>
                              {draftTemplate.mediaUrl ? (
                                <div className="relative w-full h-48">
                                    <img src={draftTemplate.mediaUrl} alt="Preview" className="w-full h-full object-contain rounded-md" />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity rounded-md">
                                        <span className="text-white font-medium flex items-center gap-2"><RefreshCw className="w-4 h-4"/> Change Image</span>
                                    </div>
                                </div>
                              ) : (
                                <>
                                    <ImageIcon className="w-12 h-12 text-slate-300 mb-2" />
                                    <p className="text-sm text-slate-500 font-medium">Click to upload image</p>
                                    <p className="text-xs text-slate-400">Supports JPG, PNG (Max 5MB)</p>
                                </>
                              )}
                              <input type="file" ref={imgInputRef} onChange={handleTemplateImageUpload} className="hidden" accept="image/*"/>
                          </div>
                        </div>
                      )}

                      <FormTextArea label="Message Content" value={draftTemplate.content || ''} onChange={e => setDraftTemplate({...draftTemplate, content: e.target.value})} className="h-32" />
                      
                      <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                        <label className="text-sm font-medium text-slate-700 mb-2 block flex items-center gap-2">
                           <LinkIcon className="w-4 h-4"/> Action Buttons (Appended Links)
                        </label>
                        <div className="flex gap-2 mb-3">
                           <button 
                             onClick={() => setDraftTemplate(prev => ({...prev, buttons: [...(prev.buttons || []), { type: 'url', label: 'Visit Website', value: 'https://' }] }))} 
                             className="px-3 py-1 bg-white border border-slate-200 rounded text-xs font-medium hover:text-emerald-600 flex items-center gap-1">
                             <Plus className="w-3 h-3"/> Add Website
                           </button>
                           <button 
                             onClick={() => setDraftTemplate(prev => ({...prev, buttons: [...(prev.buttons || []), { type: 'location', label: 'View Location', value: 'https://maps.google.com' }] }))}
                             className="px-3 py-1 bg-white border border-slate-200 rounded text-xs font-medium hover:text-emerald-600 flex items-center gap-1">
                             <Plus className="w-3 h-3"/> Add Location
                           </button>
                        </div>
                        <div className="space-y-2">
                          {draftTemplate.buttons?.map((btn, idx) => (
                             <div key={idx} className="flex gap-2 items-start">
                                <div className="grid grid-cols-2 gap-2 flex-1">
                                  <input 
                                    className="px-2 py-1 text-sm border rounded bg-white" 
                                    placeholder="Label (e.g. Visit Shop)" 
                                    value={btn.label}
                                    onChange={(e) => {
                                       const newBtns = [...(draftTemplate.buttons || [])];
                                       newBtns[idx].label = e.target.value;
                                       setDraftTemplate({...draftTemplate, buttons: newBtns});
                                    }}
                                  />
                                  <input 
                                    className="px-2 py-1 text-sm border rounded bg-white" 
                                    placeholder="URL (https://...)" 
                                    value={btn.value}
                                    onChange={(e) => {
                                       const newBtns = [...(draftTemplate.buttons || [])];
                                       newBtns[idx].value = e.target.value;
                                       setDraftTemplate({...draftTemplate, buttons: newBtns});
                                    }}
                                  />
                                </div>
                                <button 
                                  onClick={() => setDraftTemplate(prev => ({...prev, buttons: prev.buttons?.filter((_, i) => i !== idx)}))}
                                  className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                                >
                                   <Trash2 className="w-4 h-4"/>
                                </button>
                             </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-4 p-4 bg-slate-50 border rounded-lg">
                        <h5 className="font-bold text-xs text-slate-500 uppercase mb-2 flex items-center gap-1"><Sparkles className="w-3 h-3 text-purple-500"/> Live Preview</h5>
                        <div className="text-sm bg-white p-3 rounded border border-slate-200 whitespace-pre-wrap text-slate-800">
                           {draftTemplate.content ? fillTemplate(draftTemplate.content, contacts[0] || {} as Contact) : <span className="text-slate-400 italic">Start typing...</span>}
                           {draftTemplate.type === 'image' && draftTemplate.mediaUrl && (
                               <div className="mt-2 text-xs text-blue-500 underline">
                                  {draftTemplate.mediaUrl.startsWith('data:') ? '[Image Attached]' : draftTemplate.mediaUrl}
                               </div>
                           )}
                           {draftTemplate.buttons?.map((b, i) => (
                              <div key={i} className="mt-2 text-blue-600 underline font-medium block">
                                 {b.label}: {b.value}
                              </div>
                           ))}
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 pt-6">
                        <button onClick={() => { setIsCreatingTemplate(false); setDraftTemplate({ type: 'text', variables: [], buttons: [] }); setEditingTemplateId(null); }} className="px-6 py-2 text-slate-600 hover:bg-slate-50 rounded-lg font-medium">Cancel</button>
                        <button onClick={saveTemplate} className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-bold">Save Template</button>
                      </div>
                    </div>
                  </div>
                ) : (
                   <div className="flex flex-col items-center justify-center h-[400px] bg-white rounded-xl border border-slate-200 border-dashed text-slate-400">
                      <FileText className="w-16 h-16 mb-4 opacity-50" />
                      <p>Select a template to view or create a new one.</p>
                   </div>
                )}
              </div>
            </div>
          )}

          {currentView === 'campaigns' && (
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in">
               <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-fit">
                  <div className="p-4 border-b border-slate-100 font-bold text-slate-800">Your Campaigns</div>
                  <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                     {campaigns.map(c => {
                       const total = c.progress.total;
                       const sent = c.progress.sent;
                       const delivered = c.progress.delivered;
                       const read = c.progress.read;
                       const failed = c.progress.failed;
                       const pending = total - (sent + delivered + read + failed);
                       
                       const sentPercent = total > 0 ? (sent / total) * 100 : 0;
                       const deliveredPercent = total > 0 ? (delivered / total) * 100 : 0;
                       const readPercent = total > 0 ? (read / total) * 100 : 0;
                       const failedPercent = total > 0 ? (failed / total) * 100 : 0;
                       
                       return (
                         <div key={c.id} className="p-4 hover:bg-slate-50 group border rounded-xl mb-3 border-slate-100 bg-white shadow-sm m-2">
                             <div className="flex justify-between items-start mb-3">
                                 <div>
                                     <h4 className="font-bold text-slate-800 text-sm">{c.name}</h4>
                                     <span className="text-xs text-slate-400">Created: {new Date(c.createdAt).toLocaleDateString()}</span>
                                     {c.status === 'scheduled' && c.scheduleDate && (
                                         <div className="text-xs text-blue-600 mt-1 font-medium flex items-center gap-1">
                                             <Clock className="w-3 h-3"/> Scheduled: {new Date(c.scheduleDate).toLocaleString()}
                                         </div>
                                     )}
                                 </div>
                                 <div className="flex items-center gap-2">
                                     <StatusBadge status={c.status} />
                                     <button onClick={() => handleDeleteCampaign(c.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                         <Trash2 className="w-4 h-4"/>
                                     </button>
                                 </div>
                             </div>

                             {/* Multi-Segment Progress Bar */}
                             <div className="w-full bg-slate-100 rounded-full h-2.5 mb-2 flex overflow-hidden">
                                 <div className="bg-gray-400 h-full" style={{ width: `${sentPercent}%` }} title={`Sent: ${sent}`} />
                                 <div className="bg-blue-400 h-full" style={{ width: `${deliveredPercent}%` }} title={`Delivered: ${delivered}`} />
                                 <div className="bg-green-500 h-full" style={{ width: `${readPercent}%` }} title={`Read: ${read}`} />
                                 <div className="bg-red-500 h-full" style={{ width: `${failedPercent}%` }} title={`Failed: ${failed}`} />
                             </div>

                             {/* Stats */}
                             <div className="flex justify-between text-xs text-slate-500 font-medium">
                                 <div className="flex gap-2">
                                     <span className="flex items-center gap-0.5 text-gray-500"><CheckCircle className="w-3 h-3" /> {sent}</span>
                                     <span className="flex items-center gap-0.5 text-blue-500"><CheckDouble className="w-3 h-3" /> {delivered}</span>
                                     <span className="flex items-center gap-0.5 text-green-600 font-bold"><CheckDouble className="w-3 h-3" /> {read}</span>
                                     <span className="flex items-center gap-0.5 text-red-500"><AlertTriangle className="w-3 h-3" /> {failed}</span>
                                 </div>
                                  {c.status === 'running' && <span className="text-emerald-600 animate-pulse text-[10px] uppercase font-bold flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin"/> Processing</span>}
                             </div>
                         </div>
                       );
                     })}
                  </div>
               </div>

               <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                  {/* Campaign Wizard Logic (Steps 1 & 2 unchanged) */}
                  <h3 className="font-bold text-xl mb-6 flex items-center gap-2">
                     <Send className="w-5 h-5 text-emerald-600" /> New Campaign
                  </h3>
                  
                  <div className="flex items-center gap-4 mb-8">
                     {[1, 2, 3].map(i => (
                        <div key={i} className={`flex-1 h-1 rounded-full ${campaignStep >= i ? 'bg-emerald-500' : 'bg-slate-100'}`} />
                     ))}
                  </div>

                  {campaignStep === 1 && (
                     <div className="space-y-4">
                        <FormInput label="Campaign Name" value={draftCampaign.name || ''} onChange={e => setDraftCampaign({...draftCampaign, name: e.target.value})} />
                        {/* Target Audience Selector (Existing) */}
                        <div className="space-y-2">
                           <label className="text-sm font-medium text-slate-700">Target Audience</label>
                           <div className="grid grid-cols-3 gap-3">
                              <button onClick={() => setDraftCampaign({...draftCampaign, audienceType: 'all'})} className={`p-3 rounded border text-sm ${draftCampaign.audienceType === 'all' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-bold' : 'border-slate-200'}`}>All Contacts</button>
                              <button onClick={() => setDraftCampaign({...draftCampaign, audienceType: 'tag'})} className={`p-3 rounded border text-sm ${draftCampaign.audienceType === 'tag' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-bold' : 'border-slate-200'}`}>Filter by Tags</button>
                              <button onClick={() => setDraftCampaign({...draftCampaign, audienceType: 'manual'})} className={`p-3 rounded border text-sm ${draftCampaign.audienceType === 'manual' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-bold' : 'border-slate-200'}`}>
                                 Manual Selection ({draftCampaign.targetContactIds?.length || 0})
                              </button>
                           </div>
                        </div>

                        {draftCampaign.audienceType === 'tag' && (
                           <div className="flex flex-wrap gap-2 p-4 bg-slate-50 rounded-lg">
                              {allTags.map(tag => (
                                 <button 
                                   key={tag}
                                   onClick={() => {
                                      const current = draftCampaign.targetTags || [];
                                      const newTags = current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag];
                                      setDraftCampaign({...draftCampaign, targetTags: newTags});
                                   }}
                                   className={`px-3 py-1 rounded-full text-sm border transition-colors ${draftCampaign.targetTags?.includes(tag) ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : 'bg-white border-slate-200 text-slate-600'}`}
                                 >
                                    {tag}
                                 </button>
                              ))}
                           </div>
                        )}

                        <div className="flex justify-end pt-4">
                           <button onClick={() => setCampaignStep(2)} disabled={!draftCampaign.name} className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-bold disabled:opacity-50">Next: Select Template</button>
                        </div>
                     </div>
                  )}

                  {campaignStep === 2 && (
                     <div className="space-y-4">
                        <div className="flex gap-4 border-b border-slate-100 mb-4">
                           <button onClick={() => setWizardTab('select')} className={`pb-2 text-sm font-medium border-b-2 transition-colors ${wizardTab === 'select' ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-slate-500'}`}>Select Existing</button>
                           <button onClick={() => setWizardTab('generate')} className={`pb-2 text-sm font-medium border-b-2 transition-colors ${wizardTab === 'generate' ? 'border-purple-500 text-purple-700' : 'border-transparent text-slate-500'}`}>Generate with AI</button>
                        </div>

                        {wizardTab === 'select' && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto">
                              {templates.map(t => (
                                  <div key={t.id} onClick={() => setDraftCampaign({...draftCampaign, templateId: t.id})} className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${draftCampaign.templateId === t.id ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100'}`}>
                                  <div className="font-bold text-slate-800 mb-1">{t.name}</div>
                                  <p className="text-xs text-slate-500 line-clamp-3">{t.content}</p>
                                  </div>
                              ))}
                          </div>
                        )}

                        {wizardTab === 'generate' && (
                          <div className="bg-purple-50 p-6 rounded-xl border border-purple-100">
                              <h4 className="font-bold text-purple-900 mb-2 flex items-center gap-2"><Sparkles className="w-4 h-4"/> Instant AI Creator</h4>
                              <p className="text-sm text-purple-700 mb-4">Describe your message below. The AI will generate it and immediately preview it.</p>
                              <textarea 
                                  className="w-full p-3 border border-purple-200 rounded-lg text-sm h-24 mb-4 focus:ring-2 focus:ring-purple-500/20 outline-none" 
                                  placeholder="e.g. Write a friendly reminder about our flash sale..."
                                  value={wizardAiPrompt}
                                  onChange={(e) => setWizardAiPrompt(e.target.value)}
                              />
                              <button onClick={handleWizardAiGenerate} disabled={!wizardAiPrompt || isWizardGenerating} className="px-4 py-2 bg-purple-600 text-white rounded-lg font-bold flex items-center gap-2">
                                  {isWizardGenerating ? <Loader2 className="w-4 h-4 animate-spin"/> : <Sparkles className="w-4 h-4"/>}
                                  Generate & Preview
                              </button>
                          </div>
                        )}

                        <div className="flex justify-between pt-4">
                           <button onClick={() => setCampaignStep(1)} className="text-slate-500">Back</button>
                           {wizardTab === 'select' && (
                              <button onClick={() => setCampaignStep(3)} disabled={!draftCampaign.templateId} className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-bold">Next: Finalize</button>
                           )}
                        </div>
                     </div>
                  )}

                  {campaignStep === 3 && (
                     <div className="space-y-6">
                        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                           <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                              <MessageSquare className="w-4 h-4 text-emerald-600"/> Message Preview
                           </h4>
                           {(() => {
                              const selectedTemplate = templates.find(t => t.id === draftCampaign.templateId);
                              // ... (Sample Contact Selection - Existing) ... 
                              let sample: Contact | undefined;
                              if (draftCampaign.audienceType === 'manual' && draftCampaign.targetContactIds?.length) sample = contacts.find(c => c.id === draftCampaign.targetContactIds![0]);
                              else if (draftCampaign.audienceType === 'tag') sample = contacts.find(c => c.tags.some(t => draftCampaign.targetTags?.includes(t)));
                              else sample = contacts[0];

                              // Check for Custom Buttons
                              const displayButtons = (draftCampaign.customButtons && draftCampaign.customButtons.length > 0) ? draftCampaign.customButtons : selectedTemplate?.buttons;

                              return sample && selectedTemplate ? (
                                <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-100 max-w-sm">
                                   {selectedTemplate.mediaUrl && (
                                      <img src={selectedTemplate.mediaUrl} alt="Header" className="w-full h-32 object-cover rounded-md mb-2" />
                                   )}
                                   <p className="text-sm text-slate-800 whitespace-pre-wrap">
                                      {fillTemplate(selectedTemplate.content, sample)}
                                   </p>
                                   {selectedTemplate.type === 'image' && selectedTemplate.mediaUrl && (
                                        <p className="text-xs text-blue-500 mt-2 underline">
                                            {selectedTemplate.mediaUrl.startsWith('data:') ? '[Image Attached]' : selectedTemplate.mediaUrl}
                                        </p>
                                   )}
                                   {displayButtons?.map((b, i) => (
                                      <div key={i} className="mt-2 text-blue-600 underline font-medium block">
                                         {b.label}: {b.value}
                                      </div>
                                   ))}
                                </div>
                              ) : <p className="text-sm text-slate-400 italic">Select audience and template to view preview.</p>
                           })()}
                        </div>
                        
                        {/* New Section: Add Message Buttons */}
                        <div className="bg-white p-6 rounded-xl border border-slate-200">
                           <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                              <LinkIcon className="w-4 h-4 text-emerald-600"/> Add Message Buttons (Optional)
                           </h4>
                           <p className="text-xs text-slate-500 mb-4">Add customized action links specific to this campaign. Overrides template buttons.</p>
                           <div className="flex gap-2 mb-3">
                              <button 
                                onClick={() => setDraftCampaign(prev => ({...prev, customButtons: [...(prev.customButtons || []), { type: 'url', label: 'Visit Website', value: 'https://' }] }))} 
                                className="px-3 py-1 bg-slate-100 border border-slate-200 rounded text-xs font-medium hover:bg-emerald-50 hover:text-emerald-600 flex items-center gap-1">
                                <Globe className="w-3 h-3"/> Website
                              </button>
                              <button 
                                onClick={() => setDraftCampaign(prev => ({...prev, customButtons: [...(prev.customButtons || []), { type: 'phone', label: 'Call Us', value: '+1' }] }))}
                                className="px-3 py-1 bg-slate-100 border border-slate-200 rounded text-xs font-medium hover:bg-emerald-50 hover:text-emerald-600 flex items-center gap-1">
                                <Phone className="w-3 h-3"/> Phone
                              </button>
                              <button 
                                onClick={() => setDraftCampaign(prev => ({...prev, customButtons: [...(prev.customButtons || []), { type: 'location', label: 'View Location', value: 'https://maps.google.com' }] }))}
                                className="px-3 py-1 bg-slate-100 border border-slate-200 rounded text-xs font-medium hover:bg-emerald-50 hover:text-emerald-600 flex items-center gap-1">
                                <MapPin className="w-3 h-3"/> Location
                              </button>
                           </div>
                           <div className="space-y-2">
                              {draftCampaign.customButtons?.map((btn, idx) => (
                                 <div key={idx} className="flex gap-2 items-start">
                                    <div className="grid grid-cols-2 gap-2 flex-1">
                                      <input 
                                        className="px-2 py-1 text-sm border rounded bg-white" 
                                        placeholder="Label (e.g. Visit Shop)" 
                                        value={btn.label}
                                        onChange={(e) => {
                                           const newBtns = [...(draftCampaign.customButtons || [])];
                                           newBtns[idx].label = e.target.value;
                                           setDraftCampaign({...draftCampaign, customButtons: newBtns});
                                        }}
                                      />
                                      <input 
                                        className="px-2 py-1 text-sm border rounded bg-white" 
                                        placeholder="Value (URL or Phone)" 
                                        value={btn.value}
                                        onChange={(e) => {
                                           const newBtns = [...(draftCampaign.customButtons || [])];
                                           newBtns[idx].value = e.target.value;
                                           setDraftCampaign({...draftCampaign, customButtons: newBtns});
                                        }}
                                      />
                                    </div>
                                    <button 
                                      onClick={() => setDraftCampaign(prev => ({...prev, customButtons: prev.customButtons?.filter((_, i) => i !== idx)}))}
                                      className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                                    >
                                       <Trash2 className="w-4 h-4"/>
                                    </button>
                                 </div>
                              ))}
                           </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <button onClick={() => finalizeCampaign('running')} className="p-4 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left group bg-emerald-600 text-white hover:text-emerald-900">
                              <Play className="w-6 h-6 mb-2 group-hover:scale-110 transition-transform" />
                              <div className="font-bold">Send Now</div>
                              <div className="text-xs opacity-80">Auto-open WhatsApp</div>
                           </button>

                           <div className="p-4 rounded-xl border border-slate-200 bg-white">
                                <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-blue-600"/> Schedule for Later
                                </h4>
                                <div className="flex flex-col gap-2">
                                    <input 
                                        type="datetime-local" 
                                        className="border p-2 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                        value={scheduledDate}
                                        onChange={(e) => setScheduledDate(e.target.value)}
                                    />
                                    <button 
                                        onClick={() => finalizeCampaign('scheduled', scheduledDate)}
                                        disabled={!scheduledDate}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold disabled:opacity-50 disabled:bg-slate-300"
                                    >
                                        Schedule Campaign
                                    </button>
                                </div>
                           </div>
                        </div>
                        <div className="flex justify-start pt-4">
                           <button onClick={() => setCampaignStep(2)} className="text-slate-500">Back</button>
                        </div>
                     </div>
                  )}
               </div>
             </div>
          )}
        </main>
      </div>

      {/* Profile Modal - unchanged */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">Profile Settings</h3>
                <button onClick={() => setIsProfileModalOpen(false)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600"/></button>
             </div>
             <div className="space-y-4">
                <div className="flex justify-center mb-4">
                   <img src={user.avatar} alt="Avatar" className="w-20 h-20 rounded-full bg-slate-200 border-4 border-slate-50"/>
                </div>
                <FormInput label="Name" value={user.name} onChange={e => setUser({...user, name: e.target.value})} />
                <FormInput label="Company" value={user.company} onChange={e => setUser({...user, company: e.target.value})} />
                <div className="grid grid-cols-2 gap-2">
                    <FormInput label="Username" value={user.username} onChange={e => setUser({...user, username: e.target.value})} />
                    <FormInput label="Password" type="password" value={user.password || ''} onChange={e => setUser({...user, password: e.target.value})} />
                </div>
                <FormInput label="Avatar URL" value={user.avatar} onChange={e => setUser({...user, avatar: e.target.value})} />
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Sending Speed (Seconds Delay)</label>
                  <input 
                    type="range" 
                    min="1" max="10" 
                    value={user.settings.delaySeconds} 
                    onChange={e => setUser({...user, settings: {...user.settings, delaySeconds: parseInt(e.target.value)}})}
                    className="w-full accent-emerald-600"
                  />
                  <div className="flex justify-between text-xs text-slate-500 mt-1">
                     <span>Fast (1s)</span>
                     <span className="font-bold text-emerald-600">{user.settings.delaySeconds} seconds</span>
                     <span>Slow (10s)</span>
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-4">
                  <button onClick={() => setIsProfileModalOpen(false)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold">Save Changes</button>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
