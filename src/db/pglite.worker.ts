import { PGlite } from '@electric-sql/pglite'
import { worker } from '@electric-sql/pglite/worker'

// Воркер держит один экземпляр PGlite на вкладку. Клиент — см. openDatabase.ts.
// loadDataDir передаётся как есть: из дампа создаётся база при дублировании вкладки.
void worker({
  init: (options) => Promise.resolve(new PGlite({ dataDir: options.dataDir, loadDataDir: options.loadDataDir })),
})
