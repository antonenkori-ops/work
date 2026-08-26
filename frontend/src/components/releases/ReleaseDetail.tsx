import { FormEvent, useEffect, useState } from 'react'
import {
  addReleaseTicket,
  deleteRelease,
  deleteReleaseTicket,
  downloadReleaseExport,
  fetchRelease,
  Release,
  ReleaseSection,
  ReleaseTicketKind,
  updateRelease,
  updateReleaseTicket,
} from '../../api'
import AdminPicker from './AdminPicker'
import AcSystemPicker from './AcSystemPicker'
import ReleaseSectionTable from './ReleaseSectionTable'
import ReleaseRisksTable from './ReleaseRisksTable'
import ReleaseModuleSets from './ReleaseModuleSets'
import { TICKET_KIND_LABELS } from './ticketKinds'

interface Props {
  releaseId: number
  onBack: () => void
  onDeleted: () => void
}

const SECTIONS: { id: ReleaseSection; label: string }[] = [
  { id: 'prep', label: 'Подготовительные работы' },
  { id: 'main', label: 'Основные работы' },
  { id: 'closing', label: 'Заключительные работы' },
  { id: 'rollback', label: 'План отката' },
]


export default function ReleaseDetail({ releaseId, onBack, onDeleted }: Props) {
  const [release, setRelease] = useState<Release | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [newTicketLabel, setNewTicketLabel] = useState('')
  const [newTicketKey, setNewTicketKey] = useState('')
  const [newTicketKind, setNewTicketKind] = useState<ReleaseTicketKind>('other')

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setRelease(await fetchRelease(releaseId))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [releaseId])

  function applyError(e: unknown) {
    setError(e instanceof Error ? e.message : String(e))
  }

  async function saveHeaderField(field: 'title' | 'main_admin' | 'second_admin', value: string) {
    if (!release) return
    if ((release[field] ?? '') === value) return
    try {
      setRelease(await updateRelease(release.id, { [field]: value }))
    } catch (e) {
      applyError(e)
    }
  }

  async function handleAddTicket(e: FormEvent) {
    e.preventDefault()
    if (!release || !newTicketLabel.trim() || !newTicketKey.trim()) return
    try {
      setRelease(
        await addReleaseTicket(release.id, newTicketLabel.trim(), newTicketKey.trim(), newTicketKind),
      )
      setNewTicketLabel('')
      setNewTicketKey('')
      setNewTicketKind('other')
    } catch (e) {
      applyError(e)
    }
  }

  async function handleDeleteTicket(ticketId: number) {
    try {
      setRelease(await deleteReleaseTicket(ticketId))
    } catch (e) {
      applyError(e)
    }
  }

  async function handleTicketKindChange(ticketId: number, kind: ReleaseTicketKind) {
    try {
      setRelease(await updateReleaseTicket(ticketId, { kind }))
    } catch (e) {
      applyError(e)
    }
  }

  async function handleExport() {
    if (!release) return
    setExporting(true)
    try {
      await downloadReleaseExport(release.id, release.title)
    } catch (e) {
      applyError(e)
    } finally {
      setExporting(false)
    }
  }

  async function handleDelete() {
    if (!release) return
    if (!confirm('Удалить релиз?')) return
    try {
      await deleteRelease(release.id)
      onDeleted()
    } catch (e) {
      applyError(e)
    }
  }

  if (loading || !release) {
    return (
      <div className="page">
        <button className="btn-secondary" onClick={onBack}>
          ← К списку релизов
        </button>
        {error ? <div className="error-banner">Ошибка: {error}</div> : <div>Загрузка…</div>}
      </div>
    )
  }

  return (
    <div className="page">
      <header className="app-header">
        <button className="btn-secondary" onClick={onBack}>
          ← К списку релизов
        </button>
        <div className="release-actions">
          <button onClick={handleExport} disabled={exporting}>
            {exporting ? 'Экспорт…' : 'Экспорт в Excel'}
          </button>
          <button className="btn-secondary" onClick={handleDelete}>
            Удалить релиз
          </button>
        </div>
      </header>

      {error && <div className="error-banner">Ошибка: {error}</div>}

      <div className="release-header-card">
        <label className="stage-form-field release-title-field">
          АС (название системы)
          <AcSystemPicker value={release.title} onChange={(name) => saveHeaderField('title', name)} />
        </label>
        <div className="release-title-preview">
          Заголовок в документе: «План работ по внедрению релиза {release.title}»
        </div>

        <div className="release-tickets">
          <div className="release-tickets-label">Номера в Jira</div>
          <ul className="release-ticket-list">
            {release.tickets.map((t) => (
              <li key={t.id}>
                <a href={t.jira_url} target="_blank" rel="noreferrer">
                  {t.label} ({t.key})
                </a>
                <select
                  className="release-ticket-kind"
                  value={t.kind}
                  onChange={(e) =>
                    handleTicketKindChange(t.id, e.target.value as ReleaseTicketKind)
                  }
                >
                  {Object.entries(TICKET_KIND_LABELS).map(([kind, label]) => (
                    <option key={kind} value={kind}>
                      {label}
                    </option>
                  ))}
                </select>
                <button className="chart-delete-btn" onClick={() => handleDeleteTicket(t.id)}>
                  ×
                </button>
              </li>
            ))}
          </ul>
          <form className="inline-form" onSubmit={handleAddTicket}>
            <input
              type="text"
              placeholder="Название (напр. WebSite.2026.Sprint 224)"
              value={newTicketLabel}
              onChange={(e) => setNewTicketLabel(e.target.value)}
            />
            <input
              type="text"
              placeholder="Ключ (напр. WEBSITE-52101)"
              value={newTicketKey}
              onChange={(e) => setNewTicketKey(e.target.value)}
            />
            <select
              value={newTicketKind}
              onChange={(e) => setNewTicketKind(e.target.value as ReleaseTicketKind)}
            >
              {Object.entries(TICKET_KIND_LABELS).map(([kind, label]) => (
                <option key={kind} value={kind}>
                  {label}
                </option>
              ))}
            </select>
            <button type="submit">Добавить</button>
          </form>
          <p className="release-tickets-hint">
            «Спринт» — тикет, ключ которого используется как релизная ветка ({'{{sprint_branch}}'}
            ) и подставляется в тексты пунктов плана; «Бандл» — второй тикет в объявлениях.
          </p>
        </div>

        <div className="release-admins">
          <label className="stage-form-field">
            Администратор (исполнитель)
            <input
              type="text"
              defaultValue={release.main_admin ?? ''}
              key={`main-admin-${release.id}`}
              onBlur={(e) => saveHeaderField('main_admin', e.target.value)}
            />
          </label>
          <label className="stage-form-field">
            Второй администратор
            <AdminPicker
              value={release.second_admin ?? ''}
              onChange={(name) => saveHeaderField('second_admin', name)}
            />
          </label>
        </div>
      </div>

      <ReleaseModuleSets release={release} onChange={setRelease} onError={applyError} />

      {SECTIONS.map((s) => (
        <ReleaseSectionTable
          key={s.id}
          release={release}
          section={s.id}
          label={s.label}
          onChange={setRelease}
          onError={applyError}
        />
      ))}

      <ReleaseRisksTable release={release} onChange={setRelease} onError={applyError} />
    </div>
  )
}
