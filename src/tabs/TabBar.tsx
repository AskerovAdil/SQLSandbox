import { Plus, X } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { TEMPLATES } from '../templates'
import type { Tab } from '../stores/tabsStore'

interface TabBarProps {
  tabs: Tab[]
  activeId: string
  onSelect: (id: string) => void
  /** null — пустая вкладка, иначе id шаблона. */
  onAddTemplate: (templateId: string | null) => void
  onImport: () => void
  onClose: (id: string) => void
  onRename: (id: string, name: string) => void
  onMove: (fromIndex: number, toIndex: number) => void
  /** Элементы справа от вкладок (например, переключатель темы). */
  children?: ReactNode
}

export function TabBar({
  tabs,
  activeId,
  onSelect,
  onAddTemplate,
  onImport,
  onClose,
  onRename,
  onMove,
  children,
}: TabBarProps) {
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
      <NewTabMenu onAddTemplate={onAddTemplate} onImport={onImport} />
      {children}
    </div>
  )
}

function NewTabMenu({ onAddTemplate, onImport }: { onAddTemplate: (templateId: string | null) => void; onImport: () => void }) {
  const [open, setOpen] = useState(false)
  const choose = (action: () => void) => {
    setOpen(false)
    action()
  }

  return (
    <div className="relative mb-0.5 ml-1">
      <button
        type="button"
        aria-label="Новая вкладка"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Новая вкладка"
        onClick={() => {
          setOpen((value) => !value)
        }}
        className="rounded p-1.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      >
        <Plus size={16} />
      </button>
      {open && (
        <div role="menu" className="absolute top-full left-0 z-20 mt-1 w-72 rounded-md border border-zinc-200 bg-white p-1 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <MenuItem onClick={() => { choose(() => { onAddTemplate(null) }) }} title="Пустая вкладка" hint="Своя база с нуля" />
          {TEMPLATES.map((template) => (
            <MenuItem
              key={template.id}
              onClick={() => { choose(() => { onAddTemplate(template.id) }) }}
              title={`Шаблон: ${template.title}`}
              hint={template.description}
            />
          ))}
          <div className="my-1 border-t border-zinc-200 dark:border-zinc-700" />
          <MenuItem onClick={() => { choose(onImport) }} title="Импорт из файла…" hint=".sql одной вкладки или .json со всеми вкладками" />
        </div>
      )}
    </div>
  )
}

function MenuItem({ title, hint, onClick }: { title: string; hint: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full flex-col rounded px-2 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
    >
      <span className="font-medium">{title}</span>
      <span className="text-xs text-zinc-500">{hint}</span>
    </button>
  )
}
