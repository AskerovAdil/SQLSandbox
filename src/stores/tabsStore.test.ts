import { INITIAL_SQL, sanitize, useTabsStore, createTab } from './tabsStore'

function resetStore(tabNames: string[], activeIndex = 0) {
  const tabs = tabNames.map((name) => createTab(name, `-- ${name}`))
  useTabsStore.setState({ tabs, activeId: tabs[activeIndex]?.id ?? '' })
  return tabs
}

describe('tabs store', () => {
  it('adds a tab with the next free name and makes it active', () => {
    resetStore(['Песочница 1'])
    const id = useTabsStore.getState().addTab()
    const { tabs, activeId } = useTabsStore.getState()
    expect(tabs.map((tab) => tab.name)).toEqual(['Песочница 1', 'Песочница 2'])
    expect(activeId).toBe(id)
  })

  it('renames a tab and ignores empty names', () => {
    const [first] = resetStore(['A'])
    if (!first) throw new Error('no tab')
    useTabsStore.getState().renameTab(first.id, '  Задачи  ')
    expect(useTabsStore.getState().tabs[0]?.name).toBe('Задачи')
    useTabsStore.getState().renameTab(first.id, '   ')
    expect(useTabsStore.getState().tabs[0]?.name).toBe('Задачи')
  })

  it('keeps at least one tab', () => {
    const [only] = resetStore(['A'])
    if (!only) throw new Error('no tab')
    useTabsStore.getState().closeTab(only.id)
    expect(useTabsStore.getState().tabs).toHaveLength(1)
  })

  it('moves focus to a neighbour when the active tab is closed', () => {
    const tabs = resetStore(['A', 'B', 'C'], 1)
    useTabsStore.getState().closeTab(tabs[1]?.id ?? '')
    const state = useTabsStore.getState()
    expect(state.tabs.map((tab) => tab.name)).toEqual(['A', 'C'])
    expect(state.activeId).toBe(tabs[2]?.id)
  })

  it('reorders tabs', () => {
    resetStore(['A', 'B', 'C'])
    useTabsStore.getState().moveTab(0, 2)
    expect(useTabsStore.getState().tabs.map((tab) => tab.name)).toEqual(['B', 'C', 'A'])
  })

  it('stores SQL per tab', () => {
    const [first, second] = resetStore(['A', 'B'])
    if (!first || !second) throw new Error('no tabs')
    useTabsStore.getState().setSql(second.id, 'SELECT 2')
    const { tabs } = useTabsStore.getState()
    expect(tabs[0]?.sql).toBe('-- A')
    expect(tabs[1]?.sql).toBe('SELECT 2')
  })

  it('copies code into a new tab for duplication', () => {
    const [first] = resetStore(['Основная'])
    if (!first) throw new Error('no tab')
    const id = useTabsStore.getState().addTabFrom(first.id, first.sql)
    const copy = useTabsStore.getState().tabs.find((tab) => tab.id === id)
    expect(copy?.name).toBe('Основная (копия)')
    expect(copy?.sql).toBe(first.sql)
  })
})

describe('sanitize', () => {
  it('accepts a valid state', () => {
    const tab = createTab('A', 'SELECT 1')
    expect(sanitize({ tabs: [tab], activeId: tab.id })).toEqual({ tabs: [tab], activeId: tab.id })
  })

  it('falls back to the first tab when activeId is unknown', () => {
    const tab = createTab('A')
    expect(sanitize({ tabs: [tab], activeId: 'missing' })?.activeId).toBe(tab.id)
  })

  it('rejects corrupted data', () => {
    expect(sanitize(null)).toBeNull()
    expect(sanitize({ tabs: 'nope', activeId: 'x' })).toBeNull()
    expect(sanitize({ tabs: [{ id: 1 }], activeId: 'x' })).toBeNull()
    expect(sanitize({ tabs: [], activeId: 'x' })).toBeNull()
  })

  it('keeps the initial SQL template non-empty', () => {
    expect(INITIAL_SQL).toContain('CREATE TABLE')
  })
})

describe('shared sandbox tabs', () => {
  const guid = '11111111-2222-4333-8444-555555555555'

  it('opens a sandbox once and reuses the tab on the next call', () => {
    resetStore(['A'])
    useTabsStore.getState().openSandbox(guid)
    const first = useTabsStore.getState().tabs.find((tab) => tab.sandboxId === guid)
    expect(first).toBeDefined()
    useTabsStore.getState().openSandbox(guid)
    expect(useTabsStore.getState().tabs.filter((tab) => tab.sandboxId === guid)).toHaveLength(1)
    expect(useTabsStore.getState().activeId).toBe(first?.id)
  })

  it('links a local tab to a sandbox and keeps the link across sanitize', () => {
    const [local] = resetStore(['Локальная'])
    if (!local) throw new Error('no tab')
    useTabsStore.getState().setSandboxId(local.id, guid)
    const tabs = useTabsStore.getState().tabs
    expect(sanitize({ tabs, activeId: local.id })?.tabs[0]?.sandboxId).toBe(guid)
  })
})
