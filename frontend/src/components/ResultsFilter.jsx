import { Search, Phone, Mail, MapPin, Share2, X } from 'lucide-react'
import { Input } from './ui/Input'
import { Button } from './ui/Button'
import { cn } from '../lib/cn'

function FilterChip({ active, onClick, children, className }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
        active
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
        className
      )}
    >
      {children}
    </button>
  )
}

export function ResultsFilter({ filters, onFiltersChange, total, filtered }) {
  function toggle(key) {
    onFiltersChange({ ...filters, [key]: !filters[key] })
  }

  const hasActiveFilters = filters.query || filters.hasPhone || filters.hasEmail || filters.hasAddress || filters.hasSocial

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Text search */}
      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          className="pl-7 h-8 text-xs w-44"
          placeholder="Search name or URL…"
          value={filters.query}
          onChange={e => onFiltersChange({ ...filters, query: e.target.value })}
        />
      </div>

      {/* Toggle filters */}
      <FilterChip active={filters.hasPhone} onClick={() => toggle('hasPhone')}>
        <Phone size={10} /> Phone
      </FilterChip>
      <FilterChip active={filters.hasEmail} onClick={() => toggle('hasEmail')}>
        <Mail size={10} /> Email
      </FilterChip>
      <FilterChip active={filters.hasAddress} onClick={() => toggle('hasAddress')}>
        <MapPin size={10} /> Address
      </FilterChip>
      <FilterChip active={filters.hasSocial} onClick={() => toggle('hasSocial')}>
        <Share2 size={10} /> Social
      </FilterChip>

      {/* Sort */}
      <select
        className="h-8 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        value={filters.sort}
        onChange={e => onFiltersChange({ ...filters, sort: e.target.value })}
      >
        <option value="default">Sort: default</option>
        <option value="name">Sort: name</option>
        <option value="phones">Sort: most phones</option>
        <option value="emails">Sort: most emails</option>
      </select>

      {/* Clear */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onFiltersChange({ query: '', hasPhone: false, hasEmail: false, hasAddress: false, hasSocial: false, sort: 'default' })}
        >
          <X size={12} /> Clear
        </Button>
      )}

      {/* Count */}
      <span className="text-xs text-muted-foreground ml-auto">
        {filtered < total ? `${filtered} of ${total}` : `${total}`} result{total !== 1 ? 's' : ''}
      </span>
    </div>
  )
}
