// Cache geocoding results in memory to avoid re-requests
const cache = new Map()

export async function geocodeAddress(address) {
  if (!address) return null
  if (cache.has(address)) return cache.get(address)

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'WebScraper/1.0 (contact extractor)' }
    })
    const data = await resp.json()
    const result = data[0] ? { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) } : null
    cache.set(address, result)
    return result
  } catch {
    return null
  }
}

// Sleep helper for rate limiting
export function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}
