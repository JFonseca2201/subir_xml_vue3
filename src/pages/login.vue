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
          <div class="showcase-floating-badge badge-top-right elevation-4">
            <div class="badge-icon-box bg-success-subtle text-success">
              <VIcon icon="ri-shield-check-line" size="22" />
            </div>
            <div>
              <div class="badge-caption">FACTURACIÓN SRI</div>
              <div class="badge-title">XML Homologado 100%</div>
            </div>
          </div>

          <div class="showcase-floating-badge badge-bottom-left elevation-4">
            <div class="badge-icon-box bg-primary-subtle text-primary">
              <VIcon icon="ri-tools-line" size="22" />
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

      <!-- RIGHT COLUMN: Colorido con Fondo Color Primary -->
      <VCol
        cols="12"
        lg="4"
        class="auth-primary-sidebar d-flex align-center justify-center pa-4 pa-sm-8"
      >
        <!-- Ambient Glow Orbs en el Sidebar -->
        <div class="sidebar-glow-orb orb-1" />
        <div class="sidebar-glow-orb orb-2" />

        <div class="auth-form-container w-100 pa-6 pa-sm-8 pa-md-10 text-white z-index-2">
          <!-- Mobile Brand Logo -->
          <div class="d-flex d-lg-none align-center justify-center gap-3 mb-6 text-center">
            <div class="brand-logo-container-mobile">
              <VNodeRenderer :nodes="themeConfig.app.logo" />
            </div>
            <h2 class="text-h5 font-weight-bold text-white mb-0">
              {{ appBrandName }}
            </h2>
          </div>

          <!-- Welcome Titles -->
          <div class="mb-6 text-center text-sm-start">
            <div class="system-status-chip-white mb-2 d-inline-flex align-center gap-1.5">
              <span class="status-pulse-dot" />
              <span>PLATAFORMA ADMINISTRATIVA</span>
            </div>
            <h1 class="text-h4 font-weight-black text-white mb-1">
              Iniciar Sesión
            </h1>
            <p class="text-body-2 text-white opacity-90 mb-0">
              Ingresa tus credenciales para acceder al sistema
            </p>
          </div>

          <!-- Login Form -->
          <VForm @submit.prevent="login">
            <VRow dense class="gap-y-4">
              <!-- Email Input -->
              <VCol cols="12">
                <div class="form-field-header mb-1.5">
                  <span class="form-field-label-white">
                    <VIcon icon="ri-mail-line" size="14" class="me-1" />
                    CORREO ELECTRÓNICO
                  </span>
                </div>
                <VTextField
                  v-model="form.email"
                  autofocus
                  placeholder="ejemplo@luxuryevys.com"
                  bg-color="white"
                  color="primary"
                  variant="solo"
                  density="comfortable"
                  prepend-inner-icon="ri-user-3-line"
                  class="auth-input-white rounded-xl"
                  hide-details="auto"
                />
              </VCol>

              <!-- Password Input -->
              <VCol cols="12">
                <div class="d-flex justify-space-between align-center mb-1.5">
                  <span class="form-field-label-white">
                    <VIcon icon="ri-lock-2-line" size="14" class="me-1" />
                    CONTRASEÑA
                  </span>
                  <a
                    href="#"
                    class="text-caption text-white font-weight-bold forgot-link-white"
                    @click.prevent
                  >
                    ¿Olvidaste tu contraseña?
                  </a>
                </div>
                <VTextField
                  v-model="form.password"
                  placeholder="••••••••••••"
                  bg-color="white"
                  color="primary"
                  variant="solo"
                  density="comfortable"
                  prepend-inner-icon="ri-key-2-line"
                  :type="isPasswordVisible ? 'text' : 'password'"
                  :append-inner-icon="isPasswordVisible ? 'ri-eye-off-line' : 'ri-eye-line'"
                  class="auth-input-white rounded-xl"
                  hide-details="auto"
                  @click:append-inner="isPasswordVisible = !isPasswordVisible"
                />
              </VCol>

              <!-- Remember Me -->
              <VCol cols="12" class="pt-1">
                <VCheckbox
                  v-model="form.remember"
                  label="Mantener sesión iniciada"
                  color="white"
                  density="compact"
                  hide-details
                  class="auth-checkbox-white"
                />
              </VCol>

              <!-- Alerts -->
              <VCol v-if="success_login" cols="12">
                <VAlert
                  type="success"
                  color="success"
                  variant="elevated"
                  closable
                  class="rounded-xl shadow-sm text-white"
                >
                  {{ success_login }}
                </VAlert>
              </VCol>

              <VCol v-if="error_login" cols="12">
                <VAlert
                  type="error"
                  color="error"
                  variant="elevated"
                  closable
                  class="rounded-xl shadow-sm text-white"
                >
                  {{ error_login }}
                </VAlert>
              </VCol>

              <!-- Submit Button (High-Contrast White Button) -->
              <VCol cols="12" class="pt-3">
                <VBtn
                  block
                  size="x-large"
                  type="submit"
                  class="auth-submit-white-btn rounded-xl font-weight-black"
                  :loading="loader.loading"
                  :disabled="loader.loading"
                >
                  <span>INGRESAR AL SISTEMA</span>
                  <VIcon icon="ri-arrow-right-line" class="ms-2 font-weight-bold" />
                </VBtn>
              </VCol>

              <!-- Security Footer -->
              <VCol cols="12" class="text-center mt-5">
                <div class="d-inline-flex align-center gap-1.5 text-caption text-white opacity-90 mb-1 font-weight-medium">
                  <VIcon icon="ri-shield-keyhole-line" size="14" color="white" />
                  <span>Conexión Encriptada SSL de 256 bits</span>
                </div>
                <div class="text-caption text-white opacity-75">
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

