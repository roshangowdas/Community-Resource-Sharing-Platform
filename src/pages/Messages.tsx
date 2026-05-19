import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, 
  Send, 
  Clock, 
  CheckCircle, 
  XCircle, 
  ChevronRight, 
  Lock, 
  Calendar,
  User as UserIcon,
  Tag,
  Star,
  X,
  AlertCircle,
  QrCode,
  ShieldCheck,
  Camera
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../SocketContext';
import ConfirmationModal from '../components/ConfirmationModal';
import { QRCodeCanvas } from 'qrcode.react';
import ScannerModal from '../components/ScannerModal';

import { getOptimizedImage } from '../lib/imageUtils';

interface Message {
  _id: string;
  sender?: { _id: string, name: string, avatar?: string };
  text: string;
  isSystem?: boolean;
  createdAt: string;
}

interface Request {
  _id: string;
  item: { _id: string, title: string, images: string[], type: string, depositAmount?: number, value?: number };
  requester: { _id: string, name: string };
  owner: { _id: string, name: string };
  status: 'pending' | 'approved' | 'deposit_paid' | 'item_handed_over' | 'borrowed' | 'return_requested' | 'returned' | 'completed' | 'disputed' | 'cancelled';
  message: string;
  depositAmount?: number;
  borrowStartDate?: string;
  borrowEndDate?: string;
  borrowerHandoverToken?: string;
  ownerHandoverToken?: string;
  borrowerHandoverVerified?: boolean;
  ownerHandoverVerified?: boolean;
  handoverQRCode?: string;
  returnQRCode?: string;
  returnQRDataURL?: string;
  handoverConditionReport?: string;
  returnConditionReport?: string;
  aiDamageDetected?: boolean;
  insuranceFee?: number;
  insuranceCovered?: boolean;
  createdAt: string;
}

