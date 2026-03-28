import { useState, useRef, useEffect } from 'react'
import { ExternalLink, Phone, Mail, MapPin, Download, Pencil } from 'lucide-react'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import { ResultsFilter } from './ResultsFilter'
import { downloadUrl } from '../lib/api'

function Dash() {
  return <span className="text-muted-foreground text-xs">—</span>
}

function SocialLinks({ socials = {} }) {
  const items = Object.entries(socials).filter(([, v]) => v)
  if (items.length === 0) return <Dash />
  return (
    <div className="flex flex-wrap gap-1">
      {items.map(([name, href]) => (
        <a key={name} href={href} target="_blank" rel="noopener noreferrer">
          <Badge variant={name === 'instagram' ? 'instagram' : name === 'facebook' ? 'facebook' : name === 'tripadvisor' ? 'tripadvisor' : 'default'}>
            {name}
          </Badge>
        </a>
      ))}
    </div>
  )
}

function applyFilters(results, filters) {
  let out = [...results]
  if (filters.query) {
    const q = filters.query.toLowerCase()
    out = out.filter(r => (r.title || '').toLowerCase().includes(q) || (r.url || '').toLowerCase().includes(q))
  }
  if (filters.hasPhone) out = out.filter(r => r.phones?.length > 0)
  if (filters.hasEmail) out = out.filter(r => r.emails?.length > 0)
  if (filters.hasAddress) out = out.filter(r => r.address)
  if (filters.hasSocial) out = out.filter(r => Object.values(r.socials || {}).some(Boolean))
  if (filters.sort === 'name') out.sort((a, b) => (a.title || '').localeCompare(b.title || ''))
  if (filters.sort === 'phones') out.sort((a, b) => (b.phones?.length || 0) - (a.phones?.length || 0))
  if (filters.sort === 'emails') out.sort((a, b) => (b.emails?.length || 0) - (a.emails?.length || 0))
  return out
}

const DEFAULT_FILTERS = {
  query: '',
  hasPhone: false,
  hasEmail: false,
  hasAddress: false,
  hasSocial: false,
  sort: 'default',
}

function EditableCell({ value, rowIdx, field, editing, onStartEdit, onSave, onCancel, multiline }) {
  const ref = useRef(null)
  useEffect(() => { if (editing) ref.current?.focus() }, [editing])

  if (editing) {
    const Tag = multiline ? 'textarea' : 'input'
    return (
      <Tag
        ref={ref}
        defaultValue={value}
        className="w-full bg-background border border-ring rounded px-1.5 py-0.5 text-sm focus:outline-none resize-none"
        rows={multiline ? 2 : undefined}
        onBlur={e => onSave(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !multiline) { e.preventDefault(); onSave(e.target.value) }
          if (e.key === 'Escape') onCancel()
        }}
      />
    )
  }

  return (
    <div
      className="group cursor-text flex items-start gap-1 min-h-[20px]"
      onDoubleClick={() => onStartEdit(rowIdx, field)}
    >
      <span className="flex-1">{value || <span className="text-muted-foreground text-xs">—</span>}</span>
      <Pencil size={10} className="opacity-0 group-hover:opacity-40 mt-0.5 shrink-0 transition-opacity" />
    </div>
  )
}

