import { GanttStage } from '../../api'

interface Props {
  stages: GanttStage[]
  onEdit: (stage: GanttStage) => void
  onDelete: (stageId: number) => void
}

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00`)
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

export default function GanttTimeline({ stages, onEdit, onDelete }: Props) {
  if (stages.length === 0) {
    return <div className="empty-state">Этапов пока нет — добавьте первый выше.</div>
  }

  const starts = stages.map((s) => parseDate(s.start_date).getTime())
  const ends = stages.map((s) => parseDate(s.end_date).getTime())
  const rangeStart = new Date(Math.min(...starts))
  const rangeEnd = new Date(Math.max(...ends))
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

  return (
    <div className="gantt">
      <div className="gantt-row gantt-header-row">
        <div className="gantt-label-col" />
        <div className="gantt-track-col">
          {ticks.map((t, i) => (
            <span key={i} className="gantt-tick" style={{ left: `${t.pct}%` }}>
              {t.label}
            </span>
          ))}
        </div>
      </div>

      {stages.map((stage) => {
        const offset = daysBetween(rangeStart, parseDate(stage.start_date))
        const duration = daysBetween(parseDate(stage.start_date), parseDate(stage.end_date)) + 1
        const leftPct = (offset / totalDays) * 100
        const widthPct = (duration / totalDays) * 100

        return (
          <div className="gantt-row" key={stage.id}>
            <div className="gantt-label-col">
              {stage.jira_url ? (
                <a href={stage.jira_url} target="_blank" rel="noopener noreferrer">
                  {stage.name}
                </a>
              ) : (
                <span>{stage.name}</span>
              )}
              <span className="gantt-row-actions">
                <button type="button" onClick={() => onEdit(stage)} title="Изменить">
                  ✎
                </button>
                <button type="button" onClick={() => onDelete(stage.id)} title="Удалить">
                  ✕
                </button>
              </span>
            </div>
            <div className="gantt-track-col">
              {showToday && <div className="gantt-today-line" style={{ left: `${todayPct}%` }} />}
              <div
                className="gantt-bar"
                style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                title={`${stage.start_date} — ${stage.end_date}`}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
