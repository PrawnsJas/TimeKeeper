import type { ReactNode } from 'react'

interface Props {
  title: string
  value: string
  description?: string
  children?: ReactNode
}

export default function Card({ title, value, description, children }: Props) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
      <div className="text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">{title}</div>
      <div className="mt-3 text-3xl font-semibold text-slate-900 dark:text-slate-100">{value}</div>
      {description ? <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{description}</p> : null}
      {children}
    </div>
  )
}
