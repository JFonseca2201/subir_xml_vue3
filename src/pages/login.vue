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
  remember: false,
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
  
  return raw.length > 22 ? raw.substring(0, 20) + '...' : raw
})
</script>

<template>
  <div class="auth-page-container">
    <!-- Brand Logo Top Left Flotante (Solo en Desktop) -->
    <RouterLink
      to="/"
      class="auth-brand-link d-none d-lg-flex"
    >
      <div class="auth-logo-badge">
        <VNodeRenderer :nodes="themeConfig.app.logo" />
        <span class="auth-brand-title">
          {{ appBrandName }}
        </span>
      </div>
    </RouterLink>

    <VRow
      no-gutters
      class="auth-wrapper"
    >
      <!-- Columna Izquierda: Showcase Visual Minimalista y Limpio -->
      <VCol
        lg="8"
        class="d-none d-lg-flex align-center justify-center position-relative auth-illustration-wrapper"
      >
        <!-- Ambient Glow Orbs -->
        <div class="auth-glow-orb auth-glow-1" />
        <div class="auth-glow-orb auth-glow-2" />

        <div class="d-flex align-center justify-center pa-10 z-index-1 w-100">
          <img
            :src="authV2LoginIllustration"
            class="auth-illustration"
            alt="Luxury Evys Portal"
          >
        </div>

        <VImg
          :src="authV2LoginMask"
          class="d-none d-lg-flex auth-footer-mask"
          alt="auth-mask"
        />
      </VCol>

      <!-- Columna Derecha: Tarjeta de Acceso -->
      <VCol
        cols="12"
        lg="4"
        class="auth-card-v2 d-flex align-center justify-center auth-primary-sidebar"
      >
        <VCard
          flat
          :max-width="460"
          class="mt-12 mt-sm-0 pa-6 pa-lg-8 auth-login-card rounded-2xl text-white w-100"
        >
          <VCardText class="pb-2 text-white text-center text-sm-start">
            <div class="mb-4">
              <h3 class="text-h4 font-weight-bold mb-1 text-white auth-welcome-heading">
                ¡Bienvenido a <span class="auth-highlight-name">{{ appBrandName }}</span>! 👋🏻
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
                  <VTextField
                    v-model="form.email"
                    autofocus
                    placeholder="ejemplo@luxuryevys.com"
                    bg-color="white"
                    color="primary"
                    variant="solo"
                    density="comfortable"
                    class="auth-input"
                    prepend-inner-icon="ri-mail-line"
                  />
                </VCol>

                <!-- Password -->
                <VCol cols="12">
                  <label class="auth-form-label">CONTRASEÑA</label>
                  <VTextField
                    v-model="form.password"
                    placeholder="············"
                    bg-color="white"
                    color="primary"
                    variant="solo"
                    density="comfortable"
                    class="auth-input"
                    prepend-inner-icon="ri-lock-2-line"
                    :type="isPasswordVisible ? 'text' : 'password'"
                    :append-inner-icon="isPasswordVisible ? 'ri-eye-off-line' : 'ri-eye-line'"
                    @click:append-inner="isPasswordVisible = !isPasswordVisible"
                  />

                  <!-- Remember me & Forgot Password -->
                  <div class="d-flex align-center justify-space-between flex-wrap my-3 gap-x-2">
                    <VCheckbox
                      v-model="form.remember"
                      label="Recordarme"
                      color="white"
                      true-icon="ri-checkbox-fill"
                      false-icon="ri-checkbox-blank-line"
                      hide-details
                      density="compact"
                      class="text-white auth-checkbox"
                    />

                    <a
                      class="auth-forgot-link"
                      href="#"
                    >
                      ¿Olvidaste tu contraseña?
                    </a>
                  </div>
                </VCol>

                <!-- Alerts -->
                <VCol
                  v-if="success_login"
                  cols="12"
                >
                  <VAlert
                    type="success"
                    color="success"
                    closable
                    variant="elevated"
                    class="rounded-lg shadow-sm"
                  >
                    {{ success_login }}
                  </VAlert>
                </VCol>

                <VCol
                  v-if="error_login"
                  cols="12"
                >
                  <VAlert
                    type="error"
                    color="error"
                    closable
                    variant="elevated"
                    class="rounded-lg shadow-sm"
                  >
                    {{ error_login }}
                  </VAlert>
                </VCol>

                <!-- Botón de Ingreso PRO -->
                <VCol
                  cols="12"
                  class="pt-3"
                >
                  <VBtn
                    block
                    size="large"
                    type="submit"
                    class="auth-submit-btn"
                    :loading="loader.loading"
                    :disabled="loader.loading"
                  >
                    <VIcon
                      icon="ri-login-box-line"
                      class="me-2"
                    />
                    Iniciar Sesión
                  </VBtn>
                </VCol>

                <!-- Footer Copyright Minimalista -->
                <VCol
                  cols="12"
                  class="text-center mt-6"
                >
                  <div class="text-caption text-white opacity-75 font-weight-medium">
                    © {{ new Date().getFullYear() }} {{ appBrandName }} • Todos los derechos reservados
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

.auth-page-container {
  min-height: 100vh;
  background: #f8fafc;
  position: relative;
  overflow-x: hidden;
}

// Logo Badge Superior Flotante
.auth-brand-link {
  position: absolute;
  top: 24px;
  left: 28px;
  z-index: 20;
  text-decoration: none;
  transition: transform 0.2s ease;

  &:hover {
    transform: translateY(-2px);
  }
}

