export function useApi() {
  const { token } = useAuth()
  const apiBase = useRuntimeConfig().public.apiBase
  return $fetch.create({
    baseURL: apiBase || undefined,
    onRequest({ options }) {
      if (token.value) {
        const headers = new Headers(options.headers)
        headers.set('Authorization', `Bearer ${token.value}`)
        options.headers = headers
      }
    },
    async onResponseError({ response }) {
      if (response.status === 401) {
        const { logout } = useAuth()
        await logout()
      }
    }
  })
}
