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
  
  return raw.length > 22 ? raw.substring(0, 20) + '...' : raw
})
</script>

<template>
  <div class="auth-page-luxury">
    <!-- Ambient Dynamic Glow Orbs -->
    <div class="luxury-glow-orb orb-top-left" />
    <div class="luxury-glow-orb orb-bottom-right" />
    <div class="luxury-glow-orb orb-center" />

    <!-- Top Left Brand Badge (Desktop) -->
    <RouterLink
      to="/"
      class="luxury-brand-badge d-none d-lg-flex"
    >
      <div class="brand-icon-wrapper">
        <VNodeRenderer :nodes="themeConfig.app.logo" />
      </div>
      <div class="d-flex flex-column">
        <span class="brand-title">{{ appBrandName }}</span>
        <span class="brand-subtitle">Gestión Integral Automotriz</span>
      </div>
    </RouterLink>

    <VRow
      no-gutters
      class="auth-luxury-wrapper"
    >
      <!-- LEFT HERO SHOWCASE (Ultra Pro Visuals) -->
      <VCol
        lg="7"
        xl="8"
        class="d-none d-lg-flex align-center justify-center position-relative hero-showcase-column"
      >
        <!-- Decorative Floating Glass Cards -->
        <div class="floating-glass-card card-top-right">
          <div class="floating-card-icon bg-success-subtle text-success">
            <VIcon icon="ri-shield-check-line" size="22" />
          </div>
          <div>
            <div class="text-caption text-slate-400 font-weight-bold">FACTURACIÓN ELECTRÓNICA</div>
            <div class="text-body-2 font-weight-bold text-white">XML & SRI 100% Homologado</div>
          </div>
        </div>

        <div class="floating-glass-card card-bottom-left">
          <div class="floating-card-icon bg-primary-subtle text-primary">
            <VIcon icon="ri-speed-up-line" size="22" />
          </div>
          <div>
            <div class="text-caption text-slate-400 font-weight-bold">OPERACIONES EN VIVO</div>
            <div class="text-body-2 font-weight-bold text-white">Taller & Kardex en Tiempo Real</div>
          </div>
        </div>

        <!-- Central Illustration Container -->
        <div class="d-flex flex-column align-center justify-center pa-10 z-index-2 w-100 text-center">
          <div class="illustration-halo mb-6">
            <img
              :src="authV2LoginIllustration"
              class="luxury-illustration"
              alt="Luxury Evys Portal"
            >
          </div>

          <div class="hero-text-block">
            <h2 class="hero-headline">
              Control Total de tu Taller Automotriz
            </h2>
            <p class="hero-subtext">
              Administración avanzada de inventarios, órdenes de trabajo, ventas y facturación electrónica en un solo ecosistema.
            </p>
          </div>
        </div>

        <!-- Footer Mask Illustration -->
        <VImg
          :src="authV2LoginMask"
          class="auth-footer-mask-luxury"
          alt="auth-mask"
        />
      </VCol>

      <!-- RIGHT LOGIN FORM (Deep Luxury Glass Panel) -->
      <VCol
        cols="12"
        lg="5"
        xl="4"
        class="d-flex align-center justify-center position-relative login-form-column"
      >
        <div class="login-glass-container w-100 pa-6 pa-sm-10 pa-xl-12">
          <!-- Mobile Brand Logo -->
          <div class="d-flex d-lg-none align-center justify-center gap-3 mb-6 text-center">
            <div class="brand-icon-wrapper-mobile">
              <VNodeRenderer :nodes="themeConfig.app.logo" />
            </div>
            <h2 class="text-h5 font-weight-bold text-white mb-0">
              {{ appBrandName }}
            </h2>
          </div>

          <!-- Header Titles -->
          <div class="mb-6 text-center text-sm-start">
            <div class="welcome-chip mb-2 d-inline-flex">
              <span class="status-dot-pulse" />
              <span>PLATAFORMA ADMINISTRATIVA</span>
            </div>
            <h1 class="welcome-title text-h4 font-weight-black mb-1">
              Iniciar <span class="gradient-text-accent">Sesión</span>
            </h1>
            <p class="welcome-subtitle text-body-2 text-slate-300 mb-0">
              Ingresa tus credenciales para acceder al panel de control
            </p>
          </div>

          <!-- Login Form -->
          <VForm @submit.prevent="login">
            <VRow dense class="gap-y-4">
              <!-- Email Input -->
              <VCol cols="12">
                <label class="luxury-input-label">
                  <VIcon icon="ri-mail-line" size="14" class="me-1 text-primary-light" />
                  CORREO ELECTRÓNICO
                </label>
                <VTextField
                  v-model="form.email"
                  autofocus
                  placeholder="ejemplo@luxuryevys.com"
                  variant="outlined"
                  density="comfortable"
                  class="luxury-input"
                  color="primary"
                  prepend-inner-icon="ri-user-3-line"
                />
              </VCol>

              <!-- Password Input -->
              <VCol cols="12">
                <div class="d-flex justify-space-between align-center mb-1">
                  <label class="luxury-input-label mb-0">
                    <VIcon icon="ri-lock-2-line" size="14" class="me-1 text-primary-light" />
                    CONTRASEÑA
                  </label>
                  <a
                    class="luxury-forgot-link"
                    href="#"
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
                  class="luxury-input"
                  color="primary"
                  prepend-inner-icon="ri-key-2-line"
                  :type="isPasswordVisible ? 'text' : 'password'"
                  :append-inner-icon="isPasswordVisible ? 'ri-eye-off-line' : 'ri-eye-line'"
                  @click:append-inner="isPasswordVisible = !isPasswordVisible"
                />
              </VCol>

              <!-- Remember Me -->
              <VCol cols="12" class="pt-1 pb-1">
                <div class="d-flex align-center justify-space-between">
                  <VCheckbox
                    v-model="form.remember"
                    label="Mantener sesión iniciada"
                    color="primary"
                    true-icon="ri-checkbox-circle-fill"
                    false-icon="ri-checkbox-blank-circle-line"
                    hide-details
                    density="compact"
                    class="luxury-checkbox"
                  />
                </div>
              </VCol>

              <!-- Alerts -->
              <VCol v-if="success_login" cols="12">
                <VAlert
                  type="success"
                  color="success"
                  closable
                  variant="tonal"
                  class="rounded-xl border shadow-sm"
                >
                  {{ success_login }}
                </VAlert>
              </VCol>

              <VCol v-if="error_login" cols="12">
                <VAlert
                  type="error"
                  color="error"
                  closable
                  variant="tonal"
                  class="rounded-xl border shadow-sm"
                >
                  {{ error_login }}
                </VAlert>
              </VCol>

              <!-- Submit Button Pro -->
              <VCol cols="12" class="pt-2">
                <VBtn
                  block
                  size="x-large"
                  type="submit"
                  class="luxury-submit-btn"
                  :loading="loader.loading"
                  :disabled="loader.loading"
                >
                  <span class="btn-text">INGRESAR AL SISTEMA</span>
                  <VIcon icon="ri-arrow-right-line" class="btn-icon" />
                </VBtn>
              </VCol>

              <!-- Security Footer -->
              <VCol cols="12" class="text-center mt-6">
                <div class="security-badge d-inline-flex align-center gap-1.5 mb-2">
                  <VIcon icon="ri-shield-keyhole-line" size="14" class="text-success" />
                  <span>Conexión Encriptada SSL de 256 bits</span>
                </div>
                <div class="text-caption text-slate-400">
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

