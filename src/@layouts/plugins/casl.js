import { getCurrentInstance } from 'vue'
import { usePermissions } from '@/composables/usePermissions'

/**
 * Returns ability/permission result for menu item rendering
 *
 * @param {string} action CASL Action or string
 * @param {string} subject CASL Subject
 * @param {string} permission Direct permission name
 * @param {Array<string>} permissions Array of permission names for headings/groups
 */
export const can = (action, subject, permission, permissions) => {
  const { can: checkPerm, canAny } = usePermissions()

  if (permissions && Array.isArray(permissions)) {
    return canAny(permissions)
  }

  if (permission) {
    return checkPerm(permission)
  }

  if (action && typeof action === 'string' && !subject) {
    return checkPerm(action)
  }

  const vm = getCurrentInstance()
  if (!vm) return true
  const localCan = vm.proxy && '$can' in vm.proxy

  return localCan ? vm.proxy?.$can(action, subject) : true
}

/**
 * Check if user can view menu group item based on permission & children visibility
 *
 * @param {object} item navigation object item
 */
export const canViewNavMenuGroup = item => {
  const { can: checkPerm, canAny } = usePermissions()

  if (item.permissions && Array.isArray(item.permissions)) {
    if (!canAny(item.permissions)) return false
  }

  if (item.permission && !checkPerm(item.permission)) {
    return false
  }

  if (item.children && Array.isArray(item.children)) {
    const hasAnyVisibleChild = item.children.some(i => {
      if (i.permission) return checkPerm(i.permission)
      return can(i.action, i.subject, i.permission, i.permissions)
    })

    if (!hasAnyVisibleChild) return false
  }

  if (!(item.action && item.subject)) {
    return true
  }

  return can(item.action, item.subject, item.permission, item.permissions)
}

export const canNavigate = to => {
  const { can: checkPerm } = usePermissions()
  if (to.meta && to.meta.permission) {
    return checkPerm(to.meta.permission)
  }
  return true
}
