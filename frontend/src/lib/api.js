export async function fetchResults() {
  const resp = await fetch('/api/results')
  if (!resp.ok) throw new Error('Failed to fetch results')
  return resp.json()
}

export async function fetchResultFile(filename) {
  const resp = await fetch(`/api/results/${encodeURIComponent(filename)}`)
  if (!resp.ok) throw new Error('File not found')
  return resp.json()
}

export function downloadUrl(filename) {
  return `/api/download/${encodeURIComponent(filename)}`
}
