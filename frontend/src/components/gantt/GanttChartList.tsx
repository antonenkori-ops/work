import { FormEvent, useEffect, useState } from 'react'
import { createGanttChart, deleteGanttChart, fetchGanttCharts, GanttChart } from '../../api'

interface Props {
  onOpen: (chartId: number) => void
}

export default function GanttChartList({ onOpen }: Props) {
  const [charts, setCharts] = useState<GanttChart[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setCharts(await fetchGanttCharts())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    try {
      const chart = await createGanttChart(newTitle.trim())
      setNewTitle('')
      await load()
      onOpen(chart.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function handleDelete(chartId: number) {
    if (!confirm('Удалить диаграмму?')) return
    try {
      await deleteGanttChart(chartId)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="page">
      <header className="app-header">
        <h1>Диаграммы Ганта</h1>
      </header>

      {error && <div className="error-banner">Ошибка: {error}</div>}

      <form className="inline-form" onSubmit={handleCreate}>
        <input
          type="text"
          placeholder="Название новой диаграммы"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
        />
        <button type="submit">Создать</button>
      </form>

      {loading ? (
        <div>Загрузка…</div>
      ) : charts.length === 0 ? (
        <div className="empty-state">Диаграмм пока нет — создайте первую.</div>
      ) : (
        <div className="chart-list">
          {charts.map((chart) => (
            <div className="chart-list-item" key={chart.id} onClick={() => onOpen(chart.id)}>
              <div className="chart-list-title">{chart.title}</div>
              <div className="chart-list-meta">
                {chart.stages.length} этап(ов) · создана{' '}
                {new Date(chart.created_at).toLocaleDateString('ru-RU')}
              </div>
              <button
                className="chart-delete-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete(chart.id)
                }}
              >
                Удалить
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
