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

  // Panel admin: hanya admin & super admin.
  if (to.path.startsWith('/admin') && user.value.role === 'pegawai') {
    return navigateTo('/')
  }
  // Log aktivitas: khusus super admin.
  if (to.path.startsWith('/admin/log') && user.value.role !== 'super_admin') {
    return navigateTo('/admin')
  }
})
