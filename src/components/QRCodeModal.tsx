import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, QrCode, Download, Share2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface QRCodeModalProps {
  show: boolean;
  onClose: () => void;
  value: string;
  title: string;
  subtitle?: string;
}

const QRCodeModal: React.FC<QRCodeModalProps> = ({ show, onClose, value, title, subtitle }) => {
  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            onClick={onClose} 
            className="absolute inset-0 bg-slate-900/90 backdrop-blur-md" 
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.9, y: 20 }} 
            className="glass-card relative z-10 w-full max-w-sm p-8 border-sky-500/20 flex flex-col items-center"
          >
            <button 
              onClick={onClose} 
              className="absolute top-4 right-4 text-sky-100/30 hover:text-white transition-colors p-2"
            >
              <X size={20} />
            </button>

            <div className="w-full text-center mb-8">
              <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-2">{title}</h3>
              {subtitle && <p className="text-[10px] text-sky-100/40 uppercase tracking-widest font-bold leading-relaxed">{subtitle}</p>}
            </div>

            <div className="p-6 bg-white rounded-3xl shadow-2xl mb-8 relative group">
              <div className="absolute inset-0 bg-sky-500/10 rounded-3xl blur-2xl group-hover:bg-sky-500/20 transition-all" />
              <div className="relative bg-white p-4 rounded-2xl">
                <QRCodeSVG 
                  value={value} 
                  size={200}
                  level="H"
                  includeMargin={false}
                />
              </div>
            </div>

            <div className="w-full space-y-3">
              <div className="p-4 bg-sky-500/5 rounded-2xl border border-sky-500/10 text-center">
                <span className="text-[10px] font-mono text-sky-400 font-bold uppercase">{value}</span>
              </div>
              <p className="text-[9px] text-sky-100/30 text-center uppercase tracking-widest font-bold px-4">
                Show this token to the neighbor. Once scanned, the ledger status will synchronize automatically.
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-3 w-full mt-8">
               <button 
                 onClick={() => {
                   const svg = document.querySelector('.glass-card svg');
                   if (svg) {
                     const svgData = new XMLSerializer().serializeToString(svg);
                     const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
                     const url = URL.createObjectURL(blob);
                     const link = document.createElement('a');
                     link.href = url;
                     link.download = `sharelocal-token-${value}.svg`;
                     document.body.appendChild(link);
                     link.click();
                     document.body.removeChild(link);
                     URL.revokeObjectURL(url);
                   }
                 }}
                 className="flex items-center justify-center gap-2 p-3 bg-sky-500/10 border border-sky-500/20 rounded-xl text-sky-400 hover:bg-sky-500/20 transition-all"
               >
                 <Download size={16} />
                 <span className="text-[10px] font-bold uppercase tracking-wider">Save</span>
               </button>
               <button 
                 onClick={() => {
                   if (navigator.share) {
                     navigator.share({
                       title: `ShareLocal Token: ${title}`,
                       text: `Use this token for neighbor identity verification: ${value}`,
                       url: window.location.href
                     });
                   } else {
                     navigator.clipboard.writeText(value);
                     alert('Token copied to clipboard for manual sharing.');
                   }
                 }}
                 className="flex items-center justify-center gap-2 p-3 bg-sky-500/10 border border-sky-500/20 rounded-xl text-sky-400 hover:bg-sky-500/20 transition-all"
               >
                 <Share2 size={16} />
                 <span className="text-[10px] font-bold uppercase tracking-wider">Share</span>
               </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default QRCodeModal;
