
import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Users, MessageSquare, Send, Sparkles, Plus, CheckCircle, Loader2, Phone, X, AlertTriangle, Trash2, Upload, FileText, UserPlus, Search, ImageIcon, MinusCircle, LogOut, Lock, Mail, Settings, CreditCard, Camera, RefreshCw, Download, UploadCloud, Play, StopCircle, FastForward, CheckSquare } from './components/Icons';
import { DashboardChart } from './components/DashboardChart';
import { FormInput, FormTextArea } from './components/FormInput';
import { generateCampaignMessage, analyzeSegments } from './services/geminiService';
import { Contact, Campaign, ViewState, ChartData, UserProfile } from './types';

// Robust ID generator
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Mock Data used only if LocalStorage is empty - NOW EMPTY for fresh start
const DEFAULT_CONTACTS: Contact[] = [];

const DEFAULT_PROFILE: UserProfile = {
    name: 'Admin User',
    email: 'admin@desichai.com',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
    company: 'DesiChai',
    plan: 'Pro'
};

// Zeroed out chart data for fresh start
const MOCK_CHART_DATA: ChartData[] = [
  { name: 'Mon', sent: 0, replies: 0 },
  { name: 'Tue', sent: 0, replies: 0 },
  { name: 'Wed', sent: 0, replies: 0 },
  { name: 'Thu', sent: 0, replies: 0 },
  { name: 'Fri', sent: 0, replies: 0 },
  { name: 'Sat', sent: 0, replies: 0 },
  { name: 'Sun', sent: 0, replies: 0 },
];

// --- MODALS (Extracted to prevent re-render lag) ---

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  pendingContact: Contact | null;
  generatedMessage: string;
  campaignImage: string | null;
  personalizeMessage: (msg: string, contact: Contact) => string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ 
  isOpen, onClose, onConfirm, pendingContact, generatedMessage, campaignImage, personalizeMessage 
}) => {
  if (!isOpen || !pendingContact) return null;
  
  const previewMessage = personalizeMessage(generatedMessage, pendingContact);

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3 text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full">
               <AlertTriangle className="w-5 h-5" />
               <span className="text-sm font-semibold">Confirm Send</span>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <h3 className="text-lg font-bold text-slate-800 mb-2">Ready to send?</h3>
          <p className="text-slate-500 text-sm mb-4">
            This will open WhatsApp Web to send the message to <span className="font-semibold text-slate-800">{pendingContact.name}</span>.
          </p>
          
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6 relative max-h-64 overflow-y-auto">
            <p className="text-sm text-slate-700 whitespace-pre-wrap font-mono">{previewMessage}</p>
            
            {campaignImage && (
                <div className="mt-4 border-t border-slate-200 pt-3">
                    <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                        <ImageIcon className="w-3 h-3" /> Image Attachment:
                    </p>
                    <div className="rounded-lg overflow-hidden h-32 w-full border border-slate-200">
                        <img src={campaignImage} className="w-full h-full object-cover" alt="Attachment" />
                    </div>
                    <p className="text-xs text-emerald-600 mt-2 bg-emerald-50 p-2 rounded">
                        <strong>Auto-Copy Enabled:</strong> Image will be copied to your clipboard. Just press <strong>Ctrl+V</strong> (Paste) in WhatsApp.
                    </p>
                </div>
            )}
          </div>
          
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 font-medium transition-colors">
              Cancel
            </button>
            <button onClick={onConfirm} className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2">
              <Send className="w-4 h-4" /> Open WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface BulkSendModalProps {
  isOpen: boolean;
  queue: Contact[];
  currentIndex: number;
  message: string;
  image: string | null;
  onClose: () => void;
  onSendNext: () => void;
  onSkip: () => void;
  personalizeMessage: (msg: string, contact: Contact) => string;
}

const BulkSendModal: React.FC<BulkSendModalProps> = ({ 
    isOpen, queue, currentIndex, message, image, onClose, onSendNext, onSkip, personalizeMessage 
}) => {
    if (!isOpen) return null;

    const currentContact = queue[currentIndex];
    const isComplete = currentIndex >= queue.length;
    const progress = Math.min(((currentIndex) / queue.length) * 100, 100);

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
             <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                 {/* Header */}
                 <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-bold flex items-center gap-2">
                            <Play className="w-5 h-5 text-emerald-400" /> Bulk Campaign
                        </h3>
                        <p className="text-slate-400 text-xs mt-1">
                            Sending {queue.length} messages
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors bg-white/10 p-2 rounded-full">
                        <StopCircle className="w-5 h-5" />
                    </button>
                 </div>

                 {/* Progress Bar */}
                 <div className="bg-slate-100 h-2 w-full">
                     <div className="bg-emerald-500 h-2 transition-all duration-300" style={{ width: `${progress}%` }}></div>
                 </div>

                 {/* Content */}
                 <div className="p-8 flex-1 flex flex-col items-center justify-center">
                     {isComplete ? (
                         <div className="text-center py-8">
                             <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-600">
                                 <CheckCircle className="w-10 h-10" />
                             </div>
                             <h3 className="text-2xl font-bold text-slate-800 mb-2">Campaign Complete!</h3>
                             <p className="text-slate-500 mb-8">Successfully processed {queue.length} contacts.</p>
                             <button onClick={onClose} className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-medium hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200">
                                 Close & View Report
                             </button>
                         </div>
                     ) : (
                         <div className="w-full">
                             <div className="text-center mb-6">
                                 <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Current Recipient ({currentIndex + 1}/{queue.length})</p>
                                 <div className="w-20 h-20 mx-auto rounded-full bg-slate-100 mb-3 border-4 border-white shadow-lg overflow-hidden">
                                    {currentContact?.avatar ? (
                                        <img src={currentContact.avatar} alt={currentContact.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-400"><Users className="w-8 h-8" /></div>
                                    )}
                                 </div>
                                 <h2 className="text-2xl font-bold text-slate-800">{currentContact?.name}</h2>
                                 <p className="text-slate-500 font-mono">{currentContact?.phone}</p>
                             </div>

                             <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-8 relative">
                                 <p className="text-sm text-slate-600 line-clamp-3 font-mono italic">
                                     "{personalizeMessage(message, currentContact)}"
                                 </p>
                                 {image && (
                                     <div className="absolute top-2 right-2">
                                         <ImageIcon className="w-5 h-5 text-emerald-500" />
                                     </div>
                                 )}
                             </div>

                             <div className="grid grid-cols-2 gap-4">
                                 <button 
                                     onClick={onSkip}
                                     className="flex items-center justify-center gap-2 px-6 py-4 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
                                 >
                                     <FastForward className="w-5 h-5" /> Skip
                                 </button>
                                 <button 
                                     onClick={onSendNext}
                                     className="flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-emerald-600 text-white font-bold text-lg hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 hover:shadow-xl hover:-translate-y-1"
                                 >
                                     <Send className="w-5 h-5" /> Send Now
                                 </button>
                             </div>
                             <p className="text-center text-xs text-slate-400 mt-4">
                                 Opens WhatsApp Web. {image ? 'Image will be auto-copied.' : ''}
                             </p>
                         </div>
                     )}
                 </div>
             </div>
        </div>
    );
};

interface AddContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSingle: (contact: Partial<Contact>) => void;
  onAddBulk: (text: string) => void;
}

