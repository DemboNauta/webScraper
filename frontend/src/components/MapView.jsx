import 'leaflet/dist/leaflet.css'
import { useEffect, useRef, useState } from 'react'
import { MapPin, Loader } from 'lucide-react'
import { geocodeAddress, sleep } from '../lib/geocode'

export function MapView({ results }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const [progress, setProgress] = useState(null) // null | { done: N, total: N }

  useEffect(() => {
    if (!containerRef.current) return
    // Dynamically import leaflet to avoid SSR issues
    import('leaflet').then(L => {
      // Fix default marker icon paths broken by bundlers
      delete L.Icon.Default.prototype._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current).setView([40.416775, -3.70379], 6)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(mapRef.current)
      }
    })

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!results.length) return

    const withAddress = results.filter(r => r.address && !r.error)
    if (!withAddress.length) return

    let cancelled = false
    setProgress({ done: 0, total: withAddress.length })

    ;(async () => {
      const L = (await import('leaflet')).default || (await import('leaflet'))

      // Clear old markers
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []

      const bounds = []

      for (let i = 0; i < withAddress.length; i++) {
        if (cancelled) break
        const r = withAddress[i]
        const coords = await geocodeAddress(r.address)
        setProgress({ done: i + 1, total: withAddress.length })

        if (coords && mapRef.current) {
          const popup = `
            <div style="min-width:180px">
              <strong>${r.title || r.url}</strong><br/>
              ${r.phones?.length ? `📞 ${r.phones.join(', ')}<br/>` : ''}
              ${r.emails?.length ? `✉ ${r.emails.join(', ')}<br/>` : ''}
              <small style="color:#666">${r.address}</small>
            </div>`
          const marker = L.marker([coords.lat, coords.lng])
            .addTo(mapRef.current)
            .bindPopup(popup)
          markersRef.current.push(marker)
          bounds.push([coords.lat, coords.lng])
          if (bounds.length >= 2) {
            mapRef.current.fitBounds(bounds, { padding: [40, 40] })
          }
        }

        if (i < withAddress.length - 1) await sleep(1100) // Nominatim rate limit
      }

      if (!cancelled) setProgress(null)
    })()

    return () => { cancelled = true }
  }, [results])

  const withAddress = results.filter(r => r.address && !r.error).length

  return (
    <div className="rounded-xl border overflow-hidden">
      {/* Map header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30 text-sm">
        <div className="flex items-center gap-2">
          <MapPin size={14} className="text-primary" />
          <span className="font-medium">Map view</span>
          <span className="text-muted-foreground">{withAddress} address{withAddress !== 1 ? 'es' : ''} to geocode</span>
        </div>
        {progress && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader size={12} className="animate-spin" />
            Geocoding {progress.done}/{progress.total}…
          </div>
        )}
      </div>
      {/* Map container */}
      <div ref={containerRef} style={{ height: '420px' }} />
      {withAddress === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50 text-sm text-muted-foreground">
          No addresses found to map
        </div>
      )}
    </div>
  )
}
