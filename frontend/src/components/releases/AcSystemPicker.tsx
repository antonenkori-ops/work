import { addAcSystem, fetchAcSystems } from '../../api'
import NamePicker from './NamePicker'

interface Props {
  value: string
  onChange: (name: string) => void
}

export default function AcSystemPicker({ value, onChange }: Props) {
  return (
    <NamePicker
      value={value}
      onChange={onChange}
      fetchOptions={fetchAcSystems}
      addOption={addAcSystem}
      emptyLabel="— не выбрана —"
      addPlaceholder="Название АС"
    />
  )
}
