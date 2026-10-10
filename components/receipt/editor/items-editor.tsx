"use client";

import { GripVertical, Plus, Trash2 } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";

import { inputClass, NumberInput, Section } from "@/components/receipt/editor/fields";
import { useActiveDraft, useReceiptStore } from "@/lib/store/receipt-store";
import { currencyDecimals } from "@/lib/utils/currency";

/**
 * Line items: Enter moves to the next row (or adds one on the last row), the
 * grip drags to reorder, and ↑/↓ on the focused grip reorders from the keyboard.
 */
export function ItemsEditor() {
  const draft = useActiveDraft();
  const addItem = useReceiptStore((s) => s.addItem);
  const updateItem = useReceiptStore((s) => s.updateItem);
  const removeItem = useReceiptStore((s) => s.removeItem);
  const moveItem = useReceiptStore((s) => s.moveItem);
  const nameRefs = useRef(new Map<string, HTMLInputElement>());
  const [focusNewId, setFocusNewId] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  if (!draft) return null;
  const { items, currency } = draft;
  const decimals = currencyDecimals(currency);

  function handleAdd() {
    const id = addItem();
    if (id) setFocusNewId(id);
  }

  function handleEnter(e: KeyboardEvent<HTMLInputElement>, index: number) {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    e.preventDefault();
    const next = items[index + 1];
    if (next) nameRefs.current.get(next.id)?.focus();
    else handleAdd();
  }

  function handleGripKey(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    if (e.key === "ArrowUp" && index > 0) {
      e.preventDefault();
      moveItem(index, index - 1);
    } else if (e.key === "ArrowDown" && index < items.length - 1) {
      e.preventDefault();
      moveItem(index, index + 1);
    }
  }

  return (
    <Section
      title={`Items (${items.length})`}
      action={
        <button
          type="button"
          onClick={handleAdd}
          disabled={items.length >= 100}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-foreground hover:bg-surface-muted disabled:opacity-40"
        >
          <Plus className="size-3.5" aria-hidden />
          Add item
        </button>
      }
    >
      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-sm text-muted">
          No items yet. Add one to start.
        </p>
      ) : (
        <div className="grid grid-cols-[1.25rem_1fr_3.5rem_5.5rem_2rem] gap-x-1.5 px-0.5 text-[11px] font-medium text-muted">
          <span />
          <span>Item</span>
          <span className="text-right">Qty</span>
          <span className="text-right">Price</span>
          <span />
        </div>
      )}
      <ul className="space-y-1.5">
        {items.map((item, index) => (
          <li
            key={item.id}
            onDragOver={(e) => {
              if (dragFrom === null) return;
              e.preventDefault();
              setDragOver(index);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragFrom !== null) moveItem(dragFrom, index);
              setDragFrom(null);
              setDragOver(null);
            }}
            className={`grid grid-cols-[1.25rem_1fr_3.5rem_5.5rem_2rem] items-center gap-1.5 rounded-md transition-shadow ${
              dragOver === index && dragFrom !== index ? "ring-2 ring-foreground/25" : ""
            } ${dragFrom === index ? "opacity-50" : ""}`}
          >
            <button
              type="button"
              draggable
              onDragStart={(e) => {
                setDragFrom(index);
                e.dataTransfer.effectAllowed = "move";
                const row = e.currentTarget.closest("li");
                if (row) e.dataTransfer.setDragImage(row, 12, 16);
              }}
              onDragEnd={() => {
                setDragFrom(null);
                setDragOver(null);
              }}
              onKeyDown={(e) => handleGripKey(e, index)}
              aria-label={`Reorder ${item.name || `item ${index + 1}`}. Use arrow keys to move.`}
              className="flex h-8 cursor-grab items-center justify-center rounded text-muted hover:text-foreground active:cursor-grabbing"
            >
              <GripVertical className="size-4" aria-hidden />
            </button>
            <input
              ref={(el) => {
                if (el) nameRefs.current.set(item.id, el);
                else nameRefs.current.delete(item.id);
              }}
              autoFocus={item.id === focusNewId}
              aria-label={`Item ${index + 1} name`}
              placeholder="Item name"
              className={inputClass}
              maxLength={80}
              value={item.name}
              onChange={(e) => updateItem(item.id, { name: e.target.value })}
              onKeyDown={(e) => handleEnter(e, index)}
            />
            <NumberInput
              aria-label={`Item ${index + 1} quantity`}
              integer
              max={9999}
              className="text-right"
              value={item.qty}
              onValueChange={(qty) => updateItem(item.id, { qty })}
              onKeyDown={(e) => handleEnter(e, index)}
            />
            <NumberInput
              aria-label={`Item ${index + 1} unit price`}
              decimals={decimals}
              max={1_000_000}
              className="text-right"
              value={item.price}
              onValueChange={(price) => updateItem(item.id, { price })}
              onKeyDown={(e) => handleEnter(e, index)}
            />
            <button
              type="button"
              onClick={() => removeItem(item.id)}
              aria-label={`Remove ${item.name || `item ${index + 1}`}`}
              className="flex h-8 items-center justify-center rounded-md text-muted hover:bg-surface-muted hover:text-foreground"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      {items.length > 0 && (
        <p className="text-[11px] text-muted">Tip: press Enter to jump to the next row or add a new one.</p>
      )}
    </Section>
  );
}
