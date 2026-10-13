// Owner: Subgroup B (Teacher desktop UI). Purpose: choose office-hour times (two timing options) and max students per slot.
// The backend enforces the max-students limit; the UI only pre-validates for display.
import FormInput from '../../components/teacher/FormInput'

const DEFAULT_MAX_STUDENTS = 3 // TODO: confirm default with the backend team

export default function OfficeHourSettings() {
  return (
    <section>
      <h2 className="mb-4 text-xl font-semibold">Office hour settings</h2>
      <div className="grid max-w-xl grid-cols-2 gap-4">
        <div>Option A times (placeholder)</div>
        <div>Option B times (placeholder)</div>
      </div>
      <div className="mt-6 max-w-xs">
        <FormInput label="Max students per slot" type="number" min={1} defaultValue={DEFAULT_MAX_STUDENTS} />
      </div>
    </section>
  )
}
