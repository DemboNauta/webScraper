import { useState } from 'react'
import { Link } from 'lucide-react'
import { Button } from './ui/Button'
import { Textarea } from './ui/Textarea'
import { Label } from './ui/Label'
import { Switch } from './ui/Switch'
import { Spinner } from './ui/Spinner'

export function UrlsForm({ onScrape, isRunning }) {
  const [rawUrls, setRawUrls] = useState('')
  const [browser, setBrowser] = useState(false)

  const urls = rawUrls
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith('http'))

  function handleSubmit(e) {
    e.preventDefault()
    if (urls.length === 0) return
    onScrape({ type: 'urls', urls, browser })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="urls">URLs <span className="text-muted-foreground">(one per line)</span></Label>
        <Textarea
          id="urls"
          placeholder={"https://example-restaurant.com\nhttps://another-restaurant.com"}
          rows={6}
          value={rawUrls}
          onChange={e => setRawUrls(e.target.value)}
          disabled={isRunning}
        />
        {urls.length > 0 && (
          <p className="text-xs text-muted-foreground">{urls.length} valid URL{urls.length !== 1 ? 's' : ''}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Switch id="browser-urls" checked={browser} onCheckedChange={setBrowser} />
        <label htmlFor="browser-urls" className="text-sm cursor-pointer select-none">
          Browser mode <span className="text-muted-foreground">(JS-heavy sites)</span>
        </label>
      </div>

      <Button type="submit" disabled={isRunning || urls.length === 0}>
        {isRunning ? <Spinner size={14} /> : <Link size={14} />}
        {isRunning ? 'Scraping…' : `Scrape ${urls.length > 0 ? urls.length + ' URL' + (urls.length !== 1 ? 's' : '') : 'URLs'}`}
      </Button>
    </form>
  )
}
