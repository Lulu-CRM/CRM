"use client";

export type Column<T> = {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  // Set to make the header a sort button. The page owns the sort state.
  sortable?: boolean;
  className?: string;
};

export type SortState = { key: string; direction: "asc" | "desc" } | null;

export function Table<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  sort,
  onSortChange,
  selected,
  onSelectedChange,
  selectAllLabel,
  selectRowLabel,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  sort?: SortState;
  onSortChange?: (sort: SortState) => void;
  // Row selection is on when these are passed.
  selected?: Set<string>;
  onSelectedChange?: (selected: Set<string>) => void;
  selectAllLabel?: string;
  selectRowLabel?: (row: T) => string;
}) {
  const selectable = selected && onSelectedChange;
  const allSelected = selectable && rows.length > 0 && rows.every((row) => selected.has(rowKey(row)));

  const toggleAll = () => {
    if (!selectable) return;
    onSelectedChange(allSelected ? new Set() : new Set(rows.map(rowKey)));
  };

  const toggleRow = (id: string) => {
    if (!selectable) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectedChange(next);
  };

  const nextSort = (key: string): SortState => {
    if (sort?.key !== key) return { key, direction: "asc" };
    return sort.direction === "asc" ? { key, direction: "desc" } : null;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse">
        <thead>
          <tr>
            {selectable && (
              <th className="w-10 border-y border-[#efedf4] bg-[#fafaff] px-3 py-3 text-left">
                <input
                  type="checkbox"
                  checked={!!allSelected}
                  onChange={toggleAll}
                  aria-label={selectAllLabel}
                  className="accent-[#6259d6]"
                />
              </th>
            )}
            {columns.map((column) => {
              const direction = sort?.key === column.key ? sort.direction : null;
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={direction ? (direction === "asc" ? "ascending" : "descending") : undefined}
                  className={`border-y border-[#efedf4] bg-[#fafaff] px-3 py-3 text-left text-[9px] font-semibold tracking-[0.08em] text-[#9e9baa] uppercase ${column.className ?? ""}`}
                >
                  {column.sortable && onSortChange ? (
                    <button
                      type="button"
                      onClick={() => onSortChange(nextSort(column.key))}
                      className="inline-flex items-center gap-1 uppercase hover:text-text-muted"
                    >
                      {column.header}
                      <span aria-hidden>{direction === "asc" ? "↑" : direction === "desc" ? "↓" : "↕"}</span>
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const id = rowKey(row);
            return (
              <tr
                key={id}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`border-b border-surface-muted ${onRowClick ? "cursor-pointer hover:bg-surface-soft" : ""}`}
              >
                {selectable && (
                  <td className="px-3 py-3" onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(id)}
                      onChange={() => toggleRow(id)}
                      aria-label={selectRowLabel?.(row)}
                      className="accent-[#6259d6]"
                    />
                  </td>
                )}
                {columns.map((column) => (
                  <td key={column.key} className={`px-3 py-3 align-middle text-[10px] text-text-muted ${column.className ?? ""}`}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  summary,
  previousLabel,
  nextLabel,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  summary: React.ReactNode;
  previousLabel: string;
  nextLabel: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const button =
    "grid h-[26px] min-w-[26px] place-items-center rounded-md border border-border-strong bg-surface px-1.5 text-[10px] text-text-subtle disabled:opacity-40";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-4 text-[10px] text-text-subtle">
      <span>{summary}</span>
      <nav className="flex gap-1">
        <button type="button" className={button} disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label={previousLabel}>
          ‹
        </button>
        {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onPageChange(n)}
            aria-current={n === page ? "page" : undefined}
            className={`${button} ${n === page ? "border-[#d9d5f4] bg-primary-soft font-extrabold text-primary-hover" : ""}`}
          >
            {n}
          </button>
        ))}
        <button type="button" className={button} disabled={page >= pages} onClick={() => onPageChange(page + 1)} aria-label={nextLabel}>
          ›
        </button>
      </nav>
    </div>
  );
}
