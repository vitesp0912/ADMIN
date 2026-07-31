export default function EmptyState({ title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      <div className="w-10 h-10 rounded-control border border-line bg-surface-muted mb-4" />
      <p className="text-[14px] font-semibold text-ink">{title}</p>
      {description && (
        <p className="text-[13px] text-ink-secondary mt-1 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
