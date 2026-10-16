<script setup>
import { computed, ref } from 'vue'
import { useGlobalToast } from '@/composables/useGlobalToast'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  item: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['update:isDialogVisible'])

const { showNotification } = useGlobalToast()
const copiedField = ref(null)

const TAX_RATE = 0.15 // IVA Ecuador 15%

const closeDialog = () => {
  emit('update:isDialogVisible', false)
}

const formatCurrency = val => {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(val) || 0)
}

// Cálculos de precios
const normalPrice = computed(() => {
  return Number(props.item?.price) || 0
})

const ivaAmount = computed(() => {
  return normalPrice.value * TAX_RATE
})

const priceWithIva = computed(() => {
  return normalPrice.value + ivaAmount.value
})

// Código auxiliar / secundario
const secondaryCode = computed(() => {
  if (!props.item) return null

  return props.item.reference || props.item.category_code || null
})

// Nombre / Descripción completa del repuesto
const fullName = computed(() => {
  if (!props.item) return ''

  return props.item.description || props.item.category_name || props.item.code || ''
})

const getStockPillClass = status => {
  if (!status) return 'status-canceled'
  const s = status.toLowerCase()
  if (s.includes('disponible')) return 'status-paid'
  if (s.includes('stock <=') || s.includes('bajo') || s.includes('10')) return 'status-partial'
  if (s.includes('tránsito') || s.includes('transito')) return 'status-transfer'
  
  return 'status-primary'
}

const copyText = async (text, label = 'Texto') => {
  if (!text) return
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      const el = document.createElement('textarea')

      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    copiedField.value = label
    showNotification(`${label} copiado al portapapeles`, 'info')
    setTimeout(() => {
      if (copiedField.value === label) copiedField.value = null
    }, 2000)
  } catch (err) {
    console.error('Error al copiar:', err)
  }
}
</script>

