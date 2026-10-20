import { expect, type Page, test } from '@playwright/test'

/** Открывает приложение и ждёт, пока база вкладки поднимется. */
async function openApp(page: Page): Promise<void> {
  await page.goto('./')
  await expect(page.getByText('PostgreSQL · PGlite')).toBeVisible()
}

/** Заменяет текст редактора и выполняет его под курсором (Ctrl+Enter). */
async function runInEditor(page: Page, sql: string): Promise<void> {
  await page.locator('.monaco-editor .view-lines').click()
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.type(sql)
  await page.keyboard.press('ControlOrMeta+Enter')
}

test.describe('SQL Sandbox smoke', () => {
  test('creates a tab from a template, runs a SELECT and shows tables in the session panel', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await openApp(page)

    // Новая вкладка из шаблона «Сотрудники»: схема появляется после выполнения seed-скрипта.
    await page.getByRole('button', { name: 'Новая вкладка' }).click()
    await page.getByRole('menuitem', { name: /Шаблон: Сотрудники/ }).click()
    await expect(page.getByRole('tab', { name: /Сотрудники/ })).toBeVisible()
    await expect(page.getByText('3 объектов')).toBeVisible()

    // SELECT: результат с одной строкой и колонкой n.
    await runInEditor(page, 'SELECT count(*) AS n FROM employees')
    await expect(page.getByRole('button', { name: '#1 1 строка' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'n int8', exact: true })).toBeVisible()

    // Панель «Таблицы сессии»: карточка employees с семью строками.
    await expect(page.getByRole('article', { name: 'Таблица employees' })).toBeVisible()
    await expect(page.getByRole('article', { name: 'Таблица employees' }).getByText('7 строк')).toBeVisible()

    expect(errors).toEqual([])
  })

  test('shows the shortcuts dialog with ? and closes it with Escape', async ({ page }) => {
    await openApp(page)
    await page.getByRole('button', { name: 'Горячие клавиши (?)' }).click()
    const dialog = page.getByRole('dialog', { name: 'Горячие клавиши' })
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })
})
