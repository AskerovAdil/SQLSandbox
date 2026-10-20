import type { PGliteWorker } from '@electric-sql/pglite/worker'
import { splitStatements } from '../sql/splitStatements'
import { locateErrorInStatement } from './errorLocation'
import type { PlanDocument } from '../explain/planModel'

export interface ResultColumn {
  name: string
  typeId: number
}

interface StatementResultBase {
  index: number
  sql: string
  /** Смещение statement в исходном тексте редактора. */
  start: number
  durationMs: number
}

export type StatementResult =
  | (StatementResultBase & { kind: 'rows'; columns: ResultColumn[]; rows: Record<string, unknown>[] })
  | (StatementResultBase & { kind: 'command'; message: string })
  | (StatementResultBase & { kind: 'error'; message: string; offset: number })
  /** План EXPLAIN ANALYZE, см. explain/planModel.ts. */
  | (StatementResultBase & { kind: 'plan'; plan: PlanDocument })

/**
 * Выполняет statements по очереди. После первой ошибки выполнение останавливается:
 * последний элемент результата — ошибка, и база остаётся в состоянии на момент сбоя.
 * baseOffset — смещение script в редакторе, нужно для позиции ошибки.
 */
export async function executeScript(
  db: PGliteWorker,
  script: string,
  baseOffset: number,
): Promise<StatementResult[]> {
  const results: StatementResult[] = []

  for (const [index, statement] of splitStatements(script).entries()) {
    const start = baseOffset + statement.start
    const startedAt = performance.now()
    const base = { index, sql: statement.text, start }

    try {
      const response = await db.query<Record<string, unknown>>(statement.text)
      const durationMs = performance.now() - startedAt

      if (response.fields.length > 0) {
        results.push({
          ...base,
          durationMs,
          kind: 'rows',
          columns: response.fields.map((field) => ({ name: field.name, typeId: field.dataTypeID })),
          rows: response.rows,
        })
      } else {
        results.push({
          ...base,
          durationMs,
          kind: 'command',
          message: describeCommand(statement.text, response.affectedRows),
        })
      }
    } catch (error: unknown) {
      results.push({
        ...base,
        durationMs: performance.now() - startedAt,
        kind: 'error',
        message: errorMessage(error),
        offset: start + locateErrorInStatement(errorMessage(error), statement.text),
      })
      break
    }
  }

  return results
}

const DML_VERBS = new Set(['INSERT', 'UPDATE', 'DELETE', 'MERGE', 'COPY'])

function describeCommand(text: string, affectedRows: number | undefined): string {
  const words = stripComments(text).trim().split(/\s+/)
  const first = (words[0] ?? '').toUpperCase()
  if (DML_VERBS.has(first) && affectedRows !== undefined) {
    return `${first}, ${String(affectedRows)} rows affected`
  }
  return ['CREATE', 'DROP', 'ALTER'].includes(first) ? `${first} ${(words[1] ?? '').toUpperCase()}` : first
}

function stripComments(text: string): string {
  return text.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
