import L from 'leaflet'

delete L.Icon.Default.prototype._getIconUrl

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Fix for React 18/19 StrictMode double-rendering:
// Leaflet MapContainer will attempt to mount twice on the same DOM element.
// Since Leaflet stores a flag on the DOM node to prevent multiple instances,
// the second mount call fails with "Map container is already initialized".
// We monkey-patch Map._initContainer to safely remove the old instance first.
const originalInitContainer = L.Map.prototype._initContainer
L.Map.prototype._initContainer = function (id) {
  const container = L.DomUtil.get(id)
  if (container && container._leaflet_map) {
    try {
      container._leaflet_map.remove()
    } catch (e) {
      console.warn('[Leaflet Fix] Failed to clean up duplicate map instance:', e)
    }
    delete container._leaflet_map
  }

  originalInitContainer.call(this, id)

  if (container) {
    container._leaflet_map = this
  }
}

