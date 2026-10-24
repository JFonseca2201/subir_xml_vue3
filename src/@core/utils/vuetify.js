import { cookieRef } from '@layouts/stores/config'

export const resolveVuetifyTheme = defaultTheme => {
  let stored = null
  if (typeof window !== 'undefined') {
    try {
      stored = localStorage.getItem('app_theme') || localStorage.getItem('theme')
    } catch (e) {
      // ignore
    }
  }
  if (!stored) {
    stored = cookieRef('theme', defaultTheme).value
  }
  const resolved = stored || defaultTheme

  const cookieColorScheme = cookieRef('color-scheme', usePreferredDark().value ? 'dark' : 'light')
  
  return resolved === 'system'
    ? cookieColorScheme.value === 'dark'
      ? 'dark'
      : 'light'
    : resolved
}

