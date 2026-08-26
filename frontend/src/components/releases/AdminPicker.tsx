import { addReleaseAdmin, fetchReleaseAdmins } from '../../api'
import NamePicker from './NamePicker'

interface Props {
  value: string
  onChange: (name: string) => void
}

export default function AdminPicker({ value, onChange }: Props) {
  return (
    <NamePicker
      value={value}
      onChange={onChange}
      fetchOptions={fetchReleaseAdmins}
      addOption={addReleaseAdmin}
      emptyLabel="— не выбран —"
      addPlaceholder="Имя нового администратора"
    />
  )
}
