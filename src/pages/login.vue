<script setup>
import { useGenerateImageVariant } from "@/@core/composable/useGenerateImageVariant"
import authV2LoginIllustrationBorderedDark from "@images/pages/auth-v2-login-illustration-bordered-dark.png"
import authV2LoginIllustrationBorderedLight from "@images/pages/auth-v2-login-illustration-bordered-light.png"
import authV2LoginIllustrationDark from "@images/pages/auth-v2-login-illustration-dark.png"
import authV2LoginIllustrationLight from "@images/pages/auth-v2-login-illustration-light.png"
import authV2LoginMaskDark from "@images/pages/auth-v2-login-mask-dark.png"
import authV2LoginMaskLight from "@images/pages/auth-v2-login-mask-light.png"
import { VNodeRenderer } from "@layouts/components/VNodeRenderer"
import { themeConfig } from "@themeConfig"
import { useLoaderStore } from '@/stores/loader'

const route = useRoute()
const router = useRouter()
const isLoading = ref(false)

const form = ref({
  email: "laravest@gmail.com",
  password: "12345678",
  remember: false,
})

const loader = useLoaderStore()
const success_login = ref(null)
const warning_login = ref(null)
const error_login = ref(null)

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

    console.log(resp)
    localStorage.setItem("token", resp.access_token)
    localStorage.setItem("user", JSON.stringify(resp.user))

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

definePage({ meta: { layout: "blank", unauthenticatedOnly: true } })

const isPasswordVisible = ref(false)

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
</script>

<template>
  <div class="auth-page-container">
    <!-- Brand Logo Top Left Flotante -->
    <RouterLink to="/" class="auth-brand-link">
      <div class="auth-logo-badge">
        <VNodeRenderer :nodes="themeConfig.app.logo" />
        <span class="auth-brand-title">
          {{ themeConfig.app.title }}
        </span>
      </div>
    </RouterLink>

    <VRow no-gutters class="auth-wrapper">
      <!-- Columna Izquierda: Showcase Visual Minimalista y Limpio -->
      <VCol md="8" class="d-none d-md-flex align-center justify-center position-relative auth-illustration-wrapper">
        <!-- Ambient Glow Orbs -->
        <div class="auth-glow-orb auth-glow-1" />
        <div class="auth-glow-orb auth-glow-2" />

        <div class="d-flex align-center justify-center pa-10 z-index-1 w-100">
          <img :src="authV2LoginIllustration" class="auth-illustration" alt="Luxury Evys Portal">
        </div>

        <VImg :src="authV2LoginMask" class="d-none d-md-flex auth-footer-mask" alt="auth-mask" />
      </VCol>

      <!-- Columna Derecha: Tarjeta de Acceso -->
      <VCol cols="12" md="4" class="auth-card-v2 d-flex align-center justify-center auth-primary-sidebar">
        <VCard flat :max-width="460" class="mt-12 mt-sm-0 pa-6 pa-lg-8 auth-login-card rounded-2xl text-white w-100">
          <VCardText class="pb-2 text-white text-center text-sm-start">
            <div class="mb-4">
              <h3 class="text-h4 font-weight-bold mb-1 text-white auth-welcome-heading">
                ¡Bienvenido a <span class="auth-highlight-name">{{ themeConfig.app.title }}</span>! 👋🏻
              </h3>
              <p class="text-body-1 text-white opacity-85 mb-0">
                Ingresa tus credenciales para acceder al panel de control
              </p>
            </div>
          </VCardText>

          <VCardText>
            <VForm @submit.prevent="login">
              <VRow>
                <!-- Email -->
                <VCol cols="12">
                  <label class="auth-form-label">CORREO ELECTRÓNICO</label>
                  <VTextField v-model="form.email" autofocus placeholder="ejemplo@luxuryevys.com" bg-color="white"
                    color="primary" variant="solo" density="comfortable" class="auth-input"
                    prepend-inner-icon="ri-mail-line" />
                </VCol>

                <!-- Password -->
                <VCol cols="12">
                  <label class="auth-form-label">CONTRASEÑA</label>
                  <VTextField v-model="form.password" placeholder="············" bg-color="white" color="primary"
                    variant="solo" density="comfortable" class="auth-input" prepend-inner-icon="ri-lock-2-line"
                    :type="isPasswordVisible ? 'text' : 'password'"
                    :append-inner-icon="isPasswordVisible ? 'ri-eye-off-line' : 'ri-eye-line'"
                    @click:append-inner="isPasswordVisible = !isPasswordVisible" />

                  <!-- Remember me & Forgot Password -->
                  <div class="d-flex align-center justify-space-between flex-wrap my-3 gap-x-2">
                    <VCheckbox v-model="form.remember" label="Recordarme" color="white" true-icon="ri-checkbox-fill"
                      false-icon="ri-checkbox-blank-line" hide-details density="compact"
                      class="text-white auth-checkbox" />

                    <a class="auth-forgot-link" href="#">
                      ¿Olvidaste tu contraseña?
                    </a>
                  </div>
                </VCol>

                <!-- Alerts -->
                <VCol v-if="success_login" cols="12">
                  <VAlert type="success" color="success" closable variant="elevated" class="rounded-lg shadow-sm">
                    {{ success_login }}
                  </VAlert>
                </VCol>

                <VCol v-if="error_login" cols="12">
                  <VAlert type="error" color="error" closable variant="elevated" class="rounded-lg shadow-sm">
                    {{ error_login }}
                  </VAlert>
                </VCol>

                <!-- Botón de Ingreso PRO -->
                <VCol cols="12" class="pt-3">
                  <VBtn block size="large" type="submit" class="auth-submit-btn" :loading="loader.loading"
                    :disabled="loader.loading">
                    <VIcon icon="ri-login-box-line" class="me-2" />
                    Iniciar Sesión
                  </VBtn>
                </VCol>

                <!-- Footer Copyright Minimalista -->
                <VCol cols="12" class="text-center mt-6">
                  <div class="text-caption text-white opacity-75 font-weight-medium">
                    © {{ new Date().getFullYear() }} {{ themeConfig.app.title }} • Todos los derechos reservados
                  </div>
                </VCol>
              </VRow>
            </VForm>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>
  </div>
</template>

<style lang="scss">
@use "@core/scss/template/pages/page-auth.scss";
</style>
