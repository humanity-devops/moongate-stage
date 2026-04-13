'use client';

import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface PackageItem {
  id: string;
  label: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

const PALETTE_ITEMS = [
  { label: 'Logo placement — Stage banner', unitPrice: 5000 },
  { label: 'Logo placement — Website', unitPrice: 2500 },
  { label: 'Speaking slot (20 min)', unitPrice: 8000 },
  { label: 'Workshop (60 min)', unitPrice: 12000 },
  { label: 'Booth space (3m × 3m)', unitPrice: 6000 },
  { label: 'Email newsletter mention', unitPrice: 1500 },
  { label: 'Social media post (×3)', unitPrice: 2000 },
  { label: 'Swag bag insert', unitPrice: 3000 },
  { label: 'Hackathon prize sponsor', unitPrice: 10000 },
  { label: 'After-party sponsor', unitPrice: 15000 },
  { label: 'Custom add-on', unitPrice: 1000 },
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function fmtUSD(v: number) {
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

interface SortableItemProps {
  item: PackageItem;
  onChange: (id: string, field: keyof PackageItem, value: string | number) => void;
  onRemove: (id: string) => void;
}

function SortableItem({ item, onChange, onRemove }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="glass rounded-xl p-4 group"
    >
      <div className="flex items-start gap-3">
        {/* Drag handle */}
        <button
          {...listeners}
          {...attributes}
          className="mt-1 text-white/20 hover:text-white/50 cursor-grab active:cursor-grabbing transition-colors"
          aria-label="Drag to reorder"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <rect x="2" y="2" width="2" height="2" rx="1" />
            <rect x="6" y="2" width="2" height="2" rx="1" />
            <rect x="10" y="2" width="2" height="2" rx="1" />
            <rect x="2" y="6" width="2" height="2" rx="1" />
            <rect x="6" y="6" width="2" height="2" rx="1" />
            <rect x="10" y="6" width="2" height="2" rx="1" />
            <rect x="2" y="10" width="2" height="2" rx="1" />
            <rect x="6" y="10" width="2" height="2" rx="1" />
            <rect x="10" y="10" width="2" height="2" rx="1" />
          </svg>
        </button>

        <div className="flex-1 space-y-2">
          <input
            type="text"
            value={item.label}
            onChange={e => onChange(item.id, 'label', e.target.value)}
            className="w-full bg-transparent text-sm font-medium text-white placeholder-white/25 focus:outline-none border-b border-white/0 focus:border-white/20 transition-all"
            placeholder="Item name"
          />
          <input
            type="text"
            value={item.description}
            onChange={e => onChange(item.id, 'description', e.target.value)}
            className="w-full bg-transparent text-xs text-white/40 placeholder-white/15 focus:outline-none border-b border-white/0 focus:border-white/10 transition-all"
            placeholder="Optional description"
          />
          <div className="flex items-center gap-3 mt-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-white/30">Qty</span>
              <input
                type="number"
                min={1}
                value={item.quantity}
                onChange={e => onChange(item.id, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                className="w-14 bg-white/[0.05] border border-white/10 rounded px-2 py-1 text-xs text-white text-center focus:outline-none focus:border-indigo-500/50"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-white/30">$</span>
              <input
                type="number"
                min={0}
                step={100}
                value={item.unitPrice}
                onChange={e => onChange(item.id, 'unitPrice', Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-24 bg-white/[0.05] border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500/50"
              />
            </div>
            <span className="text-xs text-indigo-300 font-mono ml-auto">{fmtUSD(item.unitPrice * item.quantity)}</span>
          </div>
        </div>

        <button
          onClick={() => onRemove(item.id)}
          className="mt-1 text-white/15 hover:text-red-400 transition-colors"
          aria-label="Remove item"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 3L11 11M11 3L3 11" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

interface PackageBuilderProps {
  items: PackageItem[];
  onChange: (items: PackageItem[]) => void;
}

export function PackageBuilder({ items, onChange }: PackageBuilderProps) {
  const [showPalette, setShowPalette] = useState(items.length === 0);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = items.findIndex(i => i.id === active.id);
      const newIdx = items.findIndex(i => i.id === over.id);
      onChange(arrayMove(items, oldIdx, newIdx));
    }
  }

  function addFromPalette(palette: { label: string; unitPrice: number }) {
    const newItem: PackageItem = { id: uid(), label: palette.label, description: '', quantity: 1, unitPrice: palette.unitPrice };
    onChange([...items, newItem]);
    setShowPalette(false);
  }

  function addCustom() {
    const newItem: PackageItem = { id: uid(), label: '', description: '', quantity: 1, unitPrice: 1000 };
    onChange([...items, newItem]);
  }

  function updateItem(id: string, field: keyof PackageItem, value: string | number) {
    onChange(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  }

  function removeItem(id: string) {
    onChange(items.filter(item => item.id !== id));
  }

  const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  return (
    <div className="glass rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-white">Build your package</h2>
        <div className="text-sm text-white/40">
          Budget: <span className="text-indigo-300 font-mono font-medium">{fmtUSD(total)}</span>
        </div>
      </div>

      {/* Canvas */}
      {items.length > 0 ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {items.map(item => (
                <SortableItem key={item.id} item={item} onChange={updateItem} onRemove={removeItem} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="rounded-xl border border-dashed border-white/10 p-10 text-center">
          <p className="text-white/30 text-sm">
            Add items below to start building your custom package.
          </p>
        </div>
      )}

      {/* Palette */}
      {showPalette ? (
        <div>
          <p className="text-xs text-white/30 mb-3 uppercase tracking-widest">Common items — click to add</p>
          <div className="flex flex-wrap gap-2">
            {PALETTE_ITEMS.map(p => (
              <button
                key={p.label}
                onClick={() => addFromPalette(p)}
                className="px-3 py-1.5 rounded-lg text-xs border border-white/10 bg-white/[0.04] text-white/60 hover:text-white hover:border-indigo-500/40 hover:bg-indigo-500/10 transition-all"
              >
                {p.label}
                <span className="ml-1.5 text-white/30 font-mono">{fmtUSD(p.unitPrice)}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 mt-3">
            <button onClick={addCustom} className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
              + Add custom item
            </button>
            {items.length > 0 && (
              <button onClick={() => setShowPalette(false)} className="text-sm text-white/30 hover:text-white/60 transition-colors">
                Hide palette
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 pt-2 border-t border-white/[0.06]">
          <button
            onClick={() => setShowPalette(true)}
            className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M7 2V12M2 7H12" strokeLinecap="round" />
            </svg>
            Add from palette
          </button>
          <button onClick={addCustom} className="text-sm text-white/40 hover:text-white transition-colors flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M7 2V12M2 7H12" strokeLinecap="round" />
            </svg>
            Custom item
          </button>
        </div>
      )}
    </div>
  );
}
