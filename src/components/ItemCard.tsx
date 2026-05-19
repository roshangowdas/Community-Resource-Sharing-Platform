import React from 'react';
import { motion } from 'motion/react';
import { MapPin, Tag, Heart, Package, ShieldCheck, ArrowUpRight, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getOptimizedImage } from '../lib/imageUtils';

interface ItemCardProps {
  item: any;
  isSaved?: boolean;
  onToggleSave?: (e: React.MouseEvent, id: string) => void;
  isReserved?: boolean;
  onToggleReserve?: (e: React.MouseEvent, id: string) => void;
}

const ItemCard: React.FC<ItemCardProps> = ({ item, isSaved, onToggleSave, isReserved, onToggleReserve }) => {
  const isShare = item.type === 'share';

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -8 }}
      className="glass-card group p-0 overflow-hidden flex flex-col border-sky-500/10 hover:shadow-[0_20px_60px_rgba(14,165,233,0.2)] hover:border-sky-500/30 transition-all duration-500 h-full relative"
    >
      <Link to={`/marketplace?id=${item._id}`} className="block h-64 bg-slate-950 relative overflow-hidden shrink-0">
        {item.images?.[0] ? (
          <img 
            src={getOptimizedImage(item.images[0])} 
            alt={item.title} 
            loading="lazy"
            className="w-full h-full object-cover grayscale-[0.2] contrast-[1.1] transition-transform group-hover:scale-110 group-hover:grayscale-0 duration-[2.5s] ease-out-expo" 
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-sky-500/10 bg-gradient-to-b from-slate-900 to-slate-950">
            <Package size={80} strokeWidth={0.5} />
            <p className="text-[8px] font-bold uppercase tracking-[0.4em] mt-4 opacity-50 text-sky-400">Resource Offline</p>
          </div>
        )}
        
        {/* Status Badges */}
        <div className="absolute top-4 left-4 flex flex-col gap-2">
          <div className={`px-4 py-1.5 backdrop-blur-xl border border-white/20 text-white rounded-xl text-[9px] font-black uppercase tracking-[0.2em] shadow-2xl ${
            isShare ? 'bg-sky-500/60' : 'bg-emerald-500/60'
          }`}>
            {isShare ? 'Borrow' : 'Gift'}
          </div>
          {item.isVerified && (
            <div className="px-3 py-1 bg-slate-900/60 backdrop-blur-xl border border-sky-500/40 text-sky-400 rounded-lg text-[8px] font-bold uppercase tracking-[0.2em] flex items-center gap-1.5">
              <ShieldCheck size={10} /> Certified
            </div>
          )}
          {isShare && item.depositAmount > 0 && (
            <div className="px-3 py-1 bg-emerald-500/60 backdrop-blur-xl border border-emerald-500/40 text-white rounded-lg text-[8px] font-black uppercase tracking-[0.2em] flex items-center gap-1.5 shadow-lg shadow-emerald-500/20">
              <ShieldCheck size={10} /> ${item.depositAmount} Deposit
            </div>
          )}
        </div>

        {onToggleSave && (
          <button 
            onClick={(e) => onToggleSave(e, item._id)}
            className={`absolute top-4 right-4 w-10 h-10 rounded-2xl backdrop-blur-xl border transition-all active:scale-90 flex items-center justify-center group/save ${
              isSaved 
                ? 'bg-rose-500 text-white border-rose-400 shadow-xl shadow-rose-500/40' 
                : 'bg-black/40 text-white/60 border-white/10 hover:bg-rose-500/20 hover:text-rose-400 hover:border-rose-500/30'
            }`}
          >
            <Heart size={18} fill={isSaved ? "currentColor" : "none"} strokeWidth={2.5} className={isSaved ? "animate-pulse" : ""} />
          </button>
        )}

        {onToggleReserve && (
          <button 
            onClick={(e) => onToggleReserve(e, item._id)}
            title="Reserve for specific dates"
            className={`absolute top-16 right-4 w-10 h-10 rounded-2xl backdrop-blur-xl border transition-all active:scale-90 flex items-center justify-center group/reserve ${
              isReserved 
                ? 'bg-sky-500 text-white border-sky-400 shadow-xl shadow-sky-500/40' 
                : 'bg-black/40 text-white/60 border-white/10 hover:bg-sky-500/20 hover:text-sky-400 hover:border-sky-500/30'
            }`}
          >
            <Calendar size={18} strokeWidth={2.5} />
          </button>
        )}

        {/* Deposit Indicator Removed in favor of persistent badge */}
      </Link>

      <div className="p-8 space-y-6 flex flex-col flex-1">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
             <span className="text-[9px] font-black text-sky-400 uppercase tracking-[0.3em] font-mono">{item.category || 'Unclassified'}</span>
             <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                <span className="text-[8px] font-bold text-sky-100/40 uppercase tracking-widest">Live Node</span>
             </div>
          </div>
          <Link to={`/marketplace?id=${item._id}`}>
            <h3 className="font-bold text-white group-hover:text-sky-400 transition-colors text-xl uppercase tracking-tighter leading-none line-clamp-1">
              {item.title}
            </h3>
          </Link>
          <p className="text-sky-100/30 text-[11px] line-clamp-2 leading-relaxed font-medium">
            {item.description || 'System data stream incomplete for this node resource.'}
          </p>
        </div>

        <div className="pt-6 border-t border-sky-500/5 flex items-center justify-between mt-auto">
          <div className="flex items-center gap-2.5">
             <div className="w-6 h-6 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                <MapPin size={10} />
             </div>
             <span className="text-[10px] font-bold text-sky-100/40 uppercase tracking-widest truncate max-w-[120px]">
                {item.location?.split(',')[0]}
             </span>
          </div>
          <motion.div 
            whileHover={{ scale: 1.1 }}
            className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 group-hover:bg-sky-500 group-hover:text-white group-hover:border-transparent transition-all shadow-lg"
          >
             <ArrowUpRight size={18} />
          </motion.div>
        </div>
      </div>
      
      {/* Visual Accents */}
      <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-sky-500/20 to-transparent transform scale-x-0 group-hover:scale-x-100 transition-transform duration-700" />
    </motion.div>
  );
};

export default React.memo(ItemCard);
