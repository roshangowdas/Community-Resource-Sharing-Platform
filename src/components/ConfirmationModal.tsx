import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, X, Check } from 'lucide-react';

interface ConfirmationModalProps {
  show: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'info';
}

export default function ConfirmationModal({
  show,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = 'info'
}: ConfirmationModalProps) {
  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            onClick={onClose} 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl" 
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 30 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.9, y: 30 }} 
            className="glass-card relative z-10 w-full max-w-md p-10 md:p-12 border-sky-500/20 shadow-2xl overflow-hidden"
          >
            <div className={`absolute top-0 left-0 w-full h-1.5 ${variant === 'danger' ? 'bg-rose-500' : 'bg-sky-500'}`} />
            
            <button 
              onClick={onClose} 
              className="absolute top-6 right-6 text-sky-100/30 hover:text-sky-400 hover:scale-110 transition-transform"
            >
              <X size={24} />
            </button>
            
            <div className="text-center space-y-8">
              <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto shadow-inner border border-sky-500/10 ${
                variant === 'danger' ? 'bg-rose-500/10 text-rose-400' : 'bg-sky-500/10 text-sky-400'
              }`}>
                 <AlertCircle size={40} />
              </div>
              
              <div className="space-y-3">
                <h3 className="text-2xl font-bold text-white uppercase tracking-tighter">{title}</h3>
                <p className="text-sm text-sky-100/40 font-medium leading-relaxed italic pr-2 font-serif">
                  "{message}"
                </p>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={onClose}
                  className="flex-1 glass-button bg-sky-500/5 text-sky-100/50 border-sky-500/20 px-6 py-4 hover:bg-sky-500/10 text-[10px] font-bold uppercase tracking-[0.2em]"
                >
                  {cancelText}
                </button>
                <button 
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                  className={`flex-1 glass-button px-6 py-4 text-white border-transparent text-[10px] font-bold uppercase tracking-[0.2em] shadow-xl hover:-translate-y-1 transition-all ${
                    variant === 'danger' ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/30' : 'bg-sky-500 hover:bg-sky-600 shadow-sky-500/30'
                  }`}
                >
                  {confirmText}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
