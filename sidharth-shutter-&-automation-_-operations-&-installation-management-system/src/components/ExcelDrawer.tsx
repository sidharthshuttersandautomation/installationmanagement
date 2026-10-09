import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Download, X, Search, Filter, FileSpreadsheet, ArrowUpDown } from 'lucide-react';

export interface ColumnDef<T> {
  key: string;
  label: string;
  render?: (value: any, row: T) => React.ReactNode;
  formatForExport?: (value: any, row: T) => any;
  align?: 'left' | 'center' | 'right';
}

interface ExcelDrawerProps<T = any> {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  data: T[];
  columns: ColumnDef<T>[];
  exportFileName?: string;
}

export function ExcelDrawer<T extends Record<string, any>>({
  isOpen,
  onClose,
  title,
  subtitle,
  data,
  columns,
  exportFileName = 'opsflow_export',
}: ExcelDrawerProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedColumnFilter, setSelectedColumnFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Filtered & Sorted data
  const filteredData = useMemo(() => {
    let result = [...data];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((row) => {
        if (selectedColumnFilter !== 'all') {
          const val = row[selectedColumnFilter];
          return val !== undefined && String(val).toLowerCase().includes(q);
        }
        return Object.values(row).some(
          (val) => val !== undefined && String(val).toLowerCase().includes(q)
        );
      });
    }

    if (sortKey) {
      result.sort((a, b) => {
        const valA = a[sortKey];
        const valB = b[sortKey];
        if (valA === valB) return 0;
        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortOrder === 'asc' ? valA - valB : valB - valA;
        }
        return sortOrder === 'asc'
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      });
    }

    return result;
  }, [data, searchQuery, selectedColumnFilter, sortKey, sortOrder]);

  // Real 1-Click XLSX File Download using SheetJS
  const handleExportToExcel = () => {
    try {
      const exportRows = filteredData.map((row) => {
        const formattedRow: Record<string, any> = {};
        columns.forEach((col) => {
          const rawValue = row[col.key];
          if (col.formatForExport) {
            formattedRow[col.label] = col.formatForExport(rawValue, row);
          } else {
            formattedRow[col.label] = rawValue !== undefined ? rawValue : '';
          }
        });
        return formattedRow;
      });

      const worksheet = XLSX.utils.json_to_sheet(exportRows);

      // Auto-fit column widths
      const colWidths = columns.map((col) => {
        const headerLen = col.label.length;
        const maxValLen = Math.max(
          ...filteredData.map((r) => {
            const val = r[col.key];
            return val ? String(val).length : 0;
          }),
          0
        );
        return { wch: Math.min(40, Math.max(headerLen + 2, maxValLen + 2, 10)) };
      });
      worksheet['!cols'] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'OpsFlow Data');

      const timestamp = new Date().toISOString().split('T')[0];
      const finalName = `${exportFileName}_${timestamp}.xlsx`;

      XLSX.writeFile(workbook, finalName);
    } catch (err) {
      console.error('Failed to export Excel file:', err);
    }
  };

  const handleHeaderClick = (key: string) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <aside
        aria-label="Excel data view"
        className="fixed inset-y-0 right-0 max-w-5xl w-full bg-white border-l-2 border-[#10418A] shadow-2xl flex flex-col z-50 transform transition-transform duration-300"
      >
        {/* Drawer Header with Sidharth Theme Gradient */}
        <div className="px-6 py-4 border-b border-[#0D346E] flex items-center justify-between bg-gradient-to-r from-[#10418A] to-[#1E5BB5] text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/10 text-emerald-300 border border-white/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">{title}</h2>
                <span className="text-xs text-blue-100 font-mono bg-white/10 px-2 py-0.5 rounded-full">
                  {filteredData.length} {filteredData.length === 1 ? 'record' : 'records'}
                </span>
              </div>
              {subtitle && <p className="text-xs text-blue-100 mt-0.5">{subtitle}</p>}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportToExcel}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-white bg-[#00A859] hover:bg-[#00924c] active:scale-98 rounded-lg shadow-sm transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export to Excel (.xlsx)</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar: Search & Column Filters */}
        <div className="px-6 py-3 bg-[#F8FAFC] border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-[280px]">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search raw dataset..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#10418A] focus:ring-1 focus:ring-[#10418A]"
              />
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <span>Column:</span>
              <select
                value={selectedColumnFilter}
                onChange={(e) => setSelectedColumnFilter(e.target.value)}
                className="bg-white border border-slate-300 text-slate-700 text-xs rounded-md px-2 py-1 focus:outline-none focus:border-[#10418A]"
              >
                <option value="all">All Columns</option>
                {columns.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="text-xs text-slate-500 flex items-center gap-2">
            <span>Click column header to sort</span>
            {sortKey && (
              <button
                onClick={() => {
                  setSortKey(null);
                  setSortOrder('asc');
                }}
                className="text-xs text-[#10418A] hover:underline font-bold cursor-pointer"
              >
                Clear sort
              </button>
            )}
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-auto bg-white">
          {filteredData.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-center px-6">
              <FileSpreadsheet className="w-10 h-10 text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-slate-700">No matching records found</p>
              <p className="text-xs text-slate-500 mt-1">Try refining or clearing your search filter.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs text-slate-700 border-collapse">
              <thead className="bg-[#F1F5F9] sticky top-0 z-10 border-b border-slate-200 text-[#10418A] font-bold">
                <tr>
                  <th className="py-2.5 px-4 font-mono text-[11px] text-slate-500 w-12 text-center">#</th>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => handleHeaderClick(col.key)}
                      className={`py-2.5 px-4 cursor-pointer hover:text-[#1E5BB5] select-none transition-colors ${
                        col.align === 'right'
                          ? 'text-right'
                          : col.align === 'center'
                          ? 'text-center'
                          : 'text-left'
                      }`}
                    >
                      <div
                        className={`inline-flex items-center gap-1.5 ${
                          col.align === 'right' ? 'justify-end' : ''
                        }`}
                      >
                        <span>{col.label}</span>
                        <ArrowUpDown
                          className={`w-3 h-3 ${
                            sortKey === col.key ? 'text-[#10418A]' : 'text-slate-400'
                          }`}
                        />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {filteredData.map((row, idx) => (
                  <tr
                    key={row.id || idx}
                    className="hover:bg-blue-50/50 transition-colors group"
                  >
                    <td className="py-2.5 px-4 text-center font-mono text-[11px] text-slate-400">
                      {idx + 1}
                    </td>
                    {columns.map((col) => {
                      const val = row[col.key];
                      return (
                        <td
                          key={col.key}
                          className={`py-2.5 px-4 whitespace-nowrap text-slate-800 ${
                            col.align === 'right'
                              ? 'text-right font-mono tabular-nums'
                              : col.align === 'center'
                              ? 'text-center'
                              : 'text-left'
                          }`}
                        >
                          {col.render ? col.render(val, row) : val !== undefined ? String(val) : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-[#F8FAFC] flex items-center justify-between text-xs text-slate-600">
          <div>
            Showing <span className="font-mono font-bold text-slate-900">{filteredData.length}</span> of{' '}
            <span className="font-mono font-bold text-slate-900">{data.length}</span> entries
          </div>
          <button
            onClick={handleExportToExcel}
            className="text-xs text-[#00A859] hover:underline font-bold flex items-center gap-1 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Download complete workbook (.xlsx)
          </button>
        </div>
      </aside>
    </div>
  );
}