.auth-page-luxury {
  min-height: 100vh;
  background-color: #0b0f19;
  background-image: 
    radial-gradient(at 0% 0%, rgba(115, 103, 240, 0.2) 0px, transparent 50%),
    radial-gradient(at 100% 100%, rgba(0, 207, 232, 0.15) 0px, transparent 50%),
    radial-gradient(at 50% 50%, rgba(15, 23, 42, 1) 0px, rgba(11, 15, 25, 1) 100%);
  position: relative;
  overflow-x: hidden;
  display: flex;
  align-items: stretch;
}

.auth-luxury-wrapper {
  min-height: 100vh;
  width: 100%;
}

/* Ambient Glow Orbs */
.luxury-glow-orb {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  filter: blur(100px);
  z-index: 1;

  &.orb-top-left {
    width: 450px;
    height: 450px;
    background: radial-gradient(circle, rgba(115, 103, 240, 0.3) 0%, rgba(115, 103, 240, 0) 70%);
    top: -100px;
    left: -100px;
    animation: float-glow 8s ease-in-out infinite alternate;
  }

  &.orb-bottom-right {
    width: 500px;
    height: 500px;
    background: radial-gradient(circle, rgba(0, 207, 232, 0.25) 0%, rgba(0, 207, 232, 0) 70%);
    bottom: -150px;
    right: -150px;
    animation: float-glow 10s ease-in-out infinite alternate-reverse;
  }

  &.orb-center {
    width: 350px;
    height: 350px;
    background: radial-gradient(circle, rgba(124, 58, 237, 0.2) 0%, rgba(124, 58, 237, 0) 70%);
    top: 40%;
    left: 45%;
    animation: float-glow 12s ease-in-out infinite alternate;
  }
}

