import { useState } from 'react';
import { Search, ChevronUp, ChevronDown } from 'lucide-react';

export default function AdminTable({ columns, data, actions }) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [search, setSearch]   = useState('');

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const filtered = data.filter((row) =>
    columns.some((col) => String(row[col.key] ?? '').toLowerCase().includes(search.toLowerCase()))
  );

  const sorted = sortKey
    ? [...filtered].sort((a, b) => {
        const cmp = String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? ''), undefined, { numeric: true });
        return sortDir === 'asc' ? cmp : -cmp;
      })
    : filtered;

  return (
    <div>
      {/* Search bar */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
        <input
          type="text" value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="field pl-10 text-sm"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-soft border-b border-border">
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wide cursor-pointer select-none hover:text-ink transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {sortKey === col.key
                      ? sortDir === 'asc' ? <ChevronUp size={12} className="text-brand-500" /> : <ChevronDown size={12} className="text-brand-500" />
                      : <ChevronUp size={12} className="opacity-20" />
                    }
                  </div>
                </th>
              ))}
              {actions && (
                <th className="px-4 py-3 text-right text-xs font-semibold text-ink-muted uppercase tracking-wide">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (actions ? 1 : 0)}
                  className="px-4 py-10 text-center text-ink-faint text-sm">
                  No records found.
                </td>
              </tr>
            ) : sorted.map((row, i) => (
              <tr key={row.id || row._id || i} className="trow">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-ink-muted whitespace-nowrap max-w-[200px] truncate">
                    {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '—')}
                  </td>
                ))}
                {actions && (
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">{actions(row)}</div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-faint mt-2">{sorted.length} of {data.length} records</p>
    </div>
  );
}
