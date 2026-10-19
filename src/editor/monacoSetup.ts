import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import { buildSuggestions, type CompletionTable, type SuggestionKind } from './completionLogic'

// Monaco грузится из бандла, без CDN: воркер собирается Vite из ./editor.worker.ts.
Object.assign(globalThis, {
  MonacoEnvironment: {
    getWorker: () => new Worker(new URL('./editor.worker.ts', import.meta.url), { type: 'module' }),
  },
})
loader.config({ monaco })

// Таблицы текущей базы для автодополнения. Обновляет рабочая область активной вкладки.
let completionTables: CompletionTable[] = []

export function setCompletionTables(tables: CompletionTable[]): void {
  completionTables = tables
}

const KIND: Record<SuggestionKind, monaco.languages.CompletionItemKind> = {
  keyword: monaco.languages.CompletionItemKind.Keyword,
  table: monaco.languages.CompletionItemKind.Class,
  column: monaco.languages.CompletionItemKind.Field,
}

monaco.languages.registerCompletionItemProvider('sql', {
  triggerCharacters: ['.'],
  provideCompletionItems(model, position) {
    const word = model.getWordUntilPosition(position)
    const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn)
    const before = model.getValueInRange({
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: position.lineNumber,
      endColumn: position.column,
    })
    const suggestions = buildSuggestions(before, model.getValue(), completionTables).map((item) => ({
      label: item.label,
      kind: KIND[item.kind],
      detail: item.detail,
      insertText: item.label,
      range,
    }))
    return { suggestions }
  },
})
