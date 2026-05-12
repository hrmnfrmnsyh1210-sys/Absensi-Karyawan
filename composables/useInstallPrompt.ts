interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export function useInstallPrompt() {
  const deferred = useState<BeforeInstallPromptEvent | null>('pwa_install_event', () => null)
  const installable = computed(() => deferred.value !== null)
  const installed = useState<boolean>('pwa_installed', () => false)

  function setup() {
    if (!import.meta.client) return
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // @ts-expect-error iOS Safari quirk
      window.navigator.standalone === true
    if (isStandalone) {
      installed.value = true
      return
    }
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault()
      deferred.value = e as BeforeInstallPromptEvent
    })
    window.addEventListener('appinstalled', () => {
      deferred.value = null
      installed.value = true
    })
  }

  async function promptInstall() {
    if (!deferred.value) return false
    await deferred.value.prompt()
    const choice = await deferred.value.userChoice
    deferred.value = null
    return choice.outcome === 'accepted'
  }

  return { installable, installed, promptInstall, setup }
}
