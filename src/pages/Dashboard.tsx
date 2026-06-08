import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import type { DtrRecord, UserProfile } from '../lib/types'
import { calculateWorkHours, formatDate, formatHours, formatMonth, formatTime, getMonthBounds, todayISODate, downloadCsv } from '../lib/helpers'
import Button from '../components/Button'
import Card from '../components/Card'
import ConfirmationDialog from '../components/ConfirmationDialog'
import Spinner from '../components/Spinner'

interface Props {
  profile: UserProfile
  onSignOut: () => void
  onToggleTheme: () => void
  darkMode: boolean
}

const actionLabels = {
  time_in: 'Time In',
  lunch_out: 'Lunch Out',
  lunch_in: 'Lunch In',
  time_out: 'Time Out',
} as const

type AdminUserSummary = {
  user_id: string
  email: string
  totalHours: number
  daysWorked: number
  recordCount: number
}

export default function Dashboard({ profile, onSignOut, onToggleTheme, darkMode }: Props) {
  const isAdmin = profile.role === 'admin'
  const [records, setRecords] = useState<DtrRecord[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [searchDate, setSearchDate] = useState('')
  const [monthFilter, setMonthFilter] = useState(todayISODate().slice(0, 7))
  const [stats, setStats] = useState({ totalHours: 0, daysWorked: 0, averageHours: 0 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [recordFormOpen, setRecordFormOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<DtrRecord | null>(null)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DtrRecord | null>(null)
  const [totalUsers, setTotalUsers] = useState(0)
  const [userSummaries, setUserSummaries] = useState<AdminUserSummary[]>([])

  const pageCount = Math.max(1, Math.ceil(count / pageSize))

  const recordFormInitial = {
    id: '',
    user_id: profile.id,
    date: todayISODate(),
    time_in: '',
    lunch_out: '',
    lunch_in: '',
    time_out: '',
  }

  const [formState, setFormState] = useState(recordFormInitial)

  const searchLabel = searchDate ? `Date ${searchDate}` : `Month ${formatMonth(monthFilter)}`

  useEffect(() => {
    void loadData()
  }, [page, pageSize, searchDate, monthFilter, profile.id, isAdmin])

  useEffect(() => {
    void loadStats()
  }, [searchDate, monthFilter, profile.id, isAdmin])

  const filterQuery = useMemo(() => {
    if (searchDate) {
      return { type: 'date', value: searchDate }
    }
    return { type: 'month', value: monthFilter }
  }, [searchDate, monthFilter])

  async function loadData() {
    setLoading(true)
    setError('')

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    const query = supabase
      .from('dtr')
      .select('*, users(email, role)', { count: 'exact' })
      .order('date', { ascending: false })
      .range(from, to)

    let builder = query
    if (!isAdmin) {
      builder = builder.eq('user_id', profile.id)
    }

    if (filterQuery.type === 'date') {
      builder = builder.eq('date', filterQuery.value)
    } else {
      const { from: start, to: end } = getMonthBounds(filterQuery.value)
      builder = builder.gte('date', start).lte('date', end)
    }

    const { data, error: queryError, count: total } = await builder
    if (queryError) {
      setError(queryError.message)
    } else {
      setRecords((data ?? []) as DtrRecord[])
      setCount(total ?? 0)
    }
    setLoading(false)
  }

  async function loadStats() {
    const query = supabase.from('dtr').select('time_in,time_out,lunch_out,lunch_in')
    let builder = query
    if (!isAdmin) {
      builder = builder.eq('user_id', profile.id)
    }

    if (filterQuery.type === 'date') {
      builder = builder.eq('date', filterQuery.value)
    } else {
      const { from: start, to: end } = getMonthBounds(filterQuery.value)
      builder = builder.gte('date', start).lte('date', end)
    }

    const { data } = await builder
    if (isAdmin) {
      const { count: userCount } = await supabase.from('users').select('id', { count: 'exact', head: true })
      setTotalUsers(userCount ?? 0)

      let summaryBuilder = supabase
        .from('dtr')
        .select('user_id, users(email), time_in, time_out, lunch_out, lunch_in')
        .order('user_id', { ascending: true })
      if (filterQuery.type === 'date') {
        summaryBuilder = summaryBuilder.eq('date', filterQuery.value)
      } else {
        const { from: start, to: end } = getMonthBounds(filterQuery.value)
        summaryBuilder = summaryBuilder.gte('date', start).lte('date', end)
      }

      const { data: summaryData, error: summaryError } = await summaryBuilder
      if (!summaryError) {
        const groups = new Map<string, AdminUserSummary>()
        const summaryRows = (summaryData ?? []) as Array<{
          user_id: string
          users?: { email: string } | Array<{ email: string }>
          time_in: string | null
          time_out: string | null
          lunch_out: string | null
          lunch_in: string | null
        }>
        summaryRows.forEach((entry) => {
          const userId = entry.user_id
          let email = entry.user_id
          if (entry.users) {
            if (Array.isArray(entry.users)) {
              email = entry.users[0]?.email ?? entry.user_id
            } else {
              email = entry.users.email ?? entry.user_id
            }
          }
          const hours = calculateWorkHours(entry as unknown as DtrRecord)
          const summary = groups.get(userId) ?? { user_id: userId, email, totalHours: 0, daysWorked: 0, recordCount: 0 }
          summary.totalHours += hours
          summary.daysWorked += entry.time_in && entry.time_out ? 1 : 0
          summary.recordCount += 1
          groups.set(userId, summary)
        })
        setUserSummaries(Array.from(groups.values()).sort((a, b) => b.totalHours - a.totalHours))
      }
    }
    const values: DtrRecord[] = (data ?? []) as DtrRecord[]
    const totals = values.map(calculateWorkHours)
    const workedDays = values.filter((record) => record.time_in && record.time_out).length
    const totalHours = totals.reduce((sum, value) => sum + value, 0)
    const averageHours = workedDays ? totalHours / workedDays : 0
    setStats({ totalHours, daysWorked: workedDays, averageHours })
  }

  const todayRecord = records.find((record) => record.date === todayISODate())

  const handlePunch = async (field: keyof typeof actionLabels) => {
    const current = new Date().toISOString()
    const today = todayISODate()
    setError('')
    setSuccess('')

    const { data: existingRecord } = await supabase.from('dtr').select('*').eq('user_id', profile.id).eq('date', today).single()
    if (existingRecord && existingRecord[field]) {
      setError(`${actionLabels[field]} has already been recorded for today.`)
      return
    }

    const payload = {
      user_id: profile.id,
      date: today,
      [field]: current,
    }

    const { error: punchError } = await supabase.from('dtr').upsert(payload, {
      onConflict: ['user_id', 'date'].join(','),
    })

    if (punchError) {
      setError(punchError.message)
    } else {
      setSuccess(`${actionLabels[field]} recorded.`)
      await loadData()
      await loadStats()
    }
  }

  const openNewRecordForm = () => {
    setEditingRecord(null)
    setFormState(recordFormInitial)
    setRecordFormOpen(true)
  }

  const openEditRecord = (record: DtrRecord) => {
    const localTime = (value: string | null) => {
      if (!value) return ''
      const date = new Date(value)
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${hours}:${minutes}`
    }

    setEditingRecord(record)
    setFormState({
      id: record.id,
      user_id: record.user_id,
      date: record.date,
      time_in: localTime(record.time_in),
      lunch_out: localTime(record.lunch_out),
      lunch_in: localTime(record.lunch_in),
      time_out: localTime(record.time_out),
    })
    setRecordFormOpen(true)
  }

  const closeForm = () => {
    setRecordFormOpen(false)
    setEditingRecord(null)
    setFormState(recordFormInitial)
    setError('')
    setSuccess('')
  }

  const formatTimestamp = (date: string, time: string) => {
    if (!time) return null
    return `${date}T${time}:00`
  }

  const submitRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    const payload = {
      user_id: profile.id,
      date: formState.date,
      time_in: formatTimestamp(formState.date, formState.time_in),
      lunch_out: formatTimestamp(formState.date, formState.lunch_out),
      lunch_in: formatTimestamp(formState.date, formState.lunch_in),
      time_out: formatTimestamp(formState.date, formState.time_out),
    }

    if (editingRecord) {
      const { error: updateError } = await supabase.from('dtr').update(payload).eq('id', editingRecord.id)
      if (updateError) {
        setError(updateError.message)
      } else {
        setSuccess('Record updated.')
        closeForm()
        await loadData()
        await loadStats()
      }
      return
    }

    const duplicateCheck = await supabase.from('dtr').select('id').eq('user_id', profile.id).eq('date', formState.date).single()
    if (duplicateCheck.data) {
      setError('A record already exists for that date. Edit the existing entry instead.')
      return
    }

    const { error: createError } = await supabase.from('dtr').insert(payload)
    if (createError) {
      setError(createError.message)
    } else {
      setSuccess('Manual record created.')
      closeForm()
      await loadData()
      await loadStats()
    }
  }

  const requestDelete = (record: DtrRecord) => {
    setDeleteTarget(record)
    setConfirmDeleteOpen(true)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    const { error: deleteError } = await supabase.from('dtr').delete().eq('id', deleteTarget.id)
    if (deleteError) {
      setError(deleteError.message)
    } else {
      setSuccess('Record deleted.')
      setConfirmDeleteOpen(false)
      setDeleteTarget(null)
      await loadData()
      await loadStats()
    }
  }

  const exportCsv = () => {
    const rows = [
      ['Date', 'Time In', 'Lunch Out', 'Lunch In', 'Time Out', 'Total Hours', 'User Email'],
      ...records.map((record) => [
        record.date,
        formatTime(record.time_in),
        formatTime(record.lunch_out),
        formatTime(record.lunch_in),
        formatTime(record.time_out),
        formatHours(calculateWorkHours(record)),
        isAdmin ? record.users?.email ?? record.user_id : profile.email,
      ]),
    ]
    downloadCsv(`timekeeper-${filterQuery.type}-${filterQuery.value}.csv`, rows)
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Daily Time Record</p>
            <h1 className="mt-2 text-3xl font-semibold">Welcome back, {profile.email.split('@')[0]}</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{isAdmin ? 'Admin dashboard with full employee access.' : 'Manage your daily punches and review monthly totals.'}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={onToggleTheme}>{darkMode ? 'Light mode' : 'Dark mode'}</Button>
            <Button variant="ghost" onClick={onSignOut}>Logout</Button>
          </div>
        </header>

        <section className="grid gap-4 xl:grid-cols-3">
          <Card title="Total Hours" value={formatHours(stats.totalHours)} description={`Summary for ${searchLabel}`} />
          <Card title="Days Worked" value={`${stats.daysWorked}`} description="Complete punch records counted." />
          <Card title="Average Hours" value={formatHours(stats.averageHours)} description="Average per worked day." />
        </section>

        {isAdmin ? (
          <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
            <div className="grid gap-4 xl:grid-cols-4">
              <Card title="Total Users" value={`${totalUsers}`} description="Active accounts in the system." />
              <Card title="Total Hours" value={formatHours(stats.totalHours)} description="Across the selected period." />
              <Card title="Days Worked" value={`${stats.daysWorked}`} description="Complete attendance records." />
              <Card title="Average Hours" value={formatHours(stats.averageHours)} description="Average daily work hours." />
            </div>
            <div className="mt-8">
              <h2 className="text-xl font-semibold">Per-user attendance summary</h2>
              <div className="mt-4 overflow-x-auto rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <table className="min-w-full text-left text-sm text-slate-700 dark:text-slate-200">
                  <thead>
                    <tr>
                      <th className="px-4 py-3">Employee</th>
                      <th className="px-4 py-3">Hours</th>
                      <th className="px-4 py-3">Days Worked</th>
                      <th className="px-4 py-3">Records</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userSummaries.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                          No summary data available for the selected period.
                        </td>
                      </tr>
                    ) : (
                      userSummaries.map((summary) => (
                        <tr key={summary.user_id} className="border-t border-slate-200 dark:border-slate-800">
                          <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{summary.email}</td>
                          <td className="px-4 py-3">{formatHours(summary.totalHours)}</td>
                          <td className="px-4 py-3">{summary.daysWorked}</td>
                          <td className="px-4 py-3">{summary.recordCount}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ) : null}

        <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Quick Punch Actions</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Record the current timestamp for today.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {(Object.keys(actionLabels) as Array<keyof typeof actionLabels>).map((action) => (
                <Button key={action} variant="secondary" onClick={() => void handlePunch(action)}>
                  {actionLabels[action]}
                </Button>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <label className="block text-sm text-slate-700 dark:text-slate-300">
                Search by date
                <input
                  type="date"
                  value={searchDate}
                  onChange={(event) => {
                    setPage(1)
                    setSearchDate(event.target.value)
                  }}
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500"
                />
              </label>

              <label className="block text-sm text-slate-700 dark:text-slate-300">
                Filter by month
                <input
                  type="month"
                  value={monthFilter}
                  onChange={(event) => {
                    setPage(1)
                    setMonthFilter(event.target.value)
                    setSearchDate('')
                  }}
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500"
                />
              </label>

              <label className="block text-sm text-slate-700 dark:text-slate-300">
                Page size
                <select
                  value={pageSize}
                  onChange={(event) => {
                    setPage(1)
                    setPageSize(Number(event.target.value))
                  }}
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500"
                >
                  {[8, 12, 16, 24].map((size) => (
                    <option key={size} value={size}>{size} rows</option>
                  ))}
                </select>
              </label>

              <div className="flex items-end gap-3">
                <Button variant="primary" onClick={openNewRecordForm}>Add Manual Entry</Button>
                <Button variant="ghost" onClick={exportCsv}>Export CSV</Button>
              </div>
            </div>
          </div>
        </section>

        {error ? <div className="mt-6 rounded-3xl bg-rose-50 p-4 text-sm text-rose-900 dark:bg-rose-950/40 dark:text-rose-200">{error}</div> : null}
        {success ? <div className="mt-6 rounded-3xl bg-emerald-50 p-4 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">{success}</div> : null}

        <section className="mt-6 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950 dark:text-slate-300">
                <tr>
                  <th className="px-5 py-4">Date</th>
                  <th className="px-5 py-4">Time In</th>
                  <th className="px-5 py-4">Lunch Out</th>
                  <th className="px-5 py-4">Lunch In</th>
                  <th className="px-5 py-4">Time Out</th>
                  <th className="px-5 py-4">Total Hours</th>
                  {isAdmin ? <th className="px-5 py-4">Employee</th> : null}
                  <th className="px-5 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={isAdmin ? 8 : 7}>
                      <Spinner />
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 8 : 7} className="px-5 py-8 text-center text-slate-500 dark:text-slate-400">
                      No records found for the selected filter.
                    </td>
                  </tr>
                ) : (
                  records.map((record) => (
                    <tr key={record.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-5 py-4 font-medium text-slate-900 dark:text-slate-100">{record.date}</td>
                      <td className="px-5 py-4">{formatTime(record.time_in)}</td>
                      <td className="px-5 py-4">{formatTime(record.lunch_out)}</td>
                      <td className="px-5 py-4">{formatTime(record.lunch_in)}</td>
                      <td className="px-5 py-4">{formatTime(record.time_out)}</td>
                      <td className="px-5 py-4 font-medium text-slate-900 dark:text-slate-100">{formatHours(calculateWorkHours(record))}</td>
                      {isAdmin ? <td className="px-5 py-4 text-slate-600 dark:text-slate-300">{record.users?.email ?? record.user_id}</td> : null}
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800" onClick={() => openEditRecord(record)}>
                            Edit
                          </button>
                          {(isAdmin || record.user_id === profile.id) && (
                            <button className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 transition hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200 dark:hover:bg-rose-900" onClick={() => requestDelete(record)}>
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 p-4 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <div>
              Showing {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, count)} of {count} records
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" disabled={page === 1} onClick={() => setPage((prev) => Math.max(prev - 1, 1))}>Previous</Button>
              <span>Page {page} of {pageCount}</span>
              <Button variant="secondary" disabled={page === pageCount} onClick={() => setPage((prev) => Math.min(prev + 1, pageCount))}>Next</Button>
            </div>
          </div>
        </section>
      </div>

      {recordFormOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-2xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{editingRecord ? 'Edit Record' : 'Add Manual Record'}</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Use manual entry to correct or add a daily DTR item.</p>
              </div>
              <button onClick={closeForm} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">Close</button>
            </div>

            <form className="mt-6 grid gap-4 sm:grid-cols-2" onSubmit={submitRecord}>
              <label className="block text-sm text-slate-700 dark:text-slate-300">
                Record date
                <input value={formState.date} onChange={(event) => setFormState({ ...formState, date: event.target.value })} type="date" required className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500" />
              </label>
              <label className="block text-sm text-slate-700 dark:text-slate-300">
                Time In
                <input value={formState.time_in} onChange={(event) => setFormState({ ...formState, time_in: event.target.value })} type="time" className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500" />
              </label>
              <label className="block text-sm text-slate-700 dark:text-slate-300">
                Lunch Out
                <input value={formState.lunch_out} onChange={(event) => setFormState({ ...formState, lunch_out: event.target.value })} type="time" className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500" />
              </label>
              <label className="block text-sm text-slate-700 dark:text-slate-300">
                Lunch In
                <input value={formState.lunch_in} onChange={(event) => setFormState({ ...formState, lunch_in: event.target.value })} type="time" className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500" />
              </label>
              <label className="block text-sm text-slate-700 dark:text-slate-300">
                Time Out
                <input value={formState.time_out} onChange={(event) => setFormState({ ...formState, time_out: event.target.value })} type="time" className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500" />
              </label>
              <div className="sm:col-span-2 flex flex-wrap gap-3">
                <Button type="submit" className="mt-1">{editingRecord ? 'Save changes' : 'Save manual record'}</Button>
                <Button variant="ghost" type="button" className="mt-1" onClick={closeForm}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <ConfirmationDialog
        open={confirmDeleteOpen}
        title="Delete DTR record"
        description="This action cannot be undone. Are you sure you want to remove this time record?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </div>
  )
}