<template>
  <VDialog
    :model-value="props.isDialogVisible"
    max-width="500"
    scrollable
    transition="dialog-bottom-transition"
    class="distributor-item-dialog"
    @update:model-value="closeDialog"
  >
    <VCard
      v-if="props.item"
      class="elevation-12 rounded-xl border overflow-hidden bg-surface"
    >
      <!-- 1. ENCABEZADO SUPERIOR: CÓDIGO Y PRECIO DE VENTA / CATÁLOGO -->
      <div class="dialog-header-banner pa-4 pa-sm-5 border-b">
        <div class="d-flex align-start justify-space-between gap-3 mb-2">
          <!-- Código Principal -->
          <div class="min-w-0 flex-grow-1">
            <div class="d-flex align-center gap-1.5 mb-1">
              <span class="text-caption font-weight-bold text-uppercase text-medium-emphasis tracking-wider">
                CÓDIGO DE REPUESTO
              </span>
              <div
                class="status-pill-clean"
                :class="getStockPillClass(props.item.stock_status)"
              >
                <span class="status-dot" />
                <span>{{ props.item.stock_status || 'Disponible' }}</span>
              </div>
            </div>

            <!-- Código Grande con botón de copia -->
            <div
              class="d-inline-flex align-center gap-2 cursor-pointer code-badge-interactive"
              title="Toca para copiar código"
              @click="copyText(props.item.code, 'Código')"
            >
              <span class="font-mono font-weight-black text-h5 text-primary tracking-wide">
                {{ props.item.code }}
              </span>
              <VBtn
                icon
                size="x-small"
                variant="tonal"
                color="primary"
                class="rounded-circle"
              >
                <VIcon
                  :icon="copiedField === 'Código' ? 'ri-check-line' : 'ri-file-copy-line'"
                  size="15"
                />
              </VBtn>
            </div>
          </div>

          <!-- Botón de Cerrar (X) -->
          <VBtn
            icon="ri-close-line"
            variant="text"
            size="small"
            color="default"
            class="ms-auto flex-shrink-0"
            @click="closeDialog"
          />
        </div>

        <!-- Encabezado Inferior: Precio Catálogo / Venta Distribuidor -->
        <div class="header-price-chip-row d-flex align-center justify-space-between flex-wrap gap-2 pt-2 border-t border-dashed">
          <div class="d-flex align-center gap-1.5 text-caption text-medium-emphasis font-weight-medium">
            <VIcon
              icon="ri-price-tag-3-line"
              size="15"
              color="primary"
            />
            <span>Precio Catálogo / Venta:</span>
          </div>
          <div class="text-right">
            <span class="font-mono font-weight-bold text-subtitle-1 text-primary">
              {{ formatCurrency(normalPrice) }}
            </span>
          </div>
        </div>
      </div>

      <!-- 2. CUERPO DEL DIÁLOGO (BODY EN MEDIO) -->
      <VCardText class="pa-4 pa-sm-5 d-flex flex-column gap-3.5">
        <!-- A. Nombre Completo / Descripción Extensa -->
        <div class="detail-section-box pa-3.5 rounded-lg border bg-surface">
          <div class="d-flex align-center justify-space-between gap-2 mb-2">
            <div class="d-flex align-center gap-1.5 text-caption font-weight-bold text-uppercase text-medium-emphasis">
              <VIcon
                icon="ri-tools-line"
                size="15"
                color="primary"
              />
              <span>Nombre / Descripción Completa</span>
            </div>
            <VBtn
              size="x-small"
              variant="text"
              color="primary"
              prepend-icon="ri-file-copy-line"
              class="px-2 font-weight-semibold"
              @click="copyText(fullName, 'Descripción')"
            >
              Copiar
            </VBtn>
          </div>
          <p
            class="text-body-1 font-weight-bold text-high-emphasis mb-0 full-name-text"
            style="line-height: 1.45; word-break: break-word; user-select: text;"
          >
            {{ fullName }}
          </p>
        </div>

        <!-- B. Código Secundario o Auxiliar (Referencia OEM) -->
        <div class="detail-section-box pa-3.5 rounded-lg border bg-surface">
          <div class="d-flex align-center justify-space-between gap-2 mb-1.5">
            <div class="d-flex align-center gap-1.5 text-caption font-weight-bold text-uppercase text-medium-emphasis">
              <VIcon
                icon="ri-barcode-line"
                size="15"
                color="secondary"
              />
              <span>Código Secundario / Auxiliar</span>
            </div>
            <VBtn
              v-if="secondaryCode"
              size="x-small"
              variant="text"
              color="secondary"
              prepend-icon="ri-file-copy-line"
              class="px-2 font-weight-semibold"
              @click="copyText(secondaryCode, 'Código Secundario')"
            >
              Copiar
            </VBtn>
          </div>

          <div v-if="secondaryCode">
            <span class="font-mono font-weight-bold text-body-1 text-slate-800 bg-slate-100 px-2.5 py-1 rounded d-inline-block">
              {{ secondaryCode }}
            </span>
          </div>
          <div
            v-else
            class="text-caption text-disabled font-italic"
          >
            No registra código secundario ni referencia auxiliar
          </div>
        </div>

        <!-- C. Distribuidor y Categoría (Metadatos Adicionales) -->
        <div class="d-flex align-center justify-space-between flex-wrap gap-2 pt-1">
          <div
            v-if="props.item.supplier_name"
            class="d-flex align-center gap-1.5 text-caption"
          >
            <VIcon
              icon="ri-truck-line"
              size="15"
              class="text-medium-emphasis"
            />
            <span class="text-medium-emphasis">Distribuidor:</span>
            <span class="font-weight-bold text-high-emphasis">{{ props.item.supplier_name }}</span>
          </div>

          <div
            v-if="props.item.category_name"
            class="d-flex align-center gap-1.5 text-caption ms-auto"
          >
            <span class="text-medium-emphasis">Categoría:</span>
            <span class="font-weight-bold text-primary">{{ props.item.category_name }}</span>
          </div>
        </div>

        <!-- 3. SECCIÓN DE PRECIOS (PRECIO NORMAL, AL LADO CON IVA = PRECIO DE COMPRA) -->
        <div class="purchase-pricing-card pa-4 rounded-xl border mt-1">
          <div class="d-flex align-center justify-space-between mb-3 pb-2 border-b">
            <div class="d-flex align-center gap-2">
              <VAvatar
                size="26"
                color="success"
                variant="tonal"
                rounded="circle"
              >
                <VIcon
                  icon="ri-money-dollar-circle-line"
                  size="16"
                />
              </VAvatar>
              <span class="text-caption font-weight-bold text-uppercase text-success tracking-wide">
                Nuestro Precio de Compra (Costo)
              </span>
            </div>
            <span class="text-caption text-medium-emphasis font-weight-medium">
              IVA 15%
            </span>
          </div>

          <!-- Filas de Desglose: Normal y con IVA al lado -->
          <div class="d-flex align-center justify-space-between gap-3 mb-2.5">
            <!-- Precio Normal (Sin IVA) -->
            <div class="price-stat-item flex-grow-1 pa-2.5 rounded-lg bg-surface border text-center">
              <div class="text-caption text-medium-emphasis font-weight-medium mb-0.5">
                Precio Normal (Sin IVA)
              </div>
              <div class="font-mono font-weight-bold text-body-1 text-high-emphasis">
                {{ formatCurrency(normalPrice) }}
              </div>
            </div>

            <!-- IVA 15% -->
            <div class="price-stat-item flex-grow-1 pa-2.5 rounded-lg bg-surface border text-center">
              <div class="text-caption text-medium-emphasis font-weight-medium mb-0.5">
                + IVA (15%)
              </div>
              <div class="font-mono font-weight-bold text-body-1 text-medium-emphasis">
                {{ formatCurrency(ivaAmount) }}
              </div>
            </div>
          </div>

          <!-- Total Destacado: Precio ya con IVA -->
          <div class="total-with-iva-box pa-3 rounded-lg d-flex align-center justify-space-between gap-3">
            <div>
              <div class="text-caption font-weight-bold text-uppercase text-emerald-800">
                Precio Total con IVA
              </div>
              <div class="text-caption text-emerald-700 iva-subcaption">
                Costo neto de adquisición
              </div>
            </div>
            <div class="text-right">
              <div class="font-mono font-weight-black text-h5 text-emerald-900 total-price-val">
                {{ formatCurrency(priceWithIva) }}
              </div>
            </div>
          </div>
        </div>
      </VCardText>

      <!-- 4. BOTONCITO PARA CERRAR -->
      <VCardActions class="pa-4 pt-1 bg-surface border-t">
        <VBtn
          color="secondary"
          variant="tonal"
          block
          size="large"
          prepend-icon="ri-close-line"
          class="font-weight-bold rounded-lg"
          @click="closeDialog"
        >
          Cerrar
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped lang="scss">
.font-mono {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace !important;
}

