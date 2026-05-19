import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useSearchParams } from 'react-router-dom';
import { Calendar, Search, MapPin, Tag, Filter, X, MessageSquare, Send, CheckCircle, Clock, Heart, Star, ChevronRight, Bookmark, Eye, User, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../SocketContext';
import LocationPicker from '../components/LocationPicker';
import { getDistance } from 'geolib';
import TrustBadge from '../components/TrustBadge';
import { getOptimizedImage } from '../lib/imageUtils';

interface Item {
  _id: string;
  title: string;
  description: string;
  type: 'share' | 'donate';
  category: string;
  condition: string;
  location: string;
  coordinates: { lat: number; lng: number };
  owner: {
    _id: string;
    name: string;
    rating: number;
    reviewCount?: number;
    avatar?: string;
    impactScore?: number;
  };
  images: string[];
  saveCount: number;
  views: number;
  reservations: Array<{ startDate: string; endDate: string; user: string }>;
  depositAmount?: number;
  status: string;
}

export default function Marketplace() {
  const { user, token, apiFetch, isOffline } = useAuth();
  const { socket } = useSocket();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<Item[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400); 
    return () => clearTimeout(timer);
  }, [search]);
  const [activeCategory, setActiveCategory] = useState(searchParams.get('category') || 'All Supplies');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'newest');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [radius, setRadius] = useState(searchParams.get('radius') || 'All');
  const [loading, setLoading] = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showLocationSelector, setShowLocationSelector] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number, lng: number, address?: string } | null>(
    searchParams.get('lat') && searchParams.get('lng') 
    ? { lat: parseFloat(searchParams.get('lat')!), lng: parseFloat(searchParams.get('lng')!), address: searchParams.get('addr') || 'Specified Location' } 
    : null
  );
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [requestMessage, setRequestMessage] = useState('');
  const [requestStatus, setRequestStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [saveFeedback, setSaveFeedback] = useState<{ id: string, title?: string, type: 'added' | 'removed' } | null>(null);
  const [reservationDates, setReservationDates] = useState({ start: '', end: '' });
  const [ownerReviews, setOwnerReviews] = useState<any[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ id: string, type: string } | null>(null);
  const [reportReason, setReportReason] = useState('inappropriate');
  const [reportDesc, setReportDesc] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reserving, setReserving] = useState(false);

  useEffect(() => {
    fetchItems(debouncedSearch);
    if (token) fetchSaved();
  }, [debouncedSearch, token, radius, userLocation, activeCategory, sortBy]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search.length > 1) {
        fetchSuggestions();
      } else {
        setSuggestions([]);
      }
    }, 300); // 300ms debounce
    
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    // Get user location for radius filtering if not already set by URL
    if (navigator.geolocation && !userLocation && !searchParams.get('lat')) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserLocation({ lat, lng, address: 'Current Location' });
        
        // Reverse geocoding for a nice label
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
          .then(res => res.json())
          .then(data => {
            setUserLocation(prev => prev ? { ...prev, address: data.display_name?.split(',')[0] || 'My Area' } : null);
          });
      });
    }
  }, []);

  useEffect(() => {
    if (socket) {
      const handleNewItem = (newItem: Item) => {
        setItems(prev => {
          // Prevent duplicates
          if (prev.some(item => item._id === newItem._id)) return prev;
          return [newItem, ...prev];
        });
      };

      const handleUpdateItem = (updatedItem: Item) => {
        setItems(prev => prev.map(item => item._id === updatedItem._id ? updatedItem : item));
        if (selectedItem?._id === updatedItem._id) {
          setSelectedItem(updatedItem);
        }
      };

      const handleDeleteItem = (deletedItemId: string) => {
        setItems(prev => prev.filter(item => item._id !== deletedItemId));
        if (selectedItem?._id === deletedItemId) {
          setSelectedItem(null);
          setSearchParams({});
        }
      };

      socket.on('new_item', handleNewItem);
      socket.on('item_updated', handleUpdateItem);
      socket.on('item_deleted', handleDeleteItem);

      return () => {
        socket.off('new_item', handleNewItem);
        socket.off('item_updated', handleUpdateItem);
        socket.off('item_deleted', handleDeleteItem);
      };
    }
  }, [socket, selectedItem]);

  useEffect(() => {
    const itemId = searchParams.get('id');
    if (itemId && items.length > 0) {
      const item = items.find(i => i._id === itemId);
      if (item) {
        setSelectedItem(item);
        setRequestStatus(null);
        setActiveImageIndex(0);
        fetchOwnerReviews(item.owner._id);
        incrementView(item._id);
      }
    }
  }, [searchParams, items]);

  const fetchOwnerReviews = async (userId: string) => {
    setLoadingReviews(true);
    try {
      const { ok, data } = await apiFetch(`/api/reviews/user/${userId}`);
      if (ok && Array.isArray(data)) {
        setOwnerReviews(data);
      } else {
        setOwnerReviews([]);
      }
    } catch (err) {
      console.error(err);
      setOwnerReviews([]);
    } finally {
      setLoadingReviews(false);
    }
  };

  const incrementView = async (itemId: string) => {
    try {
      const { ok, data } = await apiFetch(`/api/items/${itemId}/view`, { method: 'POST' });
      if (ok) {
        setItems(prev => Array.isArray(prev) ? prev.map(item => item._id === itemId ? { ...item, views: data.views } : item) : []);
        if (selectedItem?._id === itemId) {
          setSelectedItem(prev => prev ? { ...prev, views: data.views } : null);
        }
      }
    } catch (err) {
      console.error("View tracking error:", err);
    }
  };

  const calculateDistance = (itemCoords: { lat: number, lng: number }) => {
    if (!userLocation || !itemCoords) return null;
    try {
      const dist = getDistance(
        { latitude: userLocation.lat, longitude: userLocation.lng },
        { latitude: itemCoords.lat, longitude: itemCoords.lng }
      );
      return (dist / 1000).toFixed(1); // Return in km
    } catch (e) {
      return null;
    }
  };

  const handleReport = async () => {
    if (!reportTarget || !token) return;
    setSubmittingReport(true);
    try {
      const { ok } = await apiFetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          targetType: reportTarget.type,
          targetId: reportTarget.id,
          reason: reportReason,
          description: reportDesc
        })
      });
      if (ok) {
        setReportTarget(null);
        setReportDesc('');
        alert('Report submitted successfully. Our moderators will review it.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingReport(false);
    }
  };

  const fetchItems = async (searchTerm = debouncedSearch) => {
    setLoading(true);
    try {
      let url = `/api/items?q=${encodeURIComponent(searchTerm)}&sort=${sortBy}`;
      if (activeCategory !== 'All Supplies') {
        url += `&category=${encodeURIComponent(activeCategory)}`;
      }
      if (radius !== 'All' && userLocation) {
        url += `&lat=${userLocation.lat}&lng=${userLocation.lng}&radius=${radius}`;
      }
      
      const { data } = await apiFetch(url);
      if (Array.isArray(data)) {
        setItems(data);
      } else {
        setItems([]);
        console.error('Expected array of items, got:', data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuggestions = async () => {
    try {
      const { data } = await apiFetch(`/api/items/suggestions?q=${search}`);
      if (Array.isArray(data)) {
        setSuggestions(data);
      } else {
        setSuggestions([]);
      }
    } catch (err) {
      console.error(err);
      setSuggestions([]);
    }
  };

  const fetchSaved = async () => {
    try {
      const { ok, data } = await apiFetch('/api/items/saved');
      if (ok && Array.isArray(data)) {
        setSavedIds(data.map((i: any) => i._id));
      } else {
        setSavedIds([]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleSave = async (e: React.MouseEvent, itemId: string) => {
    e.stopPropagation();
    if (!token) return alert('Please login to save items');
    const itemToSave = items.find(i => i._id === itemId) || selectedItem;
    try {
      const { ok, data } = await apiFetch(`/api/items/${itemId}/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (ok) {
        setSavedIds(prev => {
          const isSaved = prev.includes(itemId);
          setSaveFeedback({ 
            id: itemId, 
            title: itemToSave?.title, 
            type: isSaved ? 'removed' : 'added' 
          });
          setTimeout(() => setSaveFeedback(null), 3000);
          return isSaved ? prev.filter(id => id !== itemId) : [...prev, itemId];
        });
        
        // Update saveCount locally
        setItems(prev => prev.map(item => 
          item._id === itemId 
            ? { ...item, saveCount: (item.saveCount || 0) + (data.saved ? 1 : -1) } 
            : item
        ));
        
        if (selectedItem?._id === itemId) {
          setSelectedItem(prev => prev ? { ...prev, saveCount: (prev.saveCount || 0) + (data.saved ? 1 : -1) } : null);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const [submittingRequest, setSubmittingRequest] = useState(false);

  const handleRequest = async () => {
    if (!token) return alert('Please login to request items');
    setSubmittingRequest(true);
    try {
      const { ok, data } = await apiFetch('/api/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ itemId: selectedItem?._id, message: requestMessage })
      });
      if (ok) {
        setRequestStatus({ type: 'success', msg: 'Request sent! Waiting for owner approval.' });
        setRequestMessage('');
      } else {
        setRequestStatus({ type: 'error', msg: data.error || 'Failed to send request' });
      }
    } catch (err) {
      setRequestStatus({ type: 'error', msg: 'Connection error' });
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleReserve = async () => {
    if (!token) return alert('Please login to reserve');
    if (!reservationDates.start || !reservationDates.end) return alert('Please select protocol dates');
    
    setReserving(true);
    try {
      const { ok, data } = await apiFetch('/api/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          itemId: selectedItem?._id, 
          message: `Requesting booking for ${reservationDates.start} to ${reservationDates.end}.`,
          borrowStartDate: reservationDates.start, 
          borrowEndDate: reservationDates.end 
        })
      });
      if (ok) {
        setRequestStatus({ type: 'success', msg: 'Booking request sent! Once approved, the timeframe will be locked.' });
        alert('Booking request sent successfully! Check your Activity Hub for updates.');
      } else {
        alert(data.error || 'Booking request failed');
      }
    } catch (err) {
      console.error(err);
      alert('Network error while requesting booking');
    } finally {
      setReserving(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      const { ok, data } = await apiFetch(`/api/items/${itemId}`, {
        method: 'DELETE'
      });
      if (ok) {
        setItems(prev => prev.filter(i => i._id !== itemId));
        setSelectedItem(null);
        setSearchParams({});
      } else {
        alert(data.error || 'Failed to delete item');
      }
    } catch (err) {
      console.error(err);
      alert('Connection error');
    }
  };

  return (
    <div className="space-y-16 pb-20">
      {/* Header & Filter */}
      <div className="glass-card p-6 md:p-8 flex flex-col xl:flex-row xl:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-80 h-80 bg-sky-500/10 rounded-full blur-[120px] -ml-40 -mt-40 pointer-events-none" />
        <div className="space-y-1 relative z-10 text-center md:text-left shrink-0">
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-white leading-tight uppercase">Goods Grid</h1>
          <p className="text-[10px] text-sky-100/30 uppercase tracking-[0.4em] font-bold">Synchronizing local assets</p>
        </div>
        
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4 relative z-10 w-full xl:w-auto flex-1 xl:justify-end">
          <div className="relative group flex-1 max-w-xl">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-sky-100/20 group-focus-within:text-sky-400 transition-all" size={18} />
            <input 
              type="text" 
              placeholder="Query neighborhood nodes..." 
              className="input-field pl-14"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            />
            
            <AnimatePresence>
              {showSuggestions && suggestions.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute left-0 right-0 top-full mt-3 bg-slate-950/90 backdrop-blur-2xl border border-sky-500/20 rounded-3xl overflow-hidden shadow-2xl z-50 shadow-black/40"
                >
                  {suggestions.map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        if (s.type === 'category') {
                          setSearch(s.text);
                        } else {
                          setSearch(s.text);
                          setSearchParams({ id: s.id });
                        }
                        setShowSuggestions(false);
                      }}
                      className="w-full text-left px-7 py-4 hover:bg-sky-500/10 flex items-center justify-between group transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 bg-sky-500/10 rounded-xl flex items-center justify-center text-sky-400 group-hover:bg-sky-500 group-hover:text-white transition-all">
                          {s.type === 'category' ? <Tag size={14} /> : <Search size={14} />}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-white group-hover:text-sky-400 uppercase tracking-tight">{s.text}</span>
                          <span className="text-[9px] uppercase tracking-widest text-sky-100/20 font-bold">
                            {s.type === 'category' ? 'Protocol Category' : s.category}
                          </span>
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-sky-100/10 group-hover:text-sky-400 group-hover:translate-x-1 transition-all" />
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch gap-3">
            <button 
              onClick={() => setShowLocationSelector(true)}
              className="flex-1 min-w-[180px] bg-sky-500/5 backdrop-blur-md border border-sky-500/10 rounded-2xl pl-12 pr-5 py-4 text-[11px] font-black text-sky-400 outline-none hover:bg-sky-500/10 transition-all cursor-pointer text-left truncate uppercase tracking-[0.2em] relative"
            >
              <MapPin size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-sky-500" />
              {userLocation?.address || 'Calibrate Pos'}
            </button>
            
            <div className="relative">
              <select 
                value={radius}
                onChange={(e) => {
                  setRadius(e.target.value);
                  setSearchParams(prev => {
                    if (e.target.value === 'All') prev.delete('radius');
                    else prev.set('radius', e.target.value);
                    return prev;
                  });
                }}
                className="appearance-none bg-sky-500/10 backdrop-blur-md border border-sky-500/10 rounded-2xl px-8 py-4 text-[11px] font-black text-sky-400 outline-none focus:ring-4 focus:ring-sky-500/5 transition-all cursor-pointer shadow-inner uppercase tracking-[0.2em] w-full"
              >
                <option value="All" className="bg-slate-900">Global</option>
                <option value="1" className="bg-slate-900">1km</option>
                <option value="2" className="bg-slate-900">2km</option>
                <option value="5" className="bg-slate-900">5km</option>
                <option value="10" className="bg-slate-900">10km</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/map" className="bg-sky-500 hover:bg-sky-400 text-white p-4 rounded-2xl transition-all shadow-lg shadow-sky-500/20 active:scale-95 group">
              <MapPin size={20} className="group-hover:scale-110 transition-transform" />
            </Link>
            <div className="bg-sky-500/5 border border-sky-500/10 rounded-2xl px-6 py-4 flex items-center gap-3">
              <Filter size={16} className="text-sky-500" />
              <select 
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setSearchParams(prev => {
                    prev.set('sort', e.target.value);
                    return prev;
                  });
                }}
                className="bg-transparent outline-none font-black uppercase tracking-[0.2em] text-[10px] cursor-pointer text-sky-100/40 hover:text-sky-400 transition-colors"
              >
                <option value="newest" className="bg-slate-900">Latest</option>
                <option value="popular" className="bg-slate-900">Trend</option>
                <option value="saved" className="bg-slate-900">Saved</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar">
        {['All Supplies', 'Power Tools', 'Kitchenware', 'Outdoors', 'Books', 'Electronics', 'Garden', 'Furniture', 'Sports'].map(cat => (
          <button 
            key={cat} 
            onClick={() => {
              setActiveCategory(cat);
              setSearchParams(prev => {
                if (cat === 'All Supplies') prev.delete('category');
                else prev.set('category', cat);
                return prev;
              });
            }}
            className={`whitespace-nowrap px-8 py-3 rounded-2xl border transition-all text-[10px] font-black uppercase tracking-[0.3em] active:scale-95 ${
              activeCategory === cat 
              ? 'bg-sky-500 border-sky-500 text-white shadow-[0_8px_30px_rgba(14,165,233,0.3)]' 
              : 'bg-sky-500/5 border-sky-500/10 text-sky-100/30 hover:border-sky-500/30 hover:text-sky-400 hover:bg-sky-500/10'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="glass-card p-0 overflow-hidden h-[450px] flex flex-col animate-pulse border-white/30">
              <div className="h-60 bg-slate-200/40" />
              <div className="p-8 flex-1 space-y-5">
                <div className="h-5 w-3/4 bg-slate-200/40 rounded-xl" />
                <div className="h-4 w-1/2 bg-slate-200/30 rounded-xl" />
                <div className="mt-auto h-12 w-full bg-slate-200/20 rounded-2xl" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
          {Array.isArray(items) && items.length > 0 ? (
            items.map((item, idx) => (
              <motion.div
                key={item._id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => { 
                  setSelectedItem(item); 
                  setRequestStatus(null); 
                  setActiveImageIndex(0);
                  setSearchParams({ id: item._id });
                  incrementView(item._id);
                }}
                className="glass-card group p-0 overflow-hidden cursor-pointer hover:-translate-y-3 hover:shadow-2xl hover:shadow-sky-500/10 border-sky-500/10"
              >
                <div className="h-64 bg-slate-950 relative overflow-hidden">
                  {item.images?.[0] ? (
                     <img 
                      src={getOptimizedImage(item.images[0])} 
                      alt={item.title} 
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-[1.5s]" 
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sky-100/10">
                      <Tag size={64} strokeWidth={1} />
                    </div>
                  )}
                  <div className="absolute top-5 left-5 flex flex-col gap-2">
                    <span className={`status-badge px-4 py-1.5 ${
                      item.type === 'donate' 
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                      : 'bg-sky-500/20 text-sky-400 border-sky-500/30'
                    }`}>
                      {item.type}
                    </span>
                    {item.status !== 'available' && (
                      <span className="status-badge px-4 py-1.5 bg-rose-500/20 text-rose-400 border-rose-500/30">
                        {item.status}
                      </span>
                    )}
                    <span className="px-3 py-1 bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-lg text-[8px] font-bold uppercase tracking-widest text-sky-200/60">
                      {item.condition || 'Gently Used'}
                    </span>
                  </div>
                  <div className="absolute top-5 right-5 flex flex-col gap-2">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!token) return alert('Login to report');
                        setReportTarget({ id: item._id, type: 'item' });
                      }}
                      className="p-3 rounded-2xl bg-slate-900/40 backdrop-blur-xl text-white/40 border border-white/10 hover:text-rose-400 hover:border-rose-400/30 transition-all"
                      title="Report Item"
                    >
                      <ShieldAlert size={16} />
                    </button>
                    <button 
                      onClick={(e) => toggleSave(e, item._id)}
                      className={`p-3 rounded-2xl backdrop-blur-xl border transition-all ${
                        savedIds.includes(item._id) 
                        ? 'bg-rose-500 text-white border-rose-400 shadow-lg shadow-rose-500/20' 
                        : 'bg-sky-500/10 text-white border-sky-500/20 hover:bg-sky-500/30'
                      }`}
                    >
                      <Heart size={16} fill={savedIds.includes(item._id) ? "currentColor" : "none"} />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedItem(item);
                        setSearchParams({ id: item._id });
                      }}
                      className="p-3 rounded-2xl bg-sky-500/10 backdrop-blur-xl text-white/40 border border-sky-500/20 hover:text-sky-400 hover:border-sky-400/30 transition-all"
                      title="Protocol Reservation"
                    >
                      <Calendar size={16} />
                    </button>
                  </div>
                </div>
                
                <div className="p-8 flex flex-col flex-1">
                  <div className="flex items-center gap-2 mb-3">
                     <Tag size={12} className="text-sky-400" />
                     <span className="text-[10px] font-bold text-sky-100/30 uppercase tracking-[0.2em]">{item.category}</span>
                  </div>
                  <h3 className="text-xl font-bold text-white leading-tight mb-3 group-hover:text-sky-400 transition-colors uppercase tracking-tight line-clamp-1">{item.title}</h3>
                  
                  <div className="mt-auto pt-8 border-t border-sky-500/10 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <MapPin size={12} className="text-sky-100/30" />
                      <span className="text-[10px] font-bold text-sky-100/40 uppercase tracking-widest">
                        {item.location} {calculateDistance(item.coordinates) && `• ${calculateDistance(item.coordinates)}km`}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <TrustBadge score={item.owner?.trustScore || 500} />
                      {(item.owner?.impactScore || 0) > 0 && (
                        <div className="text-emerald-400 font-bold text-[10px] bg-emerald-500/5 px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 border border-emerald-500/10">
                          <Star size={10} fill="currentColor" /> {item.owner.impactScore}
                        </div>
                      )}
                      {(item.saveCount || 0) > 0 && (
                        <div className="text-rose-400 font-bold text-[10px] bg-rose-500/5 px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 border border-rose-500/10">
                           <Heart size={10} fill="currentColor" /> {item.saveCount}
                        </div>
                      )}
                      {(item.views || 0) > 0 && (
                        <div className="text-sky-100/30 font-bold text-[10px] bg-white/5 px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 border border-white/5">
                           <Eye size={10} /> {item.views}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="col-span-full py-32 flex flex-col items-center justify-center text-center w-full">
              <div className="w-24 h-24 bg-sky-500/5 rounded-[2.5rem] flex items-center justify-center mb-8 border border-sky-500/10">
                {isOffline ? <ShieldAlert size={40} className="text-amber-400" /> : <Tag size={40} className="text-sky-100/20" />}
              </div>
              <h3 className="text-2xl font-bold text-white uppercase tracking-tighter mb-4">
                {isOffline ? 'Sync in Progress' : 'No Nodes Found'}
              </h3>
              <p className="text-sky-100/30 text-sm max-w-md uppercase tracking-widest leading-loose">
                {isOffline 
                  ? 'The local resource ledger is currently synchronizing with the community network. Browse mode is active, but some items may be temporarily hidden.'
                  : 'Your neighborhood network is currently clear. Be the first to list a resource and start the loop.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Item Modal */}
      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setSelectedItem(null);
                setSearchParams({});
              }}
              className="absolute inset-0 bg-[#020617]/80 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="glass-card relative z-10 w-full max-w-6xl max-h-[90vh] md:max-h-[92vh] overflow-hidden flex flex-col md:flex-row shadow-[0_0_120px_rgba(56, 189, 248, 0.15)] border-sky-500/20"
            >
              <button 
                onClick={() => {
                  setSelectedItem(null);
                  setSearchParams({});
                }}
                className="absolute top-4 right-4 md:top-8 md:right-8 z-30 w-10 h-10 md:w-12 md:h-12 bg-sky-500/20 hover:bg-sky-500/30 text-white rounded-xl md:rounded-2xl flex items-center justify-center transition-all backdrop-blur-2xl border border-sky-500/40 hover:scale-110 active:scale-95 shadow-xl"
              >
                <X size={20} />
              </button>

              <div className="w-full md:w-1/2 h-64 sm:h-80 md:h-auto bg-slate-950 relative overflow-hidden shrink-0 group/gallery">
                {selectedItem.images?.length ? (
                  <>
                    <img 
                      src={getOptimizedImage(selectedItem.images[activeImageIndex], 1000)} 
                      alt={selectedItem.title} 
                      className="w-full h-full object-cover transition-all duration-500" 
                      referrerPolicy="no-referrer" 
                    />
                    
                    {selectedItem.images.length > 1 && (
                      <>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveImageIndex(prev => prev === 0 ? selectedItem.images.length - 1 : prev - 1);
                          }}
                          className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-slate-950/40 backdrop-blur-md rounded-full flex items-center justify-center text-white opacity-0 group-hover/gallery:opacity-100 transition-opacity border border-white/10 hover:bg-sky-500/40"
                        >
                          <ChevronRight className="rotate-180" size={20} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveImageIndex(prev => prev === selectedItem.images.length - 1 ? 0 : prev + 1);
                          }}
                          className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-slate-950/40 backdrop-blur-md rounded-full flex items-center justify-center text-white opacity-0 group-hover/gallery:opacity-100 transition-opacity border border-white/10 hover:bg-sky-500/40"
                        >
                          <ChevronRight size={20} />
                        </button>
                        
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5 px-3 py-1.5 bg-slate-950/40 backdrop-blur-md rounded-full border border-white/10">
                          {selectedItem.images.map((_, i) => (
                            <div 
                              key={i} 
                              className={`w-1.5 h-1.5 rounded-full transition-all ${i === activeImageIndex ? 'bg-sky-400 w-4' : 'bg-white/30'}`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sky-100/10">
                    <Tag size={120} strokeWidth={1} />
                  </div>
                )}
                
                <div className="absolute top-6 left-6 z-20">
                  <div className="px-4 py-2 md:px-6 md:py-3 bg-sky-500/20 backdrop-blur-3xl border border-sky-500/40 rounded-xl md:rounded-2xl text-white text-[9px] md:text-[11px] font-bold uppercase tracking-[0.3em] shadow-2xl">
                    Verified Resource
                  </div>
                </div>
              </div>

              <div className="w-full md:w-1/2 p-8 sm:p-12 md:p-20 overflow-y-auto space-y-8 md:space-y-12 flex flex-col bg-slate-950/60">
                <div className="space-y-4 md:space-y-6">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex gap-2">
                      <span className="text-[9px] md:text-[11px] font-bold text-sky-400 uppercase tracking-[0.3em] bg-sky-500/5 px-4 py-2 rounded-xl md:rounded-2xl border border-sky-500/10">
                        {selectedItem.category} • {selectedItem.type}
                      </span>
                      <span className="text-[9px] md:text-[11px] font-bold text-sky-100/40 uppercase tracking-[0.1em] bg-white/5 px-4 py-2 rounded-xl md:rounded-2xl border border-white/10">
                        Condition: {selectedItem.condition || 'Gently Used'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-yellow-500 font-bold text-xs md:text-sm bg-yellow-500/5 px-4 py-2 rounded-xl md:rounded-2xl border border-yellow-500/10">
                      <Star size={14} className="md:w-4 md:h-4" fill="currentColor" /> {selectedItem.owner.rating && (selectedItem.owner as any).reviewCount > 0 ? selectedItem.owner.rating : 'New Neighbor'}
                    </div>
                    <div className="flex items-center gap-2 text-rose-400 font-bold text-xs md:text-sm bg-rose-500/5 px-4 py-2 rounded-xl md:rounded-2xl border border-rose-500/10">
                      <Heart size={14} className="md:w-4 md:h-4" fill="currentColor" /> {selectedItem.saveCount || 0} Saves
                    </div>
                    <div className="flex items-center gap-2 text-sky-100/40 font-bold text-xs md:text-sm bg-white/5 px-4 py-2 rounded-xl md:rounded-2xl border border-white/5">
                      <Eye size={14} className="md:w-4 md:h-4" /> {selectedItem.views || 0} Views
                    </div>
                  </div>
                  <h2 className="text-3xl md:text-5xl font-bold text-white leading-[1.1] uppercase tracking-tighter">{selectedItem.title}</h2>
                  <div className="flex items-center gap-3 text-sky-100/40 font-bold text-[10px] md:text-xs uppercase tracking-[0.2em]">
                    <MapPin size={16} className="text-sky-400 md:w-[18px] md:h-[18px]" />
                    {selectedItem.location} {calculateDistance(selectedItem.coordinates) && `• ${calculateDistance(selectedItem.coordinates)}km away`}
                  </div>
                </div>

                <div className="p-6 md:p-8 bg-sky-500/5 rounded-[2rem] md:rounded-[2.5rem] border border-sky-500/10 space-y-3 md:space-y-4 shadow-inner">
                  <h4 className="text-[9px] font-bold uppercase tracking-[0.3em] text-sky-100/30">Owner's Narrative</h4>
                  <p className="text-sky-100/60 leading-relaxed font-medium text-base md:text-lg italic pr-4">"{selectedItem.description || "A versatile resource waiting to be shared with the right neighbor."}"</p>
                </div>

                <div className="flex items-center gap-4 md:gap-6 py-6 md:py-10 border-y border-sky-500/10">
                  <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-sky-900 to-sky-950 rounded-2xl md:rounded-3xl flex items-center justify-center text-sky-400 font-bold text-xl md:text-2xl uppercase shadow-inner border border-sky-500/20 overflow-hidden">
                    {selectedItem.owner?.avatar ? (
                      <img src={selectedItem.owner.avatar} alt={selectedItem.owner.name} className="w-full h-full object-cover" />
                    ) : (
                      selectedItem.owner?.name?.[0] || '?'
                    )}
                  </div>
                  <div>
                    <h5 className="text-lg md:text-xl font-bold text-white">{selectedItem.owner?.name || 'Unknown Neighbor'}</h5>
                    <div className="flex items-center gap-3">
                      <p className="text-[9px] md:text-[10px] text-sky-100/30 font-bold uppercase tracking-[0.3em]">Ambassador of sharing</p>
                      <div className="h-1 w-1 rounded-full bg-sky-500/30" />
                      <p className="text-[9px] md:text-[10px] text-sky-400 font-bold uppercase tracking-[0.3em]">Impact Score: {selectedItem.owner?.impactScore || 0}</p>
                    </div>
                  </div>
                </div>

                {selectedItem.type === 'share' ? (
                  <div className="p-6 md:p-8 bg-sky-500/5 rounded-[2rem] border border-sky-500/10 space-y-6">
                    <h4 className="text-[9px] font-bold uppercase tracking-[0.4em] text-sky-400 flex items-center gap-3">
                      <Clock size={16} /> Availability Log
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[8px] uppercase tracking-widest text-sky-100/30 font-bold">Start Sequence</label>
                        <input 
                          type="date" 
                          className="w-full bg-slate-900/60 border border-sky-500/20 rounded-xl p-3 text-xs text-white outline-none focus:ring-2 focus:ring-sky-500/30"
                          value={reservationDates.start}
                          onChange={e => setReservationDates({...reservationDates, start: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[8px] uppercase tracking-widest text-sky-100/30 font-bold">End Sequence</label>
                        <input 
                          type="date" 
                          className="w-full bg-slate-900/60 border border-sky-500/20 rounded-xl p-3 text-xs text-white outline-none focus:ring-2 focus:ring-sky-500/30"
                          value={reservationDates.end}
                          onChange={e => setReservationDates({...reservationDates, end: e.target.value})}
                        />
                      </div>
                    </div>

                    {selectedItem.depositAmount > 0 && (
                      <div className="p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-[2rem] space-y-4 shadow-lg shadow-emerald-500/10 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />
                        <div className="flex items-center justify-between relative z-10">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 border border-emerald-500/20 group-hover:scale-110 transition-transform">
                              <ShieldCheck size={24} />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.3em]">Neural Escrow Protocol</span>
                              <span className="text-sm font-black text-white uppercase tracking-tight">Refundable Security Deposit</span>
                            </div>
                          </div>
                          <div className="text-right">
                             <div className="text-3xl font-black text-emerald-400 tracking-tighter">${selectedItem.depositAmount}</div>
                             <div className="text-[8px] font-bold text-emerald-400/50 uppercase tracking-widest">Released instantly</div>
                          </div>
                        </div>
                        <p className="text-[10px] text-emerald-100/40 font-medium leading-relaxed italic relative z-10 border-t border-emerald-500/10 pt-3">
                          This amount remains in your local escrow and is automatically returned to your ledger upon completed return verification.
                        </p>
                      </div>
                    )}

                    {selectedItem.reservations?.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-[8px] uppercase tracking-widest text-rose-400/50 font-bold">Active Loan Cycles:</p>
                        <div className="space-y-2">
                          {selectedItem.reservations.map((res, i) => (
                            <div key={i} className="flex items-center justify-between text-[10px] bg-rose-500/5 border border-rose-500/10 p-3 rounded-xl">
                              <span className="text-rose-200/60 font-bold tracking-tight">Node Occupied</span>
                              <span className="text-rose-400 font-mono">{new Date(res.startDate).toLocaleDateString()} - {new Date(res.endDate).toLocaleDateString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <button 
                      onClick={handleReserve}
                      disabled={reserving}
                      className="w-full py-4 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {reserving ? 'Processing Protocol...' : 'Book Availability Slot'}
                    </button>
                  </div>
                ) : (
                  <div className="p-6 md:p-8 bg-emerald-500/5 rounded-[2rem] border border-emerald-500/10 space-y-4">
                    <h4 className="text-[9px] font-bold uppercase tracking-[0.4em] text-emerald-400 flex items-center gap-3">
                      <Tag size={16} /> Gift Protocol
                    </h4>
                    <p className="text-[11px] text-sky-100/40 uppercase tracking-widest leading-relaxed">
                      This resource is offered for permanent coordinate shift. Once claimed, the neighbor node will transfer ownership entirely.
                    </p>
                    <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3">
                      <ShieldCheck size={14} className="text-emerald-400" />
                      <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Bypassing security deposit protocols - 100% Free</span>
                    </div>
                  </div>
                )}

                <div className="mt-8 md:mt-auto space-y-6 pt-6">
                  <div className="flex gap-4 pt-4">
                    <div className="flex flex-col sm:flex-row gap-4 mb-4 flex-1">
                      {!requestStatus && (
                        <div className="flex flex-col sm:flex-row gap-4 w-full">
                          <button 
                            onClick={(e) => toggleSave(e, selectedItem._id)}
                            className={`flex-1 py-6 rounded-[1.5rem] md:rounded-[2rem] font-bold text-sm uppercase tracking-[0.2em] transition-all border flex items-center justify-center gap-3 ${
                              savedIds.includes(selectedItem._id)
                              ? 'bg-rose-500 text-white border-rose-400 shadow-xl shadow-rose-500/20'
                              : 'bg-sky-500/10 text-sky-400 border-sky-500/20 hover:bg-sky-500/20'
                            }`}
                          >
                            <Heart size={18} fill={savedIds.includes(selectedItem._id) ? "currentColor" : "none"} />
                            {savedIds.includes(selectedItem._id) ? 'Saved to Profile' : 'Save Resource'}
                          </button>
                          <button 
                            onClick={() => {
                              if (!token) return alert('Login to report');
                              setReportTarget({ id: selectedItem._id, type: 'item' });
                            }}
                            className="px-8 py-6 rounded-[1.5rem] md:rounded-[2rem] font-bold text-sky-100/30 border border-white/5 hover:bg-rose-500/10 hover:text-rose-400 transition-all flex items-center justify-center gap-3"
                          >
                            <ShieldAlert size={18} />
                            <span className="sm:hidden lg:inline">Report</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Reviews Section */}
                  <div className="space-y-6 pt-6 border-t border-sky-500/10">
                    <h4 className="text-[10px] font-bold uppercase tracking-[0.4em] text-sky-400 flex items-center gap-2">
                       <Star size={16} /> Neighbor Testimonials
                    </h4>
                    
                    {loadingReviews ? (
                      <div className="space-y-4">
                        {[1, 2].map(i => (
                          <div key={i} className="h-24 bg-sky-500/5 rounded-2xl animate-pulse" />
                        ))}
                      </div>
                    ) : ownerReviews.length > 0 ? (
                      <div className="space-y-4">
                        {ownerReviews.slice(0, 3).map((review) => (
                          <div key={review._id} className="p-6 bg-sky-500/5 rounded-2xl border border-sky-500/10 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-sky-500/20 flex items-center justify-center text-sky-400 text-[10px] font-bold border border-sky-500/20 overflow-hidden">
                                  {review.from?.avatar ? (
                                    <img src={review.from.avatar} alt={review.from.name} className="w-full h-full object-cover" />
                                  ) : review.from?.name?.[0] || '?'}
                                </div>
                                <span className="text-xs font-bold text-white/80">{review.from?.name || 'Neighbor'}</span>
                              </div>
                              <div className="flex gap-0.5">
                                {[1,2,3,4,5].map(s => (
                                  <Star key={s} size={10} className={s <= review.rating ? "text-yellow-500" : "text-white/10"} fill={s <= review.rating ? "currentColor" : "none"} />
                                ))}
                              </div>
                            </div>
                            <p className="text-xs text-sky-100/40 leading-relaxed italic">"{review.comment}"</p>
                          </div>
                        ))}
                        {ownerReviews.length > 3 && (
                          <p className="text-center text-[9px] font-bold uppercase tracking-widest text-sky-400/50">+ {ownerReviews.length - 3} more reviews on profile</p>
                        )}
                      </div>
                    ) : (
                      <div className="p-10 bg-sky-500/5 rounded-3xl border border-dashed border-sky-500/20 text-center">
                        <p className="text-[10px] font-bold text-sky-100/20 uppercase tracking-widest italic">No session feedback yet</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-8 md:mt-auto space-y-6 pt-6">
                    {selectedItem.owner._id === user?.id && (
                      <button 
                        onClick={() => {
                          if (window.confirm("Are you sure you want to decommission this resource?")) {
                            handleDeleteItem(selectedItem._id);
                          }
                        }}
                        className="w-full bg-rose-500/10 text-rose-400 py-6 rounded-[1.5rem] md:rounded-[2rem] font-bold text-sm uppercase tracking-[0.2em] md:tracking-[0.3em] hover:bg-rose-500 hover:text-white transition-all border border-rose-500/20 mb-4"
                      >
                        Decommission Node
                      </button>
                    )}
                    
                    {selectedItem.owner._id === user?.id ? (
                      <div className="p-8 rounded-[2rem] bg-sky-500/5 border border-dashed border-sky-500/20 text-center space-y-4 shadow-inner backdrop-blur-sm">
                        <div className="w-12 h-12 bg-sky-500/10 rounded-2xl flex items-center justify-center mx-auto text-sky-400">
                          <User size={20} />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-white uppercase tracking-tight">Your Resource Node</p>
                          <p className="text-[10px] text-sky-100/40 uppercase tracking-widest font-medium">You are the current authority over this item.</p>
                        </div>
                        <div className="pt-4 flex flex-col sm:flex-row gap-3">
                          <Link 
                            to="/profile" 
                            className="flex-1 py-4 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-sky-500/20 transition-all text-center"
                            onClick={() => setSelectedItem(null)}
                          >
                            Manage in Profile
                          </Link>
                          <button 
                            onClick={() => {
                              if (window.confirm("Are you sure you want to decommission this resource?")) {
                                handleDeleteItem(selectedItem._id);
                              }
                            }}
                            className="flex-1 py-4 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all font-sans"
                          >
                            Decommission
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {!requestStatus ? (
                          <>
                            <textarea 
                              placeholder="Introduce yourself to your neighbor..."
                              className="w-full bg-sky-500/5 border border-sky-500/20 rounded-[1.5rem] md:rounded-[2rem] p-6 md:p-8 text-sm font-medium focus:ring-4 focus:ring-sky-500/10 outline-none transition-all h-32 md:h-40 resize-none shadow-inner text-white placeholder:text-sky-100/20"
                              value={requestMessage}
                              onChange={(e) => setRequestMessage(e.target.value)}
                            />
                            <button 
                              onClick={handleRequest}
                              disabled={!requestMessage.trim() || submittingRequest}
                              className="w-full bg-sky-500 text-white py-5 md:py-6 rounded-[1.5rem] md:rounded-[2rem] font-bold text-sm uppercase tracking-[0.2em] md:tracking-[0.3em] hover:bg-sky-600 transition-all shadow-2xl shadow-sky-500/40 hover:-translate-y-1 disabled:opacity-50"
                            >
                              {submittingRequest ? 'Broadcasting...' : `Initiate ${selectedItem.type}`}
                            </button>
                          </>
                        ) : (
                          <div className={`p-8 rounded-[1.5rem] md:rounded-[2rem] flex flex-col items-center text-center gap-4 ${requestStatus.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                            {requestStatus.type === 'success' ? <CheckCircle size={40} className="md:w-12 md:h-12 mb-2" /> : <X size={40} className="md:w-12 md:h-12 mb-2" />}
                            <p className="font-bold uppercase tracking-[0.1em] text-sm md:text-base">{requestStatus.msg}</p>
                            {requestStatus.type === 'success' && <p className="text-[10px] md:text-xs font-medium opacity-80">We'll notify you as soon as the owner approves.</p>}
                          </div>
                        )}
                      </>
                    )}
                  <p className="text-center text-[9px] md:text-[10px] text-sky-100/30 font-bold uppercase tracking-[0.4em] pt-4 flex items-center justify-center gap-2">
                    <Clock size={12} className="text-sky-400" /> Secure neighbors match protocol
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
        )}
      </AnimatePresence>

      {/* Global Toast Notification */}
      <AnimatePresence>
        {saveFeedback && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9, x: 50 }}
            animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20, transition: { duration: 0.2 } }}
            className="fixed bottom-8 right-8 z-[200] flex items-center gap-4 bg-slate-900/90 backdrop-blur-2xl border border-sky-500/30 p-5 rounded-3xl shadow-2xl shadow-sky-500/20 max-w-sm"
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${saveFeedback.type === 'added' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'} border border-white/10`}>
              {saveFeedback.type === 'added' ? <Bookmark size={20} fill="currentColor" /> : <X size={20} />}
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-400 mb-1">
                {saveFeedback.type === 'added' ? 'Resource Saved' : 'Removed from Saved'}
              </p>
              <p className="text-sm font-bold text-white line-clamp-1">
                {saveFeedback.title || 'Item'}
              </p>
            </div>
            <button 
              onClick={() => setSaveFeedback(null)}
              className="text-sky-100/30 hover:text-white p-2 transition-colors"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Report Modal */}
      <AnimatePresence>
        {reportTarget && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setReportTarget(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="glass-card relative z-10 w-full max-w-md p-10 border-rose-500/20 space-y-8"
            >
              <div className="text-center space-y-2">
                <ShieldAlert size={48} className="mx-auto text-rose-500 mb-4" />
                <h3 className="text-2xl font-bold text-white uppercase tracking-tighter">Content Moderation</h3>
                <p className="text-[10px] font-bold text-sky-100/40 uppercase tracking-[0.3em]">Reporting {reportTarget.type}: {reportTarget.id.slice(-6)}</p>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-sky-100/30 px-2">Reason for report</label>
                  <select 
                    value={reportReason}
                    onChange={e => setReportReason(e.target.value)}
                    className="w-full bg-sky-500/5 border border-sky-500/10 rounded-2xl px-6 py-4 text-white font-medium outline-none focus:border-rose-500/40 transition-all text-sm appearance-none"
                  >
                    <option value="inappropriate" className="bg-slate-900">Inappropriate content</option>
                    <option value="spam" className="bg-slate-900">Spam or misleading</option>
                    <option value="scam" className="bg-slate-900">Possible scam / fraud</option>
                    <option value="offensive" className="bg-slate-900">Offensive language/media</option>
                    <option value="other" className="bg-slate-900">Other reasons</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-sky-100/30 px-2">Additional Details</label>
                  <textarea 
                    value={reportDesc}
                    onChange={e => setReportDesc(e.target.value)}
                    placeholder="Provide more context..."
                    className="w-full bg-sky-500/5 border border-sky-500/10 rounded-2xl px-6 py-4 text-white font-medium focus:border-rose-500/40 outline-none transition-all min-h-[120px] text-sm"
                  />
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={handleReport}
                    disabled={submittingReport}
                    className="flex-1 glass-button bg-rose-500 text-white border-transparent py-4 text-[10px] font-bold uppercase tracking-[0.2em] shadow-lg shadow-rose-500/20"
                  >
                    {submittingReport ? 'SUBMITTING...' : 'Submit Report'}
                  </button>
                  <button 
                    onClick={() => setReportTarget(null)}
                    className="px-6 glass-button bg-sky-500/5 text-sky-100/40 border-sky-500/10 py-4 text-[10px] font-bold uppercase tracking-[0.2em]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Location Selector Modal */}
      <AnimatePresence>
        {showLocationSelector && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLocationSelector(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="glass-card relative z-10 w-full max-w-xl p-8 md:p-10 border-sky-500/20 space-y-8"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-2xl font-bold text-white uppercase tracking-tighter">Set Search Anchor</h3>
                  <p className="text-[10px] font-bold text-sky-100/40 uppercase tracking-[0.3em]">Define your neighborhood coordinates</p>
                </div>
                <button 
                  onClick={() => setShowLocationSelector(false)}
                  className="text-sky-100/30 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <LocationPicker 
                onLocationSelect={(lat, lng, addr) => {
                  const cleanedAddr = addr.split(',')[0];
                  setUserLocation({ lat, lng, address: cleanedAddr });
                  setSearchParams(prev => {
                    prev.set('lat', lat.toString());
                    prev.set('lng', lng.toString());
                    prev.set('addr', cleanedAddr);
                    return prev;
                  });
                }}
                initialLat={userLocation?.lat}
                initialLng={userLocation?.lng}
              />

              <div className="pt-4">
                <button 
                  onClick={() => setShowLocationSelector(false)}
                  className="w-full glass-button bg-sky-500 text-white border-transparent py-5 text-[10px] font-bold uppercase tracking-[0.3em] shadow-lg shadow-sky-500/20"
                >
                  Apply Coordinates
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