@keyframes float-glow {
  0% { transform: translate(0, 0) scale(1); }
  100% { transform: translate(30px, -30px) scale(1.1); }
}

/* Brand Link Top Left */
.luxury-brand-badge {
  position: absolute;
  top: 28px;
  left: 32px;
  z-index: 30;
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 8px 18px;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 18px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);

  &:hover {
    transform: translateY(-2px);
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(115, 103, 240, 0.5);
    box-shadow: 0 12px 36px rgba(115, 103, 240, 0.25);
  }

  .brand-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: linear-gradient(135deg, #7367F0 0%, #9E95F5 100%);
    color: white;
  }

  .brand-title {
    font-size: 1.1rem;
    font-weight: 800;
    letter-spacing: 0.5px;
    background: linear-gradient(135deg, #ffffff 0%, #dcd6ff 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .brand-subtitle {
    font-size: 0.68rem;
    color: rgba(255, 255, 255, 0.6);
    font-weight: 600;
    letter-spacing: 0.3px;
  }
}

/* Left Hero Showcase */
.hero-showcase-column {
  position: relative;
  z-index: 5;
  overflow: hidden;

  .illustration-halo {
    position: relative;
    display: inline-block;

    &::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 80%;
      height: 80%;
      transform: translate(-50%, -50%);
      background: radial-gradient(circle, rgba(115, 103, 240, 0.35) 0%, transparent 70%);
      filter: blur(50px);
      z-index: -1;
    }
  }

  .luxury-illustration {
    max-height: 380px;
    width: auto;
    max-width: 90%;
    filter: drop-shadow(0 25px 50px rgba(0, 0, 0, 0.5));
    transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);

    &:hover {
      transform: translateY(-6px) scale(1.02);
    }
  }

  .hero-text-block {
    max-width: 580px;

    .hero-headline {
      font-size: 2rem;
      font-weight: 800;
      color: #ffffff;
      line-height: 1.25;
      margin-bottom: 0.75rem;
      letter-spacing: -0.5px;
    }

    .hero-subtext {
      font-size: 0.95rem;
      color: rgba(255, 255, 255, 0.75);
      line-height: 1.6;
      margin-bottom: 0;
    }
  }

  .auth-footer-mask-luxury {
    position: absolute;
    bottom: 0;
    width: 100%;
    pointer-events: none;
    opacity: 0.4;
  }
}

/* Floating Glass Cards */
.floating-glass-card {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 20px;
  background: rgba(15, 23, 42, 0.75);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 20px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(115, 103, 240, 0.2);
  z-index: 10;
  animation: float-card 6s ease-in-out infinite alternate;

  &.card-top-right {
    top: 15%;
    right: 8%;
    animation-delay: 0s;
  }

  &.card-bottom-left {
    bottom: 15%;
    left: 8%;
    animation-delay: 3s;
  }

  .floating-card-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 12px;
    flex-shrink: 0;

    &.bg-success-subtle {
      background: rgba(40, 199, 111, 0.15);
      border: 1px solid rgba(40, 199, 111, 0.3);
    }

    &.bg-primary-subtle {
      background: rgba(115, 103, 240, 0.15);
      border: 1px solid rgba(115, 103, 240, 0.3);
    }
  }
}

@keyframes float-card {
  0% { transform: translateY(0); }
  100% { transform: translateY(-12px); }
}

/* Right Login Form Column */
.login-form-column {
  background: rgba(15, 23, 42, 0.82) !important;
  backdrop-filter: blur(24px) !important;
  -webkit-backdrop-filter: blur(24px);
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: -20px 0 60px rgba(0, 0, 0, 0.5);
  z-index: 10;
  min-height: 100vh;
}

.login-glass-container {
  max-width: 480px;
  margin: 0 auto;
}

