import { ExternalLink, Phone, Mail, MapPin, Download } from 'lucide-react'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
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

export function ResultsTable({ results, csvFile }) {
  if (results.length === 0) return null

  const withPhone = results.filter(r => r.phones?.length > 0).length
  const withEmail = results.filter(r => r.emails?.length > 0).length

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span><strong className="text-foreground">{results.length}</strong> results</span>
          <span className="text-green-600 flex items-center gap-1"><Phone size={12} />{withPhone} with phone</span>
          <span className="text-blue-600 flex items-center gap-1"><Mail size={12} />{withEmail} with email</span>
        </div>
        {csvFile && (
          <a href={downloadUrl(csvFile)} download>
            <Button variant="outline" size="sm">
              <Download size={13} />
              Download CSV
            </Button>
          </a>
        )}
      </div>

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
              {results.map((r, i) => (
                <tr key={i} className={r.error ? 'bg-red-50/50' : 'hover:bg-muted/30 transition-colors'}>
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
                        <div className="font-medium leading-tight text-foreground line-clamp-2">{r.title || '—'}</div>
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
                    {r.phones?.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {r.phones.map((p, j) => (
                          <Badge key={j} variant="phone">
                            <a href={`tel:${p.replace(/\s/g, '')}`}>{p}</a>
                          </Badge>
                        ))}
                      </div>
                    ) : <Dash />}
                  </td>
                  {/* Emails */}
                  <td className="px-3 py-3 align-top">
                    {r.emails?.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {r.emails.map((e, j) => (
                          <Badge key={j} variant="email">
                            <a href={`mailto:${e}`}>{e}</a>
                          </Badge>
                        ))}
                      </div>
                    ) : <Dash />}
                  </td>
                  {/* Address */}
                  <td className="px-3 py-3 align-top max-w-[200px]">
                    {r.address ? (
                      <span className="text-xs flex items-start gap-1">
                        <MapPin size={11} className="mt-0.5 shrink-0 text-orange-500" />
                        {r.address}
                      </span>
                    ) : <Dash />}
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
