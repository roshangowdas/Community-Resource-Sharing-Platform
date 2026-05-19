import React from 'react';
import { ShieldCheck, ShieldAlert, Award, Star, Zap } from 'lucide-react';

interface TrustBadgeProps {
  score: number;
  reliability?: number;
  size?: 'sm' | 'md' | 'lg';
}

const TrustBadge: React.FC<TrustBadgeProps> = ({ score, reliability = 100, size = 'sm' }) => {
  const getBadgeConfig = () => {
    if (score >= 900) return { label: 'ELITE NEIGHBOR', icon: Award, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
    if (score >= 750) return { label: 'HIGHLY TRUSTED', icon: ShieldCheck, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
    if (score >= 500) return { label: 'VERIFIED', icon: ShieldCheck, color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' };
    if (score >= 300) return { label: 'NEW MEMBER', icon: Zap, color: 'text-sky-100/40 bg-white/5 border-white/10' };
    return { label: 'RISK ALERT', icon: ShieldAlert, color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' };
  };

  const config = getBadgeConfig();
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[7px] gap-1',
    md: 'px-3 py-1 text-[9px] gap-1.5',
    lg: 'px-6 py-2.5 text-[11px] gap-3'
  };

  return (
    <div className={`inline-flex items-center font-black uppercase tracking-[0.2em] rounded-full border shadow-sm ${config.color} ${sizeClasses[size]}`}>
       <Icon size={size === 'lg' ? 18 : 12} />
       <span>{config.label}</span>
       {size === 'lg' && <span className="ml-2 pl-2 border-l border-current/20 opacity-60">SCORE: {score}</span>}
    </div>
  );
};

export default TrustBadge;
