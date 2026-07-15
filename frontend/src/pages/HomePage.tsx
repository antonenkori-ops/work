import { useEffect, useState } from 'react'
import { fetchGanttCharts, fetchStats, GanttChart, GanttStage, Stats } from '../api'

interface Props {
  onOpenChart: (chartId: number) => void
}

interface FlatStage extends GanttStage {
  chartId: number
  chartTitle: string
}

function todayISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function daysBetweenISO(a: string, b: string): number {
  const d1 = new Date(`${a}T00:00:00`)
  const d2 = new Date(`${b}T00:00:00`)
  return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24))
}

export default function HomePage({ onOpenChart }: Props) {
  const [charts, setCharts] = useState<GanttChart[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([fetchGanttCharts(), fetchStats()])
      .then(([c, s]) => {
        setCharts(c)
        setStats(s)
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [])

  const today = todayISO()

  const allStages: FlatStage[] = charts.flatMap((chart) =>
    chart.stages.map((s) => ({ ...s, chartId: chart.id, chartTitle: chart.title })),
  )

  const overdue = allStages
    .filter((s) => !s.is_done && s.end_date < today)
    .sort((a, b) => a.end_date.localeCompare(b.end_date))

  const activeToday = allStages
    .filter((s) => !s.is_done && s.start_date <= today && s.end_date >= today)
    .sort((a, b) => a.end_date.localeCompare(b.end_date))

  return (
    <div className="page">
      <header className="app-header">
        <h1>Главная</h1>
      </header>

      {error && <div className="error-banner">Ошибка: {error}</div>}
      {loading && <div>Загрузка…</div>}

      <div className="widgets-grid">
        <div className="widget">
          <h2>Что делать сегодня</h2>
          {overdue.length === 0 && activeToday.length === 0 ? (
            <div className="empty-state">На сегодня активных этапов нет.</div>
          ) : (
            <>
              {overdue.length > 0 && (
                <div className="widget-section">
                  <div className="widget-section-title widget-section-overdue">Просрочено</div>
                  {overdue.map((s) => (
                    <div className="widget-row" key={`overdue-${s.chartId}-${s.id}`}>
                      <span className="widget-row-link" onClick={() => onOpenChart(s.chartId)}>
                        {s.name}
                      </span>
                      <span className="widget-row-meta">
                        {s.chartTitle} · просрочено на {daysBetweenISO(s.end_date, today)} дн.
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {activeToday.length > 0 && (
                <div className="widget-section">
                  <div className="widget-section-title">В работе сегодня</div>
                  {activeToday.map((s) => (
                    <div className="widget-row" key={`active-${s.chartId}-${s.id}`}>
                      <span className="widget-row-link" onClick={() => onOpenChart(s.chartId)}>
                        {s.name}
                      </span>
                      <span className="widget-row-meta">
                        {s.chartTitle} · осталось {daysBetweenISO(today, s.end_date) + 1} дн.
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="widget">
          <h2>Jira</h2>
          {stats && (
            <div className="widget-stats">
              <div>Не закрыто: {stats.open_total}</div>
              <div>Выполнено за неделю: {stats.done_this_week}</div>
              <div>Выполнено за месяц: {stats.done_this_month}</div>
            </div>
          )}
        </div>

        <div className="widget">
          <h2>Диаграммы Ганта</h2>
          {charts.length === 0 ? (
            <div className="empty-state">Диаграмм пока нет.</div>
          ) : (
            charts.map((c) => (
              <div className="widget-row" key={c.id}>
                <span className="widget-row-link" onClick={() => onOpenChart(c.id)}>
                  {c.title}
                </span>
                <span className="widget-row-meta">
                  {c.stage_count} этап(ов)
                  {c.overall_end && ` · до ${new Date(c.overall_end).toLocaleDateString('ru-RU')}`}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
