import { useEffect, useRef } from 'react'
import { cn } from '../lib/cn'

export function ProgressLog({ logs, status }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  if (status === 'idle' || logs.length === 0) return null

  return (
    <div className="rounded-lg border bg-zinc-950 text-zinc-100 font-mono text-xs overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800 bg-zinc-900">
        <span className="text-zinc-400">log</span>
        {status === 'running' && (
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            running
          </span>
        )}
        {status === 'done' && <span className="text-emerald-400">✓ completed</span>}
        {status === 'error' && <span className="text-red-400">✗ error</span>}
      </div>
      <div className="h-40 overflow-y-auto p-3 space-y-0.5 scrollbar-thin">
        {logs.map((log, i) => (
          <div
            key={i}
            className={cn(
              'leading-5',
              log.type === 'error' && 'text-red-400',
              log.type === 'success' && 'text-emerald-400',
              log.type === 'info' && 'text-blue-400',
              log.type === 'ai' && 'text-purple-400',
              log.type === 'default' && 'text-zinc-300',
            )}
          >
            <span className="text-zinc-600 mr-2 select-none">{String(i + 1).padStart(3, '0')}</span>
            {log.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
