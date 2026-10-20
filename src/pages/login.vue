<script setup>
import { ref, computed, nextTick, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGenerateImageVariant } from "@/@core/composable/useGenerateImageVariant"
import authV2LoginIllustrationBorderedDark from "@images/pages/auth-v2-login-illustration-bordered-dark.png"
import authV2LoginIllustrationBorderedLight from "@images/pages/auth-v2-login-illustration-bordered-light.png"
import authV2LoginIllustrationDark from "@images/pages/auth-v2-login-illustration-dark.png"
import authV2LoginIllustrationLight from "@images/pages/auth-v2-login-illustration-light.png"
import authV2LoginIllustrationMechanic from "@images/pages/auth-v2-login-illustration-mechanic.jpg"
import authV2LoginMaskDark from "@images/pages/auth-v2-login-mask-dark.png"
import authV2LoginMaskLight from "@images/pages/auth-v2-login-mask-light.png"
import { VNodeRenderer } from "@layouts/components/VNodeRenderer"
import { themeConfig } from "@themeConfig"
import { useLoaderStore } from '@/stores/loader'
import { refreshPermissionsUser } from '@/composables/usePermissions'
import { $api, getStorageUrl } from '@/utils/api'

definePage({ meta: { layout: "blank", unauthenticatedOnly: true } })

const route = useRoute()
const router = useRouter()

const form = ref({
  email: "laravest@gmail.com",
  password: "12345678",
  remember: true,
})

const loader = useLoaderStore()
const success_login = ref(null)
const warning_login = ref(null)
const error_login = ref(null)

const isPasswordVisible = ref(false)

const loginBgUrl = ref(localStorage.getItem('login_background') || '')

const loadPublicSucursal = async () => {
  try {
    const resp = await $api('public/sucursal')
    if (resp?.sucursal?.login_background) {
      const fullUrl = getStorageUrl(resp.sucursal.login_background)

      loginBgUrl.value = fullUrl
      localStorage.setItem('login_background', fullUrl)
    } else if (resp?.sucursal) {
      loginBgUrl.value = ''
      localStorage.removeItem('login_background')
    }
  } catch (e) {
    console.warn('No se pudo cargar fondo de login de sucursal:', e)
  }
}

onMounted(() => {
  loadPublicSucursal()
})