.tracking-wider {
  letter-spacing: 0.05em;
}

.tracking-wide {
  letter-spacing: 0.02em;
}

.dialog-header-banner {
  background: linear-gradient(180deg, rgba(var(--v-theme-primary), 0.05) 0%, rgba(var(--v-theme-surface), 0) 100%);
}

.code-badge-interactive {
  transition: transform 0.15s ease, opacity 0.15s ease;
  user-select: all;

  &:hover {
    transform: translateX(2px);
  }
}

.detail-section-box {
  background-color: rgba(var(--v-theme-on-surface), 0.02) !important;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: rgba(var(--v-theme-on-surface), 0.04) !important;
  }
}

.full-name-text {
  font-size: 1rem !important;
  color: rgba(var(--v-theme-on-surface), 0.95);
}

.purchase-pricing-card {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.06) 0%, rgba(5, 150, 105, 0.02) 100%);
  border-color: rgba(16, 185, 129, 0.25) !important;
}

.total-with-iva-box {
  background-color: #ecfdf5;
  border: 1px solid #a7f3d0;
}

.text-emerald-700 {
  color: #047857 !important;
}

.text-emerald-800 {
  color: #065f46 !important;
}

.text-emerald-900 {
  color: #064e3b !important;
}

.iva-subcaption {
  font-size: 0.72rem !important;
}

.total-price-val {
  line-height: 1 !important;
}

.bg-slate-100 {
  background-color: #f1f5f9 !important;
}

.text-slate-800 {
  color: #1e293b !important;
}

// Status Pills (Estilo idéntico a catálogo)
.status-pill-clean {
  display: inline-flex !important;
  align-items: center !important;
  gap: 5px !important;
  padding: 2px 8px !important;
  border-radius: 9999px !important;
  font-size: 0.70rem !important;
  font-weight: 700 !important;
  white-space: nowrap !important;
  line-height: 1 !important;
  text-transform: uppercase !important;

  .status-dot {
    width: 6px !important;
    height: 6px !important;
    border-radius: 50% !important;
    flex-shrink: 0 !important;
  }
}

.status-paid {
  background-color: #ecfdf5 !important;
  color: #065f46 !important;
  border: 1px solid #a7f3d0 !important;

  .status-dot {
    background-color: #10b981 !important;
  }
}

.status-partial {
  background-color: #fffbeb !important;
  color: #92400e !important;
  border: 1px solid #fde68a !important;

  .status-dot {
    background-color: #f59e0b !important;
  }
}

.status-transfer {
  background-color: #eff6ff !important;
  color: #1e40af !important;
  border: 1px solid #bfdbfe !important;

  .status-dot {
    background-color: #3b82f6 !important;
  }
}

.status-primary {
  background-color: #f5f3ff !important;
  color: #5b21b6 !important;
  border: 1px solid #ddd6fe !important;

  .status-dot {
    background-color: #7c3aed !important;
  }
}

.status-canceled {
  background-color: #f1f5f9 !important;
  color: #475569 !important;
  border: 1px solid #cbd5e1 !important;

  .status-dot {
    background-color: #94a3b8 !important;
  }
}
</style>
