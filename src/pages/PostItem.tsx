import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { Camera, MapPin, Tag, Package, ChevronRight, Check, X, Clock, ShieldAlert, Navigation } from 'lucide-react';
import { safeFetch } from '../lib/api';
import LocationPicker from '../components/LocationPicker';

const CATEGORIES = ['Power Tools', 'Kitchenware', 'Outdoors', 'Books', 'Electronics', 'Garden', 'Furniture', 'Sports'];

export default function PostItem() {
  const { user, apiFetch } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const itemId = searchParams.get('id');
  
  const [step, setStep] = useState(1);
  const [loadingItem, setLoadingItem] = useState(!!itemId);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    type: 'share',
    location: '',
    coordinates: { lat: 0, lng: 0 },
    condition: 'Gently Used',
    keywords: '',
    images: [] as string[],
    expiresInDays: '30', // Default 30 days
    value: '',
    depositAmount: '',
    maxBorrowDuration: '7'
  });

  useEffect(() => {
    if (itemId && user) {
      fetchItemDetails();
    }
  }, [itemId, user]);

  const fetchItemDetails = async () => {
    setLoadingItem(true);
    try {
      const { ok, data } = await apiFetch(`/api/items?id=${itemId}`);
      // Find the specific item in the array returned by /api/items (if it returns an array)
      // Actually usually /api/items?id=X should return just that item or we might need a specific route.
      // Let's check Marketplace.tsx or similar.
      // Wait, let's assume we can fetch it. 
      // Re-reading routes: router.get('/', ...) handles queries.
      
      const res = await apiFetch(`/api/items`); // Get all potentially, but better to have a single route.
      // Let's assume we use /api/items which returns available. 
      // But if it's our own, it might not be in marketplace results if we filter self.
      // The /api/items/me route is better.
      const { data: myItems } = await apiFetch('/api/items/me');
      const item = Array.isArray(myItems) ? myItems.find((i: any) => i._id === itemId) : null;
      
      if (item) {
        setFormData({
          title: item.title,
          description: item.description,
          category: item.category,
          type: item.type,
          location: item.location || '',
          coordinates: item.coordinates || { lat: 0, lng: 0 },
          condition: item.condition || 'Gently Used',
          keywords: Array.isArray(item.keywords) ? item.keywords.join(', ') : '',
          images: item.images || [],
          expiresInDays: '30', // Can't easily back-calculate this, default to 30
          value: item.value?.toString() || '',
          depositAmount: item.depositAmount?.toString() || '',
          maxBorrowDuration: item.maxBorrowDuration?.toString() || '7'
        });
      }
    } catch (err) {
      console.error("Error fetching item for edit:", err);
    } finally {
      setLoadingItem(false);
    }
  };
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!user) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <h2 className="text-2xl font-serif mb-4 text-white">Join the community</h2>
        <p className="text-sky-100/50 mb-8">You need to be logged in to post a resource.</p>
        <button onClick={() => navigate('/auth')} className="bg-sky-500 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-sky-500/20">Login / Sign Up</button>
      </div>
    );
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setUploadError(null);
    setUploading(true);
    
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    const newImages: string[] = [];
    const fileList = Array.from(files);

    // Initial checks
    if (formData.images.length + fileList.length > 6) {
      setUploadError('Transmission limit reached: You can only broadcast up to 6 visual telemetry captures per listing. Suggestion: Remove existing images or select fewer files.');
      setUploading(false);
      return;
    }

    let processedCount = 0;
    let errors: string[] = [];

    const checkCompletion = () => {
      processedCount++;
      if (processedCount === fileList.length) {
        if (errors.length > 0) {
          // Join errors but keep them readable
          setUploadError(errors.join(' | '));
        }
        if (newImages.length > 0) {
          setFormData(prev => ({
            ...prev,
            images: [...prev.images, ...newImages]
          }));
        }
        setUploading(false);
      }
    };

    fileList.forEach((file: File) => {
      // Validate file type
      const isHeic = file.name.toLowerCase().endsWith('.heic');
      if (!ALLOWED_TYPES.includes(file.type) && !isHeic) {
        errors.push(`${file.name}: Incompatible format. Use industrial standards: JPG, PNG, or WEBP.`);
        checkCompletion();
      } else if (file.size > MAX_FILE_SIZE) {
        const sizeInMB = (file.size / (1024 * 1024)).toFixed(1);
        errors.push(`${file.name}: Data mass (${sizeInMB}MB) exceeds 5MB limit. Try downsampling.`);
        checkCompletion();
      } else {
        const reader = new FileReader();
        reader.onerror = () => {
          errors.push(`${file.name}: Magnetic interference failure (Read Error). Check file integrity.`);
          checkCompletion();
        };
        reader.onloadend = () => {
          const result = reader.result as string;
          // Security/Integrity check: Ensure it's actually an image data URL
          if (!result.startsWith('data:image/')) {
            errors.push(`${file.name}: Malformed telemetry stream.`);
          } else {
            newImages.push(result);
          }
          checkCompletion();
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!formData.category) {
      setSubmitError("Please select a category for Protocol Beta.");
      setStep(2);
      return;
    }

    if (formData.images.length === 0) {
      setSubmitError("At least one visual telemetry capture (image) is required.");
      setStep(2);
      return;
    }

    if (formData.coordinates.lat === 0 && formData.coordinates.lng === 0) {
      setSubmitError("Geospatial lock is required for resource discovery.");
      setStep(2);
      return;
    }

    setIsSubmitting(true);
    try {
      const expiresInDays = parseInt(formData.expiresInDays);
      const expiresAt = expiresInDays > 0 
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
        : null;

      const url = itemId ? `/api/items/${itemId}` : '/api/items';
      const method = itemId ? 'PATCH' : 'POST';

      const { ok, data } = await apiFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          value: formData.type === 'share' ? parseFloat(formData.value) || 0 : 0,
          depositAmount: formData.type === 'share' ? parseFloat(formData.depositAmount) || 0 : 0,
          maxBorrowDuration: formData.type === 'share' ? parseInt(formData.maxBorrowDuration) || 7 : 0,
          keywords: formData.keywords ? formData.keywords.split(',').map(k => k.trim()).filter(k => k) : [],
          expiresAt
        })
      });

      if (ok) {
        navigate('/profile?tab=contributions');
      } else {
        setSubmitError(data.error || data.message || "Broadcast failure: Listing was rejected by the grid.");
      }
    } catch (err) {
      console.error(err);
      setSubmitError("Neural link failure: Could not reach the server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingItem) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sky-100/40 text-[10px] font-bold uppercase tracking-[0.3em]">Calibrating Node Data...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-0">
      <div className="mb-12 text-center md:text-left">
        <h1 className="text-4xl font-bold text-white tracking-tight uppercase tracking-tighter mb-4">
          {itemId ? 'Re-calibrate Node' : 'Broadcast Resource'}
        </h1>
        <p className="text-sky-100/40 italic text-sm font-medium">
          {itemId ? '"Iteration is the engine of communal perfection."' : '"Collective sustainability begins with individual coordination."'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {step === 1 && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="glass-card p-8 md:p-10 border-sky-500/10 space-y-8 shadow-inner">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-sky-400 flex items-center gap-3">
                <Package size={16} /> Protocol Alpha: Basic Details
              </h3>
              
              <div className="space-y-3">
                <label className="text-[9px] uppercase tracking-[0.3em] font-bold text-sky-100/30">Node Identifier (Item Name)</label>
                <input 
                  required
                  type="text" 
                  placeholder="e.g., Makita Power Drill, Camping Tent"
                  className="w-full bg-sky-500/5 border border-sky-500/20 rounded-2xl p-5 text-sm font-medium focus:ring-4 focus:ring-sky-500/10 outline-none transition-all shadow-inner text-white placeholder:text-sky-100/20"
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                />
              </div>

              <div className="space-y-3">
                <label className="text-[9px] uppercase tracking-[0.3em] font-bold text-sky-100/30">Core Narrative (Description)</label>
                <textarea 
                  required
                  rows={4}
                  placeholder="Describe the resource potential and usage constraints..."
                  className="w-full bg-sky-500/5 border border-sky-500/20 rounded-2xl p-5 text-sm font-medium focus:ring-4 focus:ring-sky-500/10 outline-none transition-all resize-none shadow-inner text-white placeholder:text-sky-100/20"
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div 
                  onClick={() => setFormData({...formData, type: 'share'})}
                  className={`p-6 rounded-3xl border-2 cursor-pointer transition-all flex flex-col items-center gap-2 ${formData.type === 'share' ? 'border-sky-500 bg-sky-500/5 shadow-xl shadow-sky-500/10 text-white' : 'border-sky-500/10 bg-sky-500/5 text-sky-100/30 hover:border-sky-500/30'}`}
                >
                  <h4 className="font-bold uppercase tracking-tight">Temporary Share</h4>
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em]">Borrow & Restock</p>
                </div>
                <div 
                  onClick={() => setFormData({...formData, type: 'donate'})}
                  className={`p-6 rounded-3xl border-2 cursor-pointer transition-all flex flex-col items-center gap-2 ${formData.type === 'donate' ? 'border-emerald-500 bg-emerald-500/5 shadow-xl shadow-emerald-500/10 text-white' : 'border-sky-500/10 bg-sky-500/5 text-sky-100/30 hover:border-sky-500/30'}`}
                >
                  <h4 className="font-bold uppercase tracking-tight">Full Donation</h4>
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em]">Permanent Node Shift</p>
                </div>
              </div>

              {formData.type === 'share' && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-6 pt-6 border-t border-sky-500/10"
                >
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <label className="text-[9px] uppercase tracking-[0.3em] font-bold text-sky-100/30 flex items-center gap-2">
                           Resource Market Value ($)
                        </label>
                        <div className="relative">
                           <span className="absolute left-5 top-1/2 -translate-y-1/2 text-sky-400 font-bold">$</span>
                           <input 
                             type="number" 
                             placeholder="0.00"
                             className="w-full bg-sky-500/5 border border-sky-500/20 rounded-2xl p-4 pl-10 text-sm font-medium focus:ring-4 focus:ring-sky-500/10 outline-none transition-all shadow-inner text-white"
                             value={formData.value}
                             onChange={e => setFormData({...formData, value: e.target.value})}
                           />
                        </div>
                        <p className="text-[8px] text-sky-100/20 font-medium italic">Used to calculate recommended insurance levels.</p>
                      </div>
                      <div className="space-y-3">
                        <label className="text-[9px] uppercase tracking-[0.3em] font-bold text-emerald-400 flex items-center gap-2">
                           Required Security Deposit ($)
                        </label>
                        <div className="relative">
                           <span className="absolute left-5 top-1/2 -translate-y-1/2 text-emerald-400 font-bold">$</span>
                           <input 
                             type="number" 
                             placeholder="0.00"
                             className="w-full bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 pl-10 text-sm font-medium focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all shadow-inner text-white"
                             value={formData.depositAmount}
                             onChange={e => setFormData({...formData, depositAmount: e.target.value})}
                           />
                        </div>
                        <p className="text-[8px] text-emerald-500/20 font-medium italic">Escrowed securely and returned upon safe item completion.</p>
                      </div>
                   </div>
                   <div className="space-y-3">
                      <label className="text-[9px] uppercase tracking-[0.3em] font-bold text-sky-100/30">Max Borrow Duration (Days)</label>
                      <select 
                        className="w-full bg-sky-500/5 border border-sky-500/20 rounded-2xl p-4 text-sm font-medium focus:ring-4 focus:ring-sky-500/10 outline-none transition-all shadow-inner text-white appearance-none"
                        value={formData.maxBorrowDuration}
                        onChange={e => setFormData({...formData, maxBorrowDuration: e.target.value})}
                      >
                         <option value="1" className="bg-slate-900">1 Day</option>
                         <option value="3" className="bg-slate-900">3 Days</option>
                         <option value="7" className="bg-slate-900">7 Days (Standard)</option>
                         <option value="14" className="bg-slate-900">14 Days</option>
                         <option value="30" className="bg-slate-900">30 Days</option>
                      </select>
                   </div>
                </motion.div>
              )}
            </div>

            <button 
              type="button"
              onClick={() => setStep(2)}
              className="w-full bg-sky-500 text-white py-6 rounded-[2rem] font-bold flex items-center justify-center gap-4 hover:bg-sky-600 transition-all shadow-2xl shadow-sky-500/20 hover:-translate-y-1 uppercase text-xs tracking-[0.3em]"
            >
              Next Protocol <ChevronRight size={18} />
            </button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="glass-card p-8 md:p-10 border-sky-500/10 space-y-10 shadow-inner">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-sky-400 flex items-center gap-3">
                <Tag size={16} /> Protocol Beta: Classification
              </h3>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {CATEGORIES.map(cat => (
                  <div 
                    key={cat}
                    onClick={() => setFormData({...formData, category: cat})}
                    className={`py-4 px-2 rounded-xl text-center text-[10px] font-bold uppercase tracking-[0.2em] cursor-pointer transition-all border ${formData.category === cat ? 'bg-sky-500 text-white border-sky-500 shadow-xl' : 'bg-sky-500/5 text-sky-100/30 border-sky-500/10 hover:bg-sky-500/10'}`}
                  >
                    {cat}
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <label className="text-[9px] uppercase tracking-[0.3em] font-bold text-sky-100/30 flex items-center gap-2">
                  <Tag size={12} className="text-sky-400" /> Resource Condition Status
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {['New', 'Like New', 'Gently Used', 'Repairable'].map(cond => (
                    <div 
                      key={cond}
                      onClick={() => setFormData({...formData, condition: cond})}
                      className={`py-4 px-2 rounded-xl text-center text-[9px] font-bold uppercase tracking-[0.1em] cursor-pointer transition-all border ${formData.condition === cond ? 'bg-sky-500 text-white border-sky-400 shadow-lg' : 'bg-sky-500/5 text-sky-100/30 border-sky-500/10 hover:bg-sky-500/10'}`}
                    >
                      {cond}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[9px] uppercase tracking-[0.3em] font-bold text-sky-100/30 flex items-center gap-2">
                  <MapPin size={12} className="text-sky-400" /> Geospatial Coordinate Calibration
                </label>
                
                <LocationPicker 
                  onLocationSelect={(lat, lng, address) => {
                    setFormData({
                      ...formData,
                      location: address,
                      coordinates: { lat, lng }
                    });
                  }}
                />

                <div className="space-y-2">
                  <label className="text-[8px] uppercase tracking-widest font-bold text-sky-100/20">Selected Address Node</label>
                  <p className="text-[11px] text-sky-100/60 font-medium bg-sky-500/5 p-4 rounded-xl border border-sky-500/10 italic">
                    {formData.location || "No coordinate lock established..."}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[9px] uppercase tracking-[0.3em] font-bold text-sky-100/30 flex items-center gap-2">
                  <Camera size={12} className="text-sky-400" /> Visual Telemetry
                </label>
                
                {uploadError && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-3"
                  >
                    <div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center shrink-0">
                      <ShieldAlert size={16} className="text-rose-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider mb-1">Transmission Warning</p>
                      <p className="text-[11px] text-rose-100/60 leading-relaxed font-medium">{uploadError}</p>
                      <div className="mt-3 pt-3 border-t border-rose-500/10">
                        <p className="text-[9px] text-rose-400/60 font-bold uppercase tracking-wider mb-2">Resolution Protocol:</p>
                        <ul className="text-[10px] text-rose-100/40 space-y-1 list-disc pl-4">
                          <li>Check if the file is one of: JPG, PNG, WEBP</li>
                          <li>Ensure file size is below 5MB per image</li>
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
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {formData.images.map((img, idx) => (
                    <div key={idx} className="relative group aspect-square rounded-2xl overflow-hidden border border-sky-500/20">
                      <img src={img} alt="Preview" className="w-full h-full object-cover" />
                      <button 
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="absolute top-2 right-2 bg-rose-500 text-white p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  
                  {formData.images.length < 6 && (
                    <label className="aspect-square border-2 border-dashed border-sky-500/20 bg-sky-500/5 rounded-2xl flex flex-col items-center justify-center text-sky-100/20 gap-2 group cursor-pointer hover:bg-sky-500/10 transition-all">
                      <div className="w-10 h-10 bg-sky-500/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Camera size={20} className="text-sky-400" />
                      </div>
                      <span className="text-[8px] font-bold uppercase tracking-[0.2em]">{uploading ? 'Processing' : 'Add Image'}</span>
                      <input 
                        type="file" 
                        multiple 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleImageUpload}
                        disabled={uploading}
                      />
                    </label>
                  )}
                </div>
                <p className="text-[9px] text-sky-100/30 font-medium italic">Max 6 images. Base64 encoded telemetry capture.</p>
              </div>

              <div className="space-y-4">
                <label className="text-[9px] uppercase tracking-[0.3em] font-bold text-sky-100/30 flex items-center gap-2">
                  <Clock size={12} className="text-sky-400" /> Availability Phase (Expiration)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: '7 Days', val: '7' },
                    { label: '30 Days', val: '30' },
                    { label: '90 Days', val: '90' },
                    { label: 'Indefinite', val: '0' }
                  ].map(phase => (
                    <div 
                      key={phase.val}
                      onClick={() => setFormData({...formData, expiresInDays: phase.val})}
                      className={`py-3 px-2 rounded-xl text-center text-[9px] font-bold uppercase tracking-[0.1em] cursor-pointer transition-all border ${formData.expiresInDays === phase.val ? 'bg-sky-500 text-white border-sky-400' : 'bg-sky-500/5 text-sky-100/30 border-sky-500/10 hover:bg-sky-500/10'}`}
                    >
                      {phase.label}
                    </div>
                  ))}
                </div>
                <p className="text-[8px] text-sky-100/20 font-medium italic">Automatic node purge after selected duration.</p>
              </div>

              {submitError && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-3"
                >
                  <ShieldAlert size={16} className="text-rose-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-rose-400 font-bold uppercase tracking-wider">{submitError}</p>
                </motion.div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button 
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 glass-button bg-sky-500/5 text-sky-100/40 py-6 rounded-[2rem] font-bold uppercase text-[10px] tracking-[0.3em] border-sky-500/20"
              >
                Previous
              </button>
              <button 
                type="submit"
                disabled={isSubmitting || uploading}
                className="flex-[2] bg-sky-500 text-white py-6 rounded-[2rem] font-bold flex items-center justify-center gap-4 hover:bg-sky-600 transition-all shadow-2xl shadow-sky-500/40 hover:-translate-y-1 uppercase text-xs tracking-[0.3em] disabled:opacity-50 disabled:translate-y-0"
              >
                {isSubmitting ? (itemId ? 'Updating...' : 'Broadcasting...') : (itemId ? 'Apply Changes' : 'Broadcast Listing')} <Check size={18} />
              </button>
            </div>
          </motion.div>
        )}
      </form>
    </div>
  );
}
