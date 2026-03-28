import { useState, useCallback } from 'react'
import { Globe, Search, Link, History, X } from 'lucide-react'
import { SearchForm } from './components/SearchForm'
import { UrlsForm } from './components/UrlsForm'
import { ProgressLog } from './components/ProgressLog'
import { ResultsTable } from './components/ResultsTable'
import { HistoryTab } from './components/HistoryTab'
import { AISettings, loadSettings } from './components/AISettings'
import { Card, CardContent } from './components/ui/Card'
import { Button } from './components/ui/Button'
import { cn } from './lib/cn'
import { startScrapeSSE } from './lib/sse'

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
      body: { ...body, aiConfig },
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
          <ResultsTable results={results} csvFile={files?.csv} />
        )}
      </main>
    </div>
  )
}
