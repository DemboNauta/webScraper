/**
 * Start a POST-based SSE stream.
 * EventSource only supports GET, so we use fetch + ReadableStream.
 *
 * @param {object} opts
 * @param {string}   opts.endpoint
 * @param {object}   opts.body
 * @param {function} opts.onStart
 * @param {function} opts.onUrlsFound
 * @param {function} opts.onProgress
 * @param {function} opts.onDone
 * @param {function} opts.onError
 * @param {function} opts.onAiQueries   — AI query builder result
 * @param {function} opts.onAiWarning   — non-fatal AI warning
 * @param {function} opts.onWebhookSent — webhook delivered successfully
 * @param {function} opts.onWebhookError — webhook delivery failed
 * @returns {{ abort: () => void }}
 */
export function startScrapeSSE({
  endpoint, body,
  onStart, onUrlsFound, onProgress, onDone, onError,
  onAiQueries, onAiWarning, onAiStep,
  onWebhookSent, onWebhookError,
}) {
  const controller = new AbortController()

  ;(async () => {
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: resp.statusText }))
        onError?.(err.error || 'Request failed')
        return
      }

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // SSE messages are separated by \n\n
        const parts = buffer.split('\n\n')
        buffer = parts.pop() // last part may be incomplete

        for (const part of parts) {
          if (!part.trim()) continue

          let event = 'message'
          let data = ''

          for (const line of part.split('\n')) {
            if (line.startsWith('event: ')) {
              event = line.slice('event: '.length).trim()
            } else if (line.startsWith('data: ')) {
              data = line.slice('data: '.length)
            }
          }

          try {
            const parsed = JSON.parse(data)
            if (event === 'start')        onStart?.(parsed)
            else if (event === 'urls_found')   onUrlsFound?.(parsed)
            else if (event === 'progress')     onProgress?.(parsed)
            else if (event === 'done')         onDone?.(parsed)
            else if (event === 'error')        onError?.(parsed.message)
            else if (event === 'ai_queries')   onAiQueries?.(parsed)
            else if (event === 'ai_warning')   onAiWarning?.(parsed)
            else if (event === 'ai_step')       onAiStep?.(parsed)
            else if (event === 'webhook_sent')  onWebhookSent?.(parsed)
            else if (event === 'webhook_error') onWebhookError?.(parsed)
          } catch {
            // ignore malformed SSE lines
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        onError?.(err.message)
      }
    }
  })()

  return { abort: () => controller.abort() }
}
