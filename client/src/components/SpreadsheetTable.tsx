import { useState, useRef, useEffect, useCallback } from "react";
import { Plus, Trash2, GripVertical, MoreHorizontal, Pencil, X, Check } from "lucide-react";
import { trpc } from "@/lib/trpc";

type ColumnDef = {
  key: string;
  name: string;
  type: "text" | "number" | "date";
  group: string | Record<string, never>;
  width: number;
};

type RowData = {
  id: number;
  cells: Record<string, string>;
};

type SpreadsheetTableProps = {
  supplierId: number;
  sectionTitle: string | null;
  columns: ColumnDef[];
  rows: RowData[];
  onColumnsChange: (columns: ColumnDef[]) => void;
  onCellChange: (rowId: number, cells: Record<string, string>) => void;
  onAddRow: () => void;
  onDeleteRow: (rowId: number) => void;
  currency: "USD" | "BRL" | "RMB";
  exchangeRate: number;
  rmbRate: number;
};

function formatCurrency(value: string, currency: "USD" | "BRL" | "RMB", exchangeRate: number, rmbRate: number): string {
  const num = parseFloat(value) || 0;
  if (num === 0) return "";
  if (currency === "USD") return `$ ${num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (currency === "BRL") return `R$ ${(num * exchangeRate).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `¥ ${(num * rmbRate).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function SpreadsheetTable({
  supplierId,
  sectionTitle,
  columns,
  rows,
  onColumnsChange,
  onCellChange,
  onAddRow,
  onDeleteRow,
  currency,
  exchangeRate,
  rmbRate,
}: SpreadsheetTableProps) {
  const [editingCell, setEditingCell] = useState<{ rowId: number; colKey: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [columnMenu, setColumnMenu] = useState<{ colKey: string; x: number; y: number } | null>(null);
  const [renamingCol, setRenamingCol] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColType, setNewColType] = useState<"text" | "number">("text");
  const [newColGroup, setNewColGroup] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close column menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setColumnMenu(null);
      }
    }
    if (columnMenu) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [columnMenu]);

  // Focus input when editing
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  const startEdit = (rowId: number, colKey: string, currentValue: string) => {
    setEditingCell({ rowId, colKey });
    setEditValue(currentValue || "");
  };

  const commitEdit = () => {
    if (!editingCell) return;
    const row = rows.find((r) => r.id === editingCell.rowId);
    if (row) {
      const newCells = { ...row.cells, [editingCell.colKey]: editValue };
      onCellChange(editingCell.rowId, newCells);
    }
    setEditingCell(null);
    setEditValue("");
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      commitEdit();
    } else if (e.key === "Escape") {
      cancelEdit();
    } else if (e.key === "Tab") {
      e.preventDefault();
      commitEdit();
      // Move to next cell
      if (editingCell) {
        const colIdx = columns.findIndex((c) => c.key === editingCell.colKey);
        const rowIdx = rows.findIndex((r) => r.id === editingCell.rowId);
        if (colIdx < columns.length - 1) {
          const nextCol = columns[colIdx + 1];
          const row = rows[rowIdx];
          if (row) startEdit(row.id, nextCol.key, row.cells[nextCol.key] || "");
        } else if (rowIdx < rows.length - 1) {
          const nextRow = rows[rowIdx + 1];
          const firstCol = columns[0];
          if (nextRow && firstCol) startEdit(nextRow.id, firstCol.key, nextRow.cells[firstCol.key] || "");
        }
      }
    }
  };

  const openColumnMenu = (colKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setColumnMenu({ colKey, x: e.clientX, y: e.clientY });
  };

  const deleteColumn = (colKey: string) => {
    const newCols = columns.filter((c) => c.key !== colKey);
    onColumnsChange(newCols);
    setColumnMenu(null);
  };

  const startRenameColumn = (colKey: string) => {
    const col = columns.find((c) => c.key === colKey);
    if (col) {
      setRenamingCol(colKey);
      setRenameValue(col.name);
    }
    setColumnMenu(null);
  };

  const commitRename = () => {
    if (!renamingCol) return;
    const newCols = columns.map((c) =>
      c.key === renamingCol ? { ...c, name: renameValue } : c
    );
    onColumnsChange(newCols);
    setRenamingCol(null);
    setRenameValue("");
  };

  const insertColumnAfter = (colKey: string) => {
    setColumnMenu(null);
    setAddingColumn(true);
  };

  const addNewColumn = () => {
    if (!newColName.trim()) return;
    const key = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newCol: ColumnDef = {
      key,
      name: newColName.trim(),
      type: newColType,
      group: newColGroup.trim() || {},
      width: 80,
    };
    onColumnsChange([...columns, newCol]);
    setAddingColumn(false);
    setNewColName("");
    setNewColType("text");
    setNewColGroup("");
  };

  // Group columns by group name for header
  const groups: { name: string | null; cols: ColumnDef[] }[] = [];
  let currentGroup: { name: string | null; cols: ColumnDef[] } | null = null;
  for (const col of columns) {
    const groupName = typeof col.group === "string" && col.group ? col.group : null;
    if (!currentGroup || currentGroup.name !== groupName) {
      currentGroup = { name: groupName, cols: [col] };
      groups.push(currentGroup);
    } else {
      currentGroup.cols.push(col);
    }
  }

  return (
    <div className="relative">
      {/* Table */}
      <div className="overflow-x-auto -mx-2 px-2 pb-1">
        <table className="w-full text-[11px] border-collapse min-w-[800px]">
          {/* Group header row */}
          <thead>
            <tr>
              {groups.map((g, gIdx) => (
                <th
                  key={gIdx}
                  colSpan={g.cols.length}
                  className={`px-1 py-1 text-center font-bold text-[10px] uppercase tracking-wider whitespace-nowrap ${
                    g.name === "Total a pagar"
                      ? "bg-blue-50 text-blue-700 border-b-2 border-blue-400"
                      : g.name === "O que pagou"
                      ? "bg-green-50 text-green-700 border-b-2 border-green-400"
                      : g.name === "O que falta pagar"
                      ? "bg-red-50 text-red-600 border-b-2 border-red-400"
                      : g.name
                      ? "bg-purple-50 text-purple-700 border-b-2 border-purple-400"
                      : "bg-white"
                  }`}
                >
                  {g.name || ""}
                </th>
              ))}
              <th className="bg-white w-[60px]"></th>
            </tr>
            {/* Column names row */}
            <tr className="bg-slate-50 text-slate-500 uppercase text-[10px]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-2 py-2 font-semibold whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors relative group ${
                    col.type === "number" ? "text-center" : "text-left"
                  } ${
                    typeof col.group === "string" && col.group === "Total a pagar"
                      ? "bg-blue-50/50"
                      : typeof col.group === "string" && col.group === "O que pagou"
                      ? "bg-green-50/50"
                      : typeof col.group === "string" && col.group === "O que falta pagar"
                      ? "bg-red-50/50"
                      : ""
                  }`}
                  style={{ minWidth: col.width }}
                  onContextMenu={(e) => openColumnMenu(col.key, e)}
                >
                  {renamingCol === col.key ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename();
                          if (e.key === "Escape") setRenamingCol(null);
                        }}
                        onBlur={commitRename}
                        className="w-full px-1 py-0.5 text-[10px] border rounded bg-white text-slate-800 normal-case"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span>{col.name}</span>
                      <button
                        onClick={(e) => openColumnMenu(col.key, e)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-slate-200"
                      >
                        <MoreHorizontal className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </th>
              ))}
              <th className="px-1 py-2 text-center font-semibold w-[60px]">
                <button
                  onClick={() => setAddingColumn(true)}
                  className="p-1 rounded hover:bg-blue-100 text-blue-600 transition-colors"
                  title="Adicionar coluna"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr
                key={row.id}
                className={`border-b border-slate-100 hover:bg-blue-50/30 transition-colors ${
                  rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50/30"
                }`}
              >
                {columns.map((col) => {
                  const isEditing = editingCell?.rowId === row.id && editingCell?.colKey === col.key;
                  const cellValue = row.cells[col.key] || "";

                  return (
                    <td
                      key={col.key}
                      className={`px-2 py-1.5 cursor-pointer border-r border-slate-100 ${
                        col.type === "number" ? "text-right font-mono" : "text-left"
                      } ${
                        typeof col.group === "string" && col.group === "Total a pagar"
                          ? "bg-blue-50/30"
                          : typeof col.group === "string" && col.group === "O que pagou"
                          ? "bg-green-50/30"
                          : typeof col.group === "string" && col.group === "O que falta pagar"
                          ? "bg-red-50/30"
                          : ""
                      }`}
                      style={{ minWidth: col.width }}
                      onClick={() => !isEditing && startEdit(row.id, col.key, cellValue)}
                    >
                      {isEditing ? (
                        <input
                          ref={inputRef}
                          type={col.type === "number" ? "text" : "text"}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={handleKeyDown}
                          className="w-full px-1 py-0.5 text-[11px] border border-blue-400 rounded bg-white outline-none ring-1 ring-blue-200"
                        />
                      ) : (
                        <span className="block truncate text-[11px]">
                          {col.type === "number" && cellValue
                            ? formatCurrency(cellValue, currency, exchangeRate, rmbRate)
                            : cellValue}
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className="px-1 py-1.5 text-center">
                  <button
                    onClick={() => {
                      if (confirm("Remover esta linha?")) onDeleteRow(row.id);
                    }}
                    className="p-1 rounded hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors"
                    title="Remover linha"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="text-center py-6 text-slate-400 text-xs italic">
                  Nenhum registro. Clique em "+" para adicionar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add row button */}
      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={onAddRow}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md border border-blue-200 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Nova linha
        </button>
      </div>

      {/* Column context menu */}
      {columnMenu && (
        <div
          ref={menuRef}
          className="fixed z-50 bg-white rounded-lg shadow-xl border border-slate-200 py-1 min-w-[160px]"
          style={{ left: columnMenu.x, top: columnMenu.y }}
        >
          <button
            onClick={() => startRenameColumn(columnMenu.colKey)}
            className="w-full px-3 py-2 text-left text-xs hover:bg-slate-100 flex items-center gap-2"
          >
            <Pencil className="w-3.5 h-3.5" />
            Renomear coluna
          </button>
          <button
            onClick={() => insertColumnAfter(columnMenu.colKey)}
            className="w-full px-3 py-2 text-left text-xs hover:bg-slate-100 flex items-center gap-2"
          >
            <Plus className="w-3.5 h-3.5" />
            Inserir coluna
          </button>
          <hr className="my-1 border-slate-200" />
          <button
            onClick={() => deleteColumn(columnMenu.colKey)}
            className="w-full px-3 py-2 text-left text-xs hover:bg-red-50 text-red-600 flex items-center gap-2"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Excluir coluna
          </button>
        </div>
      )}

      {/* Add column modal */}
      {addingColumn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl shadow-2xl p-5 w-[320px]">
            <h3 className="text-sm font-bold text-slate-800 mb-3">Nova Coluna</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase">Nome</label>
                <input
                  type="text"
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg mt-1"
                  placeholder="Ex: Observação"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase">Tipo</label>
                <select
                  value={newColType}
                  onChange={(e) => setNewColType(e.target.value as "text" | "number")}
                  className="w-full px-3 py-2 text-sm border rounded-lg mt-1"
                >
                  <option value="text">Texto</option>
                  <option value="number">Número (moeda)</option>
                  <option value="date">Data</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase">Grupo (opcional)</label>
                <input
                  type="text"
                  value={newColGroup}
                  onChange={(e) => setNewColGroup(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg mt-1"
                  placeholder="Ex: Total a pagar"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => { setAddingColumn(false); setNewColName(""); setNewColGroup(""); }}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={addNewColumn}
                disabled={!newColName.trim()}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