function downloadEditedCsv(results) {
  const headers = ['Name', 'Website', 'Phones', 'Emails', 'Address', 'Instagram', 'Facebook', 'TripAdvisor']
  const rows = results.map(r => [
    r.title || '',
    r.url || '',
    (r.phones || []).join(' | '),
    (r.emails || []).join(' | '),
    r.address || '',
    r.socials?.instagram || '',
    r.socials?.facebook || '',
    r.socials?.tripadvisor || '',
  ])
  const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'results_edited.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export function ResultsTable({ results, csvFile }) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [edits, setEdits] = useState({})
  const [editingCell, setEditingCell] = useState(null) // { rowIdx, field } | null

  if (results.length === 0) return null

  function getVal(r, i, field) {
    return edits[i]?.[field] !== undefined ? edits[i][field] : r[field]
  }

  function handleStartEdit(rowIdx, field) {
    setEditingCell({ rowIdx, field })
  }

  function handleSave(rowIdx, field, rawValue, r) {
    let value = rawValue
    if (field === 'phones' || field === 'emails') {
      value = rawValue.split(',').map(s => s.trim()).filter(Boolean)
    }
    setEdits(prev => ({
      ...prev,
      [rowIdx]: { ...(prev[rowIdx] || {}), [field]: value },
    }))
    setEditingCell(null)
  }

  function handleCancel() {
    setEditingCell(null)
  }

  const filtered = applyFilters(results, filters)
  const withPhone = results.filter(r => r.phones?.length > 0).length
  const withEmail = results.filter(r => r.emails?.length > 0).length
  const editCount = Object.keys(edits).length

  // Build merged results for edited CSV download
  const mergedResults = results.map((r, i) => {
    if (!edits[i]) return r
    return { ...r, ...edits[i] }
  })

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span><strong className="text-foreground">{results.length}</strong> results</span>
          <span className="text-green-600 flex items-center gap-1"><Phone size={12} />{withPhone} with phone</span>
          <span className="text-blue-600 flex items-center gap-1"><Mail size={12} />{withEmail} with email</span>
        </div>
        <div className="flex items-center gap-2">
          {csvFile && (
            <a href={downloadUrl(csvFile)} download>
              <Button variant="outline" size="sm">
                <Download size={13} />
                Download CSV
              </Button>
            </a>
          )}
          {editCount > 0 && (
            <Button variant="outline" size="sm" onClick={() => downloadEditedCsv(mergedResults)}>
              <Download size={13} />
              Download edited CSV
              <span className="ml-1.5 bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 text-xs leading-none">{editCount} edit{editCount !== 1 ? 's' : ''}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <ResultsFilter
        filters={filters}
        onFiltersChange={setFilters}
        total={results.length}
        filtered={filtered.length}
      />

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide w-48">Name / Website</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Phone</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Email</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Address</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Social</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((r, i) => (
                <tr key={i} className={[
                  r.error ? 'bg-red-50/50' : 'hover:bg-muted/30 transition-colors',
                  edits[i] ? 'border-l-2 border-primary/40' : '',
                ].filter(Boolean).join(' ')}>
                  {/* Name + URL */}
                  <td className="px-3 py-3 align-top">
                    {r.error ? (
                      <div>
                        <span className="text-xs text-red-500 font-medium">Error</span>
                        <div className="text-xs text-muted-foreground truncate max-w-[180px]" title={r.url}>{r.url}</div>
                        <div className="text-xs text-red-400 mt-0.5">{r.error}</div>
                      </div>
                    ) : (
                      <div>
                        <div className="font-medium leading-tight text-foreground line-clamp-2">
                          <EditableCell
                            value={getVal(r, i, 'title')}
                            rowIdx={i}
                            field="title"
                            editing={editingCell?.rowIdx === i && editingCell?.field === 'title'}
                            onStartEdit={handleStartEdit}
                            onSave={(val) => handleSave(i, 'title', val, r)}
                            onCancel={handleCancel}
                          />
                        </div>
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline inline-flex items-center gap-0.5 mt-0.5"
                        >
                          <span className="truncate max-w-[160px]">{r.url?.replace(/^https?:\/\//, '')}</span>
                          <ExternalLink size={10} />
                        </a>
                      </div>
                    )}
                  </td>
                  {/* Phones */}
                  <td className="px-3 py-3 align-top">
                    {editingCell?.rowIdx === i && editingCell?.field === 'phones' ? (
                      <EditableCell
                        value={(getVal(r, i, 'phones') || []).join(', ')}
                        rowIdx={i}
                        field="phones"
                        editing={true}
                        onStartEdit={handleStartEdit}
                        onSave={(val) => handleSave(i, 'phones', val, r)}
                        onCancel={handleCancel}
                      />
                    ) : (
                      <div
                        className="group cursor-text flex items-start gap-1 min-h-[20px]"
                        onDoubleClick={() => handleStartEdit(i, 'phones')}
                      >
                        {(getVal(r, i, 'phones') || []).length > 0 ? (
                          <div className="flex flex-wrap gap-1 flex-1">
                            {(getVal(r, i, 'phones') || []).map((p, j) => (
                              <Badge key={j} variant="phone">
                                <a href={`tel:${p.replace(/\s/g, '')}`}>{p}</a>
                              </Badge>
                            ))}
                          </div>
                        ) : <span className="flex-1"><Dash /></span>}
                        <Pencil size={10} className="opacity-0 group-hover:opacity-40 mt-0.5 shrink-0 transition-opacity" />
                      </div>
                    )}
                  </td>
                  {/* Emails */}
                  <td className="px-3 py-3 align-top">
                    {editingCell?.rowIdx === i && editingCell?.field === 'emails' ? (
                      <EditableCell
                        value={(getVal(r, i, 'emails') || []).join(', ')}
                        rowIdx={i}
                        field="emails"
                        editing={true}
                        onStartEdit={handleStartEdit}
                        onSave={(val) => handleSave(i, 'emails', val, r)}
                        onCancel={handleCancel}
                      />
                    ) : (
                      <div
                        className="group cursor-text flex items-start gap-1 min-h-[20px]"
                        onDoubleClick={() => handleStartEdit(i, 'emails')}
                      >
                        {(getVal(r, i, 'emails') || []).length > 0 ? (
                          <div className="flex flex-wrap gap-1 flex-1">
                            {(getVal(r, i, 'emails') || []).map((e, j) => (
                              <Badge key={j} variant="email">
                                <a href={`mailto:${e}`}>{e}</a>
                              </Badge>
                            ))}
                          </div>
                        ) : <span className="flex-1"><Dash /></span>}
                        <Pencil size={10} className="opacity-0 group-hover:opacity-40 mt-0.5 shrink-0 transition-opacity" />
                      </div>
                    )}
                  </td>
                  {/* Address */}
                  <td className="px-3 py-3 align-top max-w-[200px]">
                    <div className="flex items-start gap-1">
                      {getVal(r, i, 'address') && <MapPin size={11} className="mt-0.5 shrink-0 text-orange-500" />}
                      <div className="text-xs flex-1">
                        <EditableCell
                          value={getVal(r, i, 'address') || ''}
                          rowIdx={i}
                          field="address"
                          editing={editingCell?.rowIdx === i && editingCell?.field === 'address'}
                          onStartEdit={handleStartEdit}
                          onSave={(val) => handleSave(i, 'address', val, r)}
                          onCancel={handleCancel}
                          multiline={true}
                        />
                      </div>
                    </div>
                  </td>
                  {/* Socials */}
                  <td className="px-3 py-3 align-top">
                    <SocialLinks socials={r.socials} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
