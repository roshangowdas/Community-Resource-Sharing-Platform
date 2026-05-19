import React from 'react';
import { motion } from 'motion/react';
import { Shield, FileText, Scale, Lock } from 'lucide-react';

export default function Terms() {
  return (
    <div className="max-w-4xl mx-auto space-y-16 pb-20 px-4 sm:px-0">
      <div className="text-center space-y-6 pt-12">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner"
        >
          <FileText size={40} />
        </motion.div>
        <div className="space-y-2">
          <h1 className="text-[44px] leading-[1] font-bold text-white tracking-tighter uppercase">Terms of Service</h1>
          <p className="text-[10px] font-bold text-blue-600 uppercase tracking-[0.4em]">Grid Protocol v1.0.4</p>
        </div>
      </div>

      <div className="glass-card p-10 md:p-16 space-y-12">
        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
              <Scale size={20} />
            </div>
            <h2 className="text-2xl font-bold text-white uppercase tracking-tight">1. The Coordination Clause</h2>
          </div>
          <p className="text-slate-600 leading-relaxed font-serif text-lg italic">
            "By accessing ShareLocal, you agree to participate in a circular economy designed for neighborhood resilience. You acknowledge that resources shared are for communal benefit and must be handled with care and respect."
          </p>
          <div className="pl-6 border-l border-slate-200">
            <p className="text-slate-500 text-sm">Members are responsible for the safe return and functional integrity of any item borrowed via the platform.</p>
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
              <Shield size={20} />
            </div>
            <h2 className="text-2xl font-bold text-white uppercase tracking-tight">2. Liability Limitation</h2>
          </div>
          <p className="text-slate-500 text-sm leading-relaxed">
            ShareLocal acts solely as a coordination layer. We are not responsible for the condition of borrowed items or any disputes arising from physical transfers. Users assume all risk associated with local resource exchange.
          </p>
        </section>

        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
              <Lock size={20} />
            </div>
            <h2 className="text-2xl font-bold text-white uppercase tracking-tight">3. Grid Conduct</h2>
          </div>
          <p className="text-slate-500 text-sm leading-relaxed">
            Harassment, fraud, or the redistribution of unauthorized materials is strictly forbidden. The system tracks coordination history and reserves the right to terminate access for nodes that disrupt neighborhood harmony.
          </p>
        </section>

        <div className="pt-12 border-t border-slate-100 text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Last Verification: April 27, 2026</p>
        </div>
      </div>
    </div>
  );
}
