export default function Spinner() {
  return (
    <div className="flex h-full w-full items-center justify-center py-10">
      <div className="mr-3 h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900 dark:border-slate-700 dark:border-t-slate-100"></div>
      <span className="text-sm text-slate-600 dark:text-slate-300">Loading…</span>
    </div>
  )
}
