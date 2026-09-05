<script setup>
import { ref, computed, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
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
import { refreshPermissionsUser } from '@/composables/usePermissions'
import { $api } from '@/utils/api'

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
  <div class="auth-page-root">
    <!-- Desktop Top Left Brand Badge -->
    <RouterLink
      to="/"
      class="auth-brand-floating d-none d-lg-flex align-center gap-3"
    >
      <div class="brand-logo-container">
        <VNodeRenderer :nodes="themeConfig.app.logo" />
      </div>
      <div class="d-flex flex-column">
        <span class="text-h6 font-weight-bold text-high-emphasis brand-name-text">
          {{ appBrandName }}
        </span>
        <span class="text-caption text-medium-emphasis">
          Gestión Automotriz & Facturación
        </span>
      </div>
    </RouterLink>

    <VRow
      no-gutters
      class="auth-wrapper"
    >
      <!-- LEFT COLUMN: Showcase Visual -->
      <VCol
        lg="8"
        class="d-none d-lg-flex position-relative align-center justify-center auth-showcase-column"
      >
        <div class="auth-showcase-card w-100 ma-8 me-0 d-flex flex-column align-center justify-center position-relative">
          <!-- Floating Feature Badges -->
          <div class="showcase-floating-badge badge-top-right elevation-3">
            <div class="badge-icon-box bg-success-subtle text-success">
              <VIcon icon="ri-shield-check-line" size="20" />
            </div>
            <div>
              <div class="badge-caption">FACTURACIÓN SRI</div>
              <div class="badge-title">XML Homologado 100%</div>
            </div>
          </div>

          <div class="showcase-floating-badge badge-bottom-left elevation-3">
            <div class="badge-icon-box bg-primary-subtle text-primary">
              <VIcon icon="ri-tools-line" size="20" />
            </div>
            <div>
              <div class="badge-caption">CONTROL EN VIVO</div>
              <div class="badge-title">Taller, OTs & Kardex</div>
            </div>
          </div>

          <!-- Central Illustration -->
          <div class="d-flex align-center justify-center pa-6 z-index-2">
            <VImg
              :src="authV2LoginIllustration"
              :max-width="560"
              class="auth-main-illustration"
              alt="Luxury Evys Dashboard"
            />
          </div>

          <!-- Bottom Footer Mask Graphic -->
          <VImg
            :src="authV2LoginMask"
            class="auth-footer-mask"
            alt="mask"
          />
        </div>
      </VCol>

      <!-- RIGHT COLUMN: Login Form Perfectly Centered -->
      <VCol
        cols="12"
        lg="4"
        class="auth-card-v2 d-flex align-center justify-center pa-4 pa-sm-8"
      >
        <VCard
          flat
          :max-width="460"
          class="auth-form-card w-100 pa-6 pa-sm-8 pa-md-10 rounded-2xl elevation-0"
        >
          <!-- Mobile Brand Logo -->
          <div class="d-flex d-lg-none align-center justify-center gap-3 mb-6 text-center">
            <div class="brand-logo-container">
              <VNodeRenderer :nodes="themeConfig.app.logo" />
            </div>
            <h2 class="text-h5 font-weight-bold text-high-emphasis mb-0">
              {{ appBrandName }}
            </h2>
          </div>

          <!-- Welcome Titles -->
          <div class="mb-6">
            <div class="system-status-chip mb-2 d-inline-flex align-center gap-1.5">
              <span class="status-pulse-dot" />
              <span>PLATAFORMA ADMINISTRATIVA</span>
            </div>
            <h1 class="text-h4 font-weight-bold text-high-emphasis mb-1">
              Iniciar <span class="text-primary">Sesión</span>
            </h1>
            <p class="text-body-2 text-medium-emphasis mb-0">
              Ingresa tus credenciales para acceder al sistema
            </p>
          </div>

          <!-- Login Form -->
          <VForm @submit.prevent="login">
            <VRow dense class="gap-y-4">
              <!-- Email Input -->
              <VCol cols="12">
                <div class="form-field-header mb-1">
                  <span class="form-field-label">CORREO ELECTRÓNICO</span>
                </div>
                <VTextField
                  v-model="form.email"
                  autofocus
                  placeholder="ejemplo@luxuryevys.com"
                  variant="outlined"
                  density="comfortable"
                  color="primary"
                  prepend-inner-icon="ri-mail-line"
                  class="rounded-lg"
                />
              </VCol>

              <!-- Password Input -->
              <VCol cols="12">
                <div class="d-flex justify-space-between align-center mb-1">
                  <span class="form-field-label">CONTRASEÑA</span>
                  <a
                    href="#"
                    class="text-caption text-primary font-weight-bold forgot-link"
                    @click.prevent
                  >
                    ¿Olvidaste tu contraseña?
                  </a>
                </div>
                <VTextField
                  v-model="form.password"
                  placeholder="••••••••••••"
                  variant="outlined"
                  density="comfortable"
                  color="primary"
                  prepend-inner-icon="ri-lock-2-line"
                  :type="isPasswordVisible ? 'text' : 'password'"
                  :append-inner-icon="isPasswordVisible ? 'ri-eye-off-line' : 'ri-eye-line'"
                  class="rounded-lg"
                  @click:append-inner="isPasswordVisible = !isPasswordVisible"
                />
              </VCol>

              <!-- Remember Me -->
              <VCol cols="12" class="pt-0">
                <VCheckbox
                  v-model="form.remember"
                  label="Mantener sesión iniciada"
                  color="primary"
                  density="compact"
                  hide-details
                  class="font-weight-medium"
                />
              </VCol>

              <!-- Alerts -->
              <VCol v-if="success_login" cols="12">
                <VAlert
                  type="success"
                  color="success"
                  variant="tonal"
                  closable
                  class="rounded-xl border"
                >
                  {{ success_login }}
                </VAlert>
              </VCol>

              <VCol v-if="error_login" cols="12">
                <VAlert
                  type="error"
                  color="error"
                  variant="tonal"
                  closable
                  class="rounded-xl border"
                >
                  {{ error_login }}
                </VAlert>
              </VCol>

              <!-- Submit Button -->
              <VCol cols="12" class="pt-2">
                <VBtn
                  block
                  size="large"
                  type="submit"
                  color="primary"
                  class="login-submit-button rounded-xl font-weight-bold"
                  :loading="loader.loading"
                  :disabled="loader.loading"
                  prepend-icon="ri-login-box-line"
                >
                  INGRESAR AL SISTEMA
                </VBtn>
              </VCol>

              <!-- Security Footer -->
              <VCol cols="12" class="text-center mt-4">
                <div class="d-inline-flex align-center gap-1.5 text-caption text-medium-emphasis mb-2">
                  <VIcon icon="ri-shield-keyhole-line" size="14" color="success" />
                  <span>Conexión Encriptada SSL de 256 bits</span>
                </div>
                <div class="text-caption text-disabled">
                  © {{ new Date().getFullYear() }} {{ appBrandName }} • Todos los derechos reservados
                </div>
              </VCol>
            </VRow>
          </VForm>
        </VCard>
      </VCol>
    </VRow>
  </div>
</template>

<style lang="scss">
@use "@core/scss/template/pages/page-auth.scss";

.auth-page-root {
  min-height: 100vh;
  position: relative;
  background-color: rgb(var(--v-theme-background));
}

.auth-brand-floating {
  position: absolute;
  top: 2rem;
  left: 2.5rem;
  z-index: 30;
  text-decoration: none;
  padding: 6px 14px;
  border-radius: 14px;
  background-color: rgba(var(--v-theme-surface), 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(var(--v-border-color), 0.12);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
  transition: all 0.25s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(var(--v-theme-primary), 0.15);
    border-color: rgba(var(--v-theme-primary), 0.3);
  }
}

.brand-logo-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, #7367F0 0%, #9E95F5 100%);
  color: #ffffff;
}

