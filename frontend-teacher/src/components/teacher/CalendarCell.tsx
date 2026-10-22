// Owner: Subgroup B (Teacher desktop UI). One day cell in the teacher calendar.
interface CalendarCellProps {
  day: number
  bookings?: number
  isDayOff?: boolean
}

export default function CalendarCell({ day, bookings = 0, isDayOff = false }: CalendarCellProps) {
  return (
    <div className={`h-24 border p-1 text-xs ${isDayOff ? 'bg-gray-100 text-gray-400' : 'bg-white'}`}>
      <div className="font-medium">{day}</div>
      {bookings > 0 && <div className="mt-1 rounded bg-indigo-100 px-1">{bookings} booked</div>}
    </div>
  )
}
