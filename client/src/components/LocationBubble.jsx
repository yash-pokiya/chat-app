import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import { MapPin, Navigation, Maximize2 } from 'lucide-react'

const LocationBubble = ({
  id, myCoords, partnerCoords, distance, partnerStopped, isLive = true,
}) => {

  const displayCoords = partnerCoords || myCoords

  const handleOpenInMaps = (e) => {
    e?.stopPropagation()
    if (!displayCoords) return
    const [lat, lng] = displayCoords
    // ✅ This opens Google Maps — no API key needed for this,
    // it's just a deep link URL, completely free:
    window.open(
      `https://www.google.com/maps?q=${lat},${lng}`,
      '_blank',
      'noopener,noreferrer'
    )
  }

  // No coords yet — loading state:
  if (!displayCoords) {
    return (
      <div className="w-64 h-44 rounded-2xl bg-gray-100
                      flex items-center justify-center
                      border border-gray-200">
        <p className="text-xs text-gray-400">Loading location...</p>
      </div>
    )
  }

  const [lat, lng] = displayCoords
  const position = [lat, lng]

  return (
    <div className="relative w-64 max-w-full rounded-2xl
                    overflow-hidden shadow-md border
                    border-gray-200 group">

      {/* ✅ Fully interactive map — zoom/pan works with touch
          and mouse, completely free, no API key: */}
      <div
        className="h-40 relative"
        onTouchStart={(e) => e.stopPropagation()}
        style={{ touchAction: 'pan-x pan-y' }}
      >
        <MapContainer
          key={`${id || 'live'}-${lat}-${lng}`}
          center={position}
          zoom={15}
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
          scrollWheelZoom={true}
          dragging={true}
          doubleClickZoom={true}
          touchZoom={true}
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
          <Marker position={position} />
        </MapContainer>
      </div>

      {/* Open in Google Maps button — top-right corner,
          separate from the map's own drag/zoom area: */}
      <button
        onClick={handleOpenInMaps}
        className="absolute top-2 right-2 w-8 h-8 rounded-full
                   bg-white/95 backdrop-blur-sm shadow-md
                   flex items-center justify-center
                   text-violet-500 hover:bg-white
                   hover:scale-110 transition-all z-[500]"
        title="Open in Google Maps"
      >
        <Maximize2 size={14} />
      </button>

      {/* Live pulse badge if actively sharing: */}
      {isLive && !partnerStopped && (
        <div className="absolute top-2 left-2 bg-white/95
                        backdrop-blur-sm rounded-full px-2 py-1
                        flex items-center gap-1.5 shadow-md
                        z-[500]">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full
                           animate-pulse" />
          <span className="text-[10px] font-semibold text-green-600">
            LIVE
          </span>
        </div>
      )}

      {/* Bottom info bar — tap anywhere here also opens
          Google Maps, gives a clear second affordance: */}
      <button
        onClick={handleOpenInMaps}
        className="w-full bg-white px-3.5 py-2.5 flex items-center
                   justify-between border-t border-gray-100
                   hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <MapPin size={13} className={
            isLive && !partnerStopped
              ? 'text-pink-500' : 'text-gray-400'
          } />
          <span className="text-xs font-medium text-gray-700 truncate">
            {partnerStopped ? 'Location stopped' : 'Live location'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
          {distance != null && (
            <span className="text-xs font-semibold text-violet-500">
              {distance < 1
                ? `${Math.round(distance * 1000)}m`
                : `${distance.toFixed(1)}km`}
            </span>
          )}
          <Navigation size={12} className="text-gray-400" />
        </div>
      </button>
    </div>
  )
}

export default LocationBubble
