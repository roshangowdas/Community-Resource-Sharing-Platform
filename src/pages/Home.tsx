import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Search, MapPin, Tag, Filter, Package, ShieldCheck, MessageSquare, Heart, PlusCircle, ArrowRight, Star, Leaf } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import ItemCard from '../components/ItemCard';

interface Item {
  _id: string;
  title: string;
  description: string;
  type: 'share' | 'donate';
  category: string;
  location: string;
  owner: {
    name: string;
    rating: number;
  };
  images: string[];
}

export default function Home() {
  const { user, apiFetch, token } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    itemsShared: 0,
    impactScore: 0,
    wasteSaved: 0
  });

  useEffect(() => {
    fetchItems();
    if (token) fetchSaved();
    // In a real app, we would fetch global stats here
  }, [token]);

  const fetchSaved = async () => {
    try {
      const { ok, data } = await apiFetch('/api/items/saved');
      if (ok && Array.isArray(data)) {
        setSavedIds(data.map((i: any) => i._id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleSave = async (e: React.MouseEvent, itemId: string) => {
    e.stopPropagation();
    if (!token) return alert('Please login to save items');
    try {
      const { ok, data } = await apiFetch(`/api/items/${itemId}/save`, {
        method: 'POST'
      });
      if (ok) {
        setSavedIds(prev => {
          const isSaved = prev.includes(itemId);
          return isSaved ? prev.filter(id => id !== itemId) : [...prev, itemId];
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      const { data } = await apiFetch(`/api/items?limit=8&sort=popular`);
      if (Array.isArray(data)) {
        setItems(data);
      } else {
        setItems([]);
      }
    } catch (err) {
      console.error(err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-40 pb-32">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-visible pt-10 sm:pt-20">
        <div className="absolute top-0 inset-x-0 h-full bg-gradient-to-b from-sky-400/[0.03] to-transparent pointer-events-none" />
        <div className="relative z-10 max-w-6xl mx-auto px-6 flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2.5 bg-sky-500/10 backdrop-blur-md border border-sky-500/20 px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.4em] text-sky-400 shadow-2xl shadow-sky-500/10 mb-12"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
            </span>
            Live in your neighborhood
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl xl:text-[11rem] font-black tracking-tighter leading-[0.8] text-white mb-10"
          >
            Own <span className="text-transparent bg-clip-text bg-gradient-to-br from-sky-400 via-sky-500 to-sky-600">nothing</span>,<br />
            Share <span className="italic font-serif text-sky-100/90 font-normal">everything.</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 1 }}
            className="text-lg md:text-xl text-sky-100/40 max-w-2xl mx-auto leading-relaxed font-medium mb-16"
          >
            The world's first neighbor-to-neighbor sharing economy platform. <br className="hidden md:block" />Borrow what you need, lend what you don't.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-6 w-full max-w-lg mx-auto"
          >
            <Link to="/marketplace" className="w-full sm:w-auto bg-sky-500 text-white px-12 py-5 rounded-2xl font-black text-[11px] uppercase tracking-[0.3em] hover:bg-sky-400 transition-all shadow-[0_20px_50px_rgba(14,165,233,0.3)] hover:-translate-y-1.5 active:scale-95">
              Explore Grid
            </Link>
            <Link to="/post" className="w-full sm:w-auto px-12 py-5 rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] hover:-translate-y-1.5 active:scale-95 border border-sky-500/20 text-sky-400 bg-sky-500/5 backdrop-blur-md transition-all hover:bg-sky-500/10">
              Broadcast Asset
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Visual Bento Section */}
      <section className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 h-full md:min-h-[480px]">
          <div className="md:col-span-8 bento-card bg-gradient-to-br from-sky-600 to-sky-950 p-16 flex flex-col justify-end text-white border-transparent shadow-2xl shadow-sky-900/30 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-[30rem] h-[30rem] bg-sky-400/20 rounded-full blur-[140px] -mr-60 -mt-60" />
            <h3 className="text-5xl font-bold mb-8 leading-tight relative z-10">A community effort for a <br /> sustainable future.</h3>
            <p className="text-sky-100 max-w-xl text-lg leading-relaxed font-medium relative z-10">Every item shared is one less item produced. Join thousands of neighbors making a local impact by reducing overconsumption and building stronger community ties through the power of sharing.</p>
          </div>
          
          <div className="md:col-span-4 grid grid-rows-2 gap-8">
            <div className="glass-card p-10 flex flex-col justify-end relative overflow-hidden backdrop-blur-3xl group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-sky-400/10 rounded-full blur-3xl transition-transform group-hover:scale-150" />
              <div className="w-16 h-16 bg-sky-950 rounded-2xl flex items-center justify-center text-sky-400 mb-6 shadow-inner border border-sky-500/20">
                <ShieldCheck size={32} />
              </div>
              <h4 className="text-2xl font-bold mb-2 text-white">Verified Trust</h4>
              <p className="text-sm text-sky-100/50 font-medium leading-relaxed">Every user is verified via our secure neighbor network and ID system.</p>
            </div>
            <div className="glass-card p-10 flex flex-col justify-end relative overflow-hidden backdrop-blur-3xl group">
               <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-sky-400/10 rounded-full blur-3xl transition-transform group-hover:scale-150" />
               <div className="w-16 h-16 bg-sky-950 rounded-2xl flex items-center justify-center text-sky-400 mb-6 shadow-inner border border-sky-500/20">
                 <Package size={32} />
               </div>
               <h4 className="text-2xl font-bold mb-2 text-white">Smart Inventory</h4>
               <p className="text-sm text-sky-100/50 font-medium leading-relaxed">Easily list your household items and manage your private library.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Information Section */}
      <section className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-12 py-12">
        {[
          { icon: Search, title: '1. Find what you need', desc: 'Search through hundreds of items categorized by Tools, Kitchen, Camping, and more.', color: 'sky' },
          { icon: MessageSquare, title: '2. Coordinate safely', desc: 'Send a request to the owner. Once approved, our secure end-to-end encrypted chat unlocks.', color: 'sky' },
          { icon: Heart, title: '3. Share & Rate', desc: 'Pick up the item, use it, and return it. Rate your experience to build trust.', color: 'sky' },
        ].map((feat, i) => (
          <div key={i} className="glass-card p-12 space-y-8 hover:-translate-y-3">
            <div className={`w-16 h-16 bg-sky-500/10 rounded-3xl flex items-center justify-center text-sky-400 shadow-xl shadow-sky-500/5 border border-sky-500/20`}>
               <feat.icon size={32} />
            </div>
            <h4 className="text-2xl font-bold text-white leading-tight">{feat.title}</h4>
            <p className="text-sky-100/50 text-base leading-relaxed font-medium">{feat.desc}</p>
          </div>
        ))}
      </section>

      {/* Dual-Path Trust Protocol - EXpert Responsive Section */}
      <section className="max-w-7xl mx-auto px-6 py-24 space-y-20">
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            className="inline-block px-4 py-1.5 bg-sky-500/10 border border-sky-500/20 rounded-full text-[9px] font-black uppercase tracking-[0.3em] text-sky-400"
          >
            Neighborhood Logistics
          </motion.div>
          <h2 className="text-4xl md:text-6xl font-bold text-white tracking-tighter leading-none uppercase">
            The Dual-Path <span className="text-sky-500">Trust Protocol</span>
          </h2>
          <p className="text-sky-100/40 text-sm md:text-base font-medium leading-relaxed">
            Every transaction branches into an intelligent workflow designed to maximize security for lenders and minimize friction for donors.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Path A: Rent / Lend */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            className="glass-card p-1 rounded-[2.5rem] bg-gradient-to-br from-sky-500/10 to-transparent border-sky-500/20 group hover:border-sky-500/40 transition-all"
          >
            <div className="bg-slate-950/40 backdrop-blur-3xl rounded-[2.2rem] p-10 h-full flex flex-col">
              <div className="flex items-start justify-between mb-12">
                <div className="w-16 h-16 bg-sky-500/20 rounded-2xl flex items-center justify-center text-sky-400 group-hover:scale-110 transition-transform">
                  <ShieldCheck size={32} />
                </div>
                <span className="text-[10px] font-black text-sky-500 bg-sky-500/10 px-4 py-1 rounded-full uppercase tracking-widest border border-sky-500/20">
                  Protocol A
                </span>
              </div>
              <h3 className="text-3xl font-bold text-white mb-4 uppercase tracking-tight">The Escrow Handshake</h3>
              <p className="text-sky-100/40 text-sm leading-relaxed mb-10 flex-1">
                For high-value shares, our digital ledger triggers a temporary security deposit. The collateral is held in a neutral escrow node and released only when both parties verify a successful return.
              </p>
              
              <div className="space-y-4">
                {[
                  { step: '01', title: 'Approval Trigger', desc: 'Seller approves and generates a Pickup QR token.' },
                  { step: '02', title: 'Ledger Hold', desc: 'Scan initiates a temporary deposit lock-in.' },
                  { step: '03', title: 'Refund Loop', desc: 'Return scan automatically triggers the refund loop.' }
                ].map((s, idx) => (
                  <div key={idx} className="flex items-center gap-4 bg-sky-500/5 p-4 rounded-2xl border border-sky-500/5">
                    <span className="text-sky-500 font-mono text-xs font-bold">{s.step}</span>
                    <div>
                      <h4 className="text-[10px] font-black text-white uppercase tracking-widest mb-0.5">{s.title}</h4>
                      <p className="text-[10px] text-sky-100/30 font-medium">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Path B: Donation */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            className="glass-card p-1 rounded-[2.5rem] bg-gradient-to-br from-emerald-500/10 to-transparent border-emerald-500/20 group hover:border-emerald-500/40 transition-all"
          >
            <div className="bg-slate-950/40 backdrop-blur-3xl rounded-[2.2rem] p-10 h-full flex flex-col">
              <div className="flex items-start justify-between mb-12">
                <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                  <Heart size={32} />
                </div>
                <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-4 py-1 rounded-full uppercase tracking-widest border border-emerald-500/20">
                  Protocol B
                </span>
              </div>
              <h3 className="text-3xl font-bold text-white mb-4 uppercase tracking-tight">Zero-Friction Gift</h3>
              <p className="text-sky-100/40 text-sm leading-relaxed mb-10 flex-1">
                For community donations, the system completely bypasses financial protocols. No deposits, no escrow, no return tracking. Pure neighborhood generosity synchronized via QR.
              </p>
              
              <div className="space-y-4">
                {[
                  { step: '01', title: 'Direct Claim', desc: 'Instant approval for items listed as permanent donations.' },
                  { step: '02', title: 'Bypass Logic', desc: 'Payment and deposit screens are programmatically removed.' },
                  { step: '03', title: 'Ownership Shift', desc: 'Scan immediately updates node to "Donated" status.' }
                ].map((s, idx) => (
                  <div key={idx} className="flex items-center gap-4 bg-emerald-500/5 p-4 rounded-2xl border border-emerald-500/5">
                    <span className="text-emerald-500 font-mono text-xs font-bold">{s.step}</span>
                    <div>
                      <h4 className="text-[10px] font-black text-white uppercase tracking-widest mb-0.5">{s.title}</h4>
                      <p className="text-[10px] text-sky-100/30 font-medium">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Responsive Mobile Terminal View */}
        <div className="bg-slate-900/50 border border-sky-500/10 rounded-[3rem] p-8 md:p-16 relative overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <h3 className="text-3xl md:text-4xl font-bold text-white leading-tight uppercase tracking-tighter">Unified <br /><span className="text-sky-400 font-serif italic normal-case">Handover Terminal</span></h3>
              <p className="text-sky-100/40 text-base leading-relaxed">
                Whether lending or donating, our QR terminal ensures physical verification. No more missed meetups or "I didn't get it" disputes.
              </p>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/10">
                  <div className="w-2 h-2 bg-sky-400 rounded-full animate-pulse" />
                  <span className="text-[9px] font-black text-white uppercase tracking-widest">Real-time Sync</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/10">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  <span className="text-[9px] font-black text-white uppercase tracking-widest">Secure Tokens</span>
                </div>
              </div>
            </div>
            
            <div className="relative aspect-square max-w-sm mx-auto md:ml-auto md:mr-0 group">
              <div className="absolute inset-0 bg-sky-500/20 blur-[100px] rounded-full group-hover:bg-sky-400/30 transition-all" />
              <div className="relative bg-slate-950 border border-white/10 rounded-[3rem] p-10 h-full flex flex-col items-center justify-center text-center space-y-6 shadow-2xl shadow-black/50">
                <div className="w-48 h-48 bg-white p-4 rounded-3xl relative overflow-hidden">
                  <div className="absolute inset-0 border-[6px] border-black/5 rounded-3xl" />
                  <div className="w-full h-full bg-[url('https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=protocol-alpha-verify')] bg-cover opacity-90" />
                </div>
                <div>
                  <h4 className="text-[11px] font-black text-white uppercase tracking-[0.4em] mb-2">Alpha-Token v2.0</h4>
                  <p className="text-[10px] text-sky-100/30 uppercase font-black tracking-widest">Scan to confirm node transfer</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Enhanced CTA */}
      <section className="max-w-7xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-32 items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest text-emerald-400">
              🌱 Grow your impact
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight leading-tight">What is Community <span className="text-emerald-400">Impact Score?</span></h2>
            <p className="text-lg text-sky-100/50 leading-relaxed font-medium">
              Every time you lend an item, donate to a neighbor, or complete a successful borrow, you earn <strong>Impact Points</strong>.
              Your Impact Score (Community Karma) reflects your contribution to the local economy and helps neighbors identify trusted, helpful members.
            </p>
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-sky-500/5 border border-sky-500/10 p-6 rounded-3xl">
                <div className="text-emerald-400 font-bold text-2xl mb-1">+50</div>
                <div className="text-[10px] uppercase font-bold text-sky-100/30 tracking-widest">Lending an Item</div>
              </div>
              <div className="bg-sky-500/5 border border-sky-500/10 p-6 rounded-3xl">
                <div className="text-emerald-400 font-bold text-2xl mb-1">+100</div>
                <div className="text-[10px] uppercase font-bold text-sky-100/30 tracking-widest">Successful Donation</div>
              </div>
            </div>
          </div>
          <div className="glass-card p-12 bg-sky-500/[0.02] border-sky-500/10">
            <h3 className="text-2xl font-bold text-white mb-8">Community Guidelines</h3>
            <div className="space-y-6">
              {[
                { title: 'Respect Every Item', desc: 'Treat borrowed items with even more care than your own. Clean them before returning.' },
                { title: 'Honest Listings', desc: 'Accurately describe the condition, quirks, and requirements of items you list.' },
                { title: 'Punctual Handshakes', desc: 'Respect your neighbors time. Stick to agreed-upon pickup and drop-off windows.' },
                { title: 'Safe Environment', desc: 'Keep communication within the platform and report any suspicious behavior immediately.' },
              ].map((guide, idx) => (
                <div key={idx} className="flex gap-4">
                  <div className="w-6 h-6 rounded-full bg-sky-500/20 flex items-center justify-center text-[10px] font-bold text-sky-400 shrink-0 mt-1">
                    {idx + 1}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white mb-1 uppercase tracking-wide">{guide.title}</h4>
                    <p className="text-xs text-sky-100/40 leading-relaxed">{guide.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-slate-900 rounded-[4rem] p-12 md:p-32 text-center relative overflow-hidden border border-sky-500/10">
          <div className="absolute inset-0 bg-gradient-to-br from-sky-600/10 to-sky-950/10 opacity-50" />
          <div className="absolute -top-32 -left-32 w-64 h-64 bg-sky-500 rounded-full blur-[100px] opacity-20" />
          <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-sky-500 rounded-full blur-[100px] opacity-20" />
          
          <div className="max-w-2xl mx-auto space-y-10 relative z-10">
            <h2 className="text-5xl md:text-7xl font-bold tracking-tight text-white leading-tight">Your neighborhood,<br /> upgraded.</h2>
            <p className="text-xl text-sky-100/40 leading-relaxed">Join ShareLocal today and start building a more connected, sustainable community right where you live.</p>
            <div className="flex flex-col sm:flex-row justify-center gap-6">
              <Link to={user ? "/marketplace" : "/auth"} className="bg-sky-500 text-white px-12 py-5 rounded-[2.5rem] font-bold text-sm uppercase tracking-widest hover:bg-sky-600 transition-all hover:scale-105 shadow-3xl shadow-sky-500/40">
                {user ? "Explore Marketplace" : "Join Community"}
              </Link>
              <Link to="/marketplace" className="bg-sky-500/10 backdrop-blur-md border border-sky-500/20 text-sky-400 px-12 py-5 rounded-[2.5rem] font-bold text-sm uppercase tracking-widest hover:bg-sky-500/20 transition-all">
                Browse Items
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Items Sidebar replacement */}
      <section className="max-w-7xl mx-auto px-6 space-y-12">
        <div className="flex items-end justify-between border-b border-sky-500/10 pb-10">
          <div className="space-y-3">
            <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tighter uppercase">Community Picks</h2>
            <p className="text-sky-100/40 font-bold uppercase tracking-[0.3em] text-[10px]">What neighbors are sharing right now</p>
          </div>
          <Link to="/marketplace" className="group flex items-center gap-3 text-sky-400 font-bold uppercase tracking-widest text-[10px] hover:text-sky-300 transition-colors">
            View Marketplace <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="glass-card p-0 overflow-hidden h-96 animate-pulse bg-sky-500/[0.02]" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {Array.isArray(items) && items.slice(0, 4).map((item) => (
              <ItemCard 
                key={item._id} 
                item={item} 
                isSaved={savedIds.includes(item._id)} 
                onToggleSave={toggleSave} 
                onToggleReserve={(e, id) => {
                  e.stopPropagation();
                  navigate(`/marketplace?id=${id}`);
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* Sustainable Impact Stats */}
      <section className="bg-sky-500/5 border-y border-sky-500/10 py-32 overflow-hidden relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80rem] h-[80rem] bg-emerald-500/5 rounded-full blur-[140px] -mt-[40rem]" />
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center mb-24 space-y-4">
            <h2 className="text-4xl md:text-6xl font-bold text-white tracking-tighter uppercase">Neighborhood <span className="text-emerald-400">Wins</span></h2>
            <p className="text-sky-100/40 font-bold uppercase tracking-[0.4em] text-[10px]">Real impact tracked by our community ledger</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              { label: 'Resource Cycles Completed', value: stats.itemsShared.toLocaleString(), icon: Package, postfix: '+' },
              { label: 'KG CO2 Emissions Prevented', value: (stats.wasteSaved * 12).toLocaleString(), icon: Leaf, postfix: 'kg' },
              { label: 'Local Impact Points Generated', value: (stats.impactScore * 10).toLocaleString(), icon: Star, postfix: 'pts' }
            ].map((stat, i) => (
              <div key={i} className="text-center space-y-6 glass-card p-12 bg-transparent border-transparent">
                <div className="w-20 h-20 bg-sky-500/10 rounded-full flex items-center justify-center mx-auto text-sky-400 shadow-2xl shadow-sky-500/20 mb-8 border border-sky-500/20">
                  <stat.icon size={36} />
                </div>
                <div className="text-6xl font-bold text-white tracking-tighter">
                  {stat.value}{stat.postfix}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-sky-100/30 max-w-[180px] mx-auto leading-relaxed">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
