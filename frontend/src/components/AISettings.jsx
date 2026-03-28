import { useState } from 'react'
import { Sparkles, ChevronDown, ChevronUp, CheckCircle, XCircle, Loader } from 'lucide-react'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Label } from './ui/Label'
import { Select } from './ui/Select'
import { Switch } from './ui/Switch'
import { cn } from '../lib/cn'

const PROVIDERS = [
  { value: 'anthropic', label: 'Anthropic (Claude)',   needsKey: true,  models: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6', 'claude-opus-4-6'] },
  { value: 'openai',    label: 'OpenAI (GPT)',          needsKey: true,  models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'] },
  { value: 'deepseek',  label: 'DeepSeek',              needsKey: true,  models: ['deepseek-chat', 'deepseek-reasoner'] },
  { value: 'groq',      label: 'Groq',                  needsKey: true,  models: ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'mixtral-8x7b-32768'] },
  { value: 'ollama',    label: 'Ollama (local)',         needsKey: false, models: ['llama3', 'llama3.2', 'mistral', 'gemma2', 'qwen2.5'] },
  { value: 'mistral',   label: 'Mistral AI',            needsKey: true,  models: ['mistral-small-latest', 'mistral-medium-latest', 'mistral-large-latest'] },
  { value: 'google',    label: 'Google (Gemini)',        needsKey: true,  models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'] },
]

const STORAGE_KEY = 'webscraper_ai_settings'

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || defaultSettings()
  } catch {
    return defaultSettings()
  }
}

function defaultSettings() {
  return {
    enabled: false,
    provider: 'anthropic',
    model: '',
    apiKey: '',
    baseUrl: '',
    features: { extraction: true, queryBuilder: true },
  }
}

function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function AISettings({ onChange }) {
  const [open, setOpen] = useState(false)
  const [settings, setSettings] = useState(loadSettings)
  const [testStatus, setTestStatus] = useState(null) // null | 'loading' | 'ok' | 'error'
  const [testMessage, setTestMessage] = useState('')

  const provider = PROVIDERS.find(p => p.value === settings.provider) || PROVIDERS[0]
  const showBaseUrl = settings.provider === 'ollama' || settings.provider === 'deepseek' || settings.provider === 'mistral'

  function update(patch) {
    const next = { ...settings, ...patch }
    setSettings(next)
    saveSettings(next)
    onChange?.(next)
  }

  function updateFeature(key, val) {
    update({ features: { ...settings.features, [key]: val } })
  }

  async function testConnection() {
    setTestStatus('loading')
    setTestMessage('')
    try {
      const resp = await fetch('/api/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiConfig: settings }),
      })
      const data = await resp.json()
      if (data.ok) {
        setTestStatus('ok')
        setTestMessage(`Connected! Response: "${data.response}"`)
      } else {
        setTestStatus('error')
        setTestMessage(data.error || 'Connection failed')
      }
    } catch (err) {
      setTestStatus('error')
      setTestMessage(err.message)
    }
  }

  return (
    <div className={cn('rounded-xl border transition-colors', settings.enabled ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/30')}>
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <Sparkles size={15} className={settings.enabled ? 'text-primary' : 'text-muted-foreground'} />
          <span className={settings.enabled ? 'text-primary' : 'text-muted-foreground'}>AI Enhancement</span>
          {settings.enabled && (
            <span className="text-xs bg-primary text-primary-foreground rounded-full px-2 py-0.5">
              {provider.label} · {settings.model || provider.models[0]}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Switch
            checked={settings.enabled}
            onCheckedChange={val => { update({ enabled: val }); if (val) setOpen(true) }}
          />
          {open ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
        </div>
      </button>

      {/* Expanded panel */}
      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-border/60 pt-4">

          {/* Provider + Model */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Provider</Label>
              <Select
                value={settings.provider}
                onChange={e => update({ provider: e.target.value, model: '' })}
              >
                {PROVIDERS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Model</Label>
              <div className="flex gap-2">
                <Input
                  list="model-suggestions"
                  placeholder={provider.models[0]}
                  value={settings.model}
                  onChange={e => update({ model: e.target.value })}
                />
                <datalist id="model-suggestions">
                  {provider.models.map(m => <option key={m} value={m} />)}
                </datalist>
              </div>
            </div>
          </div>

          {/* API Key */}
          {provider.needsKey && (
            <div className="space-y-1.5">
              <Label>API Key</Label>
              <Input
                type="password"
                placeholder={`${provider.label} API key`}
                value={settings.apiKey}
                onChange={e => update({ apiKey: e.target.value })}
                autoComplete="off"
              />
            </div>
          )}

          {/* Base URL (Ollama, custom endpoints) */}
          {showBaseUrl && (
            <div className="space-y-1.5">
              <Label>
                Base URL
                {settings.provider === 'ollama' && (
                  <span className="text-muted-foreground font-normal ml-1">(default: http://localhost:11434/api)</span>
                )}
              </Label>
              <Input
                placeholder={settings.provider === 'ollama' ? 'http://localhost:11434/api' : 'https://api.example.com/v1'}
                value={settings.baseUrl}
                onChange={e => update({ baseUrl: e.target.value })}
              />
            </div>
          )}

          {/* Feature toggles */}
          <div className="space-y-2">
            <Label>Features</Label>
            <div className="space-y-2 pl-1">
              <div className="flex items-center gap-3">
                <Switch
                  id="feat-extraction"
                  checked={settings.features.extraction}
                  onCheckedChange={v => updateFeature('extraction', v)}
                />
                <label htmlFor="feat-extraction" className="text-sm cursor-pointer">
                  AI extraction
                  <span className="text-muted-foreground ml-1 text-xs">— LLM reads page text to extract contacts more accurately</span>
                </label>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="feat-querybuilder"
                  checked={settings.features.queryBuilder}
                  onCheckedChange={v => updateFeature('queryBuilder', v)}
                />
                <label htmlFor="feat-querybuilder" className="text-sm cursor-pointer">
                  AI query builder
                  <span className="text-muted-foreground ml-1 text-xs">— LLM generates optimised search queries from your description</span>
                </label>
              </div>
            </div>
          </div>

          {/* Test connection */}
          <div className="flex items-center gap-3 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={testConnection}
              disabled={testStatus === 'loading' || !settings.enabled}
            >
              {testStatus === 'loading' ? <Loader size={13} className="animate-spin" /> : <Sparkles size={13} />}
              Test connection
            </Button>
            {testStatus === 'ok' && (
              <span className="flex items-center gap-1.5 text-xs text-green-600">
                <CheckCircle size={13} /> {testMessage}
              </span>
            )}
            {testStatus === 'error' && (
              <span className="flex items-center gap-1.5 text-xs text-red-500">
                <XCircle size={13} /> {testMessage}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export { loadSettings }
