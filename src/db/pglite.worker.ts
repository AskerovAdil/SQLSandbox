import { PGlite } from '@electric-sql/pglite'
import { worker } from '@electric-sql/pglite/worker'

// Воркер держит один экземпляр PGlite на вкладку. Клиент — см. openDatabase.ts.
void worker({
  init: (options) => Promise.resolve(new PGlite(options.dataDir)),
})
