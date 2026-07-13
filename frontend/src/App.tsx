import { useState } from 'react'
import Sidebar, { View } from './components/Sidebar'
import JiraPage from './pages/JiraPage'
import GanttPage from './pages/GanttPage'

export default function App() {
  const [view, setView] = useState<View>('jira')

  return (
    <div className="app-layout">
      <Sidebar active={view} onSelect={setView} />
      <main className="app-content">
        {view === 'jira' && <JiraPage />}
        {view === 'gantt' && <GanttPage />}
      </main>
    </div>
  )
}
