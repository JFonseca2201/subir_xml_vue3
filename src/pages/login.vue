<script setup>
import { useGenerateImageVariant } from "@/@core/composable/useGenerateImageVariant";
import AuthProvider from "@/views/pages/authentication/AuthProvider.vue";
import authV2LoginIllustrationBorderedDark from "@images/pages/auth-v2-login-illustration-bordered-dark.png";
import authV2LoginIllustrationBorderedLight from "@images/pages/auth-v2-login-illustration-bordered-light.png";
import authV2LoginIllustrationDark from "@images/pages/auth-v2-login-illustration-dark.png";
import authV2LoginIllustrationLight from "@images/pages/auth-v2-login-illustration-light.png";
import authV2LoginMaskDark from "@images/pages/auth-v2-login-mask-dark.png";
import authV2LoginMaskLight from "@images/pages/auth-v2-login-mask-light.png";
import { VNodeRenderer } from "@layouts/components/VNodeRenderer";
import { themeConfig } from "@themeConfig";
import { useLoaderStore } from '@/stores/loader'

const route = useRoute();
const router = useRouter();
const isLoading = ref(false);
const form = ref({
  email: "laravest@gmail.com",
  password: "12345678",
  remember: false,
});

const loader = useLoaderStore()
const success_login = ref(null);
const warning_login = ref(null);
const error_login = ref(null);

const login = async () => {
  loader.start();

  success_login.value = null;
  warning_login.value = null;
  error_login.value = null;
  try {

    const resp = await $api("auth/login", {
      method: 'POST',
      body: {
        email: form.value.email,
        password: form.value.password
      },
      onResponseError({ response }) {
        console.log(response);
        error_login.value = 'Error al ingresar credenciales. Verifique usuario y contraseña.';
      }
    });

    console.log(resp);
    localStorage.setItem("token", resp.access_token);
    localStorage.setItem("user", JSON.stringify(resp.user));
    success_login.value = "Bienvenido al sistema!"
    setTimeout(async () => {

      await nextTick(() => {
        router.replace(route.query.to ? String(route.query.to) : '/')
      });
    }, 800);

  } catch (error) {
    console.log(error);
  } finally {
    loader.stop()
  }
}

definePage({ meta: { layout: "blank", unauthenticatedOnly: true } });

const isPasswordVisible = ref(false);
const authV2LoginMask = useGenerateImageVariant(
  authV2LoginMaskLight,
  authV2LoginMaskDark
);
const authV2LoginIllustration = useGenerateImageVariant(
  authV2LoginIllustrationLight,
  authV2LoginIllustrationDark,
  authV2LoginIllustrationBorderedLight,
  authV2LoginIllustrationBorderedDark,
  true
);
</script>

<template>
  <RouterLink to="/">
    <div class="app-logo auth-logo">
      <VNodeRenderer :nodes="themeConfig.app.logo" />
      <h1 class="app-logo-title">
        {{ themeConfig.app.title }}
      </h1>
    </div>
  </RouterLink>

  <VRow no-gutters class="auth-wrapper">
    <VCol md="8" class="d-none d-md-flex align-center justify-center position-relative">
      <div class="d-flex align-center justify-center pa-10">
        <img :src="authV2LoginIllustration" class="auth-illustration w-100" alt="auth-illustration" />
      </div>
      <VImg :src="authV2LoginMask" class="d-none d-md-flex auth-footer-mask" alt="auth-mask" />
    </VCol>
    <VCol cols="12" md="4" class="auth-card-v2 d-flex align-center justify-center"
      style="background-color: rgb(var(--v-theme-surface))">
      <VCard flat :max-width="500" class="mt-12 mt-sm-0 pa-5 pa-lg-7">
        <VCardText>
          <h4 class="text-h4 mb-1">
            Welcome to
            <span class="text-capitalize">{{ themeConfig.app.title }}! 👋🏻</span>
          </h4>

          <p class="mb-0">
            Please sign-in to your account and start the adventure
          </p>
        </VCardText>

        <VCardText>
          <VForm @submit.prevent="login">
            <VRow>
              <!-- email -->
              <VCol cols="12">
                <VTextField v-model="form.email" autofocus label="Email" type="email" placeholder="johndoe@email.com" />
              </VCol>

              <!-- password -->
              <VCol cols="12">
                <VTextField v-model="form.password" label="Password" placeholder="············"
                  :type="isPasswordVisible ? 'text' : 'password'" :append-inner-icon="isPasswordVisible ? 'ri-eye-off-line' : 'ri-eye-line'
                    " @click:append-inner="isPasswordVisible = !isPasswordVisible" />

                <!-- remember me checkbox -->
                <div class="d-flex align-center justify-space-between flex-wrap my-6 gap-x-2">
                  <VCheckbox v-model="form.remember" label="Remember me" />

                  <a class="text-primary" href="#"> Forgot Password? </a>
                </div>
              </VCol>
              <VCol cols="12" v-if="success_login">
                <VAlert type="success" color="success" closable="" variant="tonal">{{ success_login }}</VAlert>
              </VCol>
              <VCol cols="12" v-if="error_login">
                <VAlert type="error" color="error" closable="" variant="tonal">{{ error_login }}</VAlert>
              </VCol>
              <VCol cols="12">
                <!-- login button -->
                <VBtn block type="submit" :loading="loader.loading" :disabled="loader.loading">
                  Ingresar
                </VBtn>
              </VCol>

              <!-- create account -->
              <VCol cols="12" class="text-body-1 text-center">
                <span class="d-inline-block"> New on our platform? </span>
                <a class="text-primary ms-1 d-inline-block text-body-1" href="#">
                  Create an account
                </a>
              </VCol>

              <VCol cols="12" class="d-flex align-center">
                <VDivider />
                <span class="mx-4 text-high-emphasis">or</span>
                <VDivider />
              </VCol>

              <!-- auth providers -->
              <VCol cols="12" class="text-center">
                <AuthProvider />
              </VCol>
            </VRow>
          </VForm>
        </VCardText>
      </VCard>
    </VCol>
  </VRow>
</template>

<style lang="scss">
@use "@core/scss/template/pages/page-auth.scss";
</style>
