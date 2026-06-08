import type { DtrRecord } from './types'

export function formatDate(value: string | null): string {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(value))
}

export function formatTime(value: string | null): string {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-US', { timeStyle: 'short' }).format(new Date(value))
}

export function formatHours(hours: number): string {
  return `${hours.toFixed(2)} h`
}

export function calculateWorkHours(record: DtrRecord): number {
  if (!record.time_in || !record.time_out) {
    return 0
  }

  const start = new Date(record.time_in).getTime()
  const end = new Date(record.time_out).getTime()
  if (end <= start) {
    return 0
  }

  let total = (end - start) / 1000 / 3600

  if (record.lunch_out && record.lunch_in) {
    const lunchOut = new Date(record.lunch_out).getTime()
    const lunchIn = new Date(record.lunch_in).getTime()
    if (lunchIn > lunchOut) {
      total -= (lunchIn - lunchOut) / 1000 / 3600
    }
  }

  return Math.max(0, total)
}

export function formatMonth(value: string): string {
  const date = new Date(value + '-01')
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date)
}

export function todayISODate(): string {
  return new Date().toISOString().slice(0, 10)
}

export function getMonthBounds(monthKey: string): { from: string; to: string } {
  const [year, month] = monthKey.split('-').map(Number)
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0)
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  }
}

export function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
