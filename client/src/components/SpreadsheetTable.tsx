import { useState, useRef, useEffect } from "react";
import { Plus, Trash2, MoreHorizontal, Pencil, Palette, ChevronUp, ChevronDown, ArrowLeft, ArrowRight } from "lucide-react";

type ColumnDef = {
  key: string;
  name: string;
  type: "text" | "number" | "date";
  group: string | Record<string, never>;
  groupColor?: string;
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
  onMoveRow?: (rowId: number, direction: "up" | "down") => void;
  currency: "USD" | "BRL" | "RMB";
  exchangeRate: number;
  rmbRate: number;
};

const GROUP_COLORS: { name: string; bg: string; text: string; border: string; cellBg: string }[] = [
  { name: "Azul", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-400", cellBg: "bg-blue-50/30" },
  { name: "Verde", bg: "bg-green-50", text: "text-green-700", border: "border-green-400", cellBg: "bg-green-50/30" },
  { name: "Vermelho", bg: "bg-red-50", text: "text-red-600", border: "border-red-400", cellBg: "bg-red-50/30" },
  { name: "Roxo", bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-400", cellBg: "bg-purple-50/30" },
  { name: "Laranja", bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-400", cellBg: "bg-orange-50/30" },
  { name: "Rosa", bg: "bg-pink-50", text: "text-pink-700", border: "border-pink-400", cellBg: "bg-pink-50/30" },
  { name: "Amarelo", bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-400", cellBg: "bg-yellow-50/30" },
  { name: "Cinza", bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-400", cellBg: "bg-slate-50/50" },
];

function getGroupColor(groupName: string | null, groupColor?: string): typeof GROUP_COLORS[0] | null {
  if (!groupName) return null;
  if (groupColor) {
    const found = GROUP_COLORS.find(c => c.name === groupColor);
    if (found) return found;
  }
  const lower = groupName.toLowerCase();
  if (lower.includes("pagar") && lower.includes("total")) return GROUP_COLORS[0];
  if (lower.includes("pagou")) return GROUP_COLORS[1];
  if (lower.includes("falta")) return GROUP_COLORS[2];
  return GROUP_COLORS[3];
}

// Convert stored USD values to the selected currency for display
function formatCurrency(value: string, currency: "USD" | "BRL" | "RMB", exchangeRate: number, rmbRate: number): string {
  const num = parseFloat(value) || 0;
  if (num === 0) return "";
  
  
  let converted = num;
  if (currency === "BRL") converted = num * exchangeRate;
  else if (currency === "RMB") converted = num * rmbRate;
  if (currency === "USD") return `$ ${converted.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (currency === "BRL") return `R$ ${converted.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `¥ ${converted.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
  onMoveRow,
  currency,
  exchangeRate,
  rmbRate,
}: SpreadsheetTableProps) {
  const [editingCell, setEditingCell] = useState<{ rowId: number; colKey: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [columnMenu, setColumnMenu] = useState<{ colKey: string; x: number; y: number } | null>(null);
  const [rowMenu, setRowMenu] = useState<{ rowId: number; x: number; y: number } | null>(null);
  const [renamingCol, setRenamingCol] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColType, setNewColType] = useState<"text" | "number">("text");
  const [newColGroup, setNewColGroup] = useState("");
  const [newColGroupColor, setNewColGroupColor] = useState("Azul");
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState("");
  const [editGroupColor, setEditGroupColor] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const rowMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (columnMenu && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setColumnMenu(null);
      }
      if (rowMenu && rowMenuRef.current && !rowMenuRef.current.contains(e.target as Node)) {
        setRowMenu(null);
      }
    }
    if (columnMenu || rowMenu) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [columnMenu, rowMenu]);

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

    
  

  const startEdit = (rowId: number, colKey: string, currentValue: string, colType?: string) => {
    setEditingCell({ rowId, colKey });
    // For number columns, show the converted value (in selected currency) for editing
    if (colType === "number" && currentValue) {
      const num = parseFloat(currentValue) || 0;
      let converted = num;
      if (currency === "BRL") converted = num * exchangeRate;
      else if (currency === "RMB") converted = num * rmbRate;
      setEditValue(converted ? String(Math.round(converted * 100) / 100) : "");
    } else {
      setEditValue(currentValue || "");
    }
  };
  const commitEdit = () => {
    if (!editingCell) return;
    const row = rows.find((r) => r.id === editingCell.rowId);
    if (row) {
      const col = columns.find(c => c.key === editingCell.colKey);
      let valueToStore = editValue;
      // For number columns, convert back from selected currency to USD for storage
      if (col?.type === "number" && editValue) {
        const num = parseFloat(editValue) || 0;
        let usdVal = num;
        if (currency === "BRL") usdVal = num / exchangeRate;
        else if (currency === "RMB") usdVal = num / rmbRate;
        valueToStore = String(Math.round(usdVal * 1000000) / 1000000);
      }
      const newCells = { ...row.cells, [editingCell.colKey]: valueToStore };
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
      if (editingCell) {
        const colIdx = columns.findIndex((c) => c.key === editingCell.colKey);
        const rowIdx = rows.findIndex((r) => r.id === editingCell.rowId);
        if (colIdx < columns.length - 1) {
          const nextCol = columns[colIdx + 1];
          const row = rows[rowIdx];
          if (row) startEdit(row.id, nextCol.key, row.cells[nextCol.key] || "", nextCol.type);
        } else if (rowIdx < rows.length - 1) {
          const nextRow = rows[rowIdx + 1];
          const firstCol = columns[0];
          if (nextRow && firstCol) startEdit(nextRow.id, firstCol.key, nextRow.cells[firstCol.key] || "", firstCol.type);
        }
      }
    }
  };

  const openColumnMenu = (colKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setColumnMenu({ colKey, x: e.clientX, y: e.clientY });
    setRowMenu(null);
  };

  const openRowMenu = (rowId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setRowMenu({ rowId, x: e.clientX, y: e.clientY });
    setColumnMenu(null);
  };

  const deleteColumn = (colKey: string) => {
    const newCols = columns.filter((c) => c.key !== colKey);
    onColumnsChange(newCols);
    setColumnMenu(null);
  };

  const moveColumn = (colKey: string, direction: "left" | "right") => {
    const idx = columns.findIndex((c) => c.key === colKey);
    if (idx === -1) return;
    const swapIdx = direction === "left" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= columns.length) return;
    const newCols = [...columns];
    [newCols[idx], newCols[swapIdx]] = [newCols[swapIdx], newCols[idx]];
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

  const addNewColumn = () => {
    if (!newColName.trim()) return;
    const key = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newCol: ColumnDef = {
      key,
      name: newColName.trim(),
      type: newColType,
      group: newColGroup.trim() || {},
      groupColor: newColGroup.trim() ? newColGroupColor : undefined,
      width: 100,
    };
    onColumnsChange([...columns, newCol]);
    setAddingColumn(false);
    setNewColName("");
    setNewColType("text");
    setNewColGroup("");
    setNewColGroupColor("Azul");
  };

  const startEditGroup = (groupName: string) => {
    setEditingGroup(groupName);
    setEditGroupName(groupName);
    const firstCol = columns.find(c => typeof c.group === "string" && c.group === groupName);
    setEditGroupColor(firstCol?.groupColor || "Azul");
  };

  const commitGroupEdit = () => {
    if (!editingGroup) return;
    const newCols = columns.map((c) => {
      if (typeof c.group === "string" && c.group === editingGroup) {
        return { ...c, group: editGroupName.trim() || editingGroup, groupColor: editGroupColor };
      }
      return c;
    });
    onColumnsChange(newCols);
    setEditingGroup(null);
    setEditGroupName("");
    setEditGroupColor("");
  };

  // Group columns by group name for header
  const groups: { name: string | null; cols: ColumnDef[]; color?: string }[] = [];
  let currentGroup: { name: string | null; cols: ColumnDef[]; color?: string } | null = null;
  for (const col of columns) {
    const groupName = typeof col.group === "string" && col.group ? col.group : null;
    if (!currentGroup || currentGroup.name !== groupName) {
      currentGroup = { name: groupName, cols: [col], color: col.groupColor };
      groups.push(currentGroup);
    } else {
      currentGroup.cols.push(col);
    }
  }

  return (
    <div className="relative">
      <div className="overflow-x-auto -mx-2 px-2 pb-1">
        <table className="w-full text-[11px] border-collapse min-w-[800px]">
          <thead>
            {/* Group header row */}
            <tr>
              <th className="bg-white w-[40px] border-b-2 border-transparent"></th>
              {groups.map((g, gIdx) => {
                const colorDef = getGroupColor(g.name, g.color);
                return (
                  <th
                    key={gIdx}
                    colSpan={g.cols.length}
                    className={`px-1 py-1 text-center font-bold text-[10px] uppercase tracking-wider whitespace-nowrap border-b-2 ${
                      colorDef
                        ? `${colorDef.bg} ${colorDef.text} ${colorDef.border}`
                        : "bg-white border-transparent"
                    }`}
                  >
                    {g.name ? (
                      <div className="flex items-center justify-center gap-1">
                        {editingGroup === g.name ? (
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={editGroupName}
                              onChange={(e) => setEditGroupName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitGroupEdit();
                                if (e.key === "Escape") setEditingGroup(null);
                              }}
                              className="px-2 py-0.5 text-[10px] border rounded bg-white text-slate-800 normal-case w-[120px]"
                              autoFocus
                            />
                            <div className="flex gap-0.5">
                              {GROUP_COLORS.map((c) => (
                                <button
                                  key={c.name}
                                  onClick={() => setEditGroupColor(c.name)}
                                  className={`w-4 h-4 rounded-full ${c.bg} border-2 ${
                                    editGroupColor === c.name ? "border-slate-800 ring-1 ring-slate-400" : "border-transparent"
                                  }`}
                                  title={c.name}
                                />
                              ))}
                            </div>
                            <button
                              onClick={commitGroupEdit}
                              className="px-2 py-0.5 text-[9px] bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              OK
                            </button>
                          </div>
                        ) : (
                          <span
                            className="cursor-pointer hover:underline"
                            onDoubleClick={() => startEditGroup(g.name!)}
                            title="Duplo clique para editar nome/cor do grupo"
                          >
                            {g.name}
                          </span>
                        )}
                      </div>
                    ) : ""}
                  </th>
                );
              })}
              <th className="bg-white w-[60px] border-b-2 border-transparent"></th>
            </tr>
            {/* Column names row */}
            <tr className="bg-slate-50 text-slate-500 uppercase text-[10px]">
              <th className="px-1 py-2 text-center font-semibold w-[40px]"></th>
              {columns.map((col) => {
                const groupName = typeof col.group === "string" && col.group ? col.group : null;
                const colorDef = getGroupColor(groupName, col.groupColor);
                return (
                  <th
                    key={col.key}
                    className={`px-2 py-2 font-semibold whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors relative group ${
                      col.type === "number" ? "text-center" : "text-left"
                    } ${colorDef ? colorDef.cellBg : ""}`}
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
                          className="opacity-60 hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-slate-200"
                        >
                          <MoreHorizontal className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </th>
                );
              })}
              <th className="px-1 py-2 text-center font-semibold w-[60px]">
                <button
                  onClick={() => setAddingColumn(true)}
                  className="p-1 rounded hover:bg-blue-100 text-blue-600 transition-colors"
                  title="Adicionar coluna"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr
                key={row.id}
                className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors group/row"
                onContextMenu={(e) => openRowMenu(row.id, e)}
              >
                {/* Row actions column */}
                <td className="px-0.5 py-1.5 text-center">
                  <div className="flex flex-col items-center gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
                    <button
                      onClick={() => onMoveRow?.(row.id, "up")}
                      disabled={rowIdx === 0}
                      className="p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Mover para cima"
                    >
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => onMoveRow?.(row.id, "down")}
                      disabled={rowIdx === rows.length - 1}
                      className="p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Mover para baixo"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>
                </td>
                {columns.map((col) => {
                  const cellValue = row.cells[col.key] || "";
                  const isEditing = editingCell?.rowId === row.id && editingCell?.colKey === col.key;
                  const groupName = typeof col.group === "string" && col.group ? col.group : null;
                  const colorDef = getGroupColor(groupName, col.groupColor);
                  return (
                    <td
                      key={col.key}
                      className={`px-2 py-1.5 cursor-text hover:bg-blue-50/50 transition-colors ${
                        col.type === "number" ? "text-right font-mono" : "text-left"
                      } ${colorDef ? colorDef.cellBg : ""}`}
                      onClick={() => !isEditing && startEdit(row.id, col.key, cellValue, col.type)}
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
                <td colSpan={columns.length + 2} className="text-center py-6 text-slate-400 text-xs italic">
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
          className="fixed z-50 bg-white rounded-lg shadow-xl border border-slate-200 py-1 min-w-[180px]"
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
            onClick={() => { setColumnMenu(null); setAddingColumn(true); }}
            className="w-full px-3 py-2 text-left text-xs hover:bg-slate-100 flex items-center gap-2"
          >
            <Plus className="w-3.5 h-3.5" />
            Inserir coluna
          </button>
          <hr className="my-1 border-slate-200" />
          <button
            onClick={() => moveColumn(columnMenu.colKey, "left")}
            disabled={columns.findIndex(c => c.key === columnMenu.colKey) === 0}
            className="w-full px-3 py-2 text-left text-xs hover:bg-slate-100 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Mover para esquerda
          </button>
          <button
            onClick={() => moveColumn(columnMenu.colKey, "right")}
            disabled={columns.findIndex(c => c.key === columnMenu.colKey) === columns.length - 1}
            className="w-full px-3 py-2 text-left text-xs hover:bg-slate-100 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            Mover para direita
          </button>
          <hr className="my-1 border-slate-200" />
          <button
            onClick={() => {
              const col = columns.find(c => c.key === columnMenu.colKey);
              if (col) {
                const groupName = typeof col.group === "string" && col.group ? col.group : null;
                if (groupName) {
                  startEditGroup(groupName);
                }
              }
              setColumnMenu(null);
            }}
            className="w-full px-3 py-2 text-left text-xs hover:bg-slate-100 flex items-center gap-2"
          >
            <Palette className="w-3.5 h-3.5" />
            Alterar cor do grupo
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

      {/* Row context menu */}
      {rowMenu && (
        <div
          ref={rowMenuRef}
          className="fixed z-50 bg-white rounded-lg shadow-xl border border-slate-200 py-1 min-w-[180px]"
          style={{ left: rowMenu.x, top: rowMenu.y }}
        >
          <button
            onClick={() => { onMoveRow?.(rowMenu.rowId, "up"); setRowMenu(null); }}
            disabled={rows.findIndex(r => r.id === rowMenu.rowId) === 0}
            className="w-full px-3 py-2 text-left text-xs hover:bg-slate-100 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronUp className="w-3.5 h-3.5" />
            Mover para cima
          </button>
          <button
            onClick={() => { onMoveRow?.(rowMenu.rowId, "down"); setRowMenu(null); }}
            disabled={rows.findIndex(r => r.id === rowMenu.rowId) === rows.length - 1}
            className="w-full px-3 py-2 text-left text-xs hover:bg-slate-100 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronDown className="w-3.5 h-3.5" />
            Mover para baixo
          </button>
          <hr className="my-1 border-slate-200" />
          <button
            onClick={() => {
              if (confirm("Remover esta linha?")) {
                onDeleteRow(rowMenu.rowId);
              }
              setRowMenu(null);
            }}
            className="w-full px-3 py-2 text-left text-xs hover:bg-red-50 text-red-600 flex items-center gap-2"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Excluir linha
          </button>
        </div>
      )}

      {/* Add column modal */}
      {addingColumn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl shadow-2xl p-5 w-[340px]">
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
              {newColGroup.trim() && (
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 uppercase">Cor do grupo</label>
                  <div className="flex gap-1.5 mt-1.5 flex-wrap">
                    {GROUP_COLORS.map((c) => (
                      <button
                        key={c.name}
                        onClick={() => setNewColGroupColor(c.name)}
                        className={`w-7 h-7 rounded-lg ${c.bg} border-2 flex items-center justify-center transition-all ${
                          newColGroupColor === c.name ? "border-slate-800 scale-110 shadow-sm" : "border-transparent hover:border-slate-300"
                        }`}
                        title={c.name}
                      >
                        {newColGroupColor === c.name && <span className={`text-[8px] font-bold ${c.text}`}>✓</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
