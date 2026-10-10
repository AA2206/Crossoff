import { describe, expect, it, vi } from 'vitest'
import { busyForPlanning, commitPlan, replaceableEvents } from './commit'
import { DeleteError } from './planner'

describe('replaceableEvents', () => {
  const events = [
    { id: 'past', title: 'Essay (1/3)', start: 540, end: 600 },
    { id: 'now', title: 'Essay (2/3)', start: 780, end: 840 },
    { id: 'later', title: 'Essay (3/3)', start: 900, end: 960 },
  ]

  it('keeps sessions that have started, replacing only later ones', () => {
    // At 13:30, the 13:00 session is in progress and stays.
    expect(replaceableEvents(events, 810).map((e) => e.id)).toEqual(['later'])
  })

  it('replaces every session on a day that has not started', () => {
    expect(replaceableEvents(events, 0)).toHaveLength(3)
  })
})

describe('busyForPlanning', () => {
  it('frees the time of replaced sessions in the main calendar only', () => {
    const busy = [
      // A Crossoff session merged with a real meeting right after it.
      { calendarId: 'primary', start: 540, end: 660 },
      // A class at the same time on another calendar stays busy.
      { calendarId: 'classes', start: 540, end: 600 },
    ]
    expect(busyForPlanning(busy, [{ start: 540, end: 600 }])).toEqual([
      { calendarId: 'primary', start: 600, end: 660 },
      { calendarId: 'classes', start: 540, end: 600 },
    ])
  })
})

describe('commitPlan', () => {
  const create = (failOn?: string) =>
    vi.fn(async (s: string) => {
      if (s === failOn) throw new Error('Create failed')
      return `id-${s}`
    })

  it('creates every session, then removes the old ones', async () => {
    const calls: string[] = []
    const remove = vi.fn(async (ids: string[]) => {
      calls.push(`remove ${ids}`)
    })
    const outcome = await commitPlan({
      sessions: ['a', 'b'],
      replaceIds: ['old-1'],
      create: async (s) => {
        calls.push(`create ${s}`)
        return `id-${s}`
      },
      remove,
    })
    expect(outcome).toEqual({ kind: 'done', createdIds: ['id-a', 'id-b'] })
    expect(calls).toEqual(['create a', 'create b', 'remove old-1'])
  })

  it('stops on a create failure without touching the old plan', async () => {
    const remove = vi.fn()
    const outcome = await commitPlan({
      sessions: ['a', 'b', 'c'],
      replaceIds: ['old-1'],
      create: create('b'),
      remove,
    })
    expect(outcome).toMatchObject({
      kind: 'create-failed',
      createdIds: ['id-a'],
      failedIndex: 1,
    })
    expect(remove).not.toHaveBeenCalled()
  })

  it('reports old events it could not remove', async () => {
    const outcome = await commitPlan({
      sessions: ['a'],
      replaceIds: ['old-1', 'old-2'],
      create: create(),
      remove: async () => {
        throw new DeleteError(['old-2'], new Error('Down'))
      },
    })
    expect(outcome).toMatchObject({
      kind: 'remove-failed',
      createdIds: ['id-a'],
      leftoverIds: ['old-2'],
    })
  })

  it('reports progress as sessions are created', async () => {
    const onCreated = vi.fn()
    await commitPlan({
      sessions: ['a', 'b'],
      replaceIds: [],
      create: create(),
      remove: async () => {},
      onCreated,
    })
    expect(onCreated.mock.calls).toEqual([[1], [2]])
  })
})
