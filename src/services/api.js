import { useLoaderStore } from '@/stores/loader'

export async function apiFetch(url, options = {}) {
  const loader = useLoaderStore()

  loader.start()

  try {
    const response = await fetch(url, options)

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`)
    }

    return response
  } finally {
    loader.stop()
  }
}
