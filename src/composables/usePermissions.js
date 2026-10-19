import { ref, computed } from 'vue'

// Estado reactivo global del usuario autenticado
const userState = ref(null)
let lastRawUser = null

function initUser(force = false) {
  try {
    const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null

    // Si el contenido en localStorage no cambió y ya tenemos estado, evitar reasignar para no romper reactividad
    if (!force && userStr === lastRawUser && userState.value !== null) {
      return
    }

    lastRawUser = userStr
    userState.value = userStr ? JSON.parse(userStr) : null
  } catch (e) {
    console.error('Error parsing user from localStorage:', e)
    userState.value = null
    lastRawUser = null
  }
}

// Inicializar estado al importar el composable
initUser()

// Escuchar cambios de localStorage entre ventanas o eventos del navegador
if (typeof window !== 'undefined') {
  window.addEventListener('storage', () => {
    initUser(true)
  })
}

export function refreshPermissionsUser(userObj = null) {
  if (userObj) {
    try {
      const userStr = JSON.stringify(userObj)
      if (userStr !== lastRawUser) {
        lastRawUser = userStr
        userState.value = userObj
        if (typeof window !== 'undefined') {
          localStorage.setItem('user', userStr)
        }
      }
    } catch (e) {
      userState.value = userObj
    }
  } else {
    initUser()
  }
}

export function usePermissions() {
  const currentUser = computed(() => {
    if (!userState.value) {
      initUser()
    }
    
    return userState.value
  })

  const userRole = computed(() => {
    const user = currentUser.value
    if (!user) return null
    if (typeof user.role === 'string') return user.role
    
    return user.role?.name || null
  })

  const isSuperAdmin = computed(() => {
    const user = currentUser.value
    if (!user) return false
    const roleName = userRole.value
    const roleId = Number(user.role_id || user.role?.id)
    
    return roleName === 'Super-Admin' || roleId === 1
  })

  const userPermissions = computed(() => {
    const user = currentUser.value
    if (!user) return []
    
    // Permisos directos en objeto usuario
    if (Array.isArray(user.permissions) && user.permissions.length > 0) {
      return user.permissions.map(p => typeof p === 'string' ? p : p.name)
    }
    
    // Nombres de permisos en user.role.permissions_pluck
    if (user.role && Array.isArray(user.role.permissions_pluck)) {
      return user.role.permissions_pluck
    }

    // Array de objetos de permiso en user.role.permissions
    if (user.role && Array.isArray(user.role.permissions)) {
      return user.role.permissions.map(p => typeof p === 'string' ? p : p.name)
    }

    return []
  })

  const can = permission => {
    if (isSuperAdmin.value) return true
    if (!permission) return true

    return userPermissions.value.includes(permission)
  }

  const canAny = (permissionsList = []) => {
    if (isSuperAdmin.value) return true
    if (!permissionsList || !permissionsList.length) return true
    
    return permissionsList.some(perm => can(perm))
  }

  const hasRole = roleName => {
    if (isSuperAdmin.value) return true
    
    return userRole.value === roleName
  }

  return {
    currentUser,
    userRole,
    isSuperAdmin,
    userPermissions,
    can,
    canAny,
    hasRole,
    refreshPermissionsUser,
  }
}
