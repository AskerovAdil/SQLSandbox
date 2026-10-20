import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { SHORTCUTS } from './hotkeys'

interface ShortcutsDialogProps {
  open: boolean
  onClose: () => void
}

/** Справка по горячим клавишам. Открывается клавишей ? или кнопкой в подвале. */
export function ShortcutsDialog({ open, onClose }: ShortcutsDialogProps) {
  if (!open) return null
  return <ShortcutsPanel onClose={onClose} />
}

/**
 * Монтируется только при открытии: фокус уходит в диалог, пока он открыт, и возвращается
 * туда, где был раньше. Так набор текста не попадает в редактор под затемнением.
 */
function ShortcutsPanel({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previous = document.activeElement
    dialogRef.current?.focus()
    return () => {
      if (previous instanceof HTMLElement) previous.focus()
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Горячие клавиши"
        tabIndex={-1}
        onKeyDown={(event) => {
          // Единственная кнопка в диалоге — «Закрыть»: Tab не уводит фокус наружу.
          if (event.key === 'Tab') {
            event.preventDefault()
            closeRef.current?.focus()
          }
        }}
        className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-4 shadow-xl outline-none dark:border-zinc-700 dark:bg-zinc-900"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Горячие клавиши</h2>
          <button
            ref={closeRef}
            type="button"
            aria-label="Закрыть"
            onClick={onClose}
            className="rounded p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X size={16} />
          </button>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {SHORTCUTS.map((shortcut) => (
              <tr key={shortcut.keys} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="py-1.5 pr-3 align-top">
                  <kbd className="rounded border border-zinc-300 bg-zinc-50 px-1.5 py-0.5 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-800">
                    {shortcut.keys}
                  </kbd>
                </td>
                <td className="py-1.5 text-zinc-600 dark:text-zinc-300">{shortcut.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
