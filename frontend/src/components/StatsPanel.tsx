import { Stats } from '../api'

interface Props {
  stats: Stats | null
}

function Row({ items }: { items: [string, number][] }) {
  return (
    <div className="stats-panel">
      {items.map(([label, value]) => (
        <div className="stats-card" key={label}>
          <div className="stats-value">{value}</div>
          <div className="stats-label">{label}</div>
        </div>
      ))}
    </div>
  )
}

export default function StatsPanel({ stats }: Props) {
  if (!stats) return null

  const doneItems: [string, number][] = [
    ['Всего выполнено', stats.done_total],
    ['С начала года', stats.done_this_year],
    ['За месяц', stats.done_this_month],
    ['За неделю', stats.done_this_week],
  ]

  const statusItems: [string, number][] = [
    ['Не закрыто', stats.open_total],
    ...Object.entries(stats.status_counts),
  ]

  return (
    <div className="stats-wrapper">
      <Row items={doneItems} />
      <Row items={statusItems} />
    </div>
  )
}
