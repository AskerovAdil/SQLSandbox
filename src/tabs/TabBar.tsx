import { Plus, X } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import type { Tab } from '../stores/tabsStore'

interface TabBarProps {
  tabs: Tab[]
  activeId: string
  onSelect: (id: string) => void
  onAdd: () => void
  onClose: (id: string) => void
  onRename: (id: string, name: string) => void
  onMove: (fromIndex: number, toIndex: number) => void
  /** Элементы справа от вкладок (например, переключатель темы). */
  children?: ReactNode
}

export function TabBar({ tabs, activeId, onSelect, onAdd, onClose, onRename, onMove, children }: TabBarProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  return (
    <div
      role="tablist"
      aria-label="Вкладки песочницы"
      className="flex items-end gap-px overflow-x-auto border-b border-zinc-200 bg-zinc-100 px-2 pt-1.5 dark:border-zinc-800 dark:bg-zinc-900"
    >
      {tabs.map((tab, index) => {
        const active = tab.id === activeId
        const editing = tab.id === editingId
        return (
          <div
            key={tab.id}
            role="tab"
            aria-selected={active}
            tabIndex={0}
            draggable={!editing}
            onDragStart={(event) => {
              setDraggedIndex(index)
              event.dataTransfer.effectAllowed = 'move'
              event.dataTransfer.setData('text/plain', tab.id)
            }}
            onDragOver={(event) => {
              if (draggedIndex === null) return
              event.preventDefault()
              setDropIndex(index)
            }}
            onDragEnd={() => {
              setDraggedIndex(null)
              setDropIndex(null)
            }}
            onDrop={(event) => {
              event.preventDefault()
              if (draggedIndex !== null) onMove(draggedIndex, index)
              setDraggedIndex(null)
              setDropIndex(null)
            }}
            onClick={() => {
              onSelect(tab.id)
            }}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onSelect(tab.id)
              }
            }}
            onDoubleClick={() => {
              setEditingId(tab.id)
            }}
            className={`group relative flex max-w-56 min-w-32 cursor-pointer select-none items-center gap-1 rounded-t-md border border-b-0 px-3 py-1.5 text-sm transition-colors ${
              active
                ? 'border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100'
                : 'border-transparent text-zinc-600 hover:bg-zinc-200/70 dark:text-zinc-400 dark:hover:bg-zinc-800/70'
            } ${dropIndex === index && draggedIndex !== null && draggedIndex !== index ? 'shadow-[inset_2px_0_0_0] shadow-blue-500' : ''}`}
          >
            {editing ? (
              <input
                autoFocus
                defaultValue={tab.name}
                aria-label="Имя вкладки"
                className="w-full min-w-0 rounded border border-blue-500 bg-transparent px-1 py-0 text-sm outline-none"
                onClick={(event) => {
                  event.stopPropagation()
                }}
                onBlur={(event) => {
                  onRename(tab.id, event.currentTarget.value)
                  setEditingId(null)
                }}
                onKeyDown={(event) => {
                  event.stopPropagation()
                  if (event.key === 'Enter') event.currentTarget.blur()
                  if (event.key === 'Escape') setEditingId(null)
                }}
              />
            ) : (
              <span className="truncate" title="Двойной клик — переименовать">
                {tab.name}
              </span>
            )}
            {tabs.length > 1 && !editing && (
              <button
                type="button"
                aria-label={`Закрыть вкладку ${tab.name}`}
                onClick={(event) => {
                  event.stopPropagation()
                  onClose(tab.id)
                }}
                className="ml-auto rounded p-0.5 text-zinc-400 opacity-0 hover:bg-zinc-300 hover:text-zinc-800 group-hover:opacity-100 focus:opacity-100 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
              >
                <X size={13} />
              </button>
            )}
          </div>
        )
      })}
      <button
        type="button"
        aria-label="Новая вкладка"
        title="Новая вкладка"
        onClick={onAdd}
        className="mb-0.5 ml-1 rounded p-1.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      >
        <Plus size={16} />
      </button>
      {children}
    </div>
  )
}
