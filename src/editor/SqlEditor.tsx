import Editor from '@monaco-editor/react'
import * as Monaco from 'monaco-editor'
import { type Ref, useEffect, useImperativeHandle, useRef } from 'react'
import { statementAt, splitStatements } from '../sql/splitStatements'
import './monacoSetup'

export interface RunRequest {
  text: string
  /** Смещение текста в редакторе, чтобы перевести позицию ошибки в координаты документа. */
  baseOffset: number
}

export type RunScope = 'statement' | 'script'

export interface SqlEditorHandle {
  getRunRequest: (scope: RunScope) => RunRequest
  /** Вставляет текст в позицию курсора (или заменяет выделение) и возвращает фокус редактору. */
  insertText: (text: string) => void
}

export interface EditorError {
  offset: number
  message: string
}

interface SqlEditorProps {
  ref?: Ref<SqlEditorHandle>
  value: string
  onChange: (value: string) => void
  /** Ctrl+Enter: выделение или statement под курсором. */
  onRunStatement: () => void
  /** Ctrl+Shift+Enter: весь скрипт. */
  onRunScript: () => void
  error: EditorError | null
  dark: boolean
}

const MARKER_OWNER = 'sql-sandbox'

export function SqlEditor({ ref, value, onChange, onRunStatement, onRunScript, error, dark }: SqlEditorProps) {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
  const runRef = useRef({ onRunStatement, onRunScript })

  useEffect(() => {
    runRef.current = { onRunStatement, onRunScript }
  })

  useImperativeHandle(ref, () => ({
    getRunRequest: (scope) => readRunRequest(editorRef.current, scope),
    insertText: (text) => {
      const editor = editorRef.current
      const range = editor?.getSelection() ?? editor?.getModel()?.getFullModelRange()
      if (!editor || !range) return
      editor.executeEdits('sql-sandbox', [{ range, text, forceMoveMarkers: true }])
      editor.focus()
    },
  }))

  useEffect(() => {
    const model = editorRef.current?.getModel()
    if (!model) return

    if (error === null) {
      Monaco.editor.setModelMarkers(model, MARKER_OWNER, [])
      return
    }
    const position = model.getPositionAt(error.offset)
    Monaco.editor.setModelMarkers(model, MARKER_OWNER, [
      {
        severity: Monaco.MarkerSeverity.Error,
        message: error.message,
        startLineNumber: position.lineNumber,
        startColumn: position.column,
        endLineNumber: position.lineNumber,
        endColumn: model.getLineMaxColumn(position.lineNumber),
      },
    ])
    editorRef.current?.revealPositionInCenterIfOutsideViewport(position)
  }, [error])

  const handleMount = (editor: Monaco.editor.IStandaloneCodeEditor) => {
    editorRef.current = editor

    editor.addAction({
      id: 'sql-sandbox.run-statement',
      label: 'Выполнить statement',
      keybindings: [Monaco.KeyMod.CtrlCmd | Monaco.KeyCode.Enter],
      run: () => {
        runRef.current.onRunStatement()
      },
    })
    editor.addAction({
      id: 'sql-sandbox.run-script',
      label: 'Выполнить весь скрипт',
      keybindings: [Monaco.KeyMod.CtrlCmd | Monaco.KeyMod.Shift | Monaco.KeyCode.Enter],
      run: () => {
        runRef.current.onRunScript()
      },
    })
  }

  return (
    <Editor
      height="100%"
      defaultLanguage="sql"
      value={value}
      onChange={(next) => {
        onChange(next ?? '')
      }}
      onMount={handleMount}
      theme={dark ? 'vs-dark' : 'vs'}
      options={{
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontSize: 14,
        lineNumbers: 'on',
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
      }}
    />
  )
}

function readRunRequest(editor: Monaco.editor.IStandaloneCodeEditor | null, scope: RunScope): RunRequest {
  const model = editor?.getModel()
  if (!editor || !model) return { text: '', baseOffset: 0 }

  const full = model.getValue()
  if (scope === 'script') return { text: full, baseOffset: 0 }

  const selection = editor.getSelection()
  if (selection && !selection.isEmpty()) {
    return {
      text: model.getValueInRange(selection),
      baseOffset: model.getOffsetAt(selection.getStartPosition()),
    }
  }

  const cursor = model.getOffsetAt(editor.getPosition() ?? { lineNumber: 1, column: 1 })
  const statement = statementAt(splitStatements(full), cursor)
  return statement ? { text: statement.text, baseOffset: statement.start } : { text: '', baseOffset: 0 }
}

