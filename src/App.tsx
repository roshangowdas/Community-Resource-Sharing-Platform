import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { SocketProvider } from './SocketContext';
import { NotificationProvider } from './NotificationContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  PlusCircle, 
  User as UserIcon, 
  MessageSquare, 
  Menu,
  X,
  ShieldCheck,
  Bell,
  Tag,
  MapPin,
  ChevronRight,
  Package,
  QrCode
} from 'lucide-react';
import NotificationBell from './components/NotificationBell';
import MaintenanceBanner from './components/MaintenanceBanner';

// Lazy load pages
const Home = lazy(() => import('./pages/Home'));
const PostItem = lazy(() => import('./pages/PostItem'));
const Auth = lazy(() => import('./pages/Auth'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const Marketplace = lazy(() => import('./pages/Marketplace'));
const MapExplorer = lazy(() => import('./pages/MapExplorer'));
const Messages = lazy(() => import('./pages/Messages'));
const Profile = lazy(() => import('./pages/Profile'));
const Transactions = lazy(() => import('./pages/Transactions'));
const Terms = lazy(() => import('./pages/Terms'));

const PageLoader = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <div className="w-12 h-12 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

const Navigation = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <nav className="glass-header">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-11 h-11 bg-sky-500 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-[0_8px_30px_rgb(14,165,233,0.3)] ring-4 ring-sky-500/10 transition-all duration-500 group-hover:scale-110 group-hover:rotate-6">S</div>
              <span className="font-bold text-xl tracking-tighter text-white">ShareLocal</span>
            </Link>
          </div>
          
          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-10">
            <nav className="flex items-center gap-8 mr-4">
              <Link to="/" className="text-sky-100/40 hover:text-sky-400 transition-colors uppercase text-[10px] font-bold tracking-[0.2em]">Home</Link>
              <Link to="/marketplace" className="text-sky-100/40 hover:text-sky-400 transition-colors uppercase text-[10px] font-bold tracking-[0.2em]">Browse</Link>
              <Link to="/map" className="text-sky-100/40 hover:text-sky-400 transition-colors uppercase text-[10px] font-bold tracking-[0.2em]">Map View</Link>
              <Link to="/transactions" className="text-sky-500 font-black hover:text-sky-400 transition-colors uppercase text-[10px] tracking-[0.2em] flex items-center gap-2">
                <QrCode size={12} strokeWidth={3} />
                <span>Handover Hub</span>
              </Link>
            </nav>
            
            <div className="flex items-center gap-3 pr-4 border-r border-sky-500/10">
              <Link to="/messages" className="text-sky-100/40 hover:text-sky-400 transition-all p-2.5 hover:bg-sky-500/5 rounded-2xl relative">
                <MessageSquare size={18} />
              </Link>
              {user && <NotificationBell />}
              {user?.isAdmin && (
                <Link to="/admin" className="text-sky-100/40 hover:text-sky-400 transition-all p-2.5 hover:bg-sky-500/5 rounded-2xl">
                  <ShieldCheck size={18} />
                </Link>
              )}
            </div>
            
            <div className="flex items-center gap-5">
              <Link to="/post" className="bg-sky-500 hover:bg-sky-400 text-white px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-sky-500/20 active:scale-95 flex items-center gap-2">
                <PlusCircle size={14} strokeWidth={3} />
                <span>Post Item</span>
              </Link>
              
              <Link to={user ? "/profile" : "/auth"} className="transition-transform hover:scale-110 flex items-center gap-3 group">
                <div className="w-11 h-11 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shadow-sm backdrop-blur-md group-hover:border-sky-500/40 transition-colors">
                  <UserIcon size={18} />
                </div>
              </Link>
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center gap-3">
            {user && <NotificationBell />}
            <button 
              onClick={() => setIsOpen(!isOpen)} 
              className="text-sky-400 p-2.5 bg-sky-500/5 border border-sky-500/10 rounded-2xl transition-all active:scale-90"
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[60] md:hidden"
            />
            <motion.div 
              initial={{ opacity: 0, x: '100%' }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-80 bg-[#020617] border-l border-sky-500/10 z-[70] md:hidden shadow-[-20px_0_60px_rgba(0,0,0,0.5)] flex flex-col p-10 overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-16">
                 <div className="flex items-center gap-2">
                   <div className="w-8 h-8 bg-sky-500 rounded-xl flex items-center justify-center text-white font-bold text-sm leading-none">S</div>
                   <span className="text-[11px] font-black text-sky-400 uppercase tracking-[0.4em]">Grid Menu</span>
                 </div>
                 <button onClick={() => setIsOpen(false)} className="text-sky-100/30 hover:text-white bg-sky-500/5 p-2 rounded-xl border border-sky-500/10 transition-all active:scale-90">
                   <X size={20} />
                 </button>
              </div>
              
              <div className="flex flex-col gap-8">
                {[
                  { to: '/', icon: Tag, label: 'Home Node', desc: 'Main terminal control' },
                  { to: '/marketplace', icon: Package, label: 'Marketplace', desc: 'Resource synchronization' },
                  { to: '/map', icon: MapPin, label: 'Geospatial', desc: 'Physical neighborhood grid' },
                  { to: '/transactions', icon: QrCode, label: 'Handover Hub', desc: 'QR codes & active transfers' },
                  { to: '/messages', icon: MessageSquare, label: 'Messages', desc: 'Coordination channel' },
                  { to: '/post', icon: PlusCircle, label: 'Broadcast', desc: 'List new local assets' },
                  { to: '/profile', icon: UserIcon, label: 'User Hub', desc: 'Personal impact stats' },
                ].map((item, idx) => (
                  <motion.div
                    key={item.to}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + idx * 0.05 }}
                  >
                    <Link 
                      to={item.to} 
                      onClick={() => setIsOpen(false)} 
                      className="group flex items-start gap-5 p-4 rounded-3xl hover:bg-sky-500/5 transition-all border border-transparent hover:border-sky-500/10"
                    >
                      <div className="w-12 h-12 bg-sky-500/10 rounded-2xl flex items-center justify-center text-sky-400 group-hover:bg-sky-500 group-hover:text-white transition-all shadow-lg group-hover:shadow-sky-500/20">
                        <item.icon size={20} />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-white uppercase tracking-widest mb-1 group-hover:text-sky-400 transition-colors">{item.label}</p>
                        <p className="text-[9px] text-sky-100/30 font-medium uppercase tracking-tighter leading-none">{item.desc}</p>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
              
              <div className="mt-auto pt-10 border-t border-sky-500/10">
                {user ? (
                   <Link to="/profile" onClick={() => setIsOpen(false)} className="flex items-center gap-4 p-4 rounded-3xl bg-sky-500/5 border border-sky-500/10 active:scale-[0.98] transition-all">
                      <div className="w-12 h-12 rounded-2xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 shadow-inner">
                         <UserIcon size={24} />
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className="text-xs font-black text-white uppercase tracking-tight truncate">{user.name}</p>
                        <p className="text-[9px] text-sky-400 font-bold uppercase tracking-[0.2em] animate-pulse">Node Sync Active</p>
                      </div>
                      <ChevronRight size={16} className="text-sky-100/20" />
                   </Link>
                ) : (
                  <Link to="/auth" onClick={() => setIsOpen(false)} className="bg-sky-500 text-white w-full rounded-2xl py-5 font-black uppercase text-xs tracking-widest text-center shadow-xl shadow-sky-500/20 active:scale-95 transition-all block">
                    Access Grid
                  </Link>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </nav>
  );
};

const AppRoutes = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
      >
        <Routes location={location}>
          <Route path="/" element={<Home />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/map" element={<MapExplorer />} />
          <Route path="/post" element={<PostItem />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/terms" element={<Terms />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
};

const AppContent = () => {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#020617]">
        <div className="w-16 h-16 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen font-sans text-slate-100">
        <MaintenanceBanner />
        <Navigation />
        <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <Suspense fallback={<PageLoader />}>
            <AppRoutes />
          </Suspense>
        </main>
        
        <footer className="glass-card mx-4 lg:mx-auto max-w-7xl py-12 md:py-16 mb-8 md:mb-12 flex flex-col items-center gap-10">
          <div className="flex flex-wrap justify-center gap-x-12 gap-y-6">
            <Link to="/" className="text-[10px] font-bold text-sky-100/40 hover:text-sky-400 transition-colors uppercase tracking-[0.3em]">Home</Link>
            <Link to="/marketplace" className="text-[10px] font-bold text-sky-100/40 hover:text-sky-400 transition-colors uppercase tracking-[0.3em]">Browse</Link>
            <Link to="/map" className="text-[10px] font-bold text-sky-100/40 hover:text-sky-400 transition-colors uppercase tracking-[0.3em]">Map</Link>
            <Link to="/terms" className="text-[10px] font-bold text-sky-100/40 hover:text-sky-400 transition-colors uppercase tracking-[0.3em]">Terms</Link>
          </div>
          
          <div className="text-center px-6 space-y-4">
            <div className="w-12 h-0.5 bg-sky-500/10 mx-auto" />
            <p className="text-sky-100/40 text-xs md:text-sm italic font-serif">"A community effort for a sustainable future through local coordination."</p>
            <p className="text-[9px] font-bold text-sky-100/20 uppercase tracking-[0.5em]">ShareLocal Hub © 2026</p>
          </div>
        </footer>
      </div>
    </Router>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <NotificationProvider>
          <AppContent />
        </NotificationProvider>
      </SocketProvider>
    </AuthProvider>
  );
}
