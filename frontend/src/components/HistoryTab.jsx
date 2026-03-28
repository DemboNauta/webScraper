import { useEffect, useState } from 'react'
import { FileJson, Download, FolderOpen, RefreshCw } from 'lucide-react'
import { Button } from './ui/Button'
import { fetchResults, fetchResultFile, downloadUrl } from '../lib/api'
import { Spinner } from './ui/Spinner'

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

function formatDate(str) {
  return new Date(str).toLocaleString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function HistoryTab({ onLoad }) {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingFile, setLoadingFile] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const { files } = await fetchResults()
      setFiles(files)
    } catch {
      setFiles([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleLoad(filename) {
    setLoadingFile(filename)
    try {
      const data = await fetchResultFile(filename)
      onLoad(data, filename)
    } catch (e) {
      alert('Error loading file: ' + e.message)
    } finally {
      setLoadingFile(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Results saved in <code className="text-xs bg-muted px-1 py-0.5 rounded">results/</code>
        </p>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </Button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
          <Spinner size={16} /> Loading…
        </div>
      )}

      {!loading && files.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <FolderOpen size={32} className="opacity-30" />
          <p className="text-sm">No saved results yet</p>
        </div>
      )}

      {!loading && files.length > 0 && (
        <div className="rounded-lg border divide-y divide-border overflow-hidden">
          {files.map(f => {
            const csvName = f.name.replace('.json', '.csv')
            return (
              <div key={f.name} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                <FileJson size={16} className="text-blue-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{f.name}</div>
                  <div className="text-xs text-muted-foreground">{formatDate(f.modified)} · {formatSize(f.size)}</div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleLoad(f.name)}
                    disabled={loadingFile === f.name}
                  >
                    {loadingFile === f.name ? <Spinner size={12} /> : null}
                    Load
                  </Button>
                  <a href={downloadUrl(f.name)} download title="Download JSON">
                    <Button variant="ghost" size="icon">
                      <Download size={13} />
                    </Button>
                  </a>
                  <a href={downloadUrl(csvName)} download title="Download CSV">
                    <Button variant="ghost" size="sm" className="text-xs">CSV</Button>
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
