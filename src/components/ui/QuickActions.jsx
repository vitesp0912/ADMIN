import { Link } from 'react-router-dom'

export default function QuickActions({ actions = [] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {actions.map((action, index) => {
        const Icon = action.icon
        const className = `pf-chip justify-start h-10 ${
          index === 0 ? '!bg-brand-500 !text-white !border-transparent hover:!bg-brand-600 dark:!bg-brand-400 dark:!text-ink' : ''
        }`
        const inner = (
          <>
            {Icon && <Icon className="w-4 h-4 shrink-0 opacity-80" />}
            <span className="truncate">{action.label}</span>
          </>
        )
        if (action.href) {
          return (
            <Link key={action.label} to={action.href} className={className} onClick={action.onClick}>
              {inner}
            </Link>
          )
        }
        return (
          <button key={action.label} type="button" className={className} onClick={action.onClick}>
            {inner}
          </button>
        )
      })}
    </div>
  )
}
