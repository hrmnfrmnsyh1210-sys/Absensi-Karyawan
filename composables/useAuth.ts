interface User {
  id: number
  nip: string
  email: string
  name: string
  role: 'admin' | 'pegawai'
}

export function useAuth() {
  const token = useCookie<string | null>('auth_token', {
    maxAge: 60 * 60 * 12,
    sameSite: 'lax'
  })
  const user = useState<User | null>('auth_user', () => null)

  function apiBase() {
    return useRuntimeConfig().public.apiBase || ''
  }

  async function login(identifier: string, password: string) {
    const res = await $fetch<{ token: string; user: User }>('/api/auth/login', {
      baseURL: apiBase() || undefined,
      method: 'POST',
      body: { identifier, password }
    })
    token.value = res.token
    user.value = res.user
    return res.user
  }

  async function fetchMe() {
    if (!token.value) return null
    try {
      user.value = await $fetch<User>('/api/me', {
        baseURL: apiBase() || undefined,
        headers: { Authorization: `Bearer ${token.value}` }
      })
      return user.value
    } catch {
      token.value = null
      user.value = null
      return null
    }
  }

  async function logout() {
    token.value = null
    user.value = null
    await navigateTo('/login')
  }

  return { token, user, login, logout, fetchMe }
}
