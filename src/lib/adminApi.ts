export type CreateUserPayload = {
  email: string
  role: 'admin' | 'user'
}

export type ResetPasswordPayload = {
  userId: string
}

export async function createUser(payload: CreateUserPayload) {
  return fetch('/api/create-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function resetUserPassword(payload: ResetPasswordPayload) {
  return fetch('/api/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function listUsers() {
  return fetch('/api/list-users', { method: 'GET' })
}

export async function assignRole(userId: string, role: 'admin' | 'user') {
  return fetch('/api/assign-role', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, role }),
  })
}
