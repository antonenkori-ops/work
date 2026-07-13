import {
  DragEvent as ReactDragEvent,
  MouseEvent as ReactMouseEvent,
  useMemo,
  useRef,
  useState,
} from 'react'
import { GanttStage } from '../../api'

interface Props {
  stages: GanttStage[]
  onEdit: (stage: GanttStage) => void
  onAddChild: (parentId: number) => void
  onDelete: (stageId: number) => void
  onDatesChange: (stageId: number, startDate: string, endDate: string) => Promise<void>
  onReorder: (parentId: number | null, orderedIds: number[]) => Promise<void>
}

const ROW_HEIGHT = 36
const MS_PER_DAY = 1000 * 60 * 60 * 24

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00`)
}

function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY)
}

interface Row {
  stage: GanttStage
  depth: number
  hasChildren: boolean
}

type DragMode = 'move' | 'resize-left' | 'resize-right'

export default function GanttTimeline({
  stages,
  onEdit,
  onAddChild,
  onDelete,
  onDatesChange,
  onReorder,
}: Props) {
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
  const [preview, setPreview] = useState<{ id: number; start: Date; end: Date } | null>(null)
  const previewRef = useRef<{ id: number; start: Date; end: Date } | null>(null)
  const [dropBeforeId, setDropBeforeId] = useState<number | null>(null)
  const dragRef = useRef<{ id: number; parentId: number | null } | null>(null)
  const dragStateRef = useRef<{
    stageId: number
    mode: DragMode
    startClientX: number
    pxPerDay: number
    origStart: Date
    origEnd: Date
  } | null>(null)

  const childrenMap = useMemo(() => {
    const map = new Map<number | null, GanttStage[]>()
    for (const s of stages) {
      const key = s.parent_id
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(s)
    }
    for (const list of map.values()) list.sort((a, b) => a.sort_order - b.sort_order)
    return map
  }, [stages])

  const stageById = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages])

  const rows: Row[] = useMemo(() => {
    const out: Row[] = []
    function walk(parentId: number | null, depth: number) {
      const siblings = childrenMap.get(parentId) ?? []
      for (const stage of siblings) {
        const kids = childrenMap.get(stage.id) ?? []
        out.push({ stage, depth, hasChildren: kids.length > 0 })
        if (kids.length > 0 && !collapsed.has(stage.id)) {
          walk(stage.id, depth + 1)
        }
      }
    }
    walk(null, 0)
    return out
  }, [childrenMap, collapsed])

  if (stages.length === 0) {
    return <div className="empty-state">Этапов пока нет — добавьте первый выше.</div>
  }

  function effectiveDates(stage: GanttStage): { start: Date; end: Date } {
    if (preview && preview.id === stage.id) {
      return { start: preview.start, end: preview.end }
    }
    return { start: parseDate(stage.start_date), end: parseDate(stage.end_date) }
  }

  const allStarts = stages.map((s) => effectiveDates(s).start.getTime())
  const allEnds = stages.map((s) => effectiveDates(s).end.getTime())
  const rangeStart = new Date(Math.min(...allStarts))
  const rangeEnd = new Date(Math.max(...allEnds))
  const totalDays = Math.max(daysBetween(rangeStart, rangeEnd) + 1, 1)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayOffset = daysBetween(rangeStart, today)
  const showToday = todayOffset >= 0 && todayOffset <= totalDays
  const todayPct = (todayOffset / totalDays) * 100

  const tickCount = Math.min(6, totalDays)
  const ticks = Array.from({ length: tickCount }, (_, i) => {
    const dayOffset = Math.round((i / Math.max(tickCount - 1, 1)) * (totalDays - 1))
    const d = new Date(rangeStart)
    d.setDate(d.getDate() + dayOffset)
    return { pct: (dayOffset / totalDays) * 100, label: d.toLocaleDateString('ru-RU') }
  })

  function barStyle(stage: GanttStage) {
    const { start, end } = effectiveDates(stage)
    const offset = daysBetween(rangeStart, start)
    const duration = daysBetween(start, end) + 1
    return {
      left: `${(offset / totalDays) * 100}%`,
      width: `${(duration / totalDays) * 100}%`,
    }
  }

  function isViolated(stage: GanttStage): boolean {
    if (!stage.depends_on_id) return false
    const predecessor = stageById.get(stage.depends_on_id)
    if (!predecessor) return false
    const { start } = effectiveDates(stage)
    const { end: predEnd } = effectiveDates(predecessor)
    return start.getTime() < predEnd.getTime()
  }

  // --- перетаскивание полосы (перенос / изменение длительности) ---

  function handleBarMouseDown(e: ReactMouseEvent, stage: GanttStage, mode: DragMode) {
    e.preventDefault()
    // e.currentTarget — это span внутри .gantt-bar, которая лежит внутри .gantt-track-col
    const track = e.currentTarget.parentElement!.parentElement as HTMLElement
    const trackWidth = track.getBoundingClientRect().width
    const pxPerDay = trackWidth / totalDays

    dragStateRef.current = {
      stageId: stage.id,
      mode,
      startClientX: e.clientX,
      pxPerDay,
      origStart: parseDate(stage.start_date),
      origEnd: parseDate(stage.end_date),
    }

    function handleMove(ev: MouseEvent) {
      const state = dragStateRef.current
      if (!state) return
      const deltaDays = Math.round((ev.clientX - state.startClientX) / state.pxPerDay)
      let newStart = state.origStart
      let newEnd = state.origEnd

      if (state.mode === 'move') {
        newStart = new Date(state.origStart.getTime() + deltaDays * MS_PER_DAY)
        newEnd = new Date(state.origEnd.getTime() + deltaDays * MS_PER_DAY)
      } else if (state.mode === 'resize-left') {
        newStart = new Date(state.origStart.getTime() + deltaDays * MS_PER_DAY)
        if (newStart.getTime() > state.origEnd.getTime()) newStart = state.origEnd
      } else if (state.mode === 'resize-right') {
        newEnd = new Date(state.origEnd.getTime() + deltaDays * MS_PER_DAY)
        if (newEnd.getTime() < state.origStart.getTime()) newEnd = state.origStart
      }

      const next = { id: state.stageId, start: newStart, end: newEnd }
      previewRef.current = next
      setPreview(next)
    }

    function handleUp() {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
      const state = dragStateRef.current
      dragStateRef.current = null
      if (!state) return

      const current = previewRef.current
      if (current && current.id === state.stageId) {
        onDatesChange(state.stageId, toISODate(current.start), toISODate(current.end)).finally(
          () => {
            previewRef.current = null
            setPreview(null)
          },
        )
      } else {
        previewRef.current = null
        setPreview(null)
      }
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }

  // --- перетаскивание строк (смена порядка среди этапов одного уровня) ---

  function handleDragStart(e: ReactDragEvent, stage: GanttStage) {
    dragRef.current = { id: stage.id, parentId: stage.parent_id }
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(stage.id))
  }

  function handleDragOverRow(e: ReactDragEvent, stage: GanttStage) {
    const dragged = dragRef.current
    if (!dragged || dragged.parentId !== stage.parent_id || dragged.id === stage.id) return
    e.preventDefault()
    setDropBeforeId(stage.id)
  }

  async function handleDropOnRow(e: ReactDragEvent, stage: GanttStage) {
    e.preventDefault()
    setDropBeforeId(null)
    const dragged = dragRef.current
    dragRef.current = null
    if (!dragged || dragged.parentId !== stage.parent_id || dragged.id === stage.id) return

    const siblings = (childrenMap.get(stage.parent_id) ?? []).map((s) => s.id)
    const withoutDragged = siblings.filter((id) => id !== dragged.id)
    const targetIndex = withoutDragged.indexOf(stage.id)
    withoutDragged.splice(targetIndex, 0, dragged.id)
    await onReorder(stage.parent_id, withoutDragged)
  }

  async function handleDropAtEnd(e: ReactDragEvent) {
    e.preventDefault()
    setDropBeforeId(null)
    const dragged = dragRef.current
    dragRef.current = null
    if (!dragged) return
    const siblings = (childrenMap.get(dragged.parentId) ?? []).map((s) => s.id)
    const withoutDragged = siblings.filter((id) => id !== dragged.id)
    withoutDragged.push(dragged.id)
    await onReorder(dragged.parentId, withoutDragged)
  }

  return (
    <div className="gantt">
      <div className="gantt-row gantt-header-row">
        <div className="gantt-label-col" />
        <div className="gantt-duration-col" />
        <div className="gantt-track-col">
          {ticks.map((t, i) => (
            <span key={i} className="gantt-tick" style={{ left: `${t.pct}%` }}>
              {t.label}
            </span>
          ))}
        </div>
      </div>

      <div className="gantt-body" style={{ height: rows.length * ROW_HEIGHT }}>
        {rows.map((row) => {
          const { stage, depth, hasChildren } = row
          const violated = isViolated(stage)

          return (
            <div
              key={stage.id}
              className={`gantt-row${dropBeforeId === stage.id ? ' gantt-row-drop-target' : ''}`}
              onDragOver={(e) => handleDragOverRow(e, stage)}
              onDrop={(e) => handleDropOnRow(e, stage)}
              onDragLeave={() => setDropBeforeId((id) => (id === stage.id ? null : id))}
            >
              <div className="gantt-label-col" style={{ paddingLeft: 8 + depth * 16 }}>
                <span
                  className="gantt-drag-handle"
                  draggable
                  onDragStart={(e) => handleDragStart(e, stage)}
                  title="Перетащить, чтобы изменить порядок"
                >
                  ⠿
                </span>
                {hasChildren ? (
                  <button
                    type="button"
                    className="gantt-collapse-toggle"
                    onClick={() =>
                      setCollapsed((prev) => {
                        const next = new Set(prev)
                        if (next.has(stage.id)) next.delete(stage.id)
                        else next.add(stage.id)
                        return next
                      })
                    }
                  >
                    {collapsed.has(stage.id) ? '▸' : '▾'}
                  </button>
                ) : (
                  <span className="gantt-collapse-spacer" />
                )}
                {stage.jira_url ? (
                  <a href={stage.jira_url} target="_blank" rel="noopener noreferrer">
                    {stage.name}
                  </a>
                ) : (
                  <span className="gantt-stage-name">{stage.name}</span>
                )}
                <span className="gantt-row-actions">
                  <button type="button" onClick={() => onAddChild(stage.id)} title="Добавить подпункт">
                    +
                  </button>
                  <button type="button" onClick={() => onEdit(stage)} title="Изменить">
                    ✎
                  </button>
                  <button type="button" onClick={() => onDelete(stage.id)} title="Удалить">
                    ✕
                  </button>
                </span>
              </div>

              <div className="gantt-duration-col">{stage.duration_days} дн.</div>

              <div className="gantt-track-col">
                {showToday && <div className="gantt-today-line" style={{ left: `${todayPct}%` }} />}
                <div
                  className={`gantt-bar${violated ? ' gantt-bar-violated' : ''}`}
                  style={barStyle(stage)}
                  title={`${stage.start_date} — ${stage.end_date} (${stage.duration_days} дн.)${
                    stage.depends_on_id ? '\nНачало определяется предшественником' : ''
                  }`}
                >
                  {stage.depends_on_id ? (
                    <span className="gantt-bar-body gantt-bar-locked" />
                  ) : (
                    <>
                      <span
                        className="gantt-bar-handle gantt-bar-handle-left"
                        onMouseDown={(e) => handleBarMouseDown(e, stage, 'resize-left')}
                      />
                      <span
                        className="gantt-bar-body"
                        onMouseDown={(e) => handleBarMouseDown(e, stage, 'move')}
                      />
                    </>
                  )}
                  <span
                    className="gantt-bar-handle gantt-bar-handle-right"
                    onMouseDown={(e) => handleBarMouseDown(e, stage, 'resize-right')}
                  />
                </div>
              </div>
            </div>
          )
        })}

        <div className="gantt-drop-end" onDragOver={(e) => e.preventDefault()} onDrop={handleDropAtEnd} />
      </div>
    </div>
  )
}