<style lang="scss">
@use "@core/scss/template/pages/page-auth.scss";

.auth-page-root {
  min-height: 100vh;
  position: relative;
  background-color: rgb(var(--v-theme-background));
  overflow-x: hidden;
}

.auth-brand-floating {
  position: absolute;
  top: 2rem;
  left: 2.5rem;
  z-index: 30;
  text-decoration: none;
  padding: 6px 14px;
  border-radius: 14px;
  background-color: rgba(var(--v-theme-surface), 0.9);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(var(--v-border-color), 0.14);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
  transition: all 0.25s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(115, 103, 240, 0.2);
    border-color: rgba(115, 103, 240, 0.4);
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

.brand-logo-container-mobile {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.35);
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
  background: linear-gradient(135deg, rgba(115, 103, 240, 0.08) 0%, rgba(0, 207, 232, 0.04) 100%);
  border-radius: 28px;
  border: 1px solid rgba(115, 103, 240, 0.12);
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
    width: 40px;
    height: 40px;
    border-radius: 12px;
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

/* RIGHT COLUMN - VIBRANT PRIMARY THEMED BACKGROUND */
.auth-primary-sidebar {
  min-height: 100vh;
  background: linear-gradient(135deg, #7367F0 0%, #5e50ee 50%, #4839eb 100%) !important;
  position: relative;
  overflow: hidden;
  box-shadow: -15px 0 45px rgba(115, 103, 240, 0.25);
}

.sidebar-glow-orb {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  filter: blur(80px);
  z-index: 1;

  &.orb-1 {
    width: 320px;
    height: 320px;
    background: radial-gradient(circle, rgba(255, 255, 255, 0.22) 0%, transparent 70%);
    top: -80px;
    right: -80px;
  }

  &.orb-2 {
    width: 350px;
    height: 350px;
    background: radial-gradient(circle, rgba(0, 207, 232, 0.3) 0%, transparent 70%);
    bottom: -100px;
    left: -100px;
  }
}

.auth-form-container {
  max-width: 440px;
}

.system-status-chip-white {
  padding: 3px 12px;
  background-color: rgba(255, 255, 255, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(8px);
  border-radius: 9999px;
  color: #ffffff;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.05em;

  .status-pulse-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: #28C76F;
    box-shadow: 0 0 8px #28C76F;
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

.form-field-label-white {
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.95);
  display: flex;
  align-items: center;
}

.forgot-link-white {
  text-decoration: none;
  opacity: 0.9;
  transition: opacity 0.2s ease, transform 0.2s ease;

  &:hover {
    opacity: 1;
    text-decoration: underline;
  }
}

/* White Crisp Solo Input Fields */
.auth-input-white {
  .v-field {
    border-radius: 12px !important;
    background-color: #ffffff !important;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08) !important;
    color: #1e293b !important;
    transition: all 0.2s ease !important;

    &:hover {
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12) !important;
    }
  }

  .v-field--focused {
    box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.5), 0 8px 24px rgba(0, 0, 0, 0.15) !important;
  }

  .v-field__input {
    color: #1e293b !important;
    font-weight: 600 !important;
    font-size: 0.92rem !important;

    &::placeholder {
      color: #94a3b8 !important;
    }
  }

  .v-field__prepend-inner .v-icon,
  .v-field__append-inner .v-icon {
    color: #7367F0 !important;
  }
}

.auth-checkbox-white {
  .v-label {
    color: rgba(255, 255, 255, 0.95) !important;
    font-size: 0.85rem;
    font-weight: 600;
    user-select: none;
  }

  .v-selection-control__input {
    color: #ffffff !important;
  }
}

/* White High-Contrast Submit Button */
.auth-submit-white-btn {
  background-color: #ffffff !important;
  color: #5e50ee !important;
  height: 50px !important;
  font-size: 0.95rem !important;
  letter-spacing: 0.05em !important;
  border-radius: 14px !important;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2) !important;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;

  &:hover {
    background-color: #f8fafc !important;
    color: #4839eb !important;
    transform: translateY(-2px);
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.28) !important;
  }

  &:active {
    transform: translateY(0);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
  }
}
</style>
