/**
 * Дублирование вкладки с данными: дамп открытой базы кладём в память, а новая вкладка
 * при открытии создаёт свою базу из этого дампа. Дамп живёт только в памяти текущей страницы.
 */
const staged = new Map<string, Blob>()

export function stageCopy(targetTabId: string, dump: Blob): void {
  staged.set(targetTabId, dump)
}

export function peekStagedCopy(tabId: string): Blob | undefined {
  return staged.get(tabId)
}

export function discardStagedCopy(tabId: string): void {
  staged.delete(tabId)
}

/** Сбрасывает все объекты базы: таблицы, представления, функции, последовательности и временные объекты. */
export const RESET_SQL = `
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT n.nspname AS s, c.relname AS n, c.relkind AS k
           FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname LIKE 'pg_temp%' AND c.relkind IN ('r', 'v', 'm', 'p') LOOP
    IF r.k = 'v' THEN EXECUTE format('DROP VIEW IF EXISTS %I.%I CASCADE', r.s, r.n);
    ELSIF r.k = 'm' THEN EXECUTE format('DROP MATERIALIZED VIEW IF EXISTS %I.%I CASCADE', r.s, r.n);
    ELSE EXECUTE format('DROP TABLE IF EXISTS %I.%I CASCADE', r.s, r.n);
    END IF;
  END LOOP;
END $$;
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
`
