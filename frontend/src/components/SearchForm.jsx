import { useState } from 'react'
import { Search } from 'lucide-react'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Label } from './ui/Label'
import { Select } from './ui/Select'
import { Switch } from './ui/Switch'
import { Spinner } from './ui/Spinner'

export function SearchForm({ onScrape, isRunning }) {
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('')
  const [limit, setLimit] = useState(10)
  const [engine, setEngine] = useState('duckduckgo')
  const [browser, setBrowser] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    if (!query.trim() || !location.trim()) return
    onScrape({ type: 'search', query, location, limit: Number(limit), engine, browser })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="query">Qué buscar</Label>
          <Input
            id="query"
            placeholder="restaurante italiano, bar de tapas…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            disabled={isRunning}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="location">Dónde</Label>
          <Input
            id="location"
            placeholder="Madrid, Barcelona, Sevilla…"
            value={location}
            onChange={e => setLocation(e.target.value)}
            disabled={isRunning}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="limit">Resultados</Label>
          <Input
            id="limit"
            type="number"
            min={1}
            max={50}
            value={limit}
            onChange={e => setLimit(e.target.value)}
            disabled={isRunning}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="engine">Motor</Label>
          <Select id="engine" value={engine} onChange={e => setEngine(e.target.value)} disabled={isRunning}>
            <option value="duckduckgo">DuckDuckGo</option>
            <option value="google">Google</option>
          </Select>
        </div>
        <div className="space-y-1.5 col-span-2 sm:col-span-2">
          <Label>Opciones</Label>
          <div className="flex items-center gap-3 h-9">
            <Switch id="browser" checked={browser} onCheckedChange={setBrowser} />
            <label htmlFor="browser" className="text-sm cursor-pointer select-none">
              Modo navegador <span className="text-muted-foreground">(webs con JS)</span>
            </label>
          </div>
        </div>
      </div>

      <Button type="submit" disabled={isRunning || !query.trim() || !location.trim()}>
        {isRunning ? <Spinner size={14} /> : <Search size={14} />}
        {isRunning ? 'Scrapeando…' : 'Buscar y scrapear'}
      </Button>
    </form>
  )
}
