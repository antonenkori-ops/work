import { ReleaseTicketKind } from '../../api'

export const TICKET_KIND_LABELS: Record<ReleaseTicketKind, string> = {
  sprint: 'Спринт (ветка релиза)',
  bundle: 'Бандл',
  rov: 'РоВ',
  other: 'Другое',
}
