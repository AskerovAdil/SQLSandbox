import employeesSql from './employees.sql?raw'
import shopSql from './shop.sql?raw'
import { splitAtMarker } from '../lib/splitAtMarker'

/** Маркер в файле шаблона: до него — схема и данные, после — примеры запросов для редактора. */
export const QUERIES_MARKER = '-- @@queries'

export interface Template {
  id: string
  title: string
  description: string
  /** DDL и INSERT: выполняются в базе новой вкладки. */
  seed: string
  /** Примеры запросов: попадают в редактор. */
  queries: string
}

function template(id: string, title: string, description: string, source: string): Template {
  const { before, after } = splitAtMarker(source, QUERIES_MARKER)
  return { id, title, description, seed: before, queries: after ?? '' }
}

export const TEMPLATES: Template[] = [
  template('employees', 'Сотрудники', 'Отделы, иерархия руководителей, зарплаты: оконные функции, GROUP BY, рекурсивные CTE', employeesSql),
  template('shop', 'Интернет-магазин', 'Клиенты, товары, заказы: JOIN-ы, агрегаты, подзапросы', shopSql),
]
