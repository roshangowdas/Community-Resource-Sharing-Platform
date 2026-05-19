import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  QrCode, 
  Wallet, 
  ArrowRightLeft, 
  Clock, 
  CheckCircle2, 
  Scan, 
  Lock, 
  ShieldCheck, 
  MessageSquare,
  AlertCircle,
  ChevronRight,
  RefreshCw,
  Info
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Link } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import ScannerModal from '../components/ScannerModal';
import QRCodeModal from '../components/QRCodeModal';
import { getOptimizedImage } from '../lib/imageUtils';

interface Request {
  _id: string;
  item: { _id: string, title: string, images: string[], type: string, depositAmount?: number, value?: number };
  requester: { _id: string, name: string, avatar?: string };
  owner: { _id: string, name: string, avatar?: string };
  status: string;
  depositAmount?: number;
  borrowStartDate?: string;
  borrowEndDate?: string;
  borrowerHandoverToken?: string;
  ownerHandoverToken?: string;
  borrowerHandoverVerified?: boolean;
  ownerHandoverVerified?: boolean;
  returnQRCode?: string;
  returnQRDataURL?: string;
}

export default function Transactions() {
  const { user, token, apiFetch } = useAuth();
  const [incoming, setIncoming] = useState<Request[]>([]);
  const [outgoing, setOutgoing] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [activeScanner, setActiveScanner] = useState<{ show: boolean, requestId: string, type: 'handover' | 'return' }>({
    show: false,
    requestId: '',
    type: 'handover'
  });
  const [activeQRCode, setActiveQRCode] = useState<{ show: boolean, value: string, title: string, subtitle?: string }>({
    show: false,
    value: '',
    title: '',
    subtitle: ''
  });

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resOut, resIn] = await Promise.all([
        apiFetch('/api/requests/me'),
        apiFetch('/api/requests/incoming')
      ]);
      
      const outData = resOut.data;
      const inData = resIn.data;
      
      // Filter for "Active" transactions that need QR codes or deposits
      const activeStatuses = ['approved', 'deposit_paid', 'item_handed_over', 'borrowed', 'return_requested'];
      
      setOutgoing(Array.isArray(outData) ? outData.filter((r: any) => activeStatuses.includes(r.status)) : []);
      setIncoming(Array.isArray(inData) ? inData.filter((r: any) => activeStatuses.includes(r.status)) : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyHandover = async (requestId: string, tokenVal: string) => {
    try {
      const { ok, data } = await apiFetch(`/api/requests/${requestId}/verify-handover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenVal })
      });
      if (ok) {
        alert('Handover verified successfully!');
        setActiveScanner({ ...activeScanner, show: false });
        fetchData();
      } else {
        alert(data.error || 'Verification failed.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleVerifyReturn = async (requestId: string, qrCodeVal: string) => {
    try {
      const { ok, data } = await apiFetch(`/api/requests/${requestId}/verify-return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrCode: qrCodeVal })
      });
      if (ok) {
        alert('Return verified! Escrow released.');
        setActiveScanner({ ...activeScanner, show: false });
        fetchData();
      } else {
        alert(data.error || 'Verification failed.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const isUserOwner = (req: Request) => (typeof req.owner === 'object' ? req.owner._id : req.owner) === user?.id;

  const TransactionCard = ({ req, type }: { req: Request, type: 'borrowing' | 'lending' }) => {
    const isOwner = isUserOwner(req);
    const partner = isOwner ? req.requester : req.owner;
    
    return (
      <motion.div 
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6 md:p-8 flex flex-col gap-6 relative overflow-hidden group hover:border-sky-500/30 transition-all"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 rounded-full blur-[80px] -mr-16 -mt-16 group-hover:bg-sky-500/10 transition-all" />
        
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-sky-500/20 overflow-hidden shrink-0 shadow-lg">
              {req.item?.images?.[0] ? (
                <img src={getOptimizedImage(req.item.images[0])} alt="" className="w-full h-full object-cover" />
              ) : <div className="w-full h-full flex items-center justify-center text-sky-400/20"><QrCode size={24} /></div>}
            </div>
            <div>
              <h3 className="font-bold text-white uppercase tracking-tight text-lg leading-tight">{req.item?.title}</h3>
              <p className="text-[10px] text-sky-100/40 font-bold uppercase tracking-[0.2em] mt-1 flex items-center gap-2">
                {type === 'borrowing' ? 'Lent by' : 'Requested by'} <span className="text-sky-400">{partner?.name}</span>
              </p>
              <div className="flex items-center gap-2 mt-3">
                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                  req.status === 'approved' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                  req.status === 'deposit_paid' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' :
                  req.status === 'borrowed' || req.status === 'item_handed_over' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                }`}>
                  {req.status.replace('_', ' ')}
                </span>
                {req.item?.type === 'donate' && (
                  <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border bg-rose-500/10 text-rose-400 border-rose-500/20">
                    Free Donation
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <Link to={`/messages?id=${req._id}`} className="p-3 bg-sky-500/5 hover:bg-sky-500/10 rounded-2xl border border-sky-500/10 transition-all text-sky-400">
            <MessageSquare size={20} />
          </Link>
        </div>

        {/* QR Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Display QR */}
          <div className="bg-white/5 border border-white/5 rounded-[2rem] p-6 flex flex-col items-center gap-4">
            <p className="text-[9px] font-black text-sky-100/20 uppercase tracking-[0.3em]">Handover Token</p>
            <div className="p-3 bg-white rounded-2xl shadow-2xl border-4 border-sky-400/10">
              <QRCodeCanvas 
                value={isOwner ? req.ownerHandoverToken || '' : req.borrowerHandoverToken || ''} 
                size={120}
                level="H"
              />
            </div>
            <button 
              onClick={() => setActiveQRCode({
                show: true,
                value: isOwner ? req.ownerHandoverToken || '' : req.borrowerHandoverToken || '',
                title: 'Handover Token',
                subtitle: 'Present this to your neighbor during physical exchange'
              })}
              className="text-[10px] font-bold text-sky-400 hover:text-sky-300 uppercase tracking-widest flex items-center gap-2"
            >
              <RefreshCw size={12} /> Expand QR
            </button>
          </div>

          {/* Action to Scan */}
          <div className="bg-sky-500/5 border border-sky-500/10 rounded-[2rem] p-6 flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/10 flex items-center justify-center text-sky-400 mb-2">
              <Scan size={24} />
            </div>
            
            {req.item?.type === 'donate' ? (
              <div className="flex flex-col items-center gap-2">
                <button 
                  onClick={() => setActiveScanner({ show: true, requestId: req._id, type: 'handover' })}
                  className="glass-button w-full bg-emerald-500 text-white border-transparent hover:bg-emerald-600 uppercase tracking-widest text-[10px]"
                >
                  Verify Pickup
                </button>
                <p className="text-[9px] text-emerald-400/60 font-bold uppercase tracking-widest text-center px-4 leading-relaxed">
                  Bypassing security deposit protocols for community donation
                </p>
              </div>
            ) : (
              <>
                {req.status === 'return_requested' && isOwner ? (
                  <button 
                    onClick={() => setActiveScanner({ show: true, requestId: req._id, type: 'return' })}
                    className="glass-button w-full bg-emerald-500 text-white border-transparent hover:bg-emerald-600 uppercase tracking-widest text-[10px]"
                  >
                    Scan Return QR
                  </button>
                ) : (
                  <button 
                    onClick={() => setActiveScanner({ show: true, requestId: req._id, type: 'handover' })}
                    className="glass-button w-full bg-sky-500 text-white border-transparent hover:bg-sky-600 uppercase tracking-widest text-[10px]"
                  >
                    Scan Neighbor QR
                  </button>
                )}
                
                <p className="text-[9px] text-sky-100/30 font-bold uppercase tracking-widest text-center px-4 leading-relaxed">
                  Scan your neighbor's token to securely confirm the resource transfer
                </p>
              </>
            )}
          </div>
        </div>

        {/* Deposit Info */}
        {req.depositAmount ? (
          <div className="flex items-center justify-between p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <Lock size={18} />
              </div>
              <div>
                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Escrow Active</p>
                <p className="text-xs text-white font-bold">${req.depositAmount.toLocaleString()}</p>
              </div>
            </div>
            <div className="text-[9px] font-bold text-sky-100/30 uppercase tracking-[0.2em] flex items-center gap-2">
              <ShieldCheck size={12} className="text-emerald-400" /> Community Secured
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-4 bg-sky-500/5 border border-sky-500/10 rounded-2xl">
            <Info size={16} className="text-sky-400" />
            <p className="text-[9px] font-bold text-sky-100/40 uppercase tracking-widest">No security deposit required for this coordination cycle</p>
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-20">
      <ScannerModal 
        show={activeScanner.show}
        onClose={() => setActiveScanner({ ...activeScanner, show: false })}
        title={activeScanner.type === 'handover' ? 'Scan Handover Token' : 'Scan Return QR Code'}
        onScan={(data) => {
          if (activeScanner.type === 'handover') {
            handleVerifyHandover(activeScanner.requestId, data);
          } else {
            handleVerifyReturn(activeScanner.requestId, data);
          }
        }}
      />
      
      <QRCodeModal 
        show={activeQRCode.show}
        onClose={() => setActiveQRCode({ ...activeQRCode, show: false })}
        value={activeQRCode.value}
        title={activeQRCode.title}
        subtitle={activeQRCode.subtitle}
      />

      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-4">
            <h1 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter">Handover Hub</h1>
            <p className="text-sky-100/40 font-black uppercase tracking-[0.4em] text-[10px] md:text-xs max-w-xl">
              Centralized terminal for secure physical resource exchange and security deposit management.
            </p>
          </div>
          <div className="flex gap-4">
             <button onClick={fetchData} className="glass-button bg-sky-500/5 text-sky-400 border-sky-500/10 hover:bg-sky-500/10 px-6">
               <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
             </button>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {[1,2,3,4].map(i => (
            <div key={i} className="glass-card h-80 animate-pulse border-white/10" />
          ))}
        </div>
      ) : (
        <div className="space-y-16">
          {/* Lending Section */}
          {incoming.length > 0 && (
            <div className="space-y-8">
              <div className="flex items-center gap-4">
                <div className="h-0.5 flex-1 bg-sky-500/10" />
                <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-sky-400 whitespace-nowrap">Your Lending Streams ({incoming.length})</h2>
                <div className="h-0.5 flex-1 bg-sky-500/10" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {incoming.map(req => (
                  <div key={req._id}>
                    <TransactionCard req={req} type="lending" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Borrowing Section */}
          {outgoing.length > 0 && (
            <div className="space-y-8">
              <div className="flex items-center gap-4">
                <div className="h-0.5 flex-1 bg-emerald-500/10" />
                <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-emerald-400 whitespace-nowrap">Your Synchronization Tasks ({outgoing.length})</h2>
                <div className="h-0.5 flex-1 bg-emerald-500/10" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {outgoing.map(req => (
                  <div key={req._id}>
                    <TransactionCard req={req} type="borrowing" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {incoming.length === 0 && outgoing.length === 0 && (
            <div className="glass-card py-32 flex flex-col items-center justify-center text-center space-y-6">
              <div className="w-24 h-24 rounded-[2.5rem] bg-sky-500/5 backdrop-blur-3xl border border-sky-500/10 flex items-center justify-center text-sky-100/10">
                <ArrowRightLeft size={48} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-white uppercase tracking-tight">Terminal Idle</h3>
                <p className="text-[10px] text-sky-100/30 font-bold uppercase tracking-widest max-w-xs leading-relaxed">
                  No active handovers or pending returns detected in the neighborhood network.
                </p>
              </div>
              <Link to="/marketplace" className="glass-button bg-sky-500 text-white px-10 border-transparent hover:bg-sky-600 transition-all">
                Synchronize Resources
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
