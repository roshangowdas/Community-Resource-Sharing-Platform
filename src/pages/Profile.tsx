import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Calendar, User as UserIcon, Settings, LogOut, Package, Heart, Star, MapPin, Trash2, ShieldAlert, Camera, X, Clock, CheckCircle2, MessageSquare, AlertCircle, Send, BadgeCheck, ShieldCheck, History, Wallet, ArrowRight, ChevronRight, Lock, QrCode, Scan } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import ConfirmationModal from '../components/ConfirmationModal';
import TrustBadge from '../components/TrustBadge';
import ScannerModal from '../components/ScannerModal';
import QRCodeModal from '../components/QRCodeModal';
import { safeFetch } from '../lib/api';
import { getOptimizedImage } from '../lib/imageUtils';

interface Item {
  _id: string;
  title: string;
  description: string;
  type: string;
  images: string[];
  owner: { name: string, rating: number };
  expiresAt?: string | Date;
}

export default function Profile() {
  const { user, logout, token, apiFetch, isOffline } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [profileData, setProfileData] = useState<any>(null);
  const [savedItems, setSavedItems] = useState<Item[]>([]);
  const [myItems, setMyItems] = useState<Item[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<any[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [loadingMyItems, setLoadingMyItems] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [activeTab, setActiveTab] = useState<'saved' | 'contributions' | 'reviews' | 'activity' | 'history'>(
    (searchParams.get('tab') as any) || 'saved'
  );
  const [reviews, setReviews] = useState<any[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  
  // Review Modal State
  const [reviewModal, setReviewModal] = useState<{
    show: boolean;
    requestId: string;
    itemTitle: string;
    targetName: string;
  } | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(isOffline);

  // QR Flow State
  const [activeScanner, setActiveScanner] = useState<{ show: boolean, requestId: string, type: 'handover' | 'return' }>({
    show: false,
    requestId: '',
    type: 'handover'
  });
  const [activeQRCode, setActiveQRCode] = useState<{ show: boolean, value: string, title: string, subtitle?: string }>({
    show: false,
    value: '',
    title: '',
    subtitle: ''
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    bio: '',
    location: '',
    avatar: ''
  });
  const [saveLoading, setSaveLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  const [confirmConfig, setConfirmConfig] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const handleVerifyHandover = async (requestId: string, tokenVal: string) => {
    try {
      const { ok, data } = await apiFetch(`/api/requests/${requestId}/verify-handover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenVal })
      });
      if (ok) {
        alert('Handover verified successfully! Neural link established.');
        setActiveScanner({ ...activeScanner, show: false });
        fetchRequests();
      } else {
        alert(data.error || 'Verification failed. Please check the token.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error during verification');
    }
  };

  const handleVerifyReturn = async (requestId: string, qrCodeVal: string) => {
    try {
      const { ok, data } = await apiFetch(`/api/requests/${requestId}/verify-return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrCode: qrCodeVal })
      });
      if (ok) {
        alert('Return verified! Security deposit has been released to the borrower.');
        setActiveScanner({ ...activeScanner, show: false });
        fetchRequests();
        fetchTransactions();
      } else {
        alert(data.error || 'Verification failed. Invalid return code.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error during verification');
    }
  };

  useEffect(() => {
    if (token) {
      fetchSavedItems();
      fetchMyItems();
      fetchProfile();
      fetchReviews();
      fetchRequests();
      fetchTransactions();
    }
  }, [token]);

  const fetchTransactions = async () => {
    setLoadingTransactions(true);
    try {
      const { ok, data } = await apiFetch('/api/escrow/transactions');
      if (ok) setTransactions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const fetchRequests = async () => {
    setLoadingRequests(true);
    try {
      const [{ ok: okInc, data: incData }, { ok: okOut, data: outData }] = await Promise.all([
        apiFetch('/api/requests/incoming'),
        apiFetch('/api/requests/me')
      ]);
      
      if (okInc && Array.isArray(incData)) setIncomingRequests(incData);
      else setIncomingRequests([]);
      
      if (okOut && Array.isArray(outData)) setOutgoingRequests(outData);
      else setOutgoingRequests([]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleRequestStatus = async (requestId: string, status: string) => {
    try {
      const { ok } = await apiFetch(`/api/requests/${requestId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });
      if (ok) {
        fetchRequests();
        fetchMyItems();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewModal) return;
    setSubmittingReview(true);
    try {
      const { ok, data } = await apiFetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requestId: reviewModal.requestId,
          rating: reviewRating,
          comment: reviewComment
        })
      });
      if (ok) {
        setReviewModal(null);
        setReviewComment('');
        fetchReviews();
        fetchRequests();
      } else {
        alert(data.error || data.message || 'Failed to submit review');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingReview(false);
    }
  };

  const fetchReviews = async () => {
    if (!user?.id && !profileData?._id) return;
    const targetUserId = profileData?._id || user?.id;
    setLoadingReviews(true);
    try {
      const { ok, data } = await safeFetch(`/api/reviews/user/${targetUserId}`);
      if (ok && Array.isArray(data)) {
        setReviews(data);
      } else {
        setReviews([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingReviews(false);
    }
  };

  const fetchProfile = async () => {
    try {
      const { ok, data } = await apiFetch('/api/users/profile');
      if (ok) {
        setProfileData(data);
        setEditForm({
          name: data.name || '',
          bio: data.bio || '',
          location: data.location || '',
          avatar: data.avatar || ''
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setUploadingAvatar(true);

    const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

    const isHeic = file.name.toLowerCase().endsWith('.heic');
    if (!ALLOWED_TYPES.includes(file.type) && !isHeic) {
      setUploadError(`Incompatible format: "${file.name}" is not supported for profile identifiers. Please use industrial standards: JPG, PNG, or WEBP.`);
      setUploadingAvatar(false);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      const sizeInMB = (file.size / (1024 * 1024)).toFixed(1);
      setUploadError(`Data overflow: Avatar mass (${sizeInMB}MB) exceeds the 2MB allocation for profile nodes. Suggestion: Downsample the image or use a compression protocol.`);
      setUploadingAvatar(false);
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      setUploadError('Internal telemetry failure: Failed to decode the biometric capture. Please check file integrity and try again.');
      setUploadingAvatar(false);
    };
    reader.onloadend = () => {
      const result = reader.result as string;
      if (!result.startsWith('data:image/')) {
        setUploadError('Malformed data stream: Selected file does not contain valid image telemetry.');
      } else {
        setEditForm(prev => ({
          ...prev,
          avatar: result
        }));
      }
      setUploadingAvatar(false);
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveLoading(true);
    try {
      const { ok, data } = await apiFetch('/api/users/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editForm)
      });
      if (ok) {
        setProfileData(data);
        setIsEditing(false);
      } else {
        alert(data.error || data.message || 'Failed to update profile');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating profile');
    } finally {
      setSaveLoading(false);
    }
  };

  const unsaveItem = async (e: React.MouseEvent, itemId: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const { ok } = await apiFetch(`/api/items/${itemId}/save`, {
        method: 'POST'
      });
      if (ok) {
        setSavedItems(prev => prev.filter(i => i._id !== itemId));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSavedItems = async () => {
    setLoadingSaved(true);
    try {
      const { ok, data } = await apiFetch('/api/items/saved');
      if (ok && Array.isArray(data)) {
        setSavedItems(data);
      } else {
        setSavedItems([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSaved(false);
    }
  };

  const fetchMyItems = async () => {
    setLoadingMyItems(true);
    try {
      const { ok, data } = await apiFetch('/api/items/me');
      if (ok && Array.isArray(data)) {
        setMyItems(data);
      } else {
        setMyItems([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMyItems(false);
    }
  };

  const renewItem = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const { ok, data } = await apiFetch(`/api/items/${id}/renew`, {
        method: 'POST'
      });
      if (ok) {
        fetchMyItems();
      } else {
        alert(data.error || data.message || 'Failed to renew item');
      }
    } catch (err) {
      console.error(err);
      alert('Error connecting to server to renew item');
    }
  };

  const deleteItem = async (id: string) => {
    setConfirmConfig({
      show: true,
      title: "Decommission Resource",
      message: "Are you sure you want to remove this item from the neighborhood network? This action is irreversible.",
      onConfirm: () => executeDeletion(id)
    });
  };

  const executeDeletion = async (id: string) => {
    try {
      const { ok, data } = await apiFetch(`/api/items/${id}`, {
        method: 'DELETE'
      });
      if (ok) {
        fetchMyItems();
      } else {
        alert(data.error || data.message || 'Failed to delete item');
      }
    } catch (err) {
      console.error(err);
      alert('Error connecting to server to delete item');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-16 pb-20 px-4 sm:px-0">
      <ScannerModal 
        show={activeScanner.show}
        onClose={() => setActiveScanner({ ...activeScanner, show: false })}
        title={activeScanner.type === 'handover' ? 'Scan Handover Token' : 'Scan Return QR Code'}
        onScan={(data) => {
          if (activeScanner.type === 'handover') {
            handleVerifyHandover(activeScanner.requestId, data);
          } else {
            handleVerifyReturn(activeScanner.requestId, data);
          }
        }}
      />
      
      <QRCodeModal 
        show={activeQRCode.show}
        onClose={() => setActiveQRCode({ ...activeQRCode, show: false })}
        value={activeQRCode.value}
        title={activeQRCode.title}
        subtitle={activeQRCode.subtitle}
      />

      {user?.isTemporary && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card bg-amber-500/10 border-amber-500/30 p-8 flex flex-col md:flex-row items-center gap-6"
        >
          <div className="w-16 h-16 bg-amber-500/20 rounded-2xl flex items-center justify-center shrink-0 text-amber-400">
            <ShieldAlert size={32} />
          </div>
          <div className="space-y-2 text-center md:text-left">
            <h4 className="text-lg font-bold text-amber-200 uppercase tracking-tighter">Temporary Community Node</h4>
            <p className="text-sm text-amber-100/60 leading-relaxed font-medium">
              The primary database is currently offline. You are authenticated as a guest neighbor. Your items, history, and impact score will be restored once the neural link is re-established.
            </p>
          </div>
        </motion.div>
      )}

      {/* Header */}
      <section className="glass-card p-8 md:p-20 flex flex-col md:flex-row items-center gap-8 md:gap-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-sky-500/10 rounded-full blur-[120px] -mr-40 -mt-40" />
        
        {isEditing ? (
          <form onSubmit={handleUpdateProfile} className="w-full relative z-10 space-y-8">
            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="relative group shrink-0">
                <div className="w-32 h-32 md:w-56 md:h-56 rounded-[2.5rem] md:rounded-[3rem] bg-gradient-to-br from-sky-900 to-sky-950 flex items-center justify-center text-sky-400 p-1 md:p-1.5 border border-sky-500/20 shadow-2xl overflow-hidden">
                  <div className="w-full h-full rounded-[2.3rem] md:rounded-[2.8rem] overflow-hidden bg-slate-950/40 backdrop-blur-md border border-sky-500/20 relative">
                    {editForm.avatar ? (
                      <img src={editForm.avatar} alt="Avatar Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center opacity-30">
                        <UserIcon size={48} strokeWidth={1} />
                      </div>
                    )}
                    
                    <label className="absolute inset-0 bg-slate-950/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      <Camera size={24} className="text-sky-400 mb-2" />
                      <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white">Upload</span>
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*" 
                        onChange={handleAvatarUpload}
                      />
                    </label>
                  </div>
                </div>
                {editForm.avatar && (
                  <button 
                    type="button"
                    onClick={() => setEditForm({...editForm, avatar: ''})}
                    className="absolute -top-2 -right-2 bg-rose-500 text-white p-1.5 rounded-xl shadow-lg hover:bg-rose-600 transition-colors z-20"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              
              <div className="flex-1 space-y-6 w-full">
                {uploadError && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-3 mb-4"
                  >
                    <div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center shrink-0 text-rose-400">
                      <ShieldAlert size={16} />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider mb-1">Upload Error</p>
                      <p className="text-[11px] text-rose-100/60 leading-relaxed font-medium">{uploadError}</p>
                      <div className="mt-3 pt-3 border-t border-rose-500/10">
                        <p className="text-[9px] text-rose-400/60 font-bold uppercase tracking-wider mb-2">Resolution Protocol:</p>
                        <ul className="text-[10px] text-rose-100/40 space-y-1 list-disc pl-4">
                          <li>Check if the file is one of: JPG, PNG, WEBP</li>
                          <li>Ensure file size is below 2MB for profile avatars</li>
                          <li>Verify the file is not open in another application</li>
                          <li>Try clearing your browser cache if persistent</li>
                        </ul>
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setUploadError(null)}
                      className="text-rose-400/40 hover:text-rose-400 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </motion.div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-100/40 ml-1">Node Identifier</label>
                    <input 
                      type="text" 
                      value={editForm.name}
                      onChange={e => setEditForm({...editForm, name: e.target.value})}
                      className="w-full bg-sky-500/5 border border-sky-500/10 rounded-2xl px-6 py-4 text-white font-medium focus:border-sky-500/40 outline-none transition-all"
                      placeholder="Display Name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-100/40 ml-1">Location Coordinates</label>
                    <input 
                      type="text" 
                      value={editForm.location}
                      onChange={e => setEditForm({...editForm, location: e.target.value})}
                      className="w-full bg-sky-500/5 border border-sky-500/10 rounded-2xl px-6 py-4 text-white font-medium focus:border-sky-500/40 outline-none transition-all"
                      placeholder="Neighborhood / City"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-100/40 ml-1">Operational Protocol (Bio)</label>
                  <textarea 
                    value={editForm.bio}
                    onChange={e => setEditForm({...editForm, bio: e.target.value})}
                    className="w-full bg-sky-500/5 border border-sky-500/10 rounded-2xl px-6 py-4 text-white font-medium focus:border-sky-500/40 outline-none transition-all min-h-[120px]"
                    placeholder="Tell the neighborhood about yourself..."
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    disabled={saveLoading}
                    type="submit" 
                    className="glass-button bg-sky-500 text-white border-transparent hover:bg-sky-600 px-10 flex-1 md:flex-none uppercase tracking-[0.2em] font-bold text-xs"
                  >
                    {saveLoading ? 'Syncing...' : 'Update Node'}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setIsEditing(false)}
                    className="glass-button bg-sky-500/5 text-sky-100/40 border-sky-500/10 hover:text-sky-100 px-10 flex-1 md:flex-none uppercase tracking-[0.2em] font-bold text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </form>
        ) : (
          <>
            <div className="w-32 h-32 md:w-56 md:h-56 rounded-[2.5rem] md:rounded-[3rem] bg-gradient-to-br from-sky-900 to-sky-950 flex items-center justify-center text-sky-400 relative z-10 p-1 md:p-1.5 border border-sky-500/20 shadow-2xl">
              <div className="w-full h-full rounded-[2.3rem] md:rounded-[2.8rem] overflow-hidden bg-slate-950/40 backdrop-blur-md border border-sky-500/20 group relative">
                {profileData?.avatar ? (
                  <img src={profileData.avatar} alt={profileData.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center opacity-30">
                    <UserIcon size={window.innerWidth < 768 ? 48 : 80} strokeWidth={1} />
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 text-center md:text-left space-y-6 relative z-10">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-white uppercase tracking-tighter">{profileData?.name || user?.name}</h1>
                  {profileData?.isVerified && (
                    <div className="bg-sky-500/20 text-sky-400 p-1.5 rounded-full border border-sky-500/30" title="Verified Neighbor">
                      <ShieldCheck size={20} fill="currentColor" fillOpacity={0.2} />
                    </div>
                  )}
                </div>
                <p className="text-sky-100/40 font-bold uppercase tracking-[0.3em] text-[9px] md:text-xs">{user?.email}</p>
              </div>
              
              <div className="bg-slate-900/50 p-8 rounded-[2.5rem] border border-sky-500/10 inline-block">
                <div className="flex flex-col gap-4">
                  <span className="text-[10px] font-bold text-sky-100/30 uppercase tracking-[0.4em] mb-1">Reputation Protocol</span>
                  <div className="flex items-center gap-6">
                    <div className="flex flex-col">
                      <div className="flex items-end gap-2">
                        <span className="text-4xl font-black text-white">{profileData?.trustScore || 500}</span>
                        <span className="text-xs font-bold text-sky-500/40 mb-1.5">/ 1000</span>
                      </div>
                    </div>
                    <TrustBadge score={profileData?.trustScore || 500} size="lg" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-8 pt-4 border-t border-sky-500/10">
                     <div className="space-y-1">
                        <p className="text-[8px] font-black text-sky-100/20 uppercase tracking-widest">Reliability</p>
                        <p className="text-sm font-bold text-emerald-400">{profileData?.reliabilityRate || 100}%</p>
                     </div>
                     <div className="space-y-1">
                        <p className="text-[8px] font-black text-sky-100/20 uppercase tracking-widest">Transactions</p>
                        <p className="text-sm font-bold text-sky-400">{profileData?.transactionCount || 0} Nodes</p>
                     </div>
                  </div>
                </div>
              </div>
              
              {profileData?.bio && (
                <p className="text-sky-100/60 text-sm md:text-md max-w-xl leading-relaxed italic border-l-2 border-sky-500/20 pl-4">
                  "{profileData.bio}"
                </p>
              )}

              <div className="flex flex-wrap justify-center md:justify-start gap-3 md:gap-4">
                <div className="px-4 py-2 md:px-6 md:py-3 bg-sky-500/5 backdrop-blur-md border border-sky-500/10 rounded-xl md:rounded-2xl text-[8px] md:text-[10px] font-bold uppercase tracking-[0.2em] text-sky-100/50 flex items-center gap-2 md:gap-3 shadow-inner">
                  <Star className="text-yellow-500" size={14} fill="currentColor" /> {profileData?.rating && profileData?.reviewCount > 0 ? `${profileData.rating} Trust` : 'New Neighbor'}
                </div>
                <div className="px-4 py-2 md:px-6 md:py-3 bg-emerald-500/5 backdrop-blur-md border border-emerald-500/10 rounded-xl md:rounded-2xl text-[8px] md:text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400 flex items-center gap-2 md:gap-3 shadow-inner">
                  <Star size={14} fill="currentColor" /> {profileData?.impactScore || 0} Impact Score
                </div>
                <div className="px-4 py-2 md:px-6 md:py-3 bg-sky-500/5 backdrop-blur-md border border-sky-500/10 rounded-xl md:rounded-2xl text-[8px] md:text-[10px] font-bold uppercase tracking-[0.2em] text-sky-100/50 flex items-center gap-2 md:gap-3 shadow-inner">
                  <MapPin size={14} className="text-sky-400" /> {profileData?.location || 'Neighborhood Local'}
                </div>
              </div>
              <div className="flex justify-center md:justify-start gap-4 pt-2 md:pt-4">
                <button 
                  onClick={() => setIsEditing(true)}
                  className="glass-button bg-sky-500 text-white border-transparent hover:bg-sky-700 w-12 h-12 md:w-14 md:h-14 flex items-center justify-center p-0 shadow-lg shadow-sky-500/20"
                >
                  <Settings size={20} />
                </button>
                <button 
                  onClick={() => {
                    logout();
                    navigate('/');
                  }} 
                  className="glass-button flex items-center gap-3 bg-sky-500/5 text-rose-400 border-rose-500/10 hover:bg-rose-500 hover:text-white px-6 md:px-8"
                >
                  <LogOut size={20} /> <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Logout</span>
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Tabs */}
      <div className="space-y-10">
        <div className="flex items-center gap-8 md:gap-12 border-b border-sky-500/10 px-6 overflow-x-auto whitespace-nowrap">
          <button 
            onClick={() => setActiveTab('saved')}
            className={`pb-6 border-b-4 transition-all ${activeTab === 'saved' ? 'border-sky-500 text-sky-400' : 'border-transparent text-sky-100/30 hover:text-sky-100/60'} font-bold text-[10px] uppercase tracking-[0.3em] flex items-center gap-3 relative`}
          >
            <Heart size={16} fill={activeTab === 'saved' ? "currentColor" : "none"} /> 
            Saved Resources
            {savedItems.length > 0 && (
              <span className="ml-1 bg-sky-500/10 text-sky-400 px-2 py-0.5 rounded-full text-[8px] border border-sky-500/20">{savedItems.length}</span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('contributions')}
            className={`pb-6 border-b-4 transition-all ${activeTab === 'contributions' ? 'border-sky-500 text-sky-400' : 'border-transparent text-sky-100/30 hover:text-sky-100/60'} font-bold text-[10px] uppercase tracking-[0.3em] flex items-center gap-3 relative`}
          >
            <Package size={16} fill={activeTab === 'contributions' ? "currentColor" : "none"} /> 
            My Contributions
            {myItems.length > 0 && (
              <span className="ml-1 bg-sky-500/10 text-sky-400 px-2 py-0.5 rounded-full text-[8px] border border-sky-500/20">{myItems.length}</span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('activity')}
            className={`pb-6 border-b-4 transition-all ${activeTab === 'activity' ? 'border-sky-500 text-sky-400' : 'border-transparent text-sky-100/30 hover:text-sky-100/60'} font-bold text-[10px] uppercase tracking-[0.3em] flex items-center gap-3 relative`}
          >
            <Clock size={16} /> 
            My Activity
            {(incomingRequests.filter(r => r.status === 'pending').length) > 0 && (
              <span className="ml-1 bg-sky-500 text-white px-2 py-0.5 rounded-full text-[8px] animate-pulse">
                {incomingRequests.filter(r => r.status === 'pending').length}
              </span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('reviews')}
            className={`pb-6 border-b-4 transition-all ${activeTab === 'reviews' ? 'border-sky-500 text-sky-400' : 'border-transparent text-sky-100/30 hover:text-sky-100/60'} font-bold text-[10px] uppercase tracking-[0.3em] flex items-center gap-3 relative`}
          >
            <Star size={16} fill={activeTab === 'reviews' ? "currentColor" : "none"} /> 
            Community Reviews
            {reviews.length > 0 && (
              <span className="ml-1 bg-sky-500/10 text-sky-400 px-2 py-0.5 rounded-full text-[8px] border border-sky-500/20">{reviews.length}</span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`pb-6 border-b-4 transition-all ${activeTab === 'history' ? 'border-sky-500 text-sky-400' : 'border-transparent text-sky-100/30 hover:text-sky-100/60'} font-bold text-[10px] uppercase tracking-[0.3em] flex items-center gap-3 relative`}
          >
            <Wallet size={16} /> 
            Ledger
          </button>
        </div>

        {(activeTab === 'saved' ? loadingSaved : activeTab === 'contributions' ? loadingMyItems : activeTab === 'reviews' ? loadingReviews : loadingRequests) ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[1,2,3,4].map(i => (
              <div key={i} className="glass-card p-0 overflow-hidden h-72 animate-pulse border-white/30">
                <div className="h-44 bg-slate-200/40" />
                <div className="p-6 space-y-3">
                  <div className="h-4 w-3/4 bg-slate-200/40 rounded-xl" />
                  <div className="h-3 w-1/2 bg-slate-200/30 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {activeTab === 'saved' ? (
              <>
                {Array.isArray(savedItems) && savedItems.map((item) => (
                  <Link key={item._id} to={`/marketplace?id=${item._id}`} className="glass-card group p-0 overflow-hidden h-full flex flex-col border-sky-500/10 hover:-translate-y-2 hover:shadow-2xl hover:shadow-sky-500/10 transition-all">
                    <div className="h-52 bg-slate-950 relative overflow-hidden">
                      {item.images?.[0] ? (
                        <img src={getOptimizedImage(item.images[0])} alt={item.title} className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-[1.5s]" referrerPolicy="no-referrer" />
                      ) : <div className="w-full h-full flex items-center justify-center text-sky-100/10"><Heart size={48} strokeWidth={1} /></div>}
                      <div className="absolute top-4 left-4 px-4 py-1.5 bg-sky-500 text-white rounded-full text-[9px] font-bold uppercase tracking-[0.2em] shadow-xl">
                        Matched
                      </div>
                      <button 
                        onClick={(e) => unsaveItem(e, item._id)}
                        className="absolute top-4 right-4 w-10 h-10 bg-slate-900/60 backdrop-blur-xl border border-sky-500/20 rounded-xl flex items-center justify-center text-rose-400 opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-500 hover:text-white"
                      >
                        <Heart size={18} fill="currentColor" />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          navigate(`/marketplace?id=${item._id}`);
                        }}
                        className="absolute top-16 right-4 w-10 h-10 bg-slate-900/60 backdrop-blur-xl border border-sky-500/20 rounded-xl flex items-center justify-center text-sky-400 opacity-0 group-hover:opacity-100 transition-all hover:bg-sky-500 hover:text-white"
                        title="Reserve Resource"
                      >
                        <Calendar size={18} />
                      </button>
                    </div>
                    <div className="p-6 flex flex-col flex-1">
                      <h3 className="font-bold text-white group-hover:text-sky-400 transition-colors mb-2 uppercase tracking-tight text-lg line-clamp-1">{item.title}</h3>
                      <div className="mt-auto pt-6 border-t border-sky-500/10 flex items-center justify-between">
                         <span className="text-[10px] font-bold text-sky-100/30 uppercase tracking-[0.2em]">{item.type}</span>
                         <div className="text-yellow-500 font-bold text-[10px] bg-yellow-500/5 px-2 py-1 rounded-lg border border-yellow-500/10">★ {item.owner.rating}</div>
                      </div>
                    </div>
                  </Link>
                ))}
                {savedItems.length === 0 && (
                  <div className="col-span-full py-24 flex flex-col items-center justify-center text-center glass-card border-dashed border-sky-500/10 bg-sky-500/5 min-h-[400px]">
                    <div className="w-20 h-20 bg-sky-500/10 border border-sky-500/20 rounded-3xl flex items-center justify-center text-sky-400 mb-6 animate-pulse">
                      <Heart size={40} />
                    </div>
                    <p className="text-[10px] font-bold text-sky-100/30 uppercase tracking-[0.4em] mb-4">No curated resources yet</p>
                    <Link to="/marketplace" className="glass-button bg-sky-500 text-white border-transparent px-10">Discover Global Community</Link>
                  </div>
                )}
              </>
            ) : (
              <>
                {Array.isArray(myItems) && myItems.map((item) => {
                  const isExpiring = item.expiresAt && new Date(item.expiresAt).getTime() - new Date().getTime() < 72 * 60 * 60 * 1000;
                  const daysLeft = item.expiresAt ? Math.ceil((new Date(item.expiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;

                  return (
                    <div key={item._id} className="glass-card group p-0 overflow-hidden h-full flex flex-col border-sky-500/10 hover:shadow-2xl transition-all">
                      <div className="h-52 bg-slate-950 relative overflow-hidden">
                        {item.images?.[0] ? (
                          <img src={getOptimizedImage(item.images[0])} alt={item.title} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-700" referrerPolicy="no-referrer" />
                        ) : <div className="w-full h-full flex items-center justify-center text-sky-100/10"><Package size={48} strokeWidth={1} /></div>}
                        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                          {isExpiring && (
                            <button 
                              onClick={(e) => renewItem(e, item._id)}
                              title="Renew listing"
                              className="w-10 h-10 bg-emerald-500/60 backdrop-blur-xl border border-emerald-500/20 rounded-xl flex items-center justify-center text-white hover:bg-emerald-600"
                            >
                              <Clock size={18} />
                            </button>
                          )}
                          <button 
                            onClick={() => navigate(`/post?id=${item._id}`)}
                            className="w-10 h-10 bg-slate-900/60 backdrop-blur-xl border border-sky-500/20 rounded-xl flex items-center justify-center text-sky-400 hover:bg-sky-500 hover:text-white"
                          >
                            <Settings size={18} />
                          </button>
                          <button 
                            onClick={() => deleteItem(item._id)}
                            className="w-10 h-10 bg-slate-900/60 backdrop-blur-xl border border-sky-500/20 rounded-xl flex items-center justify-center text-rose-400 hover:bg-rose-500 hover:text-white"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                        {isExpiring && (
                           <div className="absolute bottom-4 left-4 right-4 py-2 px-3 bg-rose-500/80 backdrop-blur-md rounded-xl flex items-center justify-between shadow-lg">
                              <span className="text-[9px] font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                 <AlertCircle size={12} /> Expiring Soon
                              </span>
                              <span className="text-[9px] font-black text-white uppercase tracking-wider">{daysLeft}D Left</span>
                           </div>
                        )}
                      </div>
                      <div className="p-6 flex flex-col flex-1">
                        <h3 className="font-bold text-white mb-2 uppercase tracking-tight text-lg line-clamp-1">{item.title}</h3>
                        <div className="mt-auto pt-6 border-t border-sky-500/10 flex items-center justify-between">
                           <span className="text-[10px] font-bold text-sky-100/30 uppercase tracking-[0.2em]">{item.type}</span>
                           <span className="text-[10px] font-bold text-sky-400 uppercase tracking-[0.2em] bg-sky-500/5 px-2 py-1 rounded-lg border border-sky-500/10">Active Node</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {myItems.length === 0 && (
                  <div className="col-span-full py-24 flex flex-col items-center justify-center text-center glass-card border-dashed border-2 bg-white/20">
                    <div className="w-20 h-20 bg-white shadow-inner rounded-3xl flex items-center justify-center text-slate-200 mb-6">
                      <Package size={40} />
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.4em] mb-4">You haven't contributed any resources yet</p>
                    <Link to="/post" className="glass-button text-blue-600 border-blue-500/20 px-10">Broadcast First Resource</Link>
                  </div>
                )}
              </>
            )}
            
            {activeTab === 'activity' && (
              <div className="col-span-full space-y-20">
                {/* Incoming Requests Section - The "Owner" view */}
                <div className="space-y-10">
                  <div className="flex items-center justify-between border-b border-sky-500/10 pb-6">
                    <div className="space-y-1">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-sky-400 flex items-center gap-3">
                        <ShieldCheck size={16} /> Asset Custody Terminal
                      </h4>
                      <p className="text-[9px] text-sky-100/20 font-bold uppercase tracking-widest ml-7">Requests for your local resources</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <Link to="/transactions" className="glass-button bg-sky-500 text-white px-5 py-2 text-[9px] border-transparent hover:bg-sky-600">
                        Open Handover Hub
                      </Link>
                      <div className="px-5 py-2 bg-sky-500/5 rounded-full border border-sky-500/10 text-[9px] font-bold text-sky-400 uppercase tracking-widest">
                        {incomingRequests.length} Active Nodes
                      </div>
                    </div>
                  </div>
                  
                  {incomingRequests.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {incomingRequests.map((req) => (
                        <div key={req._id} className="glass-card p-10 border-sky-500/10 flex flex-col gap-8 group hover:border-sky-500/30 transition-all relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/5 rounded-full blur-3xl -mr-12 -mt-12 group-hover:bg-sky-500/10 transition-all" />
                          
                          <div className="flex items-start justify-between gap-4 relative z-10">
                            <div className="flex items-center gap-5">
                              <div className="w-14 h-14 bg-gradient-to-br from-sky-900 to-sky-950 rounded-2xl border border-sky-500/20 overflow-hidden shrink-0 shadow-inner">
                                {req.requester?.avatar ? (
                                  <img src={req.requester.avatar} alt="" className="w-full h-full object-cover" />
                                ) : <div className="w-full h-full flex items-center justify-center text-sky-400 font-bold text-xl">{req.requester?.name?.[0]}</div>}
                              </div>
                              <div>
                                <p className="text-base font-black text-white group-hover:text-sky-400 transition-colors uppercase tracking-tight">{req.requester?.name}</p>
                                <p className="text-[10px] text-sky-100/40 font-bold uppercase tracking-widest mt-1">{req.item?.title}</p>
                              </div>
                            </div>
                            <div className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border shadow-lg ${
                              req.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                              req.status === 'deposit_paid' ? 'bg-sky-500/20 text-sky-400 border-sky-500/30' :
                              req.status === 'pending' ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30' :
                              req.status === 'item_handed_over' || req.status === 'borrowed' ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' :
                              req.status === 'completed' ? 'bg-emerald-500 text-white border-transparent' :
                              'bg-rose-500/20 text-rose-400 border-rose-500/30'
                            }`}>
                              {req.status === 'item_handed_over' ? 'Handover Complete' : req.status.replace('_', ' ')}
                            </div>
                          </div>

                          <div className="flex flex-col gap-4 relative z-10">
                            {req.borrowStartDate && (
                              <div className="flex items-center gap-2 text-[9px] font-black text-sky-100/30 uppercase tracking-widest bg-white/5 p-3 rounded-xl border border-white/5">
                                <Clock size={12} className="text-sky-400" />
                                Timeline: {new Date(req.borrowStartDate).toLocaleDateString()} — {new Date(req.borrowEndDate).toLocaleDateString()}
                              </div>
                            )}
                            <div className="p-5 bg-sky-500/5 rounded-2xl border border-sky-500/10 italic text-[11px] text-sky-100/60 leading-relaxed font-medium">
                              "{req.message || "No narrative provided."}"
                            </div>
                          </div>

                          <div className="flex gap-4 relative z-10 mt-auto">
                            {req.status === 'pending' && (
                              <>
                                <button 
                                  onClick={() => handleRequestStatus(req._id, 'approved')}
                                  className="flex-1 py-4 bg-sky-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-sky-500/20 hover:bg-sky-600 transition-all active:scale-95"
                                >
                                  Authorize
                                </button>
                                <button 
                                  onClick={() => handleRequestStatus(req._id, 'rejected')}
                                  className="flex-1 py-4 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-rose-500/20 transition-all"
                                >
                                  Decline
                                </button>
                              </>
                            )}
                            
                            {(req.status === 'approved' || req.status === 'deposit_paid') && (
                              <div className="flex flex-col w-full gap-4">
                                <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <ShieldCheck size={16} className="text-emerald-400" />
                                    <span className="text-[9px] font-black text-emerald-400/60 uppercase tracking-widest">Awaiting Verification</span>
                                  </div>
                                  <span className="text-[10px] font-black text-white px-3 py-1 bg-white/5 rounded-lg border border-white/10 uppercase tracking-tighter">Phase 1/2</span>
                                </div>
                                <button 
                                  onClick={() => setActiveScanner({ show: true, requestId: req._id, type: 'handover' })}
                                  className="w-full py-5 bg-sky-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-sky-500/30 hover:bg-sky-400 flex items-center justify-center gap-3 transition-all active:scale-95"
                                >
                                  <Scan size={18} /> Scan Neighbor QR
                                </button>
                              </div>
                            )}

                            {(req.status === 'borrowed' || req.status === 'item_handed_over' || req.status === 'return_requested') && (
                              <button 
                                onClick={() => setActiveScanner({ show: true, requestId: req._id, type: 'return' })}
                                className="w-full py-5 bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-emerald-500/30 hover:bg-emerald-400 flex items-center justify-center gap-3 transition-all active:scale-95"
                              >
                                <Scan size={18} /> Verify Return Scan
                              </button>
                            )}

                            {req.status === 'completed' && (
                              <button 
                                onClick={() => setReviewModal({
                                  show: true,
                                  requestId: req._id,
                                  itemTitle: req.item?.title,
                                  targetName: req.requester?.name
                                })}
                                className="w-full py-4 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-yellow-500/20 transition-all"
                                disabled={reviews.some(r => r.request === req._id)}
                              >
                                {reviews.some(r => r.request === req._id) ? <><CheckCircle2 size={16} /> Protocol Validated</> : <><Star size={16} /> Rate Guest Loop</>}
                              </button>
                            )}
                            
                            <Link 
                              to={`/messages?id=${req._id}`}
                              className="p-4 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-2xl hover:bg-sky-500/20 transition-all flex items-center justify-center shadow-lg"
                            >
                              <MessageSquare size={20} />
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-24 glass-card border-dashed border-sky-500/10 bg-sky-500/5 text-center flex flex-col items-center justify-center gap-4">
                      <div className="w-16 h-16 bg-sky-500/5 rounded-full flex items-center justify-center text-sky-500/20">
                        <History size={32} />
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-[0.6em] text-sky-100/20">No incoming node interactions detected</p>
                    </div>
                  )}
                </div>

                {/* Outgoing Requests Section - The "Borrower" view */}
                <div className="space-y-10">
                  <div className="flex items-center justify-between border-b border-sky-500/10 pb-6">
                    <div className="space-y-1">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-emerald-400 flex items-center gap-3">
                        <Send size={16} /> Outbound Missions
                      </h4>
                      <p className="text-[9px] text-sky-100/20 font-bold uppercase tracking-widest ml-7">Resources you are attempting to sync</p>
                    </div>
                    <div className="px-5 py-2 bg-emerald-500/5 rounded-full border border-emerald-500/10 text-[9px] font-bold text-emerald-400 uppercase tracking-widest">
                      {outgoingRequests.length} Synchronizations
                    </div>
                  </div>

                  {outgoingRequests.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {outgoingRequests.map((req) => (
                        <div key={req._id} className="glass-card p-10 border-sky-500/10 flex flex-col gap-8 group hover:border-sky-500/30 transition-all relative overflow-hidden">
                          <div className="absolute bottom-0 left-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-3xl -ml-12 -mb-12 group-hover:bg-emerald-500/10 transition-all" />
                          
                          <div className="flex items-start justify-between gap-4 relative z-10">
                            <div className="flex items-center gap-5">
                              <div className="w-16 h-16 bg-slate-950 rounded-2xl border border-sky-500/10 overflow-hidden shrink-0 shadow-2xl">
                                <img src={getOptimizedImage(req.item?.images?.[0])} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                              </div>
                              <div>
                                <p className="text-base font-black text-white group-hover:text-emerald-400 transition-colors uppercase tracking-tight">{req.item?.title}</p>
                                <p className="text-[10px] text-sky-100/40 font-bold uppercase tracking-widest mt-1">Owner: {req.owner?.name}</p>
                              </div>
                            </div>
                            <div className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border shadow-lg ${
                              req.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                              req.status === 'deposit_paid' ? 'bg-sky-500/20 text-sky-400 border-sky-500/30' :
                              req.status === 'pending' ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30' :
                              req.status === 'item_handed_over' || req.status === 'borrowed' ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' :
                              req.status === 'completed' ? 'bg-emerald-500 text-white border-transparent' :
                              'bg-rose-500/20 text-rose-400 border-rose-500/30'
                            }`}>
                              {req.status === 'item_handed_over' ? 'In Use' : req.status.replace('_', ' ')}
                            </div>
                          </div>

                          <div className="space-y-4 relative z-10">
                            {req.depositAmount > 0 && (
                              <div className="flex items-center justify-between p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
                                <div className="flex items-center gap-3">
                                  <ShieldCheck size={16} className="text-emerald-400" />
                                  <span className="text-[10px] font-black text-emerald-100/40 uppercase tracking-widest">Refundable Deposit</span>
                                </div>
                                <span className="text-sm font-black text-emerald-400">${req.depositAmount}</span>
                              </div>
                            )}
                            
                            <div className="grid grid-cols-2 gap-4">
                              {req.borrowStartDate && (
                                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-col gap-1">
                                  <span className="text-[8px] font-black text-sky-100/20 uppercase tracking-widest">Sync Start</span>
                                  <span className="text-[10px] font-bold text-white uppercase">{new Date(req.borrowStartDate).toLocaleDateString()}</span>
                                </div>
                              )}
                              {req.borrowEndDate && (
                                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-col gap-1">
                                  <span className="text-[8px] font-black text-sky-100/20 uppercase tracking-widest">Sync End</span>
                                  <span className="text-[10px] font-bold text-white uppercase">{new Date(req.borrowEndDate).toLocaleDateString()}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col gap-4 relative z-10 mt-auto">
                            {req.status === 'approved' && req.item?.depositAmount > 0 && (
                              <div className="flex flex-col gap-4">
                                  <p className="text-[9px] text-center text-sky-100/30 font-bold uppercase tracking-widest">Security Commitment Required</p>
                                  <button 
                                    onClick={() => navigate(`/messages?id=${req._id}`)}
                                    className="w-full py-5 bg-sky-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-sky-500/30 hover:bg-sky-400 transition-all flex items-center justify-center gap-3"
                                  >
                                    <Wallet size={18} /> Initiate Escrow Deposit
                                  </button>
                              </div>
                            )}

                            {(req.status === 'deposit_paid' || (req.status === 'approved' && (!req.item?.depositAmount || req.item?.depositAmount === 0))) && (
                              <button 
                                onClick={() => setActiveQRCode({
                                  show: true,
                                  value: req.borrowerHandoverToken,
                                  title: 'Handover Identification',
                                  subtitle: `Show this to ${req.owner?.name} to receive ${req.item?.title}`
                                })}
                                className="w-full py-5 bg-sky-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-sky-500/30 hover:bg-sky-400 flex items-center justify-center gap-3 transition-all active:scale-95"
                              >
                                <QrCode size={18} /> Show Handover QR
                              </button>
                            )}

                            {(req.status === 'item_handed_over' || req.status === 'borrowed') && (
                              <div className="flex flex-col gap-4 w-full">
                                <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl text-[10px] text-indigo-300 font-bold uppercase tracking-widest text-center">
                                  Node Sync Active: In Usage Cycle
                                </div>
                                <button 
                                  onClick={() => {
                                    // First show QR, but also tell server we are ready to return
                                    apiFetch(`/api/requests/${req._id}/return-request`, { method: 'POST' }).then(() => fetchRequests());
                                    setActiveQRCode({
                                      show: true,
                                      value: req.returnQRCode || `RET-WAIT-${req._id.substring(0,4)}`,
                                      title: 'Return Protocol QR',
                                      subtitle: `Show this to ${req.owner?.name} when returning the resource`
                                    });
                                  }}
                                  className="w-full py-5 bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-emerald-500/30 hover:bg-emerald-400 flex items-center justify-center gap-3 transition-all active:scale-95"
                                >
                                  <QrCode size={18} /> Generate Return Scan
                                </button>
                              </div>
                            )}

                            {req.status === 'return_requested' && (
                              <button 
                                onClick={() => setActiveQRCode({
                                  show: true,
                                  value: req.returnQRCode,
                                  title: 'Return Protocol QR',
                                  subtitle: `Show this to ${req.owner?.name} to finalize return`
                                })}
                                className="w-full py-5 bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-emerald-500/30 hover:bg-emerald-400 flex items-center justify-center gap-3 transition-all active:scale-95"
                              >
                                <QrCode size={18} /> Show Return QR
                              </button>
                            )}

                            {req.status === 'completed' && (
                              <button 
                                onClick={() => setReviewModal({
                                  show: true,
                                  requestId: req._id,
                                  itemTitle: req.item?.title,
                                  targetName: req.owner?.name
                                })}
                                className="w-full py-4 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-yellow-500/20 transition-all"
                                disabled={reviews.some(r => r.request === req._id)}
                              >
                                {reviews.some(r => r.request === req._id) ? <><CheckCircle2 size={16} /> Loop Closed</> : <><Star size={16} /> Rate Neighborhood Hub</>}
                              </button>
                            )}
                            
                            <Link 
                              to={`/messages?id=${req._id}`}
                              className="w-full py-4 bg-white/5 text-sky-100/40 border border-white/5 rounded-2xl hover:bg-white/10 transition-all flex items-center justify-center gap-3 text-[10px] font-bold uppercase tracking-widest shadow-lg"
                            >
                              <MessageSquare size={16} /> Open Communication Neural Link
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-24 glass-card border-dashed border-sky-500/10 bg-sky-500/5 text-center flex flex-col items-center justify-center gap-4">
                      <div className="w-16 h-16 bg-sky-500/5 rounded-full flex items-center justify-center text-sky-500/20">
                        <Send size={32} />
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-[0.6em] text-sky-100/20">No outbound missions initialized</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="col-span-full space-y-6">
                {reviews.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {reviews.map((review) => (
                      <div key={review._id} className="glass-card p-8 space-y-4 border-sky-500/10 relative group">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-sky-500/10 rounded-xl border border-sky-500/20 flex items-center justify-center text-sky-400 overflow-hidden">
                              {review.from?.avatar ? (
                                <img src={review.from.avatar} alt={review.from.name} className="w-full h-full object-cover" />
                              ) : (
                                review.from?.name?.[0]?.toUpperCase() || '?'
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-white">{review.from?.name || 'Neighbor'}</p>
                              <p className="text-[10px] text-sky-100/30 font-bold uppercase tracking-widest">
                                {new Date(review.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star 
                                key={star} 
                                size={12} 
                                className={star <= review.rating ? "text-yellow-500" : "text-sky-100/10"} 
                                fill={star <= review.rating ? "currentColor" : "none"} 
                              />
                            ))}
                          </div>
                        </div>
                        <p className="text-sm text-sky-100/60 leading-relaxed font-medium">"{review.comment}"</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-24 flex flex-col items-center justify-center text-center glass-card border-dashed border-sky-500/10 bg-sky-500/5 min-h-[400px]">
                    <div className="w-20 h-20 bg-sky-500/10 border border-sky-500/20 rounded-3xl flex items-center justify-center text-sky-400 mb-6">
                      <Star size={40} />
                    </div>
                    <p className="text-[10px] font-bold text-sky-100/30 uppercase tracking-[0.4em] mb-4">No community feedback yet</p>
                    <p className="text-xs text-sky-100/50 max-w-xs leading-relaxed">Reviews will appear here after you complete exchanges with your neighbors.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div className="col-span-full space-y-8">
                <div className="flex items-center justify-between border-b border-sky-500/10 pb-6 mb-8">
                   <div className="space-y-1">
                      <h4 className="text-xl font-bold text-white uppercase tracking-tighter">Community Ledger</h4>
                      <p className="text-[10px] text-sky-100/20 font-bold uppercase tracking-[0.3em]">Cryptographically signed transaction history</p>
                   </div>
                   <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3">
                      <Wallet size={16} className="text-emerald-400" />
                      <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">${transactions.reduce((acc, tx) => acc + (tx.type === 'deposit' ? tx.amount : 0), 0).toFixed(2)} Escrowed</span>
                   </div>
                </div>

                {loadingTransactions ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-20 bg-sky-500/5 rounded-2xl animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {transactions.map((tx) => (
                      <div key={tx._id} className="glass-card hover:bg-sky-500/5 transition-all p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 border-sky-500/10 group">
                        <div className="flex items-center gap-6">
                           <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border ${
                             tx.type === 'deposit' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' : 
                             tx.type === 'refund' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                             'bg-rose-500/10 text-rose-400 border-rose-500/20'
                           }`}>
                             {tx.type === 'deposit' ? <ArrowRight size={24} /> : tx.type === 'refund' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
                           </div>
                           <div className="space-y-1">
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-bold text-white uppercase tracking-tight">{tx.type} Sequence</span>
                                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg ${
                                  tx.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-sky-500/20 text-sky-400'
                                }`}>{tx.status}</span>
                              </div>
                              <p className="text-[10px] text-sky-100/30 font-bold uppercase tracking-widest">
                                {new Date(tx.createdAt).toLocaleString()} • Ref: #{tx._id.slice(-8).toUpperCase()}
                              </p>
                           </div>
                        </div>

                        <div className="flex items-center justify-between md:justify-end gap-10">
                           <div className="text-right">
                              <p className="text-[9px] font-bold text-sky-100/20 uppercase tracking-[0.2em] mb-1">Impact Volume</p>
                              <p className={`text-xl font-black ${tx.type === 'refund' ? 'text-emerald-400' : 'text-white'}`}>
                                {tx.type === 'refund' ? '+' : '-'}${tx.amount.toFixed(2)}
                              </p>
                           </div>
                           <ChevronRight size={16} className="text-sky-100/10 group-hover:text-sky-400 group-hover:translate-x-1 transition-all md:block hidden" />
                        </div>
                      </div>
                    ))}
                    {transactions.length === 0 && (
                      <div className="py-24 flex flex-col items-center justify-center text-center glass-card border-dashed border-sky-500/10 bg-sky-500/5 min-h-[400px]">
                        <div className="w-20 h-20 bg-sky-500/10 border border-sky-500/20 rounded-3xl flex items-center justify-center text-sky-400 mb-6 group-hover:text-sky-400 transition-colors">
                          <History size={40} />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-sky-100/20 mb-2">Immutable Ledger Empty</p>
                          <p className="text-[11px] text-sky-100/10 font-medium italic">Your neighbors await your first coordination cycle.</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmationModal 
        show={confirmConfig.show}
        onClose={() => setConfirmConfig({ ...confirmConfig, show: false })}
        onConfirm={confirmConfig.onConfirm}
        title={confirmConfig.title}
        message={confirmConfig.message}
        variant="danger"
        confirmText="Confirm Deletion"
      />

      {/* Review Modal */}
      {reviewModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-[#020617]/80 backdrop-blur-xl" onClick={() => setReviewModal(null)} />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="glass-card relative z-10 w-full max-w-md p-10 border-sky-500/20 space-y-8"
          >
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-bold text-white uppercase tracking-tighter">Trust Review</h3>
              <p className="text-[10px] font-bold text-sky-100/40 uppercase tracking-[0.3em]">Rating neighbor: {reviewModal.targetName}</p>
              <p className="text-[10px] text-sky-400 font-bold uppercase italic mt-1">Resource: {reviewModal.itemTitle}</p>
            </div>

            <div className="flex flex-col items-center gap-6">
              <div className="flex gap-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button 
                    key={star}
                    onClick={() => setReviewRating(star)}
                    className={`transition-all hover:scale-125 ${star <= reviewRating ? 'text-yellow-500' : 'text-sky-100/10'}`}
                  >
                    <Star size={36} fill={star <= reviewRating ? "currentColor" : "none"} strokeWidth={1.5} />
                  </button>
                ))}
              </div>

              <textarea 
                value={reviewComment}
                onChange={e => setReviewComment(e.target.value)}
                placeholder="How was the exchange experience?"
                className="w-full bg-sky-500/5 border border-sky-500/10 rounded-2xl px-6 py-4 text-white font-medium focus:border-sky-500/40 outline-none transition-all min-h-[120px] text-sm"
              />

              <div className="flex gap-4 w-full">
                <button 
                  onClick={submitReview}
                  disabled={submittingReview}
                  className="flex-1 glass-button bg-sky-500 text-white border-transparent py-4 text-[10px] font-bold uppercase tracking-[0.2em] shadow-lg shadow-sky-500/20"
                >
                  {submittingReview ? 'LOGGING...' : 'Bridges Sealed'}
                </button>
                <button 
                  onClick={() => setReviewModal(null)}
                  className="px-6 glass-button bg-sky-500/5 text-sky-100/40 border-sky-500/10 py-4 text-[10px] font-bold uppercase tracking-[0.2em]"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
      {/* Modal Layers */}
      <ScannerModal 
        show={activeScanner.show}
        onClose={() => setActiveScanner({ ...activeScanner, show: false })}
        onScan={(val) => {
          if (activeScanner.type === 'handover') {
            handleVerifyHandover(activeScanner.requestId, val);
          } else {
            handleVerifyReturn(activeScanner.requestId, val);
          }
        }}
        title={activeScanner.type === 'handover' ? 'Verify Handover Sequence' : 'Finalize Return Cycle'}
      />

      <QRCodeModal 
        show={activeQRCode.show}
        onClose={() => setActiveQRCode({ ...activeQRCode, show: false })}
        value={activeQRCode.value}
        title={activeQRCode.title}
        subtitle={activeQRCode.subtitle}
      />
    </div>
  );
}
