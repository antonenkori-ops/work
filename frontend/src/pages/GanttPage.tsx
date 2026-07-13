import { useState } from 'react'
import GanttChartList from '../components/gantt/GanttChartList'
import GanttChartView from '../components/gantt/GanttChartView'

export default function GanttPage() {
  const [selectedChartId, setSelectedChartId] = useState<number | null>(null)

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