.welcome-chip {
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  background: rgba(115, 103, 240, 0.15);
  border: 1px solid rgba(115, 103, 240, 0.3);
  border-radius: 20px;
  color: #9e95f5;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.8px;

  .status-dot-pulse {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background-color: #28c76f;
    box-shadow: 0 0 8px #28c76f;
    animation: pulse-green 2s infinite;
  }
}

@keyframes pulse-green {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.85); }
}

.welcome-title {
  color: #ffffff;
  letter-spacing: -0.5px;
}

.gradient-text-accent {
  background: linear-gradient(135deg, #9e95f5 0%, #00cfe8 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.welcome-subtitle {
  line-height: 1.5;
}

.luxury-input-label {
  display: flex;
  align-items: center;
  font-size: 0.73rem;
  font-weight: 800;
  letter-spacing: 0.6px;
  color: rgba(255, 255, 255, 0.85);
  margin-bottom: 6px;
  text-transform: uppercase;
}

.text-primary-light {
  color: #9e95f5 !important;
}

/* Luxury Input Field Overrides */
.luxury-input {
  .v-field {
    border-radius: 14px !important;
    background-color: rgba(30, 41, 59, 0.6) !important;
    border: 1px solid rgba(255, 255, 255, 0.12) !important;
    color: #ffffff !important;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;

    &:hover {
      background-color: rgba(30, 41, 59, 0.85) !important;
      border-color: rgba(115, 103, 240, 0.4) !important;
    }
  }

  .v-field--focused {
    background-color: rgba(15, 23, 42, 0.95) !important;
    border-color: #7367f0 !important;
    box-shadow: 0 0 0 3px rgba(115, 103, 240, 0.3), 0 8px 24px rgba(0, 0, 0, 0.3) !important;
    transform: translateY(-1px);
  }

  .v-field__input {
    color: #ffffff !important;
    font-size: 0.95rem !important;
    font-weight: 500 !important;

    &::placeholder {
      color: rgba(255, 255, 255, 0.4) !important;
    }
  }

  .v-field__prepend-inner .v-icon,
  .v-field__append-inner .v-icon {
    color: rgba(255, 255, 255, 0.6) !important;
    transition: color 0.2s ease;
  }

  .v-field--focused .v-field__prepend-inner .v-icon {
    color: #9e95f5 !important;
  }
}

.luxury-forgot-link {
  color: #9e95f5;
  font-size: 0.78rem;
  font-weight: 700;
  text-decoration: none;
  transition: all 0.2s ease;

  &:hover {
    color: #ffffff;
    text-decoration: underline;
    text-shadow: 0 0 8px rgba(158, 149, 245, 0.6);
  }
}

.luxury-checkbox {
  .v-label {
    color: rgba(255, 255, 255, 0.85) !important;
    font-size: 0.84rem;
    font-weight: 600;
    user-select: none;
  }

  .v-selection-control__input {
    color: #7367f0 !important;
  }
}

/* Luxury Submit Button */
.luxury-submit-btn {
  background: linear-gradient(135deg, #7367F0 0%, #5e50ee 50%, #4839eb 100%) !important;
  color: #ffffff !important;
  border-radius: 14px !important;
  height: 52px !important;
  font-weight: 800 !important;
  font-size: 0.95rem !important;
  letter-spacing: 0.8px;
  box-shadow: 0 8px 24px rgba(115, 103, 240, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.15) inset !important;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.25), transparent);
    transition: left 0.6s ease;
  }

  .btn-text {
    position: relative;
    z-index: 2;
  }

  .btn-icon {
    font-size: 1.25rem;
    margin-left: 8px;
    transition: transform 0.25s ease;
    position: relative;
    z-index: 2;
  }

  &:hover {
    background: linear-gradient(135deg, #8277ff 0%, #6d60f9 50%, #5648f5 100%) !important;
    transform: translateY(-2px);
    box-shadow: 0 14px 32px rgba(115, 103, 240, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.3) inset !important;

    &::before {
      left: 100%;
    }

    .btn-icon {
      transform: translateX(4px);
    }
  }

  &:active {
    transform: translateY(0);
    box-shadow: 0 6px 16px rgba(115, 103, 240, 0.35) !important;
  }
}

.security-badge {
  color: rgba(255, 255, 255, 0.65);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.3px;
}

.brand-icon-wrapper-mobile {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: linear-gradient(135deg, #7367F0 0%, #9E95F5 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

@media (max-width: 960px) {
  .login-form-column {
    border-left: none;
    box-shadow: none;
    padding: 2rem 1rem !important;
  }
}
</style>
