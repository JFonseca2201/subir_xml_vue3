<script setup>
const props = defineProps({
  userData: {
    type: Object,
    required: false,
    default: () => ({
      avatar: '',
      company: '',
      contact: '',
      country: null,
      currentPlan: '',
      email: '',
      fullName: '',
      id: 0,
      role: '',
      status: null,
      username: '',
      language: [],
      projectDone: 0,
      taskDone: 0,
      taxId: '',
    }),
  },
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
})

const emit = defineEmits([
  'submit',
  'update:isDialogVisible',
])

const userData = ref(structuredClone(toRaw(props.userData)))

watch(() => props, () => {
  userData.value = structuredClone(toRaw(props.userData))
})

const onFormSubmit = () => {
  emit('update:isDialogVisible', false)
  emit('submit', userData.value)
}

const onFormReset = () => {
  userData.value = structuredClone(toRaw(props.userData))
  emit('update:isDialogVisible', false)
}

const dialogVisibleUpdate = val => {
  emit('update:isDialogVisible', val)
}
</script>

<template>
  <VDialog
    scrollable
    :width="$vuetify.display.smAndDown ? 'auto' : 900 "
    :model-value="props.isDialogVisible"
    @update:model-value="dialogVisibleUpdate"
  >
    <VCard class="pa-sm-11 pa-3">
      <!-- 👉 dialog close btn -->
      <DialogCloseBtn
        variant="text"
        size="default"
        @click="onFormReset"
      />

      <VCardText class="pt-5">
        <div class="text-center pb-6">
          <h4 class="text-h4 mb-2">
            Edit User Information
          </h4>
          <div class="text-body-1">
            Updating user details will receive a privacy audit.
          </div>
        </div>

        <!-- 👉 Form -->
        <VForm
          class="mt-4"
          @submit.prevent="onFormSubmit"
        >
          <VRow>
            <!-- 👉 First Name -->
            <VCol
              cols="12"
              md="6"
            >
              <VTextField
                v-model="userData.fullName.split(' ')[0]"
                label="First Name"
                placeholder="John"
              />
            </VCol>

            <!-- 👉 Last Name -->
            <VCol
              cols="12"
              md="6"
            >
              <VTextField
                v-model="userData.fullName.split(' ')[1]"
                label="Last Name"
                placeholder="doe"
              />
            </VCol>

            <!-- 👉 User Name  -->

            <VCol cols="12">
              <VTextField
                v-model="userData.username"
                label="Username"
                placeholder="John Doe"
              />
            </VCol>

            <!-- 👉 Billing Email -->
            <VCol
              cols="12"
              md="6"
            >
              <VTextField
                v-model="userData.email"
                label="Billing Email"
                placeholder="johndoe@email.com"
              />
            </VCol>

            <!-- 👉 Status -->
            <VCol
              cols="12"
              md="6"
            >
              <VSelect
                v-model="userData.status"
                :items="['Active', 'Inactive', 'Pending']"
                label="Status"
                placeholder="Status"
              />
            </VCol>

            <!-- 👉 Tax Id -->
            <VCol
              cols="12"
              md="6"
            >
              <VTextField
                v-model="userData.taxId"
                label="Tax Id"
                placeholder="Tax-3456789"
              />
            </VCol>

            <!-- 👉 Contact -->
            <VCol
              cols="12"
              md="6"
            >
              <VTextField
                v-model="userData.contact"
                label="Contact"
                placeholder="+1 9876543210"
              />
            </VCol>

            <!-- 👉 Language -->
            <VCol
              cols="12"
              md="6"
            >
              <VSelect
                v-model="userData.language"
                :items="['English', 'Spanish', 'French']"
                label="Language"
                placeholder="English"
                chips
                closable-chips
                multiple
              />
            </VCol>

            <!-- 👉 Country -->
            <VCol
              cols="12"
              md="6"
            >
              <VSelect
                v-model="userData.country"
                :items="['United States', 'United Kingdom', 'France']"
                label="Country"
                placeholder="United States"
              />
            </VCol>

            <VCol cols="12">
              <VSwitch
                density="compact"
                label="Use as a billing address?"
              />
            </VCol>
          </VRow>
        </VForm>
      </VCardText>

      <VDivider />

      <VCardActions
        class="pa-4 d-flex justify-end align-center gap-3 bg-white"
        style="position: sticky; bottom: 0; z-index: 2;"
      >
        <VBtn
          color="secondary"
          variant="outlined"
          prepend-icon="ri-close-line"
          class="rounded-lg px-6 font-weight-medium"
          height="40"
          @click="onFormReset"
        >
          Cancelar
        </VBtn>

        <VBtn
          type="submit"
          color="primary"
          variant="elevated"
          prepend-icon="ri-save-3-line"
          class="rounded-lg px-6 font-weight-bold"
          height="40"
          @click="onFormSubmit"
        >
          Guardar
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
