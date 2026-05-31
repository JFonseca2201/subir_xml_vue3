import { setupLayouts } from "virtual:generated-layouts"
import { createRouter, createWebHistory } from "vue-router/auto"
import { setupGuards } from "./guards"

function recursiveLayouts(route) {
  if (route.children) {
    for (let i = 0; i < route.children.length; i++)
      route.children[i] = recursiveLayouts(route.children[i])

    return route
  }

  return setupLayouts([route])[0]
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior(to) {
    if (to.hash) return { el: to.hash, behavior: "smooth", top: 60 }

    return { top: 0 }
  },
  extendRoutes: pages => [
    ...[
      {
        path: "/",
        name: "index",
        redirect: to => {
          // TODO: Get type from backend
          const userData = localStorage.getItem("user")
          if (userData) return { name: "dashboard" }

          return { name: "login", query: to.query }
        },
      },
    ],
    ...[
      ...pages,
      ...[
        {
          path: "/roles-y-permisos",
          name: "roles-permisos",
          component: () => import("@/pages/roles-permisos/index.vue"),
        },
        {
          path: "/finanzas/tesoreria",
          name: "accounts-index",
          component: () => import("@/pages/accounts/index.vue"),
        },
        {
          path: "/finanzas/operaciones",
          name: "operations-index",
          component: () => import("@/pages/operations/index.vue"),
        },
        {
          path: "/finanzas/aportes",
          name: "aportes-index",
          component: () => import("@/pages/aportes/index.vue"),
          meta: { navActiveLink: 'operations-index' }
        },
        {
          path: "/finanzas/movimientos",
          name: "movements-index",
          component: () => import("@/pages/movements/index.vue"),
          meta: { navActiveLink: 'operations-index' }
        },
        {
          path: "/work-orders",
          name: "work-orders-list",
          component: () => import("@/pages/work-orders/list.vue"),
        },
        {
          path: "/configuration/unit-convertion",
          name: "configuration-unit-convertion",
          component: () => import("@/pages/configuration/unitconversions.vue"),
        },
      ],
    ].map(route => {
      // Forzar navActiveLink para subpáginas de operaciones
      const opsPaths = ['/finanzas/employee-expenses', '/finanzas/aportes', '/finanzas/movimientos', '/transfers']
      const opsNames = ['finanzas-employee-expenses', 'employee-expenses', 'transfers', 'transfers-index', 'aportes-index', 'movements-index']

      if (opsNames.includes(route.name) || opsPaths.includes(route.path)) {
        route.meta = { ...route.meta, navActiveLink: 'operations-index' }
      }
      return recursiveLayouts(route)
    }),
  ],
})

setupGuards(router)

export { router }
export default function (app) {
  app.use(router)
}
