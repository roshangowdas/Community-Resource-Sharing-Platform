import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, MapPin, Navigation } from 'lucide-react';

// Fix for default marker icon in Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface LocationPickerProps {
  onLocationSelect: (lat: number, lng: number, address: string) => void;
  initialLat?: number;
  initialLng?: number;
}

const LocationMarker = ({ position, setPosition }: { position: L.LatLng | null, setPosition: (pos: L.LatLng) => void }) => {
  const map = useMapEvents({
    click(e) {
      setPosition(e.latlng);
      map.flyTo(e.latlng, map.getZoom());
    },
  });

  return position === null ? null : (
    <Marker position={position}></Marker>
  );
};

// Component to handle auto-centering when initial values change
const MapUpdater = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 13);
  }, [center, map]);
  return null;
};

const LocationPicker: React.FC<LocationPickerProps> = ({ onLocationSelect, initialLat, initialLng }) => {
  const [position, setPosition] = useState<L.LatLng | null>(
    initialLat && initialLng ? L.latLng(initialLat, initialLng) : null
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number]>([initialLat || 51.505, initialLng || -0.09]);

  const handleSearch = async () => {
    if (!searchQuery) return;
    setSearching(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      if (data && data.length > 0) {
        const { lat, lon, display_name } = data[0];
        const newPos = L.latLng(parseFloat(lat), parseFloat(lon));
        setPosition(newPos);
        setMapCenter([parseFloat(lat), parseFloat(lon)]);
        onLocationSelect(parseFloat(lat), parseFloat(lon), display_name);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setSearching(false);
    }
  };

  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const newPos = L.latLng(pos.coords.latitude, pos.coords.longitude);
        setPosition(newPos);
        setMapCenter([pos.coords.latitude, pos.coords.longitude]);
        
        // Reverse geocode to get a readable address
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`)
          .then(res => res.json())
          .then(data => {
            onLocationSelect(pos.coords.latitude, pos.coords.longitude, data.display_name || 'My Location');
          });
      });
    }
  };

  useEffect(() => {
    if (position) {
      // Periodic reverse geocoding if position changed via click but not search
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.lat}&lon=${position.lng}`)
        .then(res => res.json())
        .then(data => {
          onLocationSelect(position.lat, position.lng, data.display_name || `${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}`);
        });
    }
  }, [position]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-sky-400/50" size={16} />
          <input 
            type="text"
            placeholder="Search for address or neighborhood..."
            className="w-full bg-sky-500/5 border border-sky-500/20 rounded-2xl py-3 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-sky-500/20 text-white"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSearch())}
          />
        </div>
        <button 
          type="button"
          onClick={handleSearch}
          disabled={searching}
          className="bg-sky-500/10 text-sky-400 px-4 rounded-2xl hover:bg-sky-500/20 transition-all"
        >
          {searching ? '...' : <Search size={18} />}
        </button>
        <button 
          type="button"
          onClick={getUserLocation}
          className="bg-sky-500 text-white px-4 rounded-2xl hover:bg-sky-600 transition-all shadow-lg shadow-sky-500/20"
        >
          <Navigation size={18} />
        </button>
      </div>

      <div className="h-64 rounded-3xl overflow-hidden border border-sky-500/20 z-0">
        <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LocationMarker position={position} setPosition={setPosition} />
          <MapUpdater center={mapCenter} />
        </MapContainer>
      </div>
      <p className="text-[10px] text-sky-100/30 text-center uppercase tracking-widest font-bold">
        Click on map to calibrate precise pickup node
      </p>
    </div>
  );
};

export default LocationPicker;
