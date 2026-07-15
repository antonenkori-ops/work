import { useEffect, useState } from 'react'
import GanttChartList from '../components/gantt/GanttChartList'
import GanttChartView from '../components/gantt/GanttChartView'

interface Props {
  initialChartId?: number | null
  onConsumeInitialChartId?: () => void
}

export default function GanttPage({ initialChartId, onConsumeInitialChartId }: Props) {
  const [selectedChartId, setSelectedChartId] = useState<number | null>(initialChartId ?? null)

  useEffect(() => {
    if (initialChartId != null) {
      onConsumeInitialChartId?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (selectedChartId === null) {
    return <GanttChartList onOpen={setSelectedChartId} />
  }

  return (
    <GanttChartView
      chartId={selectedChartId}
      onBack={() => setSelectedChartId(null)}
      onDeleted={() => setSelectedChartId(null)}
    />
  )
}
