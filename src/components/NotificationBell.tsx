import React, { useState, useRef, useEffect } from 'react';
import { Bell, X, CheckSquare, MessageSquare, Package, Heart, Trash2, ExternalLink, Clock, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNotifications, AppNotification } from '../NotificationContext';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const NotificationBell: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const { apiFetch } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [renewingId, setRenewingId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const renewListing = async (e: React.MouseEvent, notificationId: string, itemId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setRenewingId(itemId);
    try {
      const { ok, data } = await apiFetch(`/api/items/${itemId}/renew`, {
        method: 'POST'
      });
      if (ok) {
        markAsRead(notificationId);
        // We could also delete the notification or show a success toast
      } else {
        alert(data.error || 'Failed to renew listing');
      }
    } catch (err) {
      console.error(err);
      alert('Error connecting to server');
    } finally {
      setRenewingId(null);
    }
  };

  const getIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'request_created': return <Package className="text-sky-400" size={16} />;
      case 'request_approved': return <CheckSquare className="text-emerald-400" size={16} />;
      case 'request_rejected': return <X className="text-rose-400" size={16} />;
      case 'request_completed': return <Heart className="text-rose-400" size={16} />;
      case 'new_message': return <MessageSquare className="text-sky-400" size={16} />;
      case 'expiration_warning': return <Clock className="text-yellow-400" size={16} />;
      default: return <Bell className="text-sky-400" size={16} />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() === new Date().toLocaleDateString()
      ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-sky-100/50 hover:text-sky-400 hover:bg-sky-500/10 rounded-xl transition-all"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-[8px] font-bold flex items-center justify-center rounded-full border-2 border-[#020617] animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="absolute right-0 mt-3 w-80 md:w-96 glass-card p-0 overflow-hidden z-50 shadow-2xl"
          >
            <div className="p-4 border-b border-sky-500/10 flex items-center justify-between bg-sky-500/5">
              <h3 className="text-[10px] font-bold text-sky-400 uppercase tracking-[0.2em]">Notifications</h3>
              {unreadCount > 0 && (
                <button 
                  onClick={markAllAsRead}
                  className="text-[9px] font-bold text-sky-100/30 hover:text-sky-400 uppercase tracking-widest transition-colors"
                >
                  Mark all as read
                </button>
              )}
            </div>

            <div className="max-h-[70vh] overflow-y-auto custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell size={32} className="mx-auto text-sky-100/10 mb-3" />
                  <p className="text-[10px] text-sky-100/30 uppercase tracking-widest font-bold">No transmissions received</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div 
                    key={notif._id}
                    className={`p-4 border-b border-sky-500/5 hover:bg-sky-500/5 transition-colors group relative ${!notif.read ? 'bg-sky-500/[0.02]' : ''}`}
                  >
                    {!notif.read && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-sky-500" />
                    )}
                    <div className="flex gap-3">
                      <div className="shrink-0 w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                        {getIcon(notif.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className={`text-[11px] font-bold tracking-tight truncate ${notif.read ? 'text-sky-100/60' : 'text-white'}`}>
                            {notif.title}
                          </h4>
                          <span className="text-[9px] text-sky-100/20 font-bold uppercase">{formatDate(notif.createdAt)}</span>
                        </div>
                        <p className="text-[10px] text-sky-100/40 leading-relaxed mb-2 line-clamp-2">
                          {notif.message}
                        </p>
                        <div className="flex items-center gap-3">
                          {notif.type === 'expiration_warning' && notif.relatedId && (
                            <button
                              onClick={(e) => renewListing(e, notif._id, notif.relatedId!)}
                              disabled={renewingId === notif.relatedId}
                              className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 disabled:opacity-50"
                            >
                              {renewingId === notif.relatedId ? <RefreshCw size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                              Renew Listing
                            </button>
                          )}
                          {notif.link && (
                            <Link 
                              to={notif.link}
                              onClick={() => {
                                markAsRead(notif._id);
                                setIsOpen(false);
                              }}
                              className="text-[9px] font-bold text-sky-400 uppercase tracking-widest flex items-center gap-1 hover:underline"
                            >
                              View <ExternalLink size={10} />
                            </Link>
                          )}
                          {!notif.read && (
                            <button 
                              onClick={() => markAsRead(notif._id)}
                              className="text-[9px] font-bold text-emerald-400/60 hover:text-emerald-400 uppercase tracking-widest"
                            >
                              Mark read
                            </button>
                          )}
                          <button 
                            onClick={() => deleteNotification(notif._id)}
                            className="text-[9px] font-bold text-rose-400/40 hover:text-rose-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity ml-auto"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {notifications.length > 0 && (
              <div className="p-3 bg-[#020617]/50 border-t border-sky-500/10 text-center">
                <p className="text-[8px] text-sky-100/20 uppercase tracking-[0.3em] font-bold">End of transmissions</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationBell;
