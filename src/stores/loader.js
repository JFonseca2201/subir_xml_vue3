import { defineStore } from 'pinia'

export const useLoaderStore = defineStore('loader', {
  state: () => ({
    loading: false,
  }),
  actions: {
    start() {
      this.loading = true
    },
    stop() {
      this.loading = false
    },
  },
})
