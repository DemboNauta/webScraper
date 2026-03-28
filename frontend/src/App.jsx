import { useState, useCallback } from 'react'
import { Globe, Search, Link, History, X } from 'lucide-react'
import { SearchForm } from './components/SearchForm'
import { UrlsForm } from './components/UrlsForm'
import { ProgressLog } from './components/ProgressLog'
import { ResultsTable } from './components/ResultsTable'
import { HistoryTab } from './components/HistoryTab'
import { Card, CardContent } from './components/ui/Card'
import { Button } from './components/ui/Button'
import { cn } from './lib/cn'
import { startScrapeSSE } from './lib/sse'

const TABS = [
  { id: 'search', label: 'Buscar negocios', icon: Search },
  { id: 'urls', label: 'URLs directas', icon: Link },
  { id: 'history', label: 'Historial', icon: History },
]

export default function App() {
  const [tab, setTab] = useState('search')
  const [status, setStatus] = useState('idle')   // idle | running | done | error
  const [logs, setLogs] = useState([])
  const [results, setResults] = useState([])
  const [files, setFiles] = useState(null)
  const [abortCtrl, setAbortCtrl] = useState(null)

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
    addLog('Scraping cancelado.', 'error')
    setStatus('error')
  }

  function handleScrape({ type, ...body }) {
    reset()
    setStatus('running')

    const endpoint = type === 'search' ? '/api/scrape/search' : '/api/scrape/urls'

    const ctrl = startScrapeSSE({
      endpoint,
      body,
      onStart: ({ total, mode, query, location }) => {
        if (mode === 'search') {
          addLog(`Buscando "${query}" en ${location}…`, 'info')
        } else {
          addLog(`Iniciando scraping de ${total} URL(s)…`, 'info')
        }
      },
      onUrlsFound: ({ urls, total }) => {
        addLog(`Encontradas ${total} URLs para scrapear.`, 'info')
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
          addLog(`✓ ${result.title || result.url}${info ? '  —  ' + info : ''}`, 'success')
        }
        setResults(prev => [...prev, result])
      },
      onDone: ({ results: allResults, files: f }) => {
        setResults(allResults)
        setFiles(f)
        setStatus('done')
        addLog(`Scraping completado. ${allResults.length} resultados.`, 'success')
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
    setLogs([{ text: `Cargado: ${filename} (${data.length} resultados)`, type: 'info' }])
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Globe size={20} className="text-primary" />
          <span className="font-semibold tracking-tight">WebScraper</span>
          <span className="text-muted-foreground text-sm hidden sm:inline">— extracción de contactos</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">

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

          <CardContent className="pt-6">
            {tab === 'search' && (
              <SearchForm onScrape={handleScrape} isRunning={status === 'running'} />
            )}
            {tab === 'urls' && (
              <UrlsForm onScrape={handleScrape} isRunning={status === 'running'} />
            )}
            {tab === 'history' && (
              <HistoryTab onLoad={handleHistoryLoad} />
            )}
          </CardContent>
        </Card>

        {/* Progress + abort */}
        {status !== 'idle' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              {status === 'running' && (
                <Button variant="outline" size="sm" onClick={abort}>
                  <X size={13} /> Cancelar
                </Button>
              )}
              {(status === 'done' || status === 'error') && (
                <Button variant="ghost" size="sm" onClick={reset}>
                  <X size={13} /> Limpiar
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