const loginBgRootStyle = computed(() => {
  if (loginBgUrl.value) {
    return {
      backgroundImage: `url(${loginBgUrl.value})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center center',
      backgroundRepeat: 'no-repeat',
      backgroundAttachment: 'fixed',
    }
  }

  return {}
})


const login = async () => {
  loader.start()

  success_login.value = null
  warning_login.value = null
  error_login.value = null
  try {
    const resp = await $api("auth/login", {
      method: 'POST',
      body: {
        email: form.value.email,
        password: form.value.password,
      },
      onResponseError({ response }) {
        console.log(response)
        error_login.value = 'Error al ingresar credenciales. Verifique usuario y contraseña.'
      },
    })

    localStorage.setItem("token", resp.access_token)
    refreshPermissionsUser(resp.user)

    setTimeout(async () => {
      await nextTick(() => {
        router.replace(route.query.to ? String(route.query.to) : '/')
      })
    }, 200)

  } catch (error) {
    console.error('Error al iniciar sesión:', error)
    if (!error_login.value) {
      error_login.value = error.response?._data?.message || 'Error de conexión con el servidor.'
    }
  } finally {
    loader.stop()
  }
}

const authV2LoginMask = useGenerateImageVariant(
  authV2LoginMaskLight,
  authV2LoginMaskDark,
)

const authV2LoginIllustration = useGenerateImageVariant(
  authV2LoginIllustrationLight,
  authV2LoginIllustrationDark,
  authV2LoginIllustrationBorderedLight,
  authV2LoginIllustrationBorderedDark,
  true,
)

const appBrandName = computed(() => {
  const raw = themeConfig.app?.title || 'LUXURY EVYS'
  if (raw.toUpperCase().includes('LUXURY EVYS')) return 'LUXURY EVYS'

  return raw.length > 24 ? raw.substring(0, 22) + '...' : raw
})
</script>

<template>
  <div class="auth-page-root" :style="loginBgRootStyle">
    <!-- Desktop Top Left Brand Badge -->
    <RouterLink to="/" class="auth-brand-floating d-none d-lg-flex align-center gap-3">
      <div class="brand-logo-container">
        <VNodeRenderer :nodes="themeConfig.app.logo" />
      </div>
      <div class="d-flex flex-column">
        <span class="text-h6 font-weight-bold brand-name-text">
          {{ appBrandName }}
        </span>
        <span class="text-caption auth-brand-subtitle">
          Gestión Automotriz & Facturación
        </span>
      </div>
    </RouterLink>


    <VRow no-gutters class="auth-wrapper">
      <!-- LEFT COLUMN: Open space allowing full-screen background image to be visible -->
      <VCol lg="7" xl="8" class="d-none d-lg-flex position-relative align-center justify-center" />

      <!-- RIGHT COLUMN: Container for Icons & Text Fields -->
      <VCol cols="12" lg="5" xl="4" class="auth-primary-sidebar d-flex align-center justify-center pa-4 pa-sm-8">
        <!-- Ambient Glow Orbs en el Sidebar -->
        <div class="sidebar-glow-orb orb-1" />
        <div class="sidebar-glow-orb orb-2" />

        <div class="auth-form-container w-100 pa-6 pa-sm-8 pa-md-10 z-index-2">
          <!-- Mobile Brand Logo -->
          <div class="d-flex d-lg-none align-center justify-center gap-3 mb-6 text-center">
            <div class="brand-logo-container-mobile">
              <VNodeRenderer :nodes="themeConfig.app.logo" />
            </div>
            <h2 class="text-h5 font-weight-bold auth-title mb-0">
              {{ appBrandName }}
            </h2>
          </div>

          <!-- Welcome Titles -->
          <div class="mb-6 text-center text-sm-start">
            <h1 class="text-h4 font-weight-black auth-title mb-1">
              Ingreso al Sistema
            </h1>
            <p class="text-body-2 auth-subtitle mb-0">
              Ingresa tus credenciales para acceder al sistema
            </p>
          </div>

          <!-- Login Form -->
          <VForm @submit.prevent="login">
            <VRow dense class="gap-y-4">
              <!-- Email Input -->
              <VCol cols="12">
                <div class="form-field-header mb-1.5">
                  <span class="auth-field-label">
                    <VIcon icon="ri-mail-line" size="14" class="me-1" />
                    CORREO ELECTRÓNICO
                  </span>
                </div>
                <VTextField v-model="form.email" autofocus placeholder="ejemplo@luxuryevys.com" variant="solo"
                  density="comfortable" prepend-inner-icon="ri-user-3-line" class="auth-input rounded-xl"
                  hide-details="auto" />
              </VCol>

              <!-- Password Input -->
              <VCol cols="12">
                <div class="d-flex justify-space-between align-center mb-1.5">
                  <span class="auth-field-label">
                    <VIcon icon="ri-lock-2-line" size="14" class="me-1" />
                    CONTRASEÑA
                  </span>
                  <a href="#" class="text-caption auth-forgot-link" @click.prevent>
                    ¿Olvidaste tu contraseña?
                  </a>
                </div>
                <VTextField v-model="form.password" placeholder="••••••••••••" variant="solo" density="comfortable"
                  prepend-inner-icon="ri-key-2-line" :type="isPasswordVisible ? 'text' : 'password'"
                  :append-inner-icon="isPasswordVisible ? 'ri-eye-off-line' : 'ri-eye-line'"
                  class="auth-input rounded-xl" hide-details="auto"
                  @click:append-inner="isPasswordVisible = !isPasswordVisible" />
              </VCol>

              <!-- Remember Me -->
              <VCol cols="12" class="pt-1">
                <VCheckbox v-model="form.remember" label="Mantener sesión iniciada" color="primary"
                  true-icon="ri-checkbox-fill" false-icon="ri-checkbox-blank-line" density="compact" hide-details
                  class="auth-checkbox" />
              </VCol>

              <!-- Alerts -->
              <VCol v-if="success_login" cols="12">
                <VAlert type="success" color="success" variant="elevated" closable
                  class="rounded-xl shadow-sm text-white">
                  {{ success_login }}
                </VAlert>
              </VCol>

              <VCol v-if="error_login" cols="12">
                <VAlert type="error" color="error" variant="elevated" closable class="rounded-xl shadow-sm text-white">
                  {{ error_login }}
                </VAlert>
              </VCol>

              <!-- Submit Button -->
              <VCol cols="12" class="pt-3">
                <VBtn block size="x-large" type="submit" class="auth-submit-btn rounded-xl" :loading="loader.loading"
                  :disabled="loader.loading">
                  <span>INGRESAR AL SISTEMA</span>
                  <VIcon icon="ri-arrow-right-line" class="ms-2" />
                </VBtn>
              </VCol>

              <!-- Security Footer -->
              <VCol cols="12" class="text-center mt-5">
                <div class="d-inline-flex align-center gap-1.5 text-caption auth-footer-text mb-1 font-weight-medium">
                  <VIcon icon="ri-shield-keyhole-line" size="14" />
                  <span>Conexión Encriptada SSL de 256 bits</span>
                </div>
                <div class="text-caption auth-footer-text opacity-75">
                  © {{ new Date().getFullYear() }} {{ appBrandName }} • Todos los derechos reservados
                </div>
              </VCol>
            </VRow>
          </VForm>
        </div>
      </VCol>
    </VRow>
  </div>
</template>
