import { Stats } from '../api'

interface Props {
  stats: Stats | null
}

export default function StatsPanel({ stats }: Props) {
  if (!stats) return null

  const items: [string, number][] = [
    ['Всего выполнено', stats.done_total],
    ['С начала года', stats.done_this_year],
    ['За месяц', stats.done_this_month],
    ['За неделю', stats.done_this_week],
  ]

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
