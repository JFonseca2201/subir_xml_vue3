import { usePermissions } from "@/composables/usePermissions"

export const setupGuards = router => {
  // 👉 router.beforeEach
  // Docs: https://router.vuejs.org/guide/advanced/navigation-guards.html#global-before-guards
  router.beforeEach(to => {
    /*
     * If it's a public route, continue navigation.
     */
    if (to.meta.public) return

    /**
     * Check if user is logged in by checking if token & user data exists in local storage
     */
    const isLoggedIn = !!(
      localStorage.getItem("user") && localStorage.getItem("token")
    )

    if (to.meta.unauthenticatedOnly) {
      if (isLoggedIn) return "/"
      else return undefined
    }
    if (!isLoggedIn && to.matched.length) {
      return {
        name: "login",
        query: {
          ...to.query,
          to: to.fullPath !== "/" ? to.path : undefined,
        },
      }
    }

    // Check permissions if required by route metadata
    if (isLoggedIn && (to.meta.permission || to.meta.permissions)) {
      const { can, canAny } = usePermissions()
      if (to.meta.permission && !can(to.meta.permission)) {
        return { name: "dashboard" }
      }
      if (to.meta.permissions && !canAny(to.meta.permissions)) {
        return { name: "dashboard" }
      }
    }
  })
}