.auth-logo-badge {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 0.65rem 1.25rem;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: 16px;
  border: 1px solid rgba(102, 108, 255, 0.18);
  box-shadow: 0 8px 24px rgba(102, 108, 255, 0.12), 0 2px 6px rgba(0, 0, 0, 0.04);

  .auth-brand-title {
    color: #4347d4 !important;
    font-weight: 800;
    font-size: 1.15rem;
    letter-spacing: -0.3px;
  }
}

// Columna Izquierda: Hero Showcase
.auth-illustration-wrapper {
  background: radial-gradient(circle at 40% 40%, rgba(102, 108, 255, 0.09) 0%, rgba(99, 104, 255, 0.03) 60%, #f8fafc 100%);
  min-height: 100vh;
  overflow: hidden;
  position: relative;

  .auth-hero-content {
    max-width: 620px;
    z-index: 2;
  }

  .auth-glow-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    pointer-events: none;
    opacity: 0.6;

    &.auth-glow-1 {
      width: 320px;
      height: 320px;
      background: rgba(102, 108, 255, 0.15);
      top: 10%;
      left: 15%;
    }

    &.auth-glow-2 {
      width: 280px;
      height: 280px;
      background: rgba(80, 85, 232, 0.12);
      bottom: 15%;
      right: 15%;
    }
  }

  .auth-illustration {
    max-height: 400px;
    width: auto;
    max-width: 90%;
    filter: drop-shadow(0 20px 40px rgba(102, 108, 255, 0.2));
    transition: transform 0.4s ease;

    &:hover {
      transform: translateY(-4px);
    }
  }

  .auth-footer-mask {
    position: absolute;
    bottom: 0;
    width: 100%;
    pointer-events: none;
  }
}

// Columna Derecha: Tarjeta de Acceso con degradado profundo
.auth-primary-sidebar {
  background: linear-gradient(165deg, #666CFF 0%, #4F54E5 45%, #3e42cb 100%) !important;
  box-shadow: -10px 0 40px rgba(62, 66, 203, 0.3) !important;
  color: #ffffff !important;
  min-height: 100vh;
  position: relative;
  z-index: 10;

  .auth-login-card {
    background: transparent !important;
  }

  .auth-welcome-heading {
    letter-spacing: -0.5px;
    line-height: 1.25;
  }

  .auth-highlight-name {
    color: #ffffff;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .auth-form-label {
    font-size: 0.72rem;
    font-weight: 800;
    color: rgba(255, 255, 255, 0.95);
    letter-spacing: 0.6px;
    margin-bottom: 6px;
    display: block;
    text-transform: uppercase;
  }

  .auth-input {
    .v-field {
      border-radius: 12px !important;
      background-color: #ffffff !important;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.1) !important;
      color: #1e293b !important;
      transition: all 0.25s ease;
    }

    .v-field--focused {
      box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.5), 0 8px 22px rgba(0, 0, 0, 0.18) !important;
    }

    .v-field__input {
      font-size: 0.925rem !important;
      font-weight: 500 !important;
      color: #0f172a !important;
    }
  }

  .auth-checkbox {
    .v-label {
      color: #ffffff !important;
      opacity: 0.95;
      font-size: 0.875rem;
      font-weight: 600;
      user-select: none;
      padding-inline-start: 4px;
    }

    .v-selection-control__input {
      color: #ffffff !important;

      .v-icon {
        color: #ffffff !important;
        font-size: 1.45rem !important;
        opacity: 0.85;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      }
    }

    .v-selection-control--dirty {
      .v-selection-control__input .v-icon {
        color: #ffffff !important;
        opacity: 1 !important;
        transform: scale(1.1);
        filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.35));
      }
    }
  }

  .auth-forgot-link {
    color: #ffffff !important;
    font-size: 0.85rem;
    font-weight: 600;
    text-decoration: underline;
    opacity: 0.9;
    transition: opacity 0.2s ease;

    &:hover {
      opacity: 1;
    }
  }

  // Botón de Envío Principal PRO
  .auth-submit-btn {
    background-color: #ffffff !important;
    color: #4347d4 !important;
    font-weight: 800 !important;
    font-size: 1.05rem !important;
    letter-spacing: 0.5px;
    border-radius: 12px !important;
    height: 50px !important;
    border: 2px solid transparent !important;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18) !important;
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
    position: relative;
    overflow: hidden;

    .v-icon {
      font-size: 1.25rem;
      transition: transform 0.25s ease;
    }

    &:hover {
      background-color: #0f172a !important;
      color: #ffffff !important;
      border-color: rgba(255, 255, 255, 0.3) !important;
      transform: translateY(-3px) scale(1.015);
      box-shadow: 0 14px 32px rgba(15, 23, 42, 0.45), 0 0 0 2px rgba(255, 255, 255, 0.2) !important;

      .v-icon {
        transform: translateX(4px);
      }
    }

    &:active {
      transform: translateY(-1px) scale(0.99);
      box-shadow: 0 6px 16px rgba(15, 23, 42, 0.3) !important;
    }
  }
}

@media (max-width: 1024px) {
  .auth-illustration-wrapper {
    display: none !important;
  }

  .auth-wrapper {
    flex-direction: column !important;
  }

  .auth-brand-link {
    display: none !important;
  }

  .auth-primary-sidebar {
    width: 100% !important;
    max-width: 100% !important;
    flex: 0 0 100% !important;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 2rem 1.25rem !important;

    .auth-welcome-heading {
      font-size: 1.85rem !important;
      font-weight: 800 !important;
      letter-spacing: -0.5px !important;
      text-align: left !important;
    }

    .auth-login-card {
      padding: 0 !important;
      max-width: 440px !important;
      width: 100% !important;
    }
  }
}
</style>
