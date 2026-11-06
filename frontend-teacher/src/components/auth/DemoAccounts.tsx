// Mock mode only (the form renders this only when VITE_USE_MOCKS is on): the example accounts. Click one to fill the form.
import { MOCK_ACCOUNTS, MOCK_PASSWORD } from '../../auth/accounts'
import type { Role } from '../../types'

export default function DemoAccounts({ role, onPick }: { role: Role; onPick: (userId: string, password: string) => void }) {
  const accounts = MOCK_ACCOUNTS.filter((a) => a.role === role)
  return (
    <section aria-labelledby="demo-h" className="flex flex-col gap-2 rounded-xl border border-dashed border-edge p-4">
      <h2 id="demo-h" className="text-[13px] font-bold uppercase tracking-[.05em] text-muted">
        Demo accounts
      </h2>
      <p className="text-[13px] text-muted">Example data only. Click one to fill the form.</p>
      <div className="flex flex-col gap-2">
        {accounts.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onPick(a.id, MOCK_PASSWORD)}
            className="flex min-h-11 items-center justify-between gap-3 rounded-[10px] border border-edge bg-surface px-3 text-left text-sm hover:border-brand"
          >
            <span>
              <b className="font-bold">{a.name}</b> <span className="text-muted">{a.detail}</span>
            </span>
            <code className="text-[13px] text-muted">{a.id}</code>
          </button>
        ))}
      </div>
    </section>
  )
}
