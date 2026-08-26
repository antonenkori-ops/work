import { useState } from 'react'
import Sidebar, { View } from './components/Sidebar'
import HomePage from './pages/HomePage'
import JiraPage from './pages/JiraPage'
import GanttPage from './pages/GanttPage'
import ReleasesPage from './pages/ReleasesPage'

export default function App() {
  const [view, setView] = useState<View>('home')
  const [pendingChartId, setPendingChartId] = useState<number | null>(null)

  function openGanttChart(chartId: number) {
    setPendingChartId(chartId)
    setView('gantt')
  }

  return (
    <div className="app-layout">
      <Sidebar active={view} onSelect={setView} />
      <main className="app-content">
        {view === 'home' && <HomePage onOpenChart={openGanttChart} />}
        {view === 'jira' && <JiraPage />}
        {view === 'gantt' && (
          <GanttPage
            initialChartId={pendingChartId}
            onConsumeInitialChartId={() => setPendingChartId(null)}
          />
        )}
        {view === 'releases' && <ReleasesPage />}
      </main>
    </div>
  )
}