const AddContactModal: React.FC<AddContactModalProps> = ({ isOpen, onClose, onAddSingle, onAddBulk }) => {
  const [addContactMode, setAddContactMode] = useState<'single' | 'bulk'>('single');
  const [newContactForm, setNewContactForm] = useState({ name: '', phone: '', tags: '', avatar: '' });
  const [bulkContactText, setBulkContactText] = useState('');

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
        setNewContactForm({ name: '', phone: '', tags: '', avatar: '' });
        setBulkContactText('');
        setAddContactMode('single');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewContactForm(prev => ({ ...prev, avatar: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = () => {
    if (addContactMode === 'single') {
        onAddSingle({
            ...newContactForm,
            tags: newContactForm.tags.split(',').map(tag => tag.trim()).filter(Boolean)
        });
    } else {
        onAddBulk(bulkContactText);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-slate-100">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-slate-800">Add New Contacts</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex bg-slate-100 rounded-lg p-1 mb-6">
              <button 
                  className={`flex-1 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${addContactMode === 'single' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  onClick={() => setAddContactMode('single')}
              >
                  <UserPlus className="w-4 h-4" /> Single
              </button>
              <button 
                  className={`flex-1 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${addContactMode === 'bulk' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  onClick={() => setAddContactMode('bulk')}
              >
                  <FileText className="w-4 h-4" /> Bulk Import
              </button>
          </div>

          {addContactMode === 'single' ? (
              <div className="space-y-4">
                {/* Image Upload */}
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-16 h-16 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {newContactForm.avatar ? (
                          <img src={newContactForm.avatar} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                          <Users className="w-6 h-6 text-slate-300" />
                      )}
                  </div>
                  <div className="flex-1">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Profile Photo</label>
                      <label className="cursor-pointer inline-flex items-center gap-2 text-xs bg-white border border-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors text-slate-600">
                          <Upload className="w-3 h-3" /> Upload Image
                          <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                      </label>
                  </div>
                </div>

                <FormInput 
                  label="Full Name"
                  placeholder="e.g. John Doe"
                  value={newContactForm.name}
                  onChange={(e) => setNewContactForm(prev => ({...prev, name: e.target.value}))}
                />
                <FormInput 
                  label="Phone Number"
                  placeholder="e.g. 15551234567"
                  type="tel"
                  value={newContactForm.phone}
                  onChange={(e) => setNewContactForm(prev => ({...prev, phone: e.target.value}))}
                />
                 <FormInput 
                  label="Tags (comma separated)"
                  placeholder="e.g. vip, new, lead"
                  value={newContactForm.tags}
                  onChange={(e) => setNewContactForm(prev => ({...prev, tags: e.target.value}))}
                />
              </div>
          ) : (
              <div className="space-y-4">
                  <div className="bg-amber-50 text-amber-800 text-xs p-3 rounded-lg flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 mt-0.5" />
                      <div className="space-y-1">
                          <p><strong>Paste list from Excel or Text.</strong></p>
                          <p>Format: Name Phone OR Phone Name</p>
                      </div>
                  </div>
                  <FormTextArea 
                      label="Paste Data Here"
                      placeholder="John Doe 15551234567"
                      rows={8}
                      value={bulkContactText}
                      onChange={(e) => setBulkContactText(e.target.value)}
                  />
              </div>
          )}

          <div className="mt-6 flex gap-3">
            <button onClick={onClose} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 font-medium">
              Cancel
            </button>
            <button 
              onClick={handleSubmit}
              disabled={addContactMode === 'single' ? (!newContactForm.name || !newContactForm.phone) : !bulkContactText}
              className="flex-1 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {addContactMode === 'single' ? 'Save Contact' : 'Import Contacts'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface LoginModalProps {
  onLogin: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ onLogin }) => {
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Simulate API Check - One Time Password / Access Key
    setTimeout(() => {
        if (accessCode.trim() === '123456') { // Hardcoded specific key
            setLoading(false);
            onLogin();
        } else {
            setLoading(false);
            setError('Invalid Access Code. Please try again.');
        }
    }, 800);
  };

  return (
    <div className="fixed inset-0 bg-slate-900 z-[100] flex items-center justify-center p-4 bg-[url('https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80')] bg-cover bg-center">
      <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"></div>
      
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8 animate-in zoom-in-95 duration-300 relative z-10">
        <div className="flex justify-center mb-6">
           <div className="w-20 h-20 bg-emerald-600 rounded-full flex items-center justify-center text-white font-serif font-bold text-4xl shadow-lg shadow-emerald-900/20 border-4 border-emerald-100">
             D
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center text-slate-800 mb-1">DesiChai</h2>
        <p className="text-center text-slate-500 mb-8 text-sm">WhatsApp Business Manager</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
             <label className="text-sm font-medium text-slate-700">Enter Access Code</label>
             <div className="relative">
                <Lock className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                <input 
                  type="password" 
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none font-mono tracking-widest text-center text-lg"
                  placeholder="••••••"
                  maxLength={6}
                  autoFocus
                  required
                />
             </div>
             {error && <p className="text-red-500 text-xs mt-1 text-center">{error}</p>}
          </div>
          
          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 mt-4 shadow-lg shadow-emerald-500/30"
          >
            {loading ? <Loader2 className="animate-spin w-5 h-5" /> : "Access Dashboard"}
          </button>
        </form>
        
        <p className="text-center text-xs text-slate-400 mt-6">
          Authorized personnel only.
        </p>
      </div>
    </div>
  );
};

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onLogout: () => void;
  onUpdateAvatar: (url: string) => void;
  onExportData: () => void;
  onImportData: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose, user, onLogout, onUpdateAvatar, onExportData, onImportData }) => {
  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              onUpdateAvatar(reader.result as string);
          };
          reader.readAsDataURL(file);
      }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-end animate-in fade-in duration-200">
        <div className="h-full w-full max-w-md bg-white shadow-2xl animate-in slide-in-from-right duration-300 p-6 flex flex-col overflow-y-auto">
            <div className="flex justify-between items-center mb-8">
               <h2 className="text-xl font-bold text-slate-800">Your Profile</h2>
               <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X className="w-6 h-6 text-slate-500" />
               </button>
            </div>
            
            <div className="flex flex-col items-center mb-8">
               <div className="relative group cursor-pointer">
                  <div className="w-28 h-28 rounded-full bg-slate-200 mb-4 overflow-hidden border-4 border-slate-50 shadow-lg relative">
                      <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Camera className="w-8 h-8 text-white" />
                      </div>
                  </div>
                  <input 
                      type="file" 
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      accept="image/*"
                      onChange={handleFileChange}
                      title="Change Profile Photo"
                  />
                  <div className="absolute bottom-4 right-0 bg-emerald-500 rounded-full p-1.5 border-2 border-white shadow-sm pointer-events-none">
                      <Camera className="w-3 h-3 text-white" />
                  </div>
               </div>
               
               <h3 className="text-xl font-bold text-slate-800">{user.name}</h3>
               <p className="text-slate-500">{user.email}</p>
               <span className="mt-2 bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide">
                 {user.plan} Plan
               </span>
            </div>
            
            <div className="space-y-2 mb-6">
                <button className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-slate-50 transition-colors text-left border border-transparent hover:border-slate-200 group">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                        <Settings className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="font-medium text-slate-800">Account Settings</h4>
                        <p className="text-xs text-slate-500">Manage your preferences</p>
                    </div>
                </button>
                <button className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-slate-50 transition-colors text-left border border-transparent hover:border-slate-200 group">
                    <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center group-hover:bg-purple-100 transition-colors">
                        <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="font-medium text-slate-800">Billing & Subscription</h4>
                        <p className="text-xs text-slate-500">Manage your Pro plan</p>
                    </div>
                </button>
            </div>

            <div className="mb-6 p-4 rounded-xl border border-slate-100 bg-slate-50/50">
               <h4 className="text-sm font-semibold text-slate-800 mb-3 uppercase tracking-wider text-xs">Data Management</h4>
               <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={onExportData}
                    className="flex flex-col items-center justify-center gap-2 p-3 bg-white border border-slate-200 rounded-lg hover:border-emerald-300 hover:shadow-sm transition-all text-slate-600 hover:text-emerald-600"
                  >
                      <Download className="w-5 h-5" />
                      <span className="text-xs font-medium">Backup Data</span>
                  </button>
                  <label className="flex flex-col items-center justify-center gap-2 p-3 bg-white border border-slate-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all text-slate-600 hover:text-blue-600 cursor-pointer">
                      <UploadCloud className="w-5 h-5" />
                      <span className="text-xs font-medium">Restore Data</span>
                      <input type="file" className="hidden" accept=".json" onChange={onImportData} />
                  </label>
               </div>
               <p className="text-[10px] text-slate-400 mt-2 text-center">
                  Backup your contacts and settings to a secure file.
               </p>
            </div>
            
            <button 
                onClick={onLogout}
                className="w-full flex items-center justify-center gap-2 p-4 rounded-xl bg-slate-50 text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors font-medium mt-auto"
            >
                <LogOut className="w-5 h-5" /> Sign Out
            </button>
        </div>
    </div>
  );
};


