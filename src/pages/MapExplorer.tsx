import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useSocket } from '../SocketContext';
import { useAuth } from '../hooks/useAuth';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Filter, MapPin, Package, Info, Clock, Heart, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';

// Fix for default marker icon in Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface Item {
  _id: string;
  title: string;
  description: string;
  category: string;
  type: 'share' | 'donate';
  images: string[];
  location: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  owner: {
    _id: string;
    name: string;
    avatar?: string;
    rating: number;
    impactScore?: number;
  };
  createdAt: string;
}

const CATEGORIES = ['All', 'Power Tools', 'Kitchenware', 'Outdoors', 'Books', 'Electronics', 'Garden', 'Furniture', 'Sports'];

export default function MapExplorer() {
  const { socket } = useSocket();
  const { apiFetch, isOffline } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ category: 'All', type: 'All' });
  const [searchQuery, setSearchQuery] = useState('');
  const [radius, setRadius] = useState('All');
  const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([51.505, -0.09]);

  const fetchItems = async () => {
    try {
      let url = '/api/items';
      const params = new URLSearchParams();
      
      if (searchQuery) params.append('q', searchQuery);
      if (filter.category !== 'All') params.append('category', filter.category);
      if (radius !== 'All' && userLocation) {
        params.append('lat', userLocation.lat.toString());
        params.append('lng', userLocation.lng.toString());
        params.append('radius', radius);
      }
      
      const { ok, data } = await apiFetch(`${url}${params.toString() ? '?' + params.toString() : ''}`);
      if (ok && Array.isArray(data)) {
        setItems(data);
      }
    } catch (err) {
      console.error('Failed to fetch items:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Get user location for radius filtering
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        setMapCenter([loc.lat, loc.lng]);
      });
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [searchQuery, filter.category, radius, userLocation]);

  useEffect(() => {
    if (socket) {
      const handleNewItem = (newItem: Item) => {
        setItems(prev => {
          if (prev.some(item => item._id === newItem._id)) return prev;
          return [newItem, ...prev];
        });
        console.log('Real-time update: New item detected in the grid.', newItem.title);
      };

      const handleUpdateItem = (updatedItem: Item) => {
        setItems(prev => prev.map(item => item._id === updatedItem._id ? updatedItem : item));
      };

      const handleDeleteItem = (deletedItemId: string) => {
        setItems(prev => prev.filter(item => item._id !== deletedItemId));
      };

      socket.on('new_item', handleNewItem);
      socket.on('item_updated', handleUpdateItem);
      socket.on('item_deleted', handleDeleteItem);

      return () => {
        socket.off('new_item', handleNewItem);
        socket.off('item_updated', handleUpdateItem);
        socket.off('item_deleted', handleDeleteItem);
      };
    }
  }, [socket]);

  const filteredItems = items.filter(item => {
    if (!item.coordinates || typeof item.coordinates.lat !== 'number') return false;
    const matchesCategory = filter.category === 'All' || item.category === filter.category;
    const matchesType = filter.type === 'All' || item.type === filter.type;
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesType && matchesSearch;
  });

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col gap-4">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-sky-400/50" size={16} />
            <input 
              type="text"
              placeholder="Search the coordinate grid..."
              className="w-full bg-sky-500/5 border border-sky-500/20 rounded-2xl py-3 pl-11 pr-4 text-sm outline-none focus:ring-2 focus:ring-sky-500/20 text-white placeholder:text-sky-100/20"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="relative">
            <select 
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              className="appearance-none bg-sky-500/5 border border-sky-500/20 rounded-2xl pl-10 pr-8 py-3 text-[10px] font-bold text-sky-400 outline-none focus:ring-2 focus:ring-sky-500/20 transition-all cursor-pointer uppercase tracking-widest"
            >
              <option value="All">All Distances</option>
              <option value="2">Within 2km</option>
              <option value="5">Within 5km</option>
              <option value="10">Within 10km</option>
            </select>
            <MapPin size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-sky-400/50 pointer-events-none" />
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 w-full md:w-auto no-scrollbar">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter({ ...filter, category: cat })}
              className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all border ${filter.category === cat ? 'bg-sky-500 text-white border-sky-400 shadow-lg shadow-sky-500/20' : 'bg-sky-500/5 text-sky-100/30 border-sky-500/10 hover:bg-sky-500/10'}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 relative glass-card p-0 overflow-hidden border-sky-500/10 shadow-2xl">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[#020617]/50 backdrop-blur-sm z-50">
            <div className="text-center space-y-4">
              <div className="w-12 h-12 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin mx-auto"></div>
              <p className="text-[10px] text-sky-400 font-bold uppercase tracking-[0.3em] animate-pulse">
                {isOffline ? 'Syncing Decentralized Grid' : 'Initializing Geospatial Grid'}
              </p>
            </div>
          </div>
        ) : (
          <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%', background: '#020617' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {filteredItems.map((item) => (
              <Marker 
                key={item._id} 
                position={[item.coordinates.lat, item.coordinates.lng]}
                icon={L.icon({
                  iconUrl: icon,
                  shadowUrl: iconShadow,
                  iconSize: [25, 41],
                  iconAnchor: [12, 41],
                  className: item.type === 'donate' ? 'hue-rotate-[120deg]' : '' // Greenish for donations
                })}
              >
                <Popup className="custom-popup">
                  <div className="w-48 p-0 overflow-hidden rounded-xl bg-[#020617] border border-sky-500/20">
                    {item.images?.[0] && (
                      <div className="h-24 overflow-hidden relative">
                        <img src={item.images[0]} alt={item.title || 'Resource'} className="w-full h-full object-cover" />
                        <div className={`absolute top-2 right-2 px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest ${item.type === 'donate' ? 'bg-emerald-500 text-white' : 'bg-sky-500 text-white'}`}>
                          {item.type}
                        </div>
                      </div>
                    )}
                    <div className="p-3 space-y-2">
                      <h4 className="text-[11px] font-bold text-white uppercase tracking-tight truncate leading-none">{item.title || 'Untitled Resource'}</h4>
                      <p className="text-[9px] text-sky-100/40 line-clamp-2 leading-relaxed">{item.description || 'A neighborhood resource.'}</p>
                      
                      <div className="flex items-center justify-between pt-2 border-t border-sky-500/10">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <img src={item.owner?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + (item.owner?.name || 'neighbor')} className="w-4 h-4 rounded-full border border-sky-500/20" alt="" />
                          <div className="flex flex-col min-w-0">
                            <span className="text-[8px] text-sky-400 font-bold truncate">{item.owner?.name || 'Neighbor'}</span>
                            {((item.owner as any)?.impactScore || 0) > 0 && (
                              <span className="text-[6px] text-emerald-400 font-bold uppercase tracking-widest">Impact: {(item.owner as any).impactScore}</span>
                            )}
                          </div>
                        </div>
                        <Link 
                          to={`/marketplace?id=${item._id}`}
                          className="text-[9px] font-bold text-sky-400 flex items-center gap-1 hover:underline shrink-0"
                        >
                          Details
                        </Link>
                      </div>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}

        <div className="absolute bottom-6 right-6 z-[1000] flex flex-col gap-2">
          <div className="glass-card bg-black/80 p-3 border-sky-500/20 shadow-2xl flex flex-col gap-2">
             <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-sky-500"></div>
                <span className="text-[8px] font-bold text-sky-100/60 uppercase tracking-widest">Neighbor Share</span>
             </div>
             <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                <span className="text-[8px] font-bold text-sky-100/60 uppercase tracking-widest">Full Donation</span>
             </div>
          </div>
        </div>

        <div className="absolute top-6 left-6 z-[1000]">
           <div className="glass-card bg-black/40 p-2.5 border-sky-500/10 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-sky-500/20 flex items-center justify-center">
                 <MapPin size={16} className="text-sky-400" />
              </div>
              <div>
                 <p className="text-[8px] text-sky-400 font-bold uppercase tracking-[0.2em]">{filteredItems.length} Active Nodes</p>
                 <p className="text-[7px] text-sky-100/20 font-bold uppercase tracking-[0.1em]">Synchronized in real-time</p>
              </div>
           </div>
        </div>
      </div>
      
      <style>{`
        .custom-popup .leaflet-popup-content-wrapper {
          background: transparent !important;
          padding: 0 !important;
          box-shadow: none !important;
          border: none !important;
        }
        .custom-popup .leaflet-popup-content {
          margin: 0 !important;
          width: auto !important;
        }
        .custom-popup .leaflet-popup-tip {
          background: #020617 !important;
          border: 1px solid rgba(14, 165, 233, 0.2) !important;
        }
      `}</style>
    </div>
  );
}
