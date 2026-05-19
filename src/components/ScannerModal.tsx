import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, QrCode, ShieldAlert, Camera } from 'lucide-react';
import { useZxing } from 'react-zxing';

interface ScannerModalProps {
  show: boolean;
  onClose: () => void;
  onScan: (data: string) => void;
  title: string;
}

const ScannerModal: React.FC<ScannerModalProps> = ({ show, onClose, onScan, title }) => {
  const [error, setError] = useState<string | null>(null);

  const { ref } = useZxing({
    onDecodeResult(result) {
      onScan(result.getText());
    },
    onError(err) {
      // Common errors (like no QR in frame) can be ignored
      // Only hardware/permission errors are critical
      if (err instanceof Error && !err.message.includes('No MultiFormat Readers')) {
        console.error(err);
      }
    },
    paused: !show
  });

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            onClick={onClose} 
            className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" 
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.9, y: 20 }} 
            className="glass-card relative z-10 w-full max-w-md p-8 border-sky-500/20 overflow-hidden"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-bold text-white uppercase tracking-widest">{title}</h3>
              <button 
                onClick={onClose} 
                className="text-sky-100/30 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="relative aspect-square bg-black rounded-2xl border-2 border-sky-500/20 overflow-hidden mb-6">
              <video 
                ref={ref} 
                className="w-full h-full object-cover"
                autoPlay
                muted
                playsInline
              />
              
              {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-4 bg-slate-900 z-10">
                  <ShieldAlert size={48} className="text-rose-500" />
                  <p className="text-xs text-rose-100/60 font-medium">{error}</p>
                   <button 
                    onClick={() => setError(null)}
                    className="text-[10px] font-bold text-sky-400 uppercase tracking-widest hover:underline"
                  >
                    Retry Initialization
                  </button>
                </div>
              )}
              
              {/* Overlay guides */}
              <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none z-[1]">
                 <div className="absolute inset-0 border-2 border-sky-500/40 rounded-sm scale-95" />
                 <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-sky-400" />
                 <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-sky-400" />
                 <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-sky-400" />
                 <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-sky-400" />
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-sky-500/5 rounded-xl border border-sky-500/10 mb-8">
              <Camera size={16} className="text-sky-400" />
              <p className="text-[10px] text-sky-100/40 font-medium italic">
                Center the neighbor's QR code within the scanning frame for automatic synchronization.
              </p>
            </div>

            <div className="space-y-4">
               <div className="relative">
                  <div className="absolute inset-y-0 left-4 flex items-center text-sky-100/30">
                    <QrCode size={14} />
                  </div>
                  <input 
                    type="text" 
                    placeholder="Or enter token manually..."
                    className="w-full bg-slate-900 border border-sky-500/20 rounded-xl py-3 pl-10 pr-4 text-xs text-white placeholder:text-sky-100/10 outline-none focus:ring-2 focus:ring-sky-500/40 transition-all font-mono"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        onScan((e.target as HTMLInputElement).value);
                      }
                    }}
                  />
               </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ScannerModal;
