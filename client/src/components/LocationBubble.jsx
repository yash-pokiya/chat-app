import { useEffect, useRef } from 'react';
import L from 'leaflet';

export default function LocationBubble({ myCoords, partnerCoords, myUsername, partnerUsername, distance, partnerStopped }) {
  const mapElRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});

  const center = myCoords || partnerCoords || [20.5937, 78.9629]; // Default India center

  const locations = [
    myCoords ? { userId: 'me', coords: myCoords, username: myUsername || 'You' } : null,
    partnerCoords ? { userId: 'partner', coords: partnerCoords, username: partnerUsername || 'Partner' } : null,
  ].filter(Boolean);

  // 1. Initialize map once on mount
  useEffect(() => {
    if (!mapElRef.current || mapInstanceRef.current) return;

    const map = L.map(mapElRef.current, {
      center: center,
      zoom: 14,
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    mapInstanceRef.current = map;

    // Cleanup: remove map instance
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // 2. Update map view (center) and markers when center or locations change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (center) {
      map.setView(center, 14);
    }

    // Clear old markers
    Object.values(markersRef.current).forEach((marker) => marker.remove());
    markersRef.current = {};

    // Add new markers
    locations.forEach((loc) => {
      const marker = L.marker(loc.coords).addTo(map);
      marker.bindPopup(loc.username);
      markersRef.current[loc.userId] = marker;
    });
  }, [center, myCoords, partnerCoords]); // triggers when coords change

  return (
    <div className="rounded-2xl overflow-hidden w-64 shadow-md border border-gray-200 msg-in">
      <div style={{ height: '160px' }}>
        <div ref={mapElRef} style={{ height: '100%', width: '100%' }} />
      </div>
      <div className="bg-white px-3 py-2 flex justify-between items-center border-t border-gray-100">
        <span className="text-xs text-gray-500 flex items-center gap-1">
          📍 {partnerStopped ? 'Location stopped' : 'Live location'}
        </span>
        {distance && (
          <span className="text-xs font-semibold text-violet-500">{distance}km apart</span>
        )}
      </div>
    </div>
  );
}
