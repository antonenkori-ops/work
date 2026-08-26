import { useState } from 'react'
import ReleaseList from '../components/releases/ReleaseList'
import ReleaseDetail from '../components/releases/ReleaseDetail'

export default function ReleasesPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null)

  if (selectedId === null) {
    return <ReleaseList onOpen={setSelectedId} />
  }

  return (
    <ReleaseDetail
      releaseId={selectedId}
      onBack={() => setSelectedId(null)}
      onDeleted={() => setSelectedId(null)}
    />
  )
}
