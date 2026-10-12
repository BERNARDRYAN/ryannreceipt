"use client";

import { GripVertical, Plus, Trash2 } from "lucide-react";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";

import { fieldDomId, Group, inputClass, NumberInput } from "@/components/receipt/editor/fields";
import { Combobox } from "@/components/ui/combobox";
import { useT } from "@/lib/i18n/messages";
import { buildItemMemory, normalizeName } from "@/lib/memory/merchants";
import { useActiveDraft, useReceiptStore } from "@/lib/store/receipt-store";
import { currencyDecimals, formatAmount, lineTotal } from "@/lib/utils/currency";

const GRID = "grid grid-cols-[1.25rem_minmax(0,1fr)_3.25rem_5.25rem_2rem] gap-x-1.5";

/**
 * Line items: Enter moves to the next row (or adds one on the last row), the
 * grip drags to reorder, and ↑/↓ on the focused grip reorders from the keyboard.
 */
export function ItemsEditor() {
  const t = useT();
  const draft = useActiveDraft();
  const addItem = useReceiptStore((s) => s.addItem);
  const updateItem = useReceiptStore((s) => s.updateItem);
  const removeItem = useReceiptStore((s) => s.removeItem);
  const moveItem = useReceiptStore((s) => s.moveItem);
  const nameRefs = useRef(new Map<string, HTMLInputElement>());
  const [focusNewId, setFocusNewId] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const receipts = useReceiptStore((s) => s.receipts);
  // Items bought before (any shop), for autocomplete with their last price.
  const known = useMemo(() => buildItemMemory(Object.values(receipts)), [receipts]);

  if (!draft) return null;
  const { items, currency } = draft;
  const itemOptions = [...known.values()].map((k) => ({ value: k.name, hint: formatAmount(k.price, currency) }));
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
    if (e.key === "ArrowUp" && index > 0) {
      e.preventDefault();
      moveItem(index, index - 1);
    } else if (e.key === "ArrowDown" && index < items.length - 1) {
      e.preventDefault();
      moveItem(index, index + 1);
    }
  }

  const addButton = (
    <button
      id={fieldDomId("items")}
      type="button"
      onClick={handleAdd}
      disabled={items.length >= 100}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-foreground hover:bg-surface-muted disabled:opacity-40"
    >
      <Plus className="size-3.5" aria-hidden />
      {t("items.add")}
    </button>
  );

  return (
    <Group title={`${t("items.title")} (${items.length})`} action={addButton}>
      {items.length === 0 ? (
        <button
          type="button"
          onClick={handleAdd}
          className="w-full rounded-xl border border-dashed border-border px-3 py-8 text-center text-sm text-muted hover:border-foreground/40 hover:text-foreground"
        >
          {t("items.empty")}
        </button>
      ) : (
        <div className={`${GRID} px-0.5 text-[11px] font-medium text-muted`}>
          <span />
          <span>{t("items.colItem")}</span>
          <span className="text-right">{t("items.colQty")}</span>
          <span className="text-right">{t("items.colPrice")}</span>
          <span />
        </div>
      )}
      <ul className="space-y-1.5">
        {items.map((item, index) => (
          <li
            key={item.id}
            data-item-index={index}
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
            className={`${GRID} items-center rounded-lg transition-shadow ${
              dragOver === index && dragFrom !== index ? "ring-2 ring-foreground/25" : ""
            } ${dragFrom === index ? "opacity-50" : ""} animate-[fade-up_160ms_ease-out]`}
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
              // Touch screens have no drag-and-drop: follow the finger instead.
              onPointerDown={(e) => {
                if (e.pointerType === "mouse") return;
                e.currentTarget.setPointerCapture(e.pointerId);
                setDragFrom(index);
                setDragOver(index);
              }}
              onPointerMove={(e) => {
                if (e.pointerType === "mouse" || dragFrom === null) return;
                const row = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-item-index]");
                if (row) setDragOver(Number(row.dataset.itemIndex));
              }}
              onPointerUp={(e) => {
                if (e.pointerType === "mouse") return;
                if (dragFrom !== null && dragOver !== null && dragOver !== dragFrom) moveItem(dragFrom, dragOver);
                setDragFrom(null);
                setDragOver(null);
              }}
              onPointerCancel={() => {
                setDragFrom(null);
                setDragOver(null);
              }}
              style={{ touchAction: "none" }}
              aria-label={`Reorder ${item.name || `item ${index + 1}`}. Use arrow keys to move.`}
              className="flex h-9 cursor-grab items-center justify-center rounded text-muted hover:text-foreground active:cursor-grabbing"
            >
              <GripVertical className="size-4" aria-hidden />
            </button>
            <Combobox
              id={fieldDomId(`item-${item.id}`)}
              inputRef={(el) => {
                if (el) nameRefs.current.set(item.id, el);
                else nameRefs.current.delete(item.id);
              }}
              autoFocus={item.id === focusNewId}
              aria-label={`Item ${index + 1} name`}
              placeholder={t("items.namePh")}
              className={inputClass}
              maxLength={80}
              value={item.name}
              options={itemOptions}
              minChars={1}
              onChange={(name) => {
                const match = known.get(normalizeName(name));
                // Picking a known item fills its last price if none is set yet.
                updateItem(item.id, match && item.price === 0 ? { name, price: match.price } : { name });
              }}
              onPick={(option) => {
                const match = known.get(normalizeName(option.value));
                if (match) updateItem(item.id, { name: match.name, price: match.price });
              }}
              onKeyDown={(e) => handleEnter(e, index)}
            />
            <NumberInput
              aria-label={`Item ${index + 1} quantity`}
              integer
              max={9999}
              className="px-2 text-right"
              value={item.qty}
              onValueChange={(qty) => updateItem(item.id, { qty })}
              onKeyDown={(e) => handleEnter(e, index)}
            />
            <NumberInput
              aria-label={`Item ${index + 1} unit price`}
              decimals={decimals}
              max={1_000_000}
              className="px-2 text-right"
              value={item.price}
              onValueChange={(price) => updateItem(item.id, { price })}
              onKeyDown={(e) => handleEnter(e, index)}
            />
            <button
              type="button"
              onClick={() => removeItem(item.id)}
              aria-label={`Remove ${item.name || `item ${index + 1}`}`}
              className="flex h-9 items-center justify-center rounded-md text-muted hover:bg-surface-muted hover:text-danger"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
            {item.qty > 1 && item.price > 0 && (
              <span className="col-span-5 -mt-0.5 pr-10 text-right text-[11px] text-muted tabular-nums">
                = {formatAmount(lineTotal(item, currency), currency)}
              </span>
            )}
          </li>
        ))}
      </ul>
      {items.length > 0 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-muted">{t("items.tip")}</p>
          {items.length > 3 && (
            <button
              type="button"
              onClick={handleAdd}
              disabled={items.length >= 100}
              className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium hover:bg-surface-muted disabled:opacity-40"
            >
              <Plus className="size-3.5" aria-hidden />
              {t("items.add")}
            </button>
          )}
        </div>
      )}
    </Group>
  );
}
