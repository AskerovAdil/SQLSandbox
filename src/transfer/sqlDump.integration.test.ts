import { PGlite } from '@electric-sql/pglite'
import { loadSchema } from '../schema/loadSchema'
import { TEMPLATES } from '../templates'
import { dumpDatabaseSql } from './sqlDump'

/**
 * Дамп вкладки должен воспроизводить базу: загружаем дамп в новый PGlite и сравниваем
 * число строк и структуру с исходной базой. Так ловятся ошибки генерации литералов и DDL.
 */
describe('SQL dump round trip', () => {
  it.each(TEMPLATES.map((template) => [template.id, template.seed] as const))(
    'restores the %s template',
    async (_id, seed) => {
      const source = new PGlite()
      await source.exec(seed)
      const relations = await loadSchema(source)
      const dump = await dumpDatabaseSql(source, relations)

      const target = new PGlite()
      await target.exec(dump)

      for (const relation of relations.filter((item) => item.kind === 'table')) {
        const table = `"${relation.name}"`
        const original = await source.query<{ count: number }>(`SELECT count(*)::int AS count FROM ${table}`)
        const restored = await target.query<{ count: number }>(`SELECT count(*)::int AS count FROM ${table}`)
        expect(restored.rows[0]?.count).toBe(original.rows[0]?.count)
      }

      const restoredSchema = await loadSchema(target)
      expect(restoredSchema.map((relation) => relation.name).sort()).toEqual(
        relations.map((relation) => relation.name).sort(),
      )
    },
    30_000,
  )

  it('keeps NULL, empty strings and quotes in values', async () => {
    const source = new PGlite()
    await source.exec(`CREATE TABLE t (id int PRIMARY KEY, note text, n numeric); INSERT INTO t VALUES (1, NULL, NULL), (2, '', 1.5), (3, 'it''s "quoted"', 2);`)
    const dump = await dumpDatabaseSql(source, await loadSchema(source))
    const target = new PGlite()
    await target.exec(dump)
    const rows = await target.query<{ id: number; note: string | null; n: string | null }>('SELECT id, note, n FROM t ORDER BY id')
    expect(rows.rows).toEqual([
      { id: 1, note: null, n: null },
      { id: 2, note: '', n: '1.5' },
      { id: 3, note: 'it\'s "quoted"', n: '2' },
    ])
  }, 30_000)
})