// --- MAIN APP COMPONENT ---

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  
  // Persistent User Profile
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
      try {
          const saved = localStorage.getItem('desichai_profile');
          return saved ? JSON.parse(saved) : DEFAULT_PROFILE;
      } catch (e) {
          return DEFAULT_PROFILE;
      }
  });

  // Save profile whenever it changes
  useEffect(() => {
      localStorage.setItem('desichai_profile', JSON.stringify(userProfile));
  }, [userProfile]);

  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  
  // Initialize contacts from LocalStorage or fallback to default
  const [contacts, setContacts] = useState<Contact[]>(() => {
    try {
      const saved = localStorage.getItem('genconnect_contacts');
      return saved ? JSON.parse(saved) : DEFAULT_CONTACTS;
    } catch (e) {
      return DEFAULT_CONTACTS;
    }
  });

  // Dashboard stats
  const [dashboardStats, setDashboardStats] = useState({
      total: contacts.length,
      sent: 0,
      responseRate: 0,
      chartData: MOCK_CHART_DATA
  });

  // Persist contacts
  useEffect(() => {
    localStorage.setItem('genconnect_contacts', JSON.stringify(contacts));
    setDashboardStats(prev => ({...prev, total: contacts.length}));
  }, [contacts]);
  
  // Campaign State
  const [campaignGoal, setCampaignGoal] = useState('');
  const [campaignAudience, setCampaignAudience] = useState('All VIP customers');
  const [generatedMessage, setGeneratedMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [campaignImage, setCampaignImage] = useState<string | null>(null);
  
  // Bulk Sending State
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [bulkQueue, setBulkQueue] = useState<Contact[]>([]);
  const [bulkCurrentIndex, setBulkCurrentIndex] = useState(0);

  // Segment State
  const [isSegmenting, setIsSegmenting] = useState(false);
  const [segments, setSegments] = useState<{name: string, reason: string, contactIds: string[]}[]>([]);

  // Modal Visibility State
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [pendingContact, setPendingContact] = useState<Contact | null>(null);

  // Contacts View State
  const [searchTerm, setSearchTerm] = useState('');

  // Notification State
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const TEST_NUMBER = '9014427480';

  // Helper: Show Notification
  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Helper: Convert Base64 string to Blob
  const dataURItoBlob = (dataURI: string) => {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], {type: mimeString});
  };

  // Helper: Personalize Message with Dynamic Placeholders
  const personalizeMessage = (template: string, contact: Contact) => {
    const firstName = contact.name.split(' ')[0] || 'Friend';
    return template
      .replace(/{firstName}/g, firstName)
      .replace(/{name}/g, contact.name || 'Valued Customer')
      .replace(/{phone}/g, contact.phone);
  };

  // Handlers
  const handleGenerateMessage = async () => {
    if (!campaignGoal) return;
    setIsGenerating(true);
    const msg = await generateCampaignMessage(campaignGoal, campaignAudience);
    setGeneratedMessage(msg);
    setIsGenerating(false);
  };

  const handleAnalyzeSegments = async () => {
    setIsSegmenting(true);
    const result = await analyzeSegments(contacts);
    setSegments(result);
    setIsSegmenting(false);
  };

  const initiateSend = (contact: Contact) => {
    setPendingContact(contact);
    setShowConfirmation(true);
  };

  // BULK SEND LOGIC
  const startBulkCampaign = () => {
      if (!generatedMessage) {
          showNotification("Please generate a message first.", 'error');
          return;
      }
      
      let queue: Contact[] = [];
      if (selectedContactIds.length > 0) {
          queue = contacts.filter(c => selectedContactIds.includes(c.id));
      } else {
          // If none selected, theoretically could send to all, but safer to require selection
          // Or we can just use all visible contacts if filtered?
          // For now, let's use all contacts if nothing is selected
           queue = contacts;
      }

      if (queue.length === 0) {
          showNotification("No contacts to send to.", 'error');
          return;
      }

      setBulkQueue(queue);
      setBulkCurrentIndex(0);
      setIsBulkSending(true);
  };

  const handleBulkSendNext = async () => {
      const contact = bulkQueue[bulkCurrentIndex];
      if (!contact) return;

       // Copy Image
       if (campaignImage) {
        try {
            const blob = dataURItoBlob(campaignImage);
            await navigator.clipboard.write([
                new ClipboardItem({
                    [blob.type]: blob
                })
            ]);
        } catch (err) {
            console.error("Auto-copy failed", err);
        }
    }

    const personalizedMsg = personalizeMessage(generatedMessage, contact);
    const encodedMessage = encodeURIComponent(personalizedMsg);
    const url = `https://wa.me/${contact.phone}?text=${encodedMessage}`;
    
    // Open WA
    window.open(url, '_blank');
    
    // Advance Queue
    setBulkCurrentIndex(prev => prev + 1);
    setDashboardStats(prev => ({...prev, sent: prev.sent + 1}));
  };

  const handleBulkSkip = () => {
      setBulkCurrentIndex(prev => prev + 1);
  };

  const confirmSend = async () => {
    if (!pendingContact || !generatedMessage) return;

    // Try to copy image to clipboard if exists
    if (campaignImage) {
        try {
            const blob = dataURItoBlob(campaignImage);
            // Writing to clipboard requires user activation (which this button click provides)
            // Note: This works in secure contexts (HTTPS) and localhost.
            await navigator.clipboard.write([
                new ClipboardItem({
                    [blob.type]: blob
                })
            ]);
            showNotification("Image copied! Paste (Ctrl+V) in WhatsApp", 'success');
        } catch (err) {
            console.error("Could not copy image: ", err);
            showNotification("Could not auto-copy image. Please attach manually.", 'error');
        }
    }

    const personalizedMsg = personalizeMessage(generatedMessage, pendingContact);
    
    // WhatsApp Web URL Scheme
    const encodedMessage = encodeURIComponent(personalizedMsg);
    const url = `https://wa.me/${pendingContact.phone}?text=${encodedMessage}`;
    
    // Small delay to allow clipboard action to finish/toast to show
    setTimeout(() => {
        window.open(url, '_blank');
        // Increment sent count manually for effect
        setDashboardStats(prev => ({...prev, sent: prev.sent + 1}));
    }, 500);
    
    setShowConfirmation(false);
    setPendingContact(null);
  };

  const sendTestToMe = async () => {
    if (!generatedMessage) return;

    if (campaignImage) {
        try {
            const blob = dataURItoBlob(campaignImage);
            await navigator.clipboard.write([
                new ClipboardItem({
                    [blob.type]: blob
                })
            ]);
            showNotification("Image copied! Paste (Ctrl+V) in WhatsApp", 'success');
        } catch (err) {
            showNotification("Could not auto-copy image. Please attach manually.", 'error');
        }
    }

    const mockContact = { name: 'Test User', phone: TEST_NUMBER } as Contact;
    const personalizedMsg = personalizeMessage(generatedMessage, mockContact);
    const encodedMessage = encodeURIComponent(personalizedMsg);
    const url = `https://wa.me/${TEST_NUMBER}?text=${encodedMessage}`;
    
    setTimeout(() => {
        window.open(url, '_blank');
    }, 500);
  };

  const handleCampaignImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCampaignImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSingleAdd = (data: Partial<Contact>) => {
      const newContact: Contact = {
          id: generateId(),
          name: data.name || 'Unknown',
          phone: data.phone || '',
          tags: data.tags || [],
          lastInteraction: new Date().toISOString().split('T')[0],
          sentiment: 'neutral',
          avatar: data.avatar
      };
      setContacts(prev => [newContact, ...prev]);
      setShowAddContact(false);
      showNotification("Contact added successfully!");
  };

  const handleBulkAdd = (text: string) => {
        const lines = text.split('\n');
        const newContacts: Contact[] = [];
        let skipped = 0;
        
        lines.forEach((line) => {
            const cleanLine = line.trim();
            if (!cleanLine) return;

            let name = '';
            let phoneRaw = '';

            const delimiterMatch = cleanLine.match(/[\t,;]/);
            if (delimiterMatch) {
                const parts = cleanLine.split(delimiterMatch[0]);
                const phoneIdx = parts.findIndex(p => p.replace(/\D/g, '').length >= 7);
                if (phoneIdx !== -1) {
                    phoneRaw = parts[phoneIdx];
                    name = parts.filter((_, i) => i !== phoneIdx).join(' ').trim();
                }
            } 
            
            if (!phoneRaw) {
                 const phoneMatch = cleanLine.match(/[\d+\-\(\)]{7,}/);
                 if (phoneMatch) {
                     phoneRaw = phoneMatch[0];
                     name = cleanLine.replace(phoneRaw, '').trim();
                 }
            }

            if (phoneRaw) {
                const phoneClean = phoneRaw.replace(/[^\d+]/g, '');
                name = name.replace(/^[,.\-;|]+|[,.\-;|]+$/g, '').trim();
                if (!name) name = "Unknown Contact";

                if (phoneClean.length >= 7) {
                    newContacts.push({
                        id: generateId(),
                        name,
                        phone: phoneClean,
                        tags: ['imported'],
                        lastInteraction: new Date().toISOString().split('T')[0],
                        sentiment: 'neutral'
                    });
                } else {
                    skipped++;
                }
            } else {
                skipped++;
            }
        });

        if (newContacts.length > 0) {
            setContacts(prev => [...newContacts, ...prev]);
            showNotification(`Successfully imported ${newContacts.length} contacts.`);
            setShowAddContact(false);
        } else {
          showNotification(skipped > 0 ? "No valid contacts found." : "Please enter some data.", 'error');
        }
  };

  const deleteContact = (id: string) => {
    setContacts(prev => prev.filter(c => c.id !== id));
    setSelectedContactIds(prev => prev.filter(selectedId => selectedId !== id));
    showNotification("Contact deleted permanently.");
  };

  const handleBulkDelete = () => {
      if (selectedContactIds.length === 0) return;
      setContacts(prev => prev.filter(c => !selectedContactIds.includes(c.id)));
      const count = selectedContactIds.length;
      setSelectedContactIds([]);
      showNotification(`${count} contacts deleted permanently.`);
  };

  const removeFromCampaign = (id: string) => {
      setSelectedContactIds(prev => prev.filter(selectedId => selectedId !== id));
      showNotification("Removed from current campaign list.");
  };

  const applySegment = (contactIds: string[]) => {
    setSelectedContactIds(contactIds);
    setCurrentView('campaigns');
    const names = contacts.filter(c => contactIds.includes(c.id)).map(c => c.name).join(', ');
    setCampaignAudience(`Segment: ${names.substring(0, 30)}...`);
  };

  const handleLogout = () => {
      setIsLoggedIn(false);
      setShowProfile(false);
  };
  
  const handleProfileUpdate = (newAvatar: string) => {
      setUserProfile(prev => ({...prev, avatar: newAvatar}));
      showNotification("Profile photo updated successfully!");
  };
  
  const refreshDashboard = () => {
      const randomSent = Math.floor(Math.random() * 500) + 1000;
      const randomRate = Math.floor(Math.random() * 20) + 70;
      const randomData = MOCK_CHART_DATA.map(d => ({
        ...d,
        sent: Math.floor(Math.random() * 50),
        replies: Math.floor(Math.random() * 30)
      }));
      setDashboardStats(prev => ({
          ...prev,
          sent: randomSent,
          responseRate: randomRate,
          chartData: randomData
      }));
      showNotification("Dashboard data refreshed.");
  };

  const handleExportData = () => {
      const backupData = {
          contacts: contacts,
          userProfile: userProfile,
          timestamp: new Date().toISOString(),
          version: '1.0'
      };
      
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `desichai_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showNotification("Backup file downloaded successfully!", "success");
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const data = JSON.parse(event.target?.result as string);
              
              if (data.contacts && Array.isArray(data.contacts)) {
                  setContacts(data.contacts);
              }
              if (data.userProfile) {
                  setUserProfile(data.userProfile);
              }
              
              showNotification("Data restored successfully!", "success");
              setShowProfile(false);
          } catch (err) {
              console.error(err);
              showNotification("Invalid backup file.", "error");
          }
      };
      reader.readAsText(file);
      // Reset input value to allow re-uploading same file if needed
      e.target.value = '';
  };

  if (!isLoggedIn) {
      return <LoginModal onLogin={() => setIsLoggedIn(true)} />;
  }

  const renderDashboard = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-end">
          <button 
            onClick={refreshDashboard}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-emerald-600 transition-colors bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm"
          >
              <RefreshCw className="w-4 h-4" /> Refresh Data
          </button>
      </div>
    
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Total Contacts</p>
            <h3 className="text-3xl font-bold text-slate-800">{dashboardStats.total}</h3>
          </div>
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg">
            <Users />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Messages Sent</p>
            <h3 className="text-3xl font-bold text-slate-800">{dashboardStats.sent}</h3>
          </div>
          <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
            <Send />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Response Rate</p>
            <h3 className="text-3xl font-bold text-slate-800">{dashboardStats.responseRate}%</h3>
          </div>
          <div className="p-3 bg-purple-100 text-purple-600 rounded-lg">
            <MessageSquare />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <DashboardChart data={dashboardStats.chartData} />
        </div>
        
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-xl text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Sparkles className="text-yellow-400" /> 
              AI Segmentation
            </h3>
            <button 
              onClick={handleAnalyzeSegments}
              disabled={isSegmenting}
              className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1 rounded-full transition-colors disabled:opacity-50"
            >
              {isSegmenting ? 'Analyzing...' : 'Refresh'}
            </button>
          </div>
          
          <div className="space-y-3">
            {segments.length === 0 && !isSegmenting && (
              <div className="text-slate-400 text-sm text-center py-8">
                Click refresh to identify smart segments in your audience.
              </div>
            )}
            
            {isSegmenting && (
               <div className="flex justify-center py-8">
                 <Loader2 className="animate-spin text-emerald-400" />
               </div>
            )}

            {segments.map((seg, idx) => (
              <div key={idx} className="bg-white/5 p-3 rounded-lg border border-white/10 hover:border-emerald-500/50 transition-all cursor-pointer group" onClick={() => applySegment(seg.contactIds)}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-emerald-300 group-hover:text-emerald-200">{seg.name}</p>
                    <p className="text-xs text-slate-400 mt-1">{seg.reason}</p>
                  </div>
                  <span className="text-xs bg-emerald-500/20 px-2 py-0.5 rounded text-emerald-300">
                    {seg.contactIds.length} users
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderCampaignBuilder = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in slide-in-from-right-4 duration-500">
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Sparkles className="text-emerald-500" />
            AI Message Creator
          </h2>
          
          <div className="space-y-4">
            <FormInput 
              label="Target Audience" 
              value={campaignAudience}
              onChange={(e) => setCampaignAudience(e.target.value)}
              placeholder="e.g. VIP Customers who bought last month"
            />
            
            <FormTextArea 
              label="Campaign Goal / Key Points" 
              value={campaignGoal}
              onChange={(e) => setCampaignGoal(e.target.value)}
              placeholder="e.g. Announce 24-hour flash sale on sneakers. 20% off with code FLASH20."
              rows={4}
            />

            <div>
                 <label className="text-sm font-medium text-slate-700 mb-1 block">Message Image (Optional)</label>
                 <div className="flex items-center gap-4">
                    <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 bg-slate-50 border border-dashed border-slate-300 rounded-lg p-4 hover:bg-slate-100 transition-colors text-slate-500 text-sm">
                        <ImageIcon className="w-5 h-5" />
                        {campaignImage ? 'Change Image' : 'Upload Image'}
                        <input type="file" className="hidden" accept="image/*" onChange={handleCampaignImageUpload} />
                    </label>
                    {campaignImage && (
                        <div className="w-16 h-16 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden relative group">
                             <img src={campaignImage} alt="Campaign" className="w-full h-full object-cover" />
                             <button onClick={() => setCampaignImage(null)} className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                <X className="w-3 h-3" />
                             </button>
                        </div>
                    )}
                 </div>
            </div>
            
            <button 
              onClick={handleGenerateMessage}
              disabled={isGenerating || !campaignGoal}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm shadow-emerald-200"
            >
              {isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles />}
              Generate Draft
            </button>
          </div>
        </div>

        {generatedMessage && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 ring-2 ring-emerald-500/10">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold text-slate-800">Review Template</h3>
              <div className="flex gap-2">
                 <button 
                    onClick={sendTestToMe}
                    className="text-xs bg-slate-900 text-white px-3 py-1 rounded hover:bg-slate-800 transition-colors flex items-center gap-1"
                    title={`Send test to ${TEST_NUMBER}`}
                 >
                    <Phone className="w-3 h-3" /> Test to Me
                 </button>
              </div>
            </div>
            
            <div className="mb-2 flex gap-2 overflow-x-auto pb-2">
                 <span className="whitespace-nowrap text-xs bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-1 rounded cursor-pointer hover:bg-emerald-100 transition-colors" onClick={() => setGeneratedMessage(prev => prev + ' {firstName}')}>+ {'{firstName}'}</span>
                 <span className="whitespace-nowrap text-xs bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-1 rounded cursor-pointer hover:bg-emerald-100 transition-colors" onClick={() => setGeneratedMessage(prev => prev + ' {name}')}>+ {'{name}'}</span>
                 <span className="whitespace-nowrap text-xs bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-1 rounded cursor-pointer hover:bg-emerald-100 transition-colors" onClick={() => setGeneratedMessage(prev => prev + ' {phone}')}>+ {'{phone}'}</span>
            </div>

            <textarea 
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-sm leading-relaxed focus:outline-none focus:border-emerald-500 resize-none h-40 font-mono"
              value={generatedMessage}
              onChange={(e) => setGeneratedMessage(e.target.value)}
            />
            <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              AI Generated content. Click placeholders above to personalize.
            </p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col h-[600px]">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
              <h3 className="font-bold text-slate-800">Recipients</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                  {selectedContactIds.length > 0 ? selectedContactIds.length : contacts.length} Selected
              </p>
          </div>
          <div className="flex items-center gap-2">
             {/* Select All Toggle */}
             <button 
                onClick={() => {
                    if (selectedContactIds.length === contacts.length) {
                        setSelectedContactIds([]);
                    } else {
                        setSelectedContactIds(contacts.map(c => c.id));
                    }
                }}
                className={`text-xs px-2 py-1.5 rounded border transition-all flex items-center gap-1 ${selectedContactIds.length === contacts.length ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-white text-slate-600 border-slate-200'}`}
             >
                <CheckSquare className="w-3 h-3" /> {selectedContactIds.length === contacts.length ? 'Deselect All' : 'Select All'}
             </button>

             {/* Bulk Start Button */}
             <button
                 onClick={startBulkCampaign}
                 disabled={contacts.length === 0 || !generatedMessage}
                 className="text-xs bg-slate-900 text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1 font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
             >
                 <Play className="w-3 h-3" /> Start Bulk Send
             </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2">
          <div className="space-y-2">
            {contacts
              .filter(c => selectedContactIds.length === 0 || selectedContactIds.includes(c.id))
              .map(contact => (
              <div key={contact.id} className="group p-4 rounded-lg border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/50 transition-all flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold overflow-hidden bg-slate-100`}>
                    {contact.avatar ? (
                        <img src={contact.avatar} alt={contact.name} className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-slate-500">{contact.name.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div>
                    <h4 className="font-medium text-slate-800">{contact.name}</h4>
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                       <Phone className="w-3 h-3" /> {contact.phone}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => initiateSend(contact)}
                        disabled={!generatedMessage}
                        className="opacity-0 group-hover:opacity-100 bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1 disabled:opacity-50"
                    >
                        <Send className="w-3 h-3" /> Send
                    </button>

                    <div className="flex items-center border-l border-slate-200 pl-2 ml-2 gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {selectedContactIds.length > 0 && (
                            <button
                                onClick={() => removeFromCampaign(contact.id)}
                                className="text-slate-400 hover:text-amber-500 p-1.5 rounded hover:bg-amber-50 transition-all"
                                title="Remove from this campaign list"
                            >
                                <MinusCircle className="w-4 h-4" />
                            </button>
                        )}
                        <button
                            onClick={() => deleteContact(contact.id)}
                            className="text-slate-400 hover:text-red-500 p-1.5 rounded hover:bg-red-50 transition-all"
                            title="Permanently Delete Contact"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
              </div>
            ))}
            {contacts.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-sm">
                    No contacts to show. Add some from the "Contacts" tab.
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderContacts = () => {
    const filteredContacts = contacts.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.phone.includes(searchTerm) ||
        c.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const allFilteredSelected = filteredContacts.length > 0 && filteredContacts.every(c => selectedContactIds.includes(c.id));
    const isIndeterminate = filteredContacts.some(c => selectedContactIds.includes(c.id)) && !allFilteredSelected;

    const handleSelectAll = () => {
        if (allFilteredSelected) {
            const idsToDeselect = filteredContacts.map(c => c.id);
            setSelectedContactIds(prev => prev.filter(id => !idsToDeselect.includes(id)));
        } else {
            const idsToSelect = filteredContacts.map(c => c.id);
            setSelectedContactIds(prev => [...new Set([...prev, ...idsToSelect])]);
        }
    };

    return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden animate-in fade-in duration-500">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
            <h2 className="text-xl font-bold text-slate-800">Contact Management</h2>
            
            <div className="flex gap-4 w-full md:w-auto items-center">
                {selectedContactIds.length > 0 && (
                    <button 
                        onClick={handleBulkDelete}
                        className="bg-red-50 text-red-600 px-3 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-red-100 transition-colors whitespace-nowrap border border-red-100 animate-in fade-in zoom-in-95"
                    >
                        <Trash2 className="w-4 h-4" /> Delete ({selectedContactIds.length})
                    </button>
                )}

                <div className="relative flex-1 md:w-64">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Search contacts..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                </div>
                <button 
                onClick={() => setShowAddContact(true)}
                className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-slate-800 transition-colors whitespace-nowrap"
                >
                    <Plus className="w-4 h-4" /> Add Contacts
                </button>
            </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 text-sm uppercase">
                  <tr>
                      <th className="p-4 w-10">
                          <input 
                            type="checkbox" 
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer accent-emerald-500"
                            checked={allFilteredSelected}
                            ref={input => { if (input) input.indeterminate = isIndeterminate; }}
                            onChange={handleSelectAll}
                          />
                      </th>
                      <th className="p-4 font-medium w-16">Avatar</th>
                      <th className="p-4 font-medium">Name</th>
                      <th className="p-4 font-medium">Phone</th>
                      <th className="p-4 font-medium">Tags</th>
                      <th className="p-4 font-medium">Last Interaction</th>
                      <th className="p-4 font-medium text-right">Actions</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                  {filteredContacts.map(contact => {
                      const isSelected = selectedContactIds.includes(contact.id);
                      return (
                      <tr key={contact.id} className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-emerald-50/30' : ''}`}>
                          <td className="p-4">
                              <input 
                                type="checkbox" 
                                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer accent-emerald-500"
                                checked={isSelected}
                                onChange={() => {
                                    if (isSelected) {
                                        setSelectedContactIds(prev => prev.filter(id => id !== contact.id));
                                    } else {
                                        setSelectedContactIds(prev => [...prev, contact.id]);
                                    }
                                }}
                              />
                          </td>
                          <td className="p-4">
                             <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center">
                                {contact.avatar ? (
                                    <img src={contact.avatar} alt={contact.name} className="w-full h-full object-cover" />
                                ) : (
                                    <Users className="w-5 h-5 text-slate-400" />
                                )}
                             </div>
                          </td>
                          <td className="p-4 font-medium text-slate-800">{contact.name}</td>
                          <td className="p-4 text-slate-600 font-mono text-sm">{contact.phone}</td>
                          <td className="p-4">
                              <div className="flex gap-1 flex-wrap">
                                  {contact.tags.map(tag => (
                                      <span key={tag} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-md border border-slate-200">
                                          {tag}
                                      </span>
                                  ))}
                              </div>
                          </td>
                          <td className="p-4 text-slate-500 text-sm">{contact.lastInteraction}</td>
                          <td className="p-4 text-right">
                              <button 
                                onClick={() => deleteContact(contact.id)}
                                className="text-slate-400 hover:text-red-500 p-2 rounded hover:bg-red-50 transition-all"
                                title="Delete Permanently"
                              >
                                  <Trash2 className="w-4 h-4" />
                              </button>
                          </td>
                      </tr>
                  )})}
                  {filteredContacts.length === 0 && (
                      <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-400">
                              {searchTerm ? 'No contacts match your search.' : 'No contacts found. Click "Add Contacts" to get started.'}
                          </td>
                      </tr>
                  )}
              </tbody>
          </table>
        </div>
    </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900">
      <ConfirmationModal 
        isOpen={showConfirmation} 
        onClose={() => setShowConfirmation(false)} 
        onConfirm={confirmSend}
        pendingContact={pendingContact}
        generatedMessage={generatedMessage}
        campaignImage={campaignImage}
        personalizeMessage={personalizeMessage}
      />
      <BulkSendModal 
        isOpen={isBulkSending}
        queue={bulkQueue}
        currentIndex={bulkCurrentIndex}
        message={generatedMessage}
        image={campaignImage}
        onClose={() => setIsBulkSending(false)}
        onSendNext={handleBulkSendNext}
        onSkip={handleBulkSkip}
        personalizeMessage={personalizeMessage}
      />
      <AddContactModal 
        isOpen={showAddContact} 
        onClose={() => setShowAddContact(false)}
        onAddSingle={handleSingleAdd}
        onAddBulk={handleBulkAdd}
      />
      <ProfileModal 
        isOpen={showProfile}
        onClose={() => setShowProfile(false)}
        user={userProfile}
        onLogout={handleLogout}
        onUpdateAvatar={handleProfileUpdate}
        onExportData={handleExportData}
        onImportData={handleImportData}
      />
      
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-top-2 duration-300 ${
            notification.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
        }`}>
            {notification.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            <span className="font-medium text-sm">{notification.message}</span>
        </div>
      )}
      
      {/* Sidebar */}
      <aside className="w-20 lg:w-64 bg-white border-r border-slate-200 flex flex-col fixed h-full z-10 transition-all">
        <div className="h-16 flex items-center justify-center lg:justify-start lg:px-6 border-b border-slate-100">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-emerald-200 font-serif">
            D
          </div>
          <span className="ml-3 font-bold text-lg hidden lg:block">DesiChai</span>
        </div>

        <nav className="p-4 space-y-2 flex-1">
          <button 
            onClick={() => setCurrentView('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              currentView === 'dashboard' ? 'bg-emerald-50 text-emerald-600 font-medium' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <LayoutDashboard />
            <span className="hidden lg:block">Dashboard</span>
          </button>
          
          <button 
            onClick={() => setCurrentView('campaigns')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              currentView === 'campaigns' ? 'bg-emerald-50 text-emerald-600 font-medium' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Send />
            <span className="hidden lg:block">Campaigns</span>
          </button>

          <button 
            onClick={() => setCurrentView('contacts')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              currentView === 'contacts' ? 'bg-emerald-50 text-emerald-600 font-medium' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Users />
            <span className="hidden lg:block">Contacts</span>
          </button>
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="bg-slate-900 rounded-xl p-4 text-white hidden lg:block">
            <p className="text-xs text-slate-400 mb-1">Credits used</p>
            <div className="w-full bg-slate-700 h-1.5 rounded-full mb-2">
              <div className="bg-emerald-400 h-1.5 rounded-full w-[65%]"></div>
            </div>
            <p className="text-xs font-medium">324 / 500 AI Generations</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-20 lg:ml-64 p-4 lg:p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 capitalize">
              {currentView}
            </h1>
            <p className="text-slate-500 text-sm">Welcome back, here's what's happening today.</p>
          </div>
          <div className="flex items-center gap-4">
             <button 
                onClick={() => setShowProfile(true)}
                className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white shadow-sm overflow-hidden hover:ring-2 hover:ring-emerald-500 transition-all cursor-pointer"
             >
                 <img src={userProfile.avatar} alt="Profile" className="w-full h-full object-cover" />
             </button>
          </div>
        </header>

        {currentView === 'dashboard' && renderDashboard()}
        {currentView === 'campaigns' && renderCampaignBuilder()}
        {currentView === 'contacts' && renderContacts()}
      </main>
    </div>
  );
};

export default App;
