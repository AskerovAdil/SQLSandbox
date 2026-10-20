import { flatten, hottestNodes, parsePlanDocument } from './planModel'

const sample = [
  {
    Plan: {
      'Node Type': 'Hash Join',
      'Total Cost': 40,
      'Actual Total Time': 12,
      'Actual Rows': 5,
      'Plan Rows': 6,
      'Actual Loops': 1,
      Plans: [
        { 'Node Type': 'Seq Scan', 'Relation Name': 'orders', 'Total Cost': 20, 'Actual Total Time': 7, 'Actual Rows': 100, 'Plan Rows': 90, 'Actual Loops': 1 },
        {
          'Node Type': 'Index Scan',
          'Relation Name': 'customers',
          'Index Name': 'customers_pkey',
          'Total Cost': 8,
          'Actual Total Time': 1,
          'Actual Rows': 5,
          'Plan Rows': 5,
          'Actual Loops': 4,
        },
      ],
    },
    'Planning Time': 0.2,
    'Execution Time': 10.5,
  },
]

describe('parsePlanDocument', () => {
  it('builds the tree and reads timings', () => {
    const doc = parsePlanDocument(sample)
    expect(doc?.root.nodeType).toBe('Hash Join')
    expect(doc?.root.children.map((child) => child.nodeType)).toEqual(['Seq Scan', 'Index Scan'])
    expect(doc?.executionMs).toBe(10.5)
    expect(doc?.planningMs).toBe(0.2)
  })

  it('multiplies time by loops and computes exclusive time', () => {
    const doc = parsePlanDocument(sample)
    const index = doc?.root.children[1]
    expect(index?.totalMs).toBe(4) // 1 мс за цикл × 4 цикла
    expect(doc?.root.exclusiveMs).toBe(12 - 7 - 4)
  })

  it('accepts JSON text and rejects unexpected shapes', () => {
    expect(parsePlanDocument(JSON.stringify(sample))?.root.nodeType).toBe('Hash Join')
    expect(parsePlanDocument({ nope: true })).toBeNull()
    expect(parsePlanDocument('not json')).toBeNull()
  })
})

describe('hottestNodes', () => {
  it('highlights the nodes with the largest exclusive time', () => {
    const doc = parsePlanDocument(sample)
    if (!doc) throw new Error('no plan')
    const hot = [...hottestNodes(doc.root, 1)]
    expect(hot.map((node) => node.nodeType)).toEqual(['Seq Scan'])
    expect(flatten(doc.root)).toHaveLength(3)
  })
})
