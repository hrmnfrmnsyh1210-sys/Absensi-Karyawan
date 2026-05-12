export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/login') return

  const { token, user, fetchMe } = useAuth()
  if (!token.value) {
    return navigateTo('/login')
  }
  if (!user.value) {
    await fetchMe()
  }
  if (!user.value) {
    return navigateTo('/login')
  }

  if (to.path.startsWith('/admin') && user.value.role !== 'admin') {
    return navigateTo('/')
  }
})
