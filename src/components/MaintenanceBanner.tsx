import React from 'react';
import { WifiOff, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';

export default function MaintenanceBanner() {
  const { isOffline, isConnecting, dbAuthError } = useAuth();
  
  return (
    <AnimatePresence>
      {(isOffline || dbAuthError) && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className={`${dbAuthError ? 'bg-rose-500/10 border-rose-500/20' : isConnecting ? 'bg-sky-500/10 border-sky-500/20' : 'bg-amber-500/10 border-amber-500/20'} border-b backdrop-blur-md overflow-hidden relative z-[60]`}
        >
          <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-center gap-3">
            {dbAuthError ? (
               <WifiOff size={14} className="text-rose-400" />
            ) : isConnecting ? (
               <motion.div 
                 animate={{ rotate: 360 }}
                 transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                 className="w-3 h-3 border-2 border-sky-500 border-t-transparent rounded-full"
               />
            ) : (
               <WifiOff size={14} className="text-amber-400" />
            )}
            
            <span className={`text-[10px] font-bold uppercase tracking-widest ${dbAuthError ? 'text-rose-400' : isConnecting ? 'text-sky-400' : 'text-amber-200'}`}>
              {dbAuthError ? 'Invalid Neural Link Credentials' : isConnecting ? 'Establishing Grid Connection' : 'Community Node Offline'}
            </span>
            <div className={`h-3 w-px ${dbAuthError ? 'bg-rose-500/20' : isConnecting ? 'bg-sky-500/20' : 'bg-amber-500/20'}`} />
            <p className={`text-[10px] ${dbAuthError ? 'text-rose-100/60' : isConnecting ? 'text-sky-100/60' : 'text-amber-200/60'} font-medium tracking-wide`}>
              {dbAuthError
                ? "The MONGODB_URI in your environment contains incorrect credentials. Authentication failed."
                : isConnecting 
                ? "The local node is currently establishing a neural link to the grid. Please stand by." 
                : "The platform is currently in read-only mode for synchronization. Writing data is temporarily disabled."
              }
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
