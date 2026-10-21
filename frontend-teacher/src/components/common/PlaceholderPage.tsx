// Shared: temporary. Used by the Student screens that are not built yet; delete when the last placeholder is replaced.
import Card from './Card'
import PageHeader from './PageHeader'

export default function PlaceholderPage({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <Card>
        <p className="text-muted">This screen is not built yet. It arrives in a later phase of the port.</p>
      </Card>
    </>
  )
}
