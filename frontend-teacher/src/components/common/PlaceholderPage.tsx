// Shared: temporary. Used by screens that are not built yet; delete when the last placeholder is replaced.
import PageHeader from './PageHeader'

export default function PlaceholderPage({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <section className="min-w-0 rounded-2xl border border-line bg-surface p-[18px] min-[900px]:p-6">
        <p className="text-muted">This screen is not built yet. It arrives in a later phase of the port.</p>
      </section>
    </>
  )
}
