import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './hooks/useAuth';

export interface AppNotification {
  _id: string;
  type: 'request_created' | 'request_approved' | 'request_rejected' | 'request_completed' | 'new_message' | 'system' | 'expiration_warning';
  title: string;
  message: string;
  link?: string;
  relatedId?: string;
  read: boolean;
  createdAt: string;
  sender?: {
    _id: string;
    name: string;
    avatar?: string;
  };
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within a NotificationProvider');
  return context;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const { socket } = useSocket();
  const { token, user, apiFetch } = useAuth();

  const unreadCount = notifications.filter(n => !n.read).length;

  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const { ok, data } = await apiFetch('/api/notifications');
      if (ok) {
        setNotifications(data);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  const markAsRead = async (id: string) => {
    if (!token) return;
    try {
      const { ok } = await apiFetch(`/api/notifications/${id}/read`, {
        method: 'PATCH'
      });
      if (ok) {
        setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    if (!token) return;
    try {
      const { ok } = await apiFetch('/api/notifications/read-all', {
        method: 'PATCH'
      });
      if (ok) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      }
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const deleteNotification = async (id: string) => {
    if (!token) return;
    try {
      const { ok } = await apiFetch(`/api/notifications/${id}`, {
        method: 'DELETE'
      });
      if (ok) {
        setNotifications(prev => prev.filter(n => n._id !== id));
      }
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
    } else {
      setNotifications([]);
    }
  }, [user, token]);

  useEffect(() => {
    if (socket) {
      const handleNewNotification = (notification: AppNotification) => {
        setNotifications(prev => [notification, ...prev]);
        
        // Show a native browser notification if possible
        if ('Notification' in window && window.Notification.permission === 'granted' && document.hidden) {
          new window.Notification(notification.title, {
            body: notification.message
          });
        }
      };

      socket.on('new_notification', handleNewNotification);
      return () => {
        socket.off('new_notification', handleNewNotification);
      };
    }
  }, [socket]);

  // Request browser notification permission
  useEffect(() => {
    if ('Notification' in window && window.Notification.permission === 'default') {
      window.Notification.requestPermission().catch(err => {
        console.warn('Manual notification permission request failed:', err);
      });
    }
  }, []);

  return (
    <NotificationContext.Provider value={{ 
      notifications, 
      unreadCount, 
      fetchNotifications, 
      markAsRead, 
      markAllAsRead, 
      deleteNotification 
    }}>
      {children}
    </NotificationContext.Provider>
  );
};
