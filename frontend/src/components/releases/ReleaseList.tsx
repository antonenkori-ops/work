import { FormEvent, useEffect, useState } from 'react'
import {
  createRelease,
  deleteRelease,
  fetchReleases,
  Release,
  ReleaseTicketKind,
} from '../../api'
import AdminPicker from './AdminPicker'
import AcSystemPicker from './AcSystemPicker'
import { TICKET_KIND_LABELS } from './ticketKinds'

interface Props {
  onOpen: (releaseId: number) => void
}

function releaseDisplayName(release: Release): string {
  const sprint = release.tickets.find((t) => t.kind === 'sprint')
  return sprint ? sprint.label : release.title
}

const KIND_OPTIONS: { id: string; label: string; enabled: boolean }[] = [
  { id: 'planned', label: 'Плановый', enabled: true },
  { id: 'unplanned', label: 'Внеплановый / хотфикс', enabled: false },
  { id: 'text', label: 'Текстовый', enabled: false },
]

export default function ReleaseList({ onOpen }: Props) {
  const [releases, setReleases] = useState<Release[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  const [kind, setKind] = useState('planned')
  const [title, setTitle] = useState('')
  const [mainAdmin, setMainAdmin] = useState('')
  const [secondAdmin, setSecondAdmin] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [draftTickets, setDraftTickets] = useState<
    { label: string; key: string; kind: ReleaseTicketKind }[]
  >([])
  const [ticketLabel, setTicketLabel] = useState('')
  const [ticketKey, setTicketKey] = useState('')
  const [ticketKind, setTicketKind] = useState<ReleaseTicketKind>('sprint')

  function addDraftTicket() {
    if (!ticketLabel.trim() || !ticketKey.trim()) return
    setDraftTickets((prev) => [
      ...prev,
      { label: ticketLabel.trim(), key: ticketKey.trim(), kind: ticketKind },
    ])
    setTicketLabel('')
    setTicketKey('')
    setTicketKind('other')
  }

  function removeDraftTicket(index: number) {
    setDraftTickets((prev) => prev.filter((_, i) => i !== index))
  }

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setReleases(await fetchReleases())
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
    setSubmitting(true)
    setError(null)
    try {
      const release = await createRelease({
        kind,
        title: title.trim() || undefined,
        main_admin: mainAdmin.trim() || undefined,
        second_admin: secondAdmin.trim() || undefined,
        tickets: draftTickets.length > 0 ? draftTickets : undefined,
      })
      setShowForm(false)
      setTitle('')
      setMainAdmin('')
      setSecondAdmin('')
      setDraftTickets([])
      onOpen(release.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(releaseId: number) {
    if (!confirm('Удалить релиз?')) return
    try {
      await deleteRelease(releaseId)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="page">
      <header className="app-header">
        <h1>Релизы</h1>
        <button onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Отмена' : 'Создать'}
        </button>
      </header>

      {error && <div className="error-banner">Ошибка: {error}</div>}

      {showForm && (
        <form className="release-create-form" onSubmit={handleCreate}>
          <div className="release-kind-picker">
            {KIND_OPTIONS.map((opt) => (
              <label
                key={opt.id}
                className={`release-kind-option${opt.enabled ? '' : ' release-kind-disabled'}`}
                title={opt.enabled ? '' : 'Пока не реализовано'}
              >
                <input
                  type="radio"
                  name="kind"
                  disabled={!opt.enabled}
                  checked={kind === opt.id}
                  onChange={() => setKind(opt.id)}
                />
                {opt.label}
              </label>
            ))}
          </div>

          <label className="stage-form-field">
            АС (название системы)
            <AcSystemPicker value={title} onChange={setTitle} />
          </label>

          <label className="stage-form-field">
            Администратор (исполнитель)
            <input
              type="text"
              placeholder="Антоненко Р.И."
              value={mainAdmin}
              onChange={(e) => setMainAdmin(e.target.value)}
            />
          </label>

          <label className="stage-form-field">
            Второй администратор
            <AdminPicker value={secondAdmin} onChange={setSecondAdmin} />
          </label>

          <div className="release-create-tickets">
            <div className="release-tickets-label">Артефакты Jira</div>
            {draftTickets.length > 0 && (
              <ul className="release-ticket-list">
                {draftTickets.map((t, i) => (
                  <li key={i}>
                    <span>
                      {t.label} ({t.key}) — {TICKET_KIND_LABELS[t.kind]}
                    </span>
                    <button
                      type="button"
                      className="chart-delete-btn"
                      onClick={() => removeDraftTicket(i)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="release-ticket-add-row">
              <input
                type="text"
                placeholder="Название (напр. WebSite.2026.Sprint 224)"
                value={ticketLabel}
                onChange={(e) => setTicketLabel(e.target.value)}
              />
              <input
                type="text"
                placeholder="Ключ (напр. WEBSITE-52101)"
                value={ticketKey}
                onChange={(e) => setTicketKey(e.target.value)}
              />
              <select
                value={ticketKind}
                onChange={(e) => setTicketKind(e.target.value as ReleaseTicketKind)}
              >
                {Object.entries(TICKET_KIND_LABELS).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
              <button type="button" className="btn-secondary" onClick={addDraftTicket}>
                + Добавить тикет
              </button>
            </div>
          </div>

          <button type="submit" disabled={submitting}>
            {submitting ? 'Создание…' : 'Создать релиз'}
          </button>
        </form>
      )}

      {loading ? (
        <div>Загрузка…</div>
      ) : releases.length === 0 ? (
        <div className="empty-state">Релизов пока нет — создайте первый.</div>
      ) : (
        <div className="chart-list">
          {releases.map((release) => (
            <div className="chart-list-item" key={release.id} onClick={() => onOpen(release.id)}>
              <div className="chart-list-title">{releaseDisplayName(release)}</div>
              <div className="chart-list-meta">
                {release.title} · {KIND_OPTIONS.find((k) => k.id === release.kind)?.label ?? release.kind}{' '}
                · {release.item_count} пункт(ов) · создан{' '}
                {new Date(release.created_at).toLocaleDateString('ru-RU')}
              </div>
              <button
                className="chart-delete-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete(release.id)
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
