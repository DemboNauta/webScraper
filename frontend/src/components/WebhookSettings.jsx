import { useState } from 'react'
import { Webhook, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Label } from './ui/Label'
import { Switch } from './ui/Switch'
import { cn } from '../lib/cn'

const STORAGE_KEY = 'webscraper_webhook'

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || defaults() } catch { return defaults() }
}
function defaults() {
  return { enabled: false, url: '', secret: '' }
}
function save(cfg) { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)) }

export function WebhookSettings({ onChange }) {
  const [open, setOpen] = useState(false)
  const [cfg, setCfg] = useState(load)

  function update(patch) {
    const next = { ...cfg, ...patch }
    setCfg(next)
    save(next)
    onChange?.(next)
  }

  return (
    <div className={cn('rounded-xl border transition-colors', cfg.enabled ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/30')}>
      <button className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium" onClick={() => setOpen(o => !o)}>
        <div className="flex items-center gap-2">
          <Webhook size={15} className={cfg.enabled ? 'text-primary' : 'text-muted-foreground'} />
          <span className={cfg.enabled ? 'text-primary' : 'text-muted-foreground'}>Webhook</span>
          {cfg.enabled && cfg.url && (
            <span className="text-xs bg-primary text-primary-foreground rounded-full px-2 py-0.5 truncate max-w-[200px]">{cfg.url}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={cfg.enabled} onCheckedChange={val => { update({ enabled: val }); if (val) setOpen(true) }} />
          {open ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/60 pt-4">
          <div className="space-y-1.5">
            <Label>Webhook URL</Label>
            <Input placeholder="https://hooks.example.com/scraper" value={cfg.url} onChange={e => update({ url: e.target.value })} />
            <p className="text-xs text-muted-foreground">Results will be POSTed here when scraping completes.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Secret <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input type="password" placeholder="Sent as X-Webhook-Secret header" value={cfg.secret} onChange={e => update({ secret: e.target.value })} autoComplete="off" />
          </div>
          <p className="text-xs text-muted-foreground">
            Payload: <code className="bg-muted px-1 rounded">{'{ event, timestamp, results[], meta }'}</code>
          </p>
        </div>
      )}
    </div>
  )
}

export { load as loadWebhookSettings }