.brand-name-text {
  letter-spacing: -0.02em;
}

.auth-showcase-column {
  min-height: 100vh;
}

.auth-showcase-card {
  min-height: calc(100vh - 4rem);
  background: linear-gradient(135deg, rgba(var(--v-theme-primary), 0.06) 0%, rgba(var(--v-theme-primary), 0.02) 100%);
  border-radius: 28px;
  border: 1px solid rgba(var(--v-theme-primary), 0.1);
  overflow: hidden;
}

.auth-main-illustration {
  transition: transform 0.4s ease;
  filter: drop-shadow(0 15px 30px rgba(0, 0, 0, 0.08));

  &:hover {
    transform: translateY(-4px) scale(1.01);
  }
}

.showcase-floating-badge {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 18px;
  background-color: rgb(var(--v-theme-surface));
  border-radius: 16px;
  border: 1px solid rgba(var(--v-border-color), 0.12);
  z-index: 10;
  transition: transform 0.3s ease;

  &:hover {
    transform: translateY(-3px);
  }

  &.badge-top-right {
    top: 10%;
    right: 8%;
  }

  &.badge-bottom-left {
    bottom: 10%;
    left: 8%;
  }

  .badge-icon-box {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;

    &.bg-success-subtle {
      background-color: rgba(40, 199, 111, 0.12);
    }
    &.bg-primary-subtle {
      background-color: rgba(115, 103, 240, 0.12);
    }
  }

  .badge-caption {
    font-size: 0.68rem;
    font-weight: 800;
    color: rgb(var(--v-theme-on-surface));
    opacity: 0.6;
    letter-spacing: 0.05em;
  }

  .badge-title {
    font-size: 0.85rem;
    font-weight: 700;
    color: rgb(var(--v-theme-on-surface));
  }
}

.auth-card-v2 {
  min-height: 100vh;
  background-color: rgb(var(--v-theme-surface));
  border-left: 1px solid rgba(var(--v-border-color), 0.08);
}

.auth-form-card {
  background-color: transparent !important;
}

.system-status-chip {
  padding: 3px 10px;
  background-color: rgba(var(--v-theme-primary), 0.1);
  border-radius: 9999px;
  color: rgb(var(--v-theme-primary));
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.04em;

  .status-pulse-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: #28C76F;
    box-shadow: 0 0 6px #28C76F;
    animation: pulse-badge 2s infinite;
  }
}

@keyframes pulse-badge {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.85); }
}

.form-field-header {
  display: flex;
  align-items: center;
}

.form-field-label {
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: rgb(var(--v-theme-on-surface));
  opacity: 0.75;
}

.forgot-link {
  text-decoration: none;
  transition: opacity 0.2s ease;

  &:hover {
    text-decoration: underline;
    opacity: 0.85;
  }
}

.login-submit-button {
  height: 48px !important;
  font-size: 0.92rem !important;
  letter-spacing: 0.04em !important;
  box-shadow: 0 6px 18px rgba(115, 103, 240, 0.35) !important;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 24px rgba(115, 103, 240, 0.45) !important;
  }
}
</style>
