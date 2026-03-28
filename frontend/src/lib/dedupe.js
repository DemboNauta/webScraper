/**
 * Deduplicate results by phone number or email address.
 * When duplicates are found, keep the entry with the most data and
 * merge unique phones/emails from the others.
 * @param {object[]} results
 * @returns {{ results: object[], removed: number }}
 */
export function deduplicateResults(results) {
  // Normalize a phone: keep digits only
  const normPhone = p => p.replace(/\D/g, '')
  // Map from normalised phone/email → index of the "keeper" entry
  const phoneIndex = new Map()
  const emailIndex = new Map()
  const removed = new Set()

  // Score a result by data richness
  const score = r =>
    (r.phones?.length || 0) * 3 +
    (r.emails?.length || 0) * 3 +
    (r.address ? 2 : 0) +
    Object.values(r.socials || {}).filter(Boolean).length

  const merged = results.map((r, i) => ({ ...r, _idx: i }))

  for (let i = 0; i < merged.length; i++) {
    if (removed.has(i)) continue
    const r = merged[i]

    for (const phone of (r.phones || [])) {
      const key = normPhone(phone)
      if (!key || key.length < 6) continue
      if (phoneIndex.has(key)) {
        const existingIdx = phoneIndex.get(key)
        const existing = merged[existingIdx]
        // Merge into the richer record
        if (score(r) > score(existing)) {
          // current is richer — merge existing into current, remove existing
          merged[i] = mergeInto(r, existing)
          removed.add(existingIdx)
          phoneIndex.set(key, i)
        } else {
          // existing is richer — merge current into existing, remove current
          merged[existingIdx] = mergeInto(existing, r)
          removed.add(i)
        }
        break
      } else {
        phoneIndex.set(key, i)
      }
    }

    if (removed.has(i)) continue

    for (const email of (r.emails || [])) {
      const key = email.toLowerCase().trim()
      if (emailIndex.has(key)) {
        const existingIdx = emailIndex.get(key)
        const existing = merged[existingIdx]
        if (score(r) > score(existing)) {
          merged[i] = mergeInto(r, existing)
          removed.add(existingIdx)
          emailIndex.set(key, i)
        } else {
          merged[existingIdx] = mergeInto(existing, r)
          removed.add(i)
        }
        break
      } else {
        emailIndex.set(key, i)
      }
    }
  }

  const deduped = merged.filter((_, i) => !removed.has(i)).map(({ _idx, ...r }) => r)
  return { results: deduped, removed: removed.size }
}

function mergeInto(keeper, donor) {
  const phones = [...new Set([...(keeper.phones || []), ...(donor.phones || [])])]
  const emails = [...new Set([...(keeper.emails || []), ...(donor.emails || [])])]
  return {
    ...keeper,
    phones,
    emails,
    address: keeper.address || donor.address,
    socials: { ...donor.socials, ...keeper.socials },
  }
}
