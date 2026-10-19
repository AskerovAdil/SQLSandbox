import type { PGliteWorker } from '@electric-sql/pglite/worker'
import { useEffect, useState } from 'react'
import { openDatabase } from './openDatabase'

export type DatabaseState =
  | { status: 'loading' }
  | { status: 'ready'; db: PGliteWorker }
  | { status: 'error'; error: unknown }

/** Открывает базу вкладки и закрывает её при размонтировании. */
export function useDatabase(tabId: string): DatabaseState {
  const [state, setState] = useState<DatabaseState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    let opened: PGliteWorker | undefined

    openDatabase(tabId).then(
      (db) => {
        if (cancelled) {
          void db.close()
          return
        }
        opened = db
        setState({ status: 'ready', db })
      },
      (error: unknown) => {
        if (!cancelled) setState({ status: 'error', error })
      },
    )

    return () => {
      cancelled = true
      void opened?.close()
    }
  }, [tabId])

  return state
}
