import type { ReactNode } from 'react'

export function Card({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-wide text-gray-500 uppercase">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}
