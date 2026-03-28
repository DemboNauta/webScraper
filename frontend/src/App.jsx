import { useState, useCallback, useMemo, useEffect } from 'react'
import { Globe, Search, Link, History, X, Moon, Sun, Table2, Map } from 'lucide-react'
import { SearchForm } from './components/SearchForm'
import { UrlsForm } from './components/UrlsForm'
import { ProgressLog } from './components/ProgressLog'
import { ResultsTable } from './components/ResultsTable'
import { MapView } from './components/MapView'
import { HistoryTab } from './components/HistoryTab'
import { AISettings, loadSettings } from './components/AISettings'
import { WebhookSettings, loadWebhookSettings } from './components/WebhookSettings'
import { Card, CardContent } from './components/ui/Card'
import { Button } from './components/ui/Button'
import { Switch } from './components/ui/Switch'
import { cn } from './lib/cn'
import { startScrapeSSE } from './lib/sse'
import { deduplicateResults } from './lib/dedupe'

const TABS = [
  { id: 'search', label: 'Search businesses', icon: Search },
  { id: 'urls', label: 'Direct URLs', icon: Link },
  { id: 'history', label: 'History', icon: History },
]

export default function App() {
  const [tab, setTab] = useState('search')
  const [status, setStatus] = useState('idle')   // idle | running | done | error
  const [logs, setLogs] = useState([])
  const [results, setResults] = useState([])
  const [files, setFiles] = useState(null)
  const [abortCtrl, setAbortCtrl] = useState(null)
  const [aiConfig, setAiConfig] = useState(loadSettings)
  const [webhookConfig, setWebhookConfig] = useState(loadWebhookSettings)
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark')
  const [dedupEnabled, setDedupEnabled] = useState(false)
  const [view, setView] = useState('table') // 'table' | 'map'

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [dark])

  const displayResults = useMemo(() => {
    if (!dedupEnabled) return results
    const { results: deduped } = deduplicateResults(results)
    return deduped
  }, [results, dedupEnabled])

  const addLog = useCallback((text, type = 'default') => {
    setLogs(prev => [...prev, { text, type }])
  }, [])

  function reset() {
    setStatus('idle')
    setLogs([])
    setResults([])
    setFiles(null)
  }

  function abort() {
    abortCtrl?.abort()
    addLog('Scraping cancelled.', 'error')
    setStatus('error')
  }

  function handleScrape({ type, ...body }) {
    reset()
    setStatus('running')

    const endpoint = type === 'search' ? '/api/scrape/search' : '/api/scrape/urls'

    const ctrl = startScrapeSSE({
      endpoint,
      body: { ...body, aiConfig, webhookConfig },
      onStart: ({ total, mode, query, location }) => {
        if (mode === 'search') {
          addLog(`Searching "${query}" in ${location}…`, 'info')
        } else {
          addLog(`Starting scrape of ${total} URL(s)…`, 'info')
        }
        if (aiConfig?.enabled) {
          const features = []
          if (aiConfig.features?.queryBuilder) features.push('query builder')
          if (aiConfig.features?.extraction) features.push('extraction')
          addLog(`✨ AI enabled (${aiConfig.provider}/${aiConfig.model || 'default'}) — ${features.join(', ')}`, 'ai')
        }
      },
      onAiQueries: ({ queries, limit, reasoning }) => {
        addLog(`✨ AI generated ${queries.length} search quer${queries.length !== 1 ? 'ies' : 'y'} (limit: ${limit})`, 'ai')
        if (reasoning) addLog(`   ${reasoning}`, 'ai')
        queries.forEach(q => addLog(`   → "${q}"`, 'ai'))
      },
      onAiWarning: ({ message }) => {
        addLog(`⚠ ${message}`, 'error')
      },
      onAiStep: ({ step, url, phones, emails, address, error }) => {
        if (step === 'building_queries') {
          addLog('✨ Building optimised search queries…', 'ai')
        } else if (step === 'extracting') {
          const short = url.length > 60 ? url.slice(0, 57) + '…' : url
          addLog('✨ Extracting contacts from ' + short, 'ai')
        } else if (step === 'extracted') {
          const parts = [phones && phones + ' phone(s)', emails && emails + ' email(s)', address && 'address'].filter(Boolean)
          addLog('   → ' + (parts.length ? parts.join(', ') : 'no data found'), 'ai')
        } else if (step === 'extraction_failed') {
          addLog('   ⚠ AI extraction failed: ' + error, 'error')
        }
      },
      onUrlsFound: ({ urls, total }) => {
        addLog(`Found ${total} URL(s) to scrape.`, 'info')
        urls.forEach(u => addLog(`  → ${u}`, 'default'))
      },
      onProgress: ({ result }) => {
        if (result.error) {
          addLog(`✗ ${result.url}: ${result.error}`, 'error')
        } else {
          const info = [
            result.phones?.length && `📞 ${result.phones[0]}`,
            result.emails?.length && `✉ ${result.emails[0]}`,
          ].filter(Boolean).join('  ')
          const aiTag = result.extractedBy === 'ai' ? ' ✨' : ''
          addLog(`✓ ${result.title || result.url}${aiTag}${info ? '  —  ' + info : ''}`, 'success')
        }
        setResults(prev => [...prev, result])
      },
      onDone: ({ results: allResults, files: f }) => {
        setResults(allResults)
        setFiles(f)
        setStatus('done')
        addLog(`Scraping complete. ${allResults.length} result(s).`, 'success')
      },
      onError: (msg) => {
        addLog(`Error: ${msg}`, 'error')
        setStatus('error')
      },
      onWebhookSent: ({ url }) => {
        addLog(`📡 Webhook delivered to ${url}`, 'info')
      },
      onWebhookError: ({ message }) => {
        addLog(`📡 Webhook failed: ${message}`, 'error')
      },
    })

    setAbortCtrl(ctrl)
  }

  function handleHistoryLoad(data, filename) {
    setResults(data)
    setFiles({ json: filename, csv: filename.replace('.json', '.csv') })
    setStatus('done')
    setLogs([{ text: `Loaded: ${filename} (${data.length} result(s))`, type: 'info' }])
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Globe size={20} className="text-primary" />
          <span className="font-semibold tracking-tight">WebScraper</span>
          <span className="text-muted-foreground text-sm hidden sm:inline">— contact extractor</span>
          <div className="ml-auto">
            <button
              onClick={() => setDark(d => !d)}
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-4">

        {/* Control card */}
        <Card>
          {/* Tabs */}
          <div className="border-b px-6 pt-4">
            <div className="flex gap-0 -mb-px">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                    tab === id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
                  )}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <CardContent className="pt-6 space-y-5">
            {tab === 'search' && (
              <SearchForm onScrape={handleScrape} isRunning={status === 'running'} />
            )}
            {tab === 'urls' && (
              <UrlsForm onScrape={handleScrape} isRunning={status === 'running'} />
            )}
            {tab === 'history' && (
              <HistoryTab onLoad={handleHistoryLoad} />
            )}

            {/* AI Settings panel — shown on search and urls tabs */}
            {tab !== 'history' && (
              <AISettings onChange={setAiConfig} />
            )}

            {/* Webhook settings panel — shown on search and urls tabs */}
            {tab !== 'history' && (
              <WebhookSettings onChange={setWebhookConfig} />
            )}
          </CardContent>
        </Card>

        {/* Progress + abort */}
        {status !== 'idle' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              {status === 'running' && (
                <Button variant="outline" size="sm" onClick={abort}>
                  <X size={13} /> Cancel
                </Button>
              )}
              {(status === 'done' || status === 'error') && (
                <Button variant="ghost" size="sm" onClick={reset}>
                  <X size={13} /> Clear
                </Button>
              )}
            </div>
            <ProgressLog logs={logs} status={status} />
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-3">
            {/* Controls bar */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* View toggle */}
              <div className="flex rounded-lg border overflow-hidden">
                <button onClick={() => setView('table')} className={cn('px-3 py-1.5 text-xs flex items-center gap-1.5', view === 'table' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted')}>
                  <Table2 size={13} /> Table
                </button>
                <button onClick={() => setView('map')} className={cn('px-3 py-1.5 text-xs flex items-center gap-1.5 border-l', view === 'map' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted')}>
                  <Map size={13} /> Map
                </button>
              </div>
              {/* Dedup toggle */}
              <div className="flex items-center gap-2">
                <Switch id="dedup" checked={dedupEnabled} onCheckedChange={setDedupEnabled} />
                <label htmlFor="dedup" className="text-xs cursor-pointer text-muted-foreground">Deduplicate</label>
                {dedupEnabled && (() => { const { removed } = deduplicateResults(results); return removed > 0 ? <span className="text-xs text-muted-foreground">({removed} removed)</span> : null })()}
              </div>
            </div>
            {view === 'table' && <ResultsTable results={displayResults} csvFile={files?.csv} />}
            {view === 'map' && <MapView results={displayResults} />}
          </div>
        )}
      </main>
    </div>
  )
}
