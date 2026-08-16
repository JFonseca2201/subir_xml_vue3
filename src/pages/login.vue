<script setup>
import { useGenerateImageVariant } from "@/@core/composable/useGenerateImageVariant"
import AuthProvider from "@/views/pages/authentication/AuthProvider.vue"
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
    <RouterLink to="/">
      <div class="app-logo auth-logo">
        <VNodeRenderer :nodes="themeConfig.app.logo" />
        <h1 class="app-logo-title">
          {{ themeConfig.app.title }}
        </h1>
      </div>
    </RouterLink>

    <VRow no-gutters class="auth-wrapper">
      <!-- Columna Izquierda con Ilustración y Fondo Tonal Primary -->
      <VCol md="8" class="d-none d-md-flex align-center justify-center position-relative auth-illustration-wrapper">
        <div class="d-flex align-center justify-center pa-10">
          <img :src="authV2LoginIllustration" class="auth-illustration w-100" alt="auth-illustration">
        </div>
        <VImg :src="authV2LoginMask" class="d-none d-md-flex auth-footer-mask" alt="auth-mask" />
      </VCol>

      <!-- Columna Derecha: Tarjeta de Inicio de Sesión con Fondo Primary igual a la barra lateral -->
      <VCol cols="12" md="4" class="auth-card-v2 d-flex align-center justify-center auth-primary-sidebar">
        <VCard flat :max-width="480" class="mt-12 mt-sm-0 pa-6 pa-lg-8 auth-login-card rounded-xl text-white">
          <VCardText class="pb-2 text-white">
            <div class="mb-2">

              <h3 class="text-h4 font-weight-bold mb-1 text-white">
                Bienvenido a
                <span class="text-capitalize text-white">{{ themeConfig.app.title }}! 👋🏻</span>
              </h3>
              <p class="text-body-1 text-white opacity-85 mb-0">
                Inicia sesión con tus credenciales para acceder al sistema
              </p>
            </div>
          </VCardText>

          <VCardText>
            <VForm @submit.prevent="login">
              <VRow>
                <!-- Email -->
                <VCol cols="12">
                  <label class="text-caption font-weight-bold text-white mb-1 d-block">CORREO ELECTRÓNICO</label>
                  <VTextField v-model="form.email" autofocus placeholder="usuario@correo.com" bg-color="white"
                    color="primary" variant="solo" density="comfortable" class="auth-input rounded-lg"
                    prepend-inner-icon="ri-mail-line" />
                </VCol>

                <!-- Password -->
                <VCol cols="12">
                  <label class="text-caption font-weight-bold text-white mb-1 d-block">CONTRASEÑA</label>
                  <VTextField v-model="form.password" placeholder="············" bg-color="white" color="primary"
                    variant="solo" density="comfortable" class="auth-input rounded-lg" prepend-inner-icon="ri-lock-line"
                    :type="isPasswordVisible ? 'text' : 'password'"
                    :append-inner-icon="isPasswordVisible ? 'ri-eye-off-line' : 'ri-eye-line'"
                    @click:append-inner="isPasswordVisible = !isPasswordVisible" />

                  <!-- Remember me checkbox & forgot password -->
                  <div class="d-flex align-center justify-space-between flex-wrap my-4 gap-x-2">
                    <VCheckbox v-model="form.remember" label="Recordarme" color="white"
                      class="text-white auth-checkbox" />

                    <a class="text-white text-decoration-underline font-weight-medium text-body-2" href="#"> ¿Olvidaste
                      tu contraseña? </a>
                  </div>
                </VCol>

                <VCol v-if="success_login" cols="12">
                  <VAlert type="success" color="success" closable="" variant="elevated">
                    {{ success_login }}
                  </VAlert>
                </VCol>

                <VCol v-if="error_login" cols="12">
                  <VAlert type="error" color="error" closable="" variant="elevated">
                    {{ error_login }}
                  </VAlert>
                </VCol>

                <VCol cols="12">
                  <!-- Botón de Ingreso Blanco con Texto Púrpura -->
                  <VBtn block size="large" type="submit" class="auth-submit-btn" :loading="loader.loading"
                    :disabled="loader.loading">
                    Iniciar Sesión
                  </VBtn>
                </VCol>

                <!-- Create account -->
                <VCol cols="12" class="text-body-1 text-center mt-2 text-white">
                  <span class="opacity-85"> ¿No tienes una cuenta? </span>
                  <a class="text-white font-weight-bold ms-1 text-decoration-underline" href="#">
                    Crear una cuenta
                  </a>
                </VCol>

                <VCol cols="12" class="d-flex align-center my-2">
                  <VDivider color="white" />
                  <span class="mx-4 text-caption text-white opacity-85 text-uppercase">o continuar con</span>
                  <VDivider color="white" />
                </VCol>

                <!-- Auth providers -->
                <VCol cols="12" class="text-center auth-providers-container">
                  <AuthProvider />
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