export default function Messages() {
  const { user, token, apiFetch } = useAuth();
  const { socket, connected } = useSocket();
  const [searchParams, setSearchParams] = useSearchParams();
  const [incoming, setIncoming] = useState<Request[]>([]);
  const [outgoing, setOutgoing] = useState<Request[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  
  // Escrow state
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [escrowEstimates, setEscrowEstimates] = useState<any>(null);
  const [useInsurance, setUseInsurance] = useState(true);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerType, setScannerType] = useState<'handover' | 'return'>('handover');
  
  useEffect(() => {
    if (showDepositModal && selectedRequest) {
      fetchEscrowEstimates();
    }
  }, [showDepositModal, selectedRequest]);

  const fetchEscrowEstimates = async () => {
    try {
      const { ok, data } = await apiFetch(`/api/escrow/calculate-deposit/${selectedRequest?._id}`);
      if (ok) setEscrowEstimates(data);
    } catch (err) {
      console.error('Failed to fetch escrow estimates', err);
    }
  };
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeDesc, setDisputeDesc] = useState('');
  const [submittingEscrow, setSubmittingEscrow] = useState(false);
  
  useEffect(() => {
    if (socket) {
      // Listen for new requests even if no request is currently selected
      socket.on('new_incoming_request', (newReq: Request) => {
        setIncoming(prev => {
          if (prev.find(r => r._id === newReq._id)) return prev;
          return [newReq, ...prev];
        });
      });

      // Global request update listener for sidebar refresh
      socket.on('request_updated', (updatedRequest: any) => {
        const isOwner = updatedRequest.owner?._id === user?.id || updatedRequest.owner === user?.id;
        const isRequester = updatedRequest.requester?._id === user?.id || updatedRequest.requester === user?.id;

        if (isOwner) {
          setIncoming(prev => {
            if (prev.find(r => r._id === updatedRequest._id)) {
              return prev.map(r => r._id === updatedRequest._id ? { ...r, ...updatedRequest } : r);
            }
            return [updatedRequest, ...prev];
          });
        }
        
        if (isRequester) {
          setOutgoing(prev => {
            if (prev.find(r => r._id === updatedRequest._id)) {
              return prev.map(r => r._id === updatedRequest._id ? { ...r, ...updatedRequest } : r);
            }
            return [updatedRequest, ...prev];
          });
        }
        
        if (selectedRequest && updatedRequest._id === selectedRequest._id) {
          setSelectedRequest(prev => {
            if (!prev) return updatedRequest;
            return {
              ...prev,
              ...updatedRequest,
              item: { ...prev.item, ...(updatedRequest.item || {}) }
            };
          });
        }
      });

      return () => {
        socket.off('new_incoming_request');
        socket.off('request_updated');
      };
    }
  }, [socket, selectedRequest]);

  useEffect(() => {
    const validSocketStatuses = [
      'pending',
      'approved', 
      'deposit_paid', 
      'item_handed_over', 
      'borrowed', 
      'return_requested', 
      'returned', 
      'completed',
      'disputed'
    ];
    if (socket && selectedRequest && validSocketStatuses.includes(selectedRequest.status)) {
      socket.emit('join_room', selectedRequest._id);

      const handleReceiveMessage = (message: Message) => {
        setMessages(prev => {
          // Prevent duplicates
          if (prev.find(m => m._id === message._id)) return prev;
          return [...prev, message];
        });
      };

      socket.on('receive_message', handleReceiveMessage);
      
      return () => {
        socket.off('receive_message', handleReceiveMessage);
      };
    }
  }, [socket, selectedRequest]);
  
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reviewing, setReviewing] = useState(false);
  
  const [confirmConfig, setConfirmConfig] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant: 'danger' | 'info';
    confirmText?: string;
  }>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {},
    variant: 'info',
    confirmText: 'Confirm'
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (token) {
      fetchRequests();
    }
  }, [token]);

  useEffect(() => {
    if (incoming.length > 0 || outgoing.length > 0) {
      const requestId = searchParams.get('id');
      if (requestId) {
        const found = [...incoming, ...outgoing].find(r => r._id === requestId);
        if (found) {
          setSelectedRequest(found);
        }
      }
    }
  }, [incoming, outgoing, searchParams]);

  useEffect(() => {
    if (selectedRequest && (
      selectedRequest.status === 'pending' ||
      selectedRequest.status === 'approved' || 
      selectedRequest.status === 'deposit_paid' ||
      selectedRequest.status === 'item_handed_over' ||
      selectedRequest.status === 'borrowed' ||
      selectedRequest.status === 'return_requested' ||
      selectedRequest.status === 'returned' ||
      selectedRequest.status === 'completed' ||
      selectedRequest.status === 'disputed'
    )) {
      fetchMessages(selectedRequest._id);
    }
  }, [selectedRequest]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const [resOut, resIn] = await Promise.all([
        apiFetch('/api/requests/me'),
        apiFetch('/api/requests/incoming')
      ]);
      
      const outData = resOut.data;
      const inData = resIn.data;
      
      setOutgoing(Array.isArray(outData) ? outData : []);
      setIncoming(Array.isArray(inData) ? inData : []);

      // Refresh selected request if it exists
      if (selectedRequest) {
        const updated = [...(Array.isArray(outData) ? outData : []), ...(Array.isArray(inData) ? inData : [])].find(r => r._id === selectedRequest._id);
        if (updated) setSelectedRequest(updated);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (requestId: string) => {
    setLoadingMessages(true);
    try {
      const { ok, data } = await apiFetch(`/api/messages/${requestId}`);
      if (ok) {
        setMessages(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const getRequestOwnerId = (req: Request) => {
    return typeof req.owner === 'object' ? req.owner._id : req.owner;
  };

  const getRequestRequesterId = (req: Request) => {
    return typeof req.requester === 'object' ? req.requester._id : req.requester;
  };

  const isUserOwner = (req: Request) => {
    return getRequestOwnerId(req) === user?.id;
  };

  const isUserRequester = (req: Request) => {
    return getRequestRequesterId(req) === user?.id;
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedRequest || !socket) return;
    try {
       socket.emit('send_message', {
         requestId: selectedRequest._id,
         text: newMessage
       });
       setNewMessage('');
    } catch (err) {
      console.error(err);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    if (status === 'rejected') {
      setConfirmConfig({
        show: true,
        title: "Reject Neighbor Request?",
        message: "This node will no longer be able to coordinate for this specific resource. This action is final and will notify the neighbor.",
        variant: 'danger',
        confirmText: "Reject Request",
        onConfirm: () => executeStatusUpdate(id, status)
      });
      return;
    }

    if (status === 'completed') {
      setConfirmConfig({
        show: true,
        title: "Finalize Match",
        message: "Confirm the resource has been exchanged or returned to complete this coordination cycle.",
        variant: 'info',
        confirmText: "Complete Cycle",
        onConfirm: () => executeStatusUpdate(id, status)
      });
      return;
    }

    executeStatusUpdate(id, status);
  };

  const executeStatusUpdate = async (id: string, status: string) => {
    try {
      const { ok, data } = await apiFetch(`/api/requests/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });
      if (ok) {
        fetchRequests();
      } else {
        alert(data.error || 'Failed to update request status');
      }
    } catch (err) {
      console.error(err);
      alert('Error connecting to server to update request');
    }
  };

  const payDeposit = async () => {
    if (!selectedRequest) return;
    setSubmittingEscrow(true);
    try {
      const { ok, data } = await apiFetch('/api/escrow/confirm-escrow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          requestId: selectedRequest._id,
          useInsurance 
        })
      });
      
      if (ok) {
        setShowDepositModal(false);
        fetchRequests();
        alert('Security deposit has been successfully committed to the community ledger.');
      } else {
        alert(data.error || 'Failed to complete escrow transaction.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error during escrow coordination.');
    } finally {
      setSubmittingEscrow(false);
    }
  };

  const verifyHandover = async (code: string) => {
    if (!selectedRequest) return;
    try {
      const { ok, data } = await apiFetch(`/api/requests/${selectedRequest._id}/verify-handover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: code })
      });
      if (ok) fetchRequests();
      else alert(data.error);
    } catch (err) {
      console.error(err);
    }
  };

  const verifyReturn = async (code: string) => {
    if (!selectedRequest) return;
    try {
      const { ok, data } = await apiFetch(`/api/requests/${selectedRequest._id}/verify-return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrCode: code })
      });
      if (ok) fetchRequests();
      else alert(data.error);
    } catch (err) {
      console.error(err);
    }
  };

  const requestReturn = async () => {
    if (!selectedRequest) return;
    try {
      const { ok, data } = await apiFetch(`/api/requests/${selectedRequest._id}/return-request`, {
        method: 'POST'
      });
      if (ok) fetchRequests();
    } catch (err) {
      console.error(err);
    }
  };

  const confirmReturn = async () => {
    if (!selectedRequest) return;
    try {
      const { ok, data } = await apiFetch(`/api/requests/${selectedRequest._id}/return-confirm`, {
        method: 'POST'
      });
      if (ok) fetchRequests();
    } catch (err) {
      console.error(err);
    }
  };

  const submitDispute = async () => {
    if (!selectedRequest) return;
    setSubmittingEscrow(true);
    try {
      const { ok, data } = await apiFetch('/api/escrow/dispute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          requestId: selectedRequest._id,
          reason: disputeReason,
          description: disputeDesc
        })
      });
      if (ok) {
        setShowDisputeModal(false);
        fetchRequests();
        alert('Dispute raised successfully. Admin will review.');
      } else {
        alert(data.error || 'Failed to raise dispute');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingEscrow(false);
    }
  };

  const submitReview = async () => {
    if (!selectedRequest) return;
    setReviewing(true);
    try {
      const { ok, data } = await apiFetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requestId: selectedRequest._id,
          rating,
          comment
        })
      });
      if (ok) {
        setShowReviewModal(false);
        setComment('');
        alert('Thank you for your feedback!');
      } else {
        alert(data.error || 'Failed to submit review');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setReviewing(false);
    }
  };

  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <Lock size={48} className="text-gray-300" />
        <h2 className="text-xl font-bold">Please login to see messages</h2>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-12rem)] max-h-[calc(100vh-12rem)] glass-card overflow-hidden flex flex-col md:flex-row shadow-2xl shadow-blue-500/5">
      {/* Sidebar */}
      <div className={`w-full md:w-80 lg:w-96 border-r border-sky-500/10 flex flex-col bg-slate-950/20 ${selectedRequest ? 'hidden md:flex' : 'flex'} h-full`}>
        <div className="p-6 md:p-8 border-b border-sky-500/10 shrink-0 flex items-center justify-between">
          <div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white uppercase tracking-tighter">Coordination</h2>
            <div className="flex items-center gap-2 mt-2">
              <p className="text-[9px] md:text-[10px] uppercase font-bold text-sky-100/30 tracking-[0.3em]">Active Node List</p>
              <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
          {loading ? (
            <div className="space-y-4 px-2">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-20 bg-sky-500/5 border border-sky-500/10 rounded-[1.5rem] animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {/* Incoming Requests */}
              <div>
                <h3 className="text-[10px] font-bold text-sky-100/20 uppercase tracking-widest px-4 mb-4">Incoming Requests</h3>
                <div className="space-y-3">
                  {incoming.map(req => (
                    <button 
                      key={req._id}
                      onClick={() => setSelectedRequest(req)}
                      className={`w-full text-left p-5 rounded-[1.5rem] border transition-all duration-300 ${
                        selectedRequest?._id === req._id 
                        ? 'bg-sky-500/10 border-sky-500/30 shadow-xl shadow-sky-500/5 ring-1 ring-sky-500/20 scale-[1.02]' 
                        : 'bg-sky-500/5 border-sky-500/10 hover:bg-sky-500/10 hover:border-sky-500/20 shadow-sm'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-bold text-white line-clamp-1 uppercase tracking-tight">{req.item?.title || 'Unknown Resource'}</span>
                        {req.status === 'pending' && <div className="w-2.5 h-2.5 bg-sky-400 rounded-full animate-ping" />}
                      </div>
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 bg-sky-500/20 rounded-xl flex items-center justify-center text-[10px] font-bold text-sky-400 shadow-inner">{req.requester?.name?.[0] || 'N'}</div>
                        <span className="text-[10px] text-sky-100/30 font-bold uppercase tracking-widest">from {req.requester?.name || 'Neighbor'}</span>
                      </div>
                    </button>
                  ))}
                  {incoming.length === 0 && <p className="text-[10px] text-sky-100/20 font-bold uppercase tracking-widest px-4 italic">No incoming requests</p>}
                </div>
              </div>

              {/* Outgoing Requests */}
              <div>
                <h3 className="text-[10px] font-bold text-sky-100/20 uppercase tracking-widest px-4 mb-4">Your Requests</h3>
                <div className="space-y-3">
                  {outgoing.map(req => (
                    <button 
                      key={req._id}
                      onClick={() => setSelectedRequest(req)}
                      className={`w-full text-left p-5 rounded-[1.5rem] border transition-all duration-300 ${
                        selectedRequest?._id === req._id 
                        ? 'bg-sky-500/10 border-sky-500/30 shadow-xl shadow-sky-500/5 ring-1 ring-sky-500/20 scale-[1.02]' 
                        : 'bg-sky-500/5 border-sky-500/10 hover:bg-sky-500/10 hover:border-sky-500/20 shadow-sm'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-bold text-white line-clamp-1 uppercase tracking-tight">{req.item?.title || 'Unknown Resource'}</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                         <span className={`text-[10px] font-bold px-3 py-1 rounded-xl border uppercase tracking-widest ${
                           req.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                           req.status === 'pending' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' : 
                           req.status === 'completed' ? 'bg-sky-100/5 text-sky-100/40 border-sky-100/10' :
                           'bg-sky-100/5 text-sky-100/20 border-sky-100/5'
                         }`}>
                           {req.status}
                         </span>
                      </div>
                    </button>
                  ))}
                  {outgoing.length === 0 && <p className="text-[10px] text-sky-100/20 font-bold uppercase tracking-widest px-4 italic">You haven't requested anything yet</p>}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Chat Area */}
    <div className={`flex-1 flex flex-col min-h-0 bg-slate-950/40 ${!selectedRequest ? 'hidden md:flex' : 'flex'} relative`}>
        {selectedRequest ? (
          <>
            {/* Header */}
            <div className="p-4 md:p-6 lg:p-8 border-b border-sky-500/10 flex items-center justify-between gap-4 bg-sky-500/5 shrink-0 relative z-10">
              <div className="flex items-center gap-3 md:gap-4 lg:gap-6 min-w-0 flex-1">
                <button 
                  onClick={() => setSelectedRequest(null)}
                  className="md:hidden p-2 hover:bg-sky-500/10 rounded-xl transition-colors text-sky-400 shrink-0"
                >
                  <X size={20} />
                </button>
                <div className="w-10 h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 rounded-xl lg:rounded-2xl bg-slate-900 overflow-hidden border border-sky-500/20 shadow-xl flex-shrink-0">
                  {selectedRequest.item?.images?.[0] ? (
                    <img src={getOptimizedImage(selectedRequest.item.images[0])} alt="item" className="w-full h-full object-cover" />
                  ) : <Tag size={20} className="w-full h-full p-2 lg:p-4 text-sky-100/10" />}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm md:text-base font-bold text-white uppercase tracking-tight truncate max-w-[150px] sm:max-w-[250px] md:max-w-none">{selectedRequest.item?.title || 'Unknown Resource'}</h3>
                  <p className="text-[8px] md:text-[9px] text-sky-100/40 flex items-center gap-2 uppercase tracking-[0.2em] font-bold mt-0.5 md:mt-1 truncate">
                     {isUserOwner(selectedRequest) ? `${selectedRequest.requester?.name || 'Neighbor'}` : `${selectedRequest.owner?.name || 'Owner'}`}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 shrink-0">
                {/* General Actions */}
                {isUserOwner(selectedRequest) && selectedRequest.status === 'pending' && (
                  <div className="flex gap-2">
                    <button onClick={() => updateStatus(selectedRequest._id, 'rejected')} className="glass-button !bg-rose-500/10 !text-rose-400 !border-rose-500/20 hover:!bg-rose-500 hover:!text-white px-3 md:px-4 !py-1.5 md:!py-2 text-[9px] md:text-[10px]">
                      Decline
                    </button>
                    <button onClick={() => updateStatus(selectedRequest._id, 'approved')} className="glass-button !bg-sky-500 !text-white !border-transparent hover:!bg-sky-600 px-3 md:px-4 !py-1.5 md:!py-2 text-[9px] md:text-[10px]">
                      Approve
                    </button>
                  </div>
                )}

                {isUserOwner(selectedRequest) && selectedRequest.status === 'approved' && (selectedRequest.item.depositAmount || 0) > 0 && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-xl text-[10px] font-bold uppercase tracking-widest">
                    <Clock size={12} className="animate-pulse" />
                    <span>Waiting for Deposit</span>
                  </div>
                )}
                
                {/* Borrower Actions */}
                {isUserRequester(selectedRequest) && selectedRequest.status === 'approved' && (selectedRequest.item.depositAmount || 0) > 0 && (
                  <button onClick={() => setShowDepositModal(true)} className="glass-button !bg-emerald-500 !text-white !border-transparent hover:!bg-emerald-600 px-4 md:px-6 !py-1.5 md:!py-2 text-[9px] md:text-[10px] whitespace-nowrap flex items-center gap-2">
                    <Lock size={12} /> Pay Deposit
                  </button>
                )}
                
                {isUserRequester(selectedRequest) && (selectedRequest.status === 'borrowed' || selectedRequest.status === 'item_handed_over') && (
                   <button onClick={requestReturn} className="glass-button !bg-sky-500 !text-white !border-transparent hover:!bg-sky-600 px-4 md:px-6 !py-1.5 md:!py-2 text-[9px] md:text-[10px] whitespace-nowrap">
                     Mark Returned
                   </button>
                )}

                {/* Dual Handover Scans */}
                {(selectedRequest.status === 'deposit_paid' || (selectedRequest.status === 'approved' && (selectedRequest.item.depositAmount || 0) === 0)) && (
                   <>
                      {isUserOwner(selectedRequest) && !selectedRequest.borrowerHandoverVerified && (
                        <button 
                          onClick={() => {
                            setScannerType('handover');
                            setShowScanner(true);
                          }} 
                          className="glass-button !bg-sky-500 !text-white !border-transparent hover:!bg-sky-600 px-4 md:px-6 !py-1.5 md:!py-2 text-[9px] md:text-[10px] whitespace-nowrap flex items-center gap-2"
                        >
                          <QrCode size={12} /> Scan Borrower QR
                        </button>
                      )}
                      {isUserRequester(selectedRequest) && !selectedRequest.ownerHandoverVerified && (
                        <button 
                          onClick={() => {
                            setScannerType('handover');
                            setShowScanner(true);
                          }} 
                          className="glass-button !bg-sky-500 !text-white !border-transparent hover:!bg-sky-600 px-4 md:px-6 !py-1.5 md:!py-2 text-[9px] md:text-[10px] whitespace-nowrap flex items-center gap-2"
                        >
                          <QrCode size={12} /> Scan Owner QR
                        </button>
                      )}
                   </>
                )}

                {isUserOwner(selectedRequest) && selectedRequest.status === 'return_requested' && (
                   <button 
                    onClick={() => {
                      setScannerType('return');
                      setShowScanner(true);
                    }} 
                    className="glass-button !bg-emerald-600 !text-white !border-transparent hover:!bg-emerald-700 px-4 md:px-6 !py-1.5 md:!py-2 text-[9px] md:text-[10px] whitespace-nowrap flex items-center gap-2"
                   >
                     <QrCode size={12} /> Scan Return QR
                   </button>
                )}

                {/* Dispute Action */}
                {['deposit_paid', 'item_handed_over', 'borrowed', 'return_requested'].includes(selectedRequest.status) && (
                  <button onClick={() => setShowDisputeModal(true)} className="glass-button !bg-rose-500/10 !text-rose-400 !border-rose-500/20 hover:!bg-rose-500 hover:!text-white px-3 md:px-4 !py-1.5 md:!py-2 text-[9px] md:text-[10px]">
                    Dispute
                  </button>
                )}

                {selectedRequest.status === 'completed' && (
                   <button onClick={() => setShowReviewModal(true)} className="glass-button !bg-sky-500/10 flex items-center justify-center gap-2 !text-sky-400 px-3 md:px-4 !py-1.5 md:!py-2 text-[9px] md:text-[10px] !border-sky-500/20">
                     <Star size={12} className="text-yellow-500" fill="currentColor" /> 
                     <span>Review</span>
                   </button>
                )}
              </div>
            </div>

            {/* Status Tracking Bar */}
            <div className="bg-slate-900/50 backdrop-blur-md px-8 py-3 border-b border-sky-500/10 flex items-center justify-between text-[8px] md:text-[10px] font-bold uppercase tracking-[0.2em] overflow-x-auto whitespace-nowrap custom-scrollbar">
               <div className="flex items-center gap-4">
                 <div className="flex items-center gap-2 text-sky-400">
                    <div className={`w-1.5 h-1.5 rounded-full bg-current ${selectedRequest.status === 'pending' ? 'animate-pulse' : ''}`} />
                    <span>Requested</span>
                 </div>
                 <ChevronRight size={10} className="text-sky-100/10" />
                 <div className={`flex items-center gap-2 ${['approved', 'deposit_paid', 'item_handed_over', 'borrowed', 'return_requested', 'returned', 'completed'].includes(selectedRequest.status) ? 'text-sky-400' : 'text-sky-100/20'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full bg-current ${selectedRequest.status === 'approved' ? 'animate-pulse' : ''}`} />
                    <span>Approved</span>
                 </div>
                 <ChevronRight size={10} className="text-sky-100/10" />
                 <div className={`flex items-center gap-2 ${['deposit_paid', 'item_handed_over', 'borrowed', 'return_requested', 'returned', 'completed'].includes(selectedRequest.status) ? 'text-emerald-400' : 'text-sky-100/20'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full bg-current ${selectedRequest.status === 'deposit_paid' ? 'animate-pulse' : ''}`} />
                    <span>Escrowed</span>
                 </div>
                 <ChevronRight size={10} className="text-sky-100/10" />
                 <div className={`flex items-center gap-2 ${['borrowed', 'return_requested', 'returned', 'completed'].includes(selectedRequest.status) ? 'text-sky-400' : 'text-sky-100/20'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full bg-current ${selectedRequest.status === 'borrowed' ? 'animate-pulse' : ''}`} />
                    <span>Borrowed</span>
                 </div>
                 <ChevronRight size={10} className="text-sky-100/10" />
                 <div className={`flex items-center gap-2 ${selectedRequest.status === 'completed' ? 'text-sky-400' : 'text-sky-100/20'}`}>
                    <div className="w-1.5 h-1.5 rounded-full bg-current" />
                    <span>Completed</span>
                 </div>
               </div>
               
               {selectedRequest.depositAmount && (
                 <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/5 px-3 py-1 rounded-full border border-emerald-500/20">
                    <Lock size={12} />
                    <span>Escrow: ${selectedRequest.depositAmount}</span>
                 </div>
               )}
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-6 md:space-y-8 custom-scrollbar" ref={scrollRef}>
              
              {/* Handover Protocol Instructions */}
              {(selectedRequest.status === 'deposit_paid' || (selectedRequest.status === 'approved' && (selectedRequest.item.depositAmount || 0) === 0)) && (
                <div className="mb-8">
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 border-sky-400/20 bg-sky-400/5 text-center">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-sky-400 mb-6">Handover Verification Protocol</h4>
                    
                    <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-12">
                      {/* My Token Display */}
                      <div className="space-y-4">
                        <p className="text-[8px] font-bold text-sky-100/40 uppercase tracking-widest">Your Private Node Token</p>
                        <div className="p-4 bg-white rounded-2xl mx-auto border-4 border-sky-400/20 shadow-2xl">
                          <QRCodeCanvas 
                            value={isUserOwner(selectedRequest) ? selectedRequest.ownerHandoverToken || '' : selectedRequest.borrowerHandoverToken || ''} 
                            size={128}
                            level="H"
                            includeMargin={false}
                          />
                        </div>
                        <p className="text-white font-mono text-[11px] bg-slate-950/40 rounded-lg p-2 border border-sky-500/10 uppercase">
                          {isUserOwner(selectedRequest) ? selectedRequest.ownerHandoverToken : selectedRequest.borrowerHandoverToken}
                        </p>
                      </div>

                      {/* Verification Status */}
                      <div className="flex flex-col gap-3 text-left">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${selectedRequest.borrowerHandoverVerified ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-slate-700'}`} />
                          <span className={`text-[9px] font-bold uppercase tracking-widest ${selectedRequest.borrowerHandoverVerified ? 'text-emerald-400' : 'text-sky-100/30'}`}>Borrower Scanned</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${selectedRequest.ownerHandoverVerified ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-slate-700'}`} />
                          <span className={`text-[9px] font-bold uppercase tracking-widest ${selectedRequest.ownerHandoverVerified ? 'text-emerald-400' : 'text-sky-100/30'}`}>Owner Scanned</span>
                        </div>
                      </div>
                    </div>

                    <p className="text-[10px] text-sky-100/40 uppercase tracking-widest leading-relaxed mt-8 bg-sky-500/10 p-4 rounded-xl border border-sky-500/20">
                      Both parties MUST scan each other's tokens to officially activate the neighbor contract.
                    </p>
                  </motion.div>
                </div>
              )}

              {/* Return Verification Instructions */}
              {isUserRequester(selectedRequest) && selectedRequest.status === 'return_requested' && selectedRequest.returnQRCode && (
                <div className="mb-8">
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 border-emerald-400/20 bg-emerald-400/5 text-center">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400 mb-6">Return Verification Protocol</h4>
                    <div className="p-4 bg-white rounded-2xl mx-auto mb-6 inline-block border-4 border-emerald-400/20 shadow-2xl overflow-hidden">
                      {selectedRequest.returnQRDataURL ? (
                        <img 
                          src={selectedRequest.returnQRDataURL} 
                          alt="Return QR" 
                          className="w-32 h-32"
                        />
                      ) : (
                        <QRCodeCanvas 
                          value={selectedRequest.returnQRCode} 
                          size={128}
                          level="H"
                        />
                      )}
                    </div>
                    <p className="text-white font-mono text-[11px] mb-2 uppercase tracking-widest">{selectedRequest.returnQRCode}</p>
                    <p className="text-[10px] text-emerald-100/40 uppercase tracking-widest leading-relaxed">Present this code for the owner to scan and release your deposit.</p>
                  </motion.div>
                </div>
              )}

              {/* Condition Reports from AI */}
              {selectedRequest.handoverConditionReport && (
                <div className="mb-8 p-6 glass-card bg-sky-500/5 border-sky-500/20">
                  <h4 className="text-[9px] font-black uppercase tracking-[0.3em] text-sky-400 mb-4 flex items-center gap-2">
                    <ShieldCheck size={14} /> Handover Condition Analysis
                  </h4>
                  <div className="text-xs text-sky-100/60 leading-relaxed italic prose-invert prose-sm">
                    {selectedRequest.handoverConditionReport}
                  </div>
                </div>
              )}

              {['pending', 'approved', 'deposit_paid', 'item_handed_over', 'borrowed', 'return_requested', 'returned', 'completed', 'disputed'].includes(selectedRequest.status) ? (
                <>
                  {loadingMessages ? (
                    <div className="space-y-6 md:space-y-8">
                      {[1, 2, 3].map(i => (
                        <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                          <div className={`w-2/3 h-16 md:h-20 rounded-[1.5rem] md:rounded-[2rem] animate-pulse bg-sky-500/5 border border-sky-500/10`} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      {messages.map((msg, i) => {
                        if (msg.isSystem) {
                          return (
                            <motion.div 
                              key={msg._id || i}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="flex justify-center"
                            >
                              <div className="bg-sky-500/5 px-4 py-1.5 rounded-full border border-sky-500/10">
                                <p className="text-[10px] font-bold text-sky-100/30 uppercase tracking-[0.2em]">{msg.text}</p>
                              </div>
                            </motion.div>
                          );
                        }

                        const isMine = msg.sender?._id === user?.id;
                        return (
                          <motion.div 
                            key={msg._id || i}
                            initial={{ opacity: 0, x: isMine ? 20 : -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={`flex items-end gap-3 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}
                          >
                            {!isMine && (
                              <div className="w-8 h-8 rounded-full bg-sky-500/20 border border-sky-500/20 flex items-center justify-center text-[10px] font-bold text-sky-400 overflow-hidden shrink-0">
                                {msg.sender?.avatar ? (
                                  <img src={msg.sender.avatar} alt={msg.sender.name} className="w-full h-full object-cover" />
                                ) : (msg.sender?.name?.[0] || '?')}
                              </div>
                            )}
                            <div className={`max-w-[85%] md:max-w-[70%] space-y-2`}>
                              <div className={`p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] text-xs md:text-sm font-medium leading-relaxed shadow-xl break-words whitespace-pre-wrap ${
                                isMine 
                                ? 'bg-sky-500 text-white rounded-tr-none shadow-sky-500/20' 
                                : 'bg-sky-500/10 text-white rounded-tl-none border border-sky-500/20 shadow-sky-500/5 backdrop-blur-md'
                              }`}>
                                {msg.text}
                              </div>
                              <p className={`text-[8px] md:text-[9px] font-bold uppercase tracking-[0.2em] text-sky-100/20 px-4 ${isMine ? 'text-right' : 'text-left'}`}>
                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </motion.div>
                        );
                      })}
                      {messages.length === 0 && (
                        <div className="text-center py-10 md:py-12">
                           <p className="text-[9px] md:text-[10px] text-sky-100/30 font-bold uppercase tracking-[0.4em] bg-sky-500/5 inline-block px-6 md:px-8 py-2 md:py-3 rounded-full border border-sky-500/10">Secure Neighbor Match Active</p>
                        </div>
                      )}
                      
                      {selectedRequest.status === 'completed' && (
                        <motion.div 
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex flex-col items-center py-10 md:py-16 space-y-6 md:space-y-8"
                        >
                          <div className="w-16 h-16 md:w-20 md:h-20 bg-emerald-500/10 rounded-[1.5rem] md:rounded-[2rem] border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-xl shadow-emerald-500/5">
                            <CheckCircle size={32} className="md:w-10 md:h-10" />
                          </div>
                          <div className="text-center space-y-3">
                            <h4 className="text-lg md:text-xl font-bold text-white uppercase tracking-tight">Cycle Completed</h4>
                            <p className="text-xs text-sky-100/40 font-medium max-w-xs mx-auto italic uppercase tracking-wider">Sharing is the foundation of our neighborhood trust.</p>
                          </div>
                          <button 
                            onClick={() => setShowReviewModal(true)}
                            className="glass-button bg-sky-500 text-white px-8 md:px-12 py-4 md:py-5 border-transparent hover:bg-sky-600 text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] shadow-2xl shadow-sky-500/20 flex items-center gap-3 transition-all hover:-translate-y-1"
                          >
                            <Star size={14} className="text-yellow-500" fill="currentColor" />
                            Leave a Review
                          </button>
                        </motion.div>
                      )}
                    </>
                  )}
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto space-y-6 md:space-y-8">
                  <div className="w-20 h-20 md:w-24 md:h-24 bg-sky-500/5 backdrop-blur-2xl rounded-[2rem] md:rounded-[2.5rem] border border-sky-500/10 flex items-center justify-center text-sky-400 shadow-inner">
                    <Lock size={40} className="md:w-12 md:h-12 text-sky-400/30" />
                  </div>
                  <div className="space-y-3 md:space-y-4">
                    <h4 className="text-xl md:text-2xl font-bold text-white uppercase tracking-tight">Verification Required</h4>
                    <p className="text-xs md:text-sm text-sky-100/40 font-medium leading-relaxed italic px-4">
                      "Neighbors coordinate via chat once a request is approved to ensure secure sharing."
                    </p>
                  </div>
                  
                  <div className="w-full p-6 md:p-8 bg-sky-500/5 border border-sky-500/10 rounded-[2rem] md:rounded-[2.5rem] text-left space-y-3 md:space-y-4 shadow-inner backdrop-blur-md">
                    <div className="flex items-center gap-3 text-[10px] md:text-xs font-bold text-sky-400 uppercase tracking-widest">
                      <MessageSquare size={14} className="md:w-4 md:h-4 text-sky-400" /> Original Narrative
                    </div>
                    <p className="text-xs md:text-sm text-sky-100/60 italic leading-relaxed font-medium line-clamp-4 md:line-clamp-none">"{selectedRequest.message}"</p>
                  </div>
                </div>
              )}
            </div>

            {/* Input - Sticky at bottom */}
            {(selectedRequest.status === 'pending' || selectedRequest.status === 'approved' || selectedRequest.status === 'deposit_paid' || selectedRequest.status === 'item_handed_over' || selectedRequest.status === 'borrowed' || selectedRequest.status === 'return_requested' || selectedRequest.status === 'returned' || selectedRequest.status === 'completed' || selectedRequest.status === 'disputed') && (
              <div className="p-4 md:p-6 border-t border-sky-500/10 bg-slate-950/60 shrink-0">
                <div className="flex gap-2 md:gap-4">
                  <input 
                    type="text" 
                    placeholder="Message neighbor..."
                    className="flex-1 bg-sky-500/5 backdrop-blur-md border border-sky-500/20 rounded-2xl px-4 md:px-6 py-3 md:py-4 text-xs md:text-sm font-medium focus:ring-4 focus:ring-sky-500/10 outline-none transition-all text-white placeholder:text-sky-100/20"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  />
                  <button onClick={sendMessage} className="w-12 h-12 md:w-14 md:h-14 bg-sky-500 text-white rounded-2xl flex items-center justify-center hover:bg-sky-600 transition-all shadow-xl shadow-sky-500/20 shrink-0">
                    <Send size={18} className="md:w-5 md:h-5" />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 md:p-12 space-y-4 md:space-y-6">
            <div className="w-20 h-20 md:w-24 md:h-24 bg-sky-500/5 rounded-3xl border border-sky-500/10 flex items-center justify-center text-sky-400/20 shadow-inner backdrop-blur-3xl">
              <MessageSquare size={40} className="md:w-12 md:h-12" />
            </div>
            <div className="space-y-2 md:space-y-3">
              <h3 className="text-xl md:text-2xl font-bold text-white tracking-tight uppercase">Your Inbox</h3>
              <p className="text-[10px] md:text-xs text-sky-100/40 font-medium max-w-xs mx-auto italic uppercase tracking-wider">Select a conversation to begin coordinating neighborhood exchanges.</p>
            </div>
          </div>
        )}
      </div>

      {/* Review Modal */}
      <AnimatePresence>
        {showReviewModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowReviewModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 30 }} className="glass-card relative z-10 w-full max-w-lg p-10 md:p-14 border-sky-500/10 shadow-3xl overflow-y-auto max-h-[90vh] custom-scrollbar">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-yellow-500" />
              <button onClick={() => setShowReviewModal(false)} className="absolute top-6 right-6 text-sky-100/30 hover:text-sky-400 hover:scale-110 transition-transform"><X size={28} /></button>
              
              <div className="text-center space-y-10">
                <div className="w-24 h-24 bg-yellow-500/10 rounded-[2.5rem] flex items-center justify-center text-yellow-500 mx-auto shadow-inner border border-yellow-500/20">
                   <Star size={44} fill="currentColor" />
                </div>
                <div className="space-y-3">
                  <h3 className="text-3xl font-bold text-white uppercase tracking-tighter">Match Feedback</h3>
                  <p className="text-sm text-sky-100/40 font-medium italic underline underline-offset-4 decoration-sky-500/30 font-serif">"Honest feedback builds a high-trust neighborhood."</p>
                </div>

                <div className="flex justify-center gap-4">
                  {[1, 2, 3, 4, 5].map(s => (
                    <button key={s} onClick={() => setRating(s)} className={`p-1 transition-all hover:scale-125 ${rating >= s ? 'text-yellow-500' : 'text-sky-100/10'}`}>
                      <Star size={36} fill={rating >= s ? "currentColor" : "none"} />
                    </button>
                  ))}
                </div>

                <textarea 
                  placeholder="Share your experience with this neighbor match..."
                  className="w-full bg-sky-500/5 border border-sky-500/20 rounded-[2rem] p-8 text-sm font-medium focus:ring-4 focus:ring-sky-500/10 outline-none transition-all h-40 resize-none shadow-inner text-white placeholder:text-sky-100/20"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />

                <button 
                  onClick={submitReview}
                  disabled={reviewing || !comment.trim()}
                  className="w-full bg-sky-500 text-white py-6 rounded-[2rem] font-bold text-sm uppercase tracking-[0.3em] hover:bg-sky-600 transition-all disabled:opacity-50 shadow-3xl shadow-sky-500/20 hover:-translate-y-1"
                >
                  {reviewing ? 'Broadcasting...' : 'Submit Review'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Deposit Modal */}
      <AnimatePresence>
        {showDepositModal && selectedRequest && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDepositModal(false)} className="absolute inset-0 bg-slate-950/90 backdrop-blur-2xl" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 40 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 40 }} className="glass-card relative z-10 w-full max-w-md p-8 md:p-10 border-emerald-500/20 text-center">
              <div className="w-20 h-20 bg-emerald-500/10 rounded-[2rem] border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto mb-8 shadow-inner">
                 <Lock size={36} />
              </div>
              <h3 className="text-2xl font-bold text-white uppercase tracking-tighter mb-4">Escrow Protocol</h3>
              <p className="text-xs text-sky-100/40 font-medium mb-8 uppercase tracking-widest leading-relaxed">
                Deposit of <span className="text-emerald-400 font-bold">${selectedRequest.item.depositAmount}</span> is required to proceed. 
                Funds will be held in secure escrow and automatically refunded upon successful return.
              </p>
              
              <div className="bg-slate-900/50 p-6 rounded-2xl border border-sky-500/10 mb-8 text-left space-y-4">
                 <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                    <span className="text-sky-100/30">Refundable Deposit</span>
                    <span className="text-white">${escrowEstimates?.dynamicDeposit || selectedRequest.item.depositAmount}</span>
                 </div>
                 {escrowEstimates?.multiplier < 1 && (
                    <div className="flex justify-between text-[8px] font-bold uppercase tracking-widest text-emerald-400">
                       <span>Trust Discount Applied</span>
                       <span>-{(1 - escrowEstimates.multiplier) * 100}%</span>
                    </div>
                 )}
                 
                 <div className="flex items-center justify-between border-t border-sky-500/10 pt-4">
                    <div className="flex flex-col">
                       <span className="text-[10px] font-bold text-sky-100/30 uppercase tracking-widest">Safety Insurance</span>
                       <span className="text-[7px] text-sky-100/10 uppercase tracking-widest">Covers accidental damage</span>
                    </div>
                    <button 
                      onClick={() => setUseInsurance(!useInsurance)}
                      className={`w-12 h-6 rounded-full p-1 transition-all ${useInsurance ? 'bg-emerald-500' : 'bg-slate-700'}`}
                    >
                       <div className={`w-4 h-4 bg-white rounded-full transition-all ${useInsurance ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                 </div>

                 {useInsurance && (
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                       <span className="text-sky-100/30">Insurance Fee (Non-refundable)</span>
                       <span className="text-white">${escrowEstimates?.insuranceFee || 2}</span>
                    </div>
                 )}

                 <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest border-t border-sky-500/10 pt-4">
                    <span className="text-sky-100/30">Total Escrow</span>
                    <span className="text-emerald-400 font-black">
                       ${(escrowEstimates?.dynamicDeposit || 0) + (useInsurance ? (escrowEstimates?.insuranceFee || 2) : 0)}
                    </span>
                 </div>
              </div>

              <button 
                onClick={payDeposit}
                disabled={submittingEscrow}
                className="w-full glass-button bg-emerald-500 text-white py-5 rounded-2xl font-bold uppercase tracking-[0.2em] shadow-2xl shadow-emerald-500/20 hover:-translate-y-1 transition-all disabled:opacity-50"
              >
                {submittingEscrow ? 'Processing...' : 'Authorize Escrow'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dispute Modal */}
      <AnimatePresence>
        {showDisputeModal && selectedRequest && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDisputeModal(false)} className="absolute inset-0 bg-rose-950/80 backdrop-blur-2xl" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 40 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 40 }} className="glass-card relative z-10 w-full max-w-md p-8 md:p-10 border-rose-500/20">
              <h3 className="text-2xl font-bold text-white uppercase tracking-tighter mb-2">Raise Dispute</h3>
              <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-8 flex items-center gap-2">
                 <AlertCircle size={14} /> Arbitration Protocol Initialized
              </p>
              
              <div className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[9px] uppercase tracking-widest font-bold text-sky-100/30">Reason for Dispute</label>
                    <select 
                      value={disputeReason}
                      onChange={(e) => setDisputeReason(e.target.value)}
                      className="w-full bg-slate-900 border border-rose-500/20 rounded-xl p-4 text-xs font-bold text-white outline-none"
                    >
                       <option value="">Select a reason...</option>
                       <option value="not_returned">Item Not Returned</option>
                       <option value="damaged">Item Damaged</option>
                       <option value="not_as_described">Item Not As Described</option>
                       <option value="safety_concern">Safety Concern</option>
                       <option value="other">Other</option>
                    </select>
                 </div>
                 
                 <div className="space-y-2">
                    <label className="text-[9px] uppercase tracking-widest font-bold text-sky-100/30">Detailed Narrative</label>
                    <textarea 
                      placeholder="Provide specific details for the admin review..."
                      className="w-full bg-slate-900 border border-rose-500/20 rounded-xl p-4 text-xs font-bold text-white outline-none h-32 resize-none"
                      value={disputeDesc}
                      onChange={(e) => setDisputeDesc(e.target.value)}
                    />
                 </div>
                 
                 <div className="flex gap-4">
                    <button 
                      onClick={() => setShowDisputeModal(false)}
                      className="flex-1 glass-button bg-slate-800 text-sky-100/40 py-4 rounded-xl font-bold uppercase tracking-widest text-[9px]"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={submitDispute}
                      disabled={submittingEscrow || !disputeReason || !disputeDesc}
                      className="flex-[2] glass-button bg-rose-500 text-white py-4 rounded-xl font-bold uppercase tracking-widest shadow-xl shadow-rose-500/20 disabled:opacity-50 text-[10px]"
                    >
                      {submittingEscrow ? 'Submitting...' : 'Initiate Review'}
                    </button>
                 </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmationModal 
        show={confirmConfig.show}
        onClose={() => setConfirmConfig({ ...confirmConfig, show: false })}
        onConfirm={confirmConfig.onConfirm}
        title={confirmConfig.title}
        message={confirmConfig.message}
        variant={confirmConfig.variant}
        confirmText={confirmConfig.confirmText}
      />
      {/* Scanner Modal */}
      <ScannerModal 
        show={showScanner}
        onClose={() => setShowScanner(false)}
        title={scannerType === 'handover' ? 'Verify Handover' : 'Verify Return'}
        onScan={(data) => {
          setShowScanner(false);
          if (scannerType === 'handover') verifyHandover(data);
          else verifyReturn(data);
        }}
      />
    </div>
  );
}

