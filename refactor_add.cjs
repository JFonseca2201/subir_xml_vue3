const fs = require('fs');
const path = require('path');

const addFile = path.join(__dirname, 'src', 'pages', 'sales', 'add.vue');
let content = fs.readFileSync(addFile, 'utf8');

const newTemplate = `<template>
  <div class="pa-4 pa-sm-6 min-vh-100 bg-grey-lighten-4">
    <div style="max-width: 1000px; margin: 0 auto;">
      <!-- Cabecera Animada -->
      <div class="d-flex flex-column flex-sm-row justify-space-between align-start align-sm-center mb-8 gap-4">
        <div>
          <div class="d-flex align-center">
            <VAvatar color="primary" variant="tonal" size="64" class="mr-4 elevation-2">
              <VIcon icon="ri-shopping-cart-2-line" size="36" />
            </VAvatar>
            <div>
              <h1 class="text-h3 font-weight-black mb-1 text-grey-darken-4" style="letter-spacing: -1px;">Nueva Venta</h1>
              <p class="text-subtitle-1 text-primary font-weight-medium mb-0">Formulario Dinámico y Optimizado</p>
            </div>
          </div>
        </div>
        <VBtn color="secondary" variant="flat" size="large" prepend-icon="ri-arrow-left-line" to="/sales/list" class="rounded-pill text-none font-weight-bold px-6 elevation-2">
          Volver al Listado
        </VBtn>
      </div>

      <VForm ref="formRef" @submit.prevent="submitForm">
        
        <!-- 1. TIPO DE DOCUMENTO (Tarjetas interactivas) -->
        <VCard class="mb-8 elevation-3 rounded-xl border-0 overflow-hidden" style="background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(10px);">
          <div class="pa-6">
            <h2 class="text-h5 font-weight-bold mb-5 d-flex align-center text-grey-darken-3">
              <VAvatar color="primary" size="36" class="mr-3 text-white font-weight-bold shadow-sm">1</VAvatar>
              Selecciona el Documento
            </h2>
            <div class="d-flex gap-4 flex-wrap">
              <VCard :class="sale.document_type === 'quote' ? 'border-primary bg-primary-lighten-5 elevation-4 transform-scale-102' : 'border-opacity-25 bg-grey-lighten-5 hover:elevation-3'" class="flex-1 cursor-pointer rounded-xl transition-all border-2" style="transition: all 0.3s ease;" variant="flat" @click="sale.document_type = 'quote'; onDocumentTypeChange()">
                <VCardText class="pa-6 text-center">
                  <VIcon icon="ri-file-text-line" size="42" :color="sale.document_type === 'quote' ? 'primary' : 'grey-darken-1'" class="mb-3"/>
                  <div class="text-h6 font-weight-black" :class="sale.document_type === 'quote' ? 'text-primary' : 'text-grey-darken-1'">Cotización</div>
                </VCardText>
              </VCard>

              <VCard :class="sale.document_type === 'sale_note' ? 'border-success bg-success-lighten-5 elevation-4 transform-scale-102' : 'border-opacity-25 bg-grey-lighten-5 hover:elevation-3'" class="flex-1 cursor-pointer rounded-xl transition-all border-2" style="transition: all 0.3s ease;" variant="flat" @click="sale.document_type = 'sale_note'; onDocumentTypeChange()">
                <VCardText class="pa-6 text-center">
                  <VIcon icon="ri-file-list-3-line" size="42" :color="sale.document_type === 'sale_note' ? 'success' : 'grey-darken-1'" class="mb-3"/>
                  <div class="text-h6 font-weight-black" :class="sale.document_type === 'sale_note' ? 'text-success' : 'text-grey-darken-1'">Nota de Venta</div>
                </VCardText>
              </VCard>

              <VCard :class="sale.document_type === 'invoice' ? 'border-purple bg-purple-lighten-5 elevation-4 transform-scale-102' : 'border-opacity-25 bg-grey-lighten-5 hover:elevation-3'" class="flex-1 cursor-pointer rounded-xl transition-all border-2" style="transition: all 0.3s ease;" variant="flat" @click="sale.document_type = 'invoice'; onDocumentTypeChange()">
                <VCardText class="pa-6 text-center">
                  <VIcon icon="ri-bill-line" size="42" :color="sale.document_type === 'invoice' ? 'purple' : 'grey-darken-1'" class="mb-3"/>
                  <div class="text-h6 font-weight-black" :class="sale.document_type === 'invoice' ? 'text-purple' : 'text-grey-darken-1'">Factura Fiscal</div>
                </VCardText>
              </VCard>
            </div>
          </div>
        </VCard>

        <!-- 2. DATOS GENERALES -->
        <VCard class="mb-8 elevation-3 rounded-xl border-0 overflow-hidden" style="background: rgba(255, 255, 255, 0.9);">
          <div class="pa-6">
            <div class="d-flex align-center justify-space-between mb-6 pb-4 border-b">
              <h2 class="text-h5 font-weight-bold d-flex align-center text-grey-darken-3">
                <VAvatar color="primary" size="36" class="mr-3 text-white font-weight-bold shadow-sm">2</VAvatar>
                Datos del Cliente
              </h2>
              <VBtn color="info" variant="flat" prepend-icon="ri-download-cloud-line" class="rounded-pill font-weight-bold elevation-2 px-5" @click="openWorkOrderImportDialog">
                Importar OT
              </VBtn>
            </div>
            
            <VRow class="mt-2">
              <VCol cols="12" md="6">
                <label class="text-subtitle-2 font-weight-bold text-grey-darken-1 mb-2 d-block">Número de Documento</label>
                <VTextField v-model="sale.document_number" :rules="[requiredRule]" variant="solo-filled" density="comfortable" prepend-inner-icon="ri-hashtag" hide-details="auto" required readonly flat bg-color="grey-lighten-4" class="rounded-lg"/>
              </VCol>
              <VCol cols="12" md="6">
                <label class="text-subtitle-2 font-weight-bold text-grey-darken-1 mb-2 d-block">Fecha de Emisión</label>
                <VTextField v-model="sale.service_date" type="date" :rules="[requiredRule]" variant="outlined" density="comfortable" prepend-inner-icon="ri-calendar-line" hide-details="auto" required class="rounded-lg bg-white" />
              </VCol>
              <VCol cols="12">
                <label class="text-subtitle-2 font-weight-bold text-grey-darken-1 mb-2 d-block">Cliente Principal *</label>
                <div class="d-flex gap-3 align-start">
                  <VAutocomplete v-model="sale.client_id" :items="clients" :item-title="getClientName" item-value="id" :rules="[requiredRule]" variant="outlined" density="comfortable" prepend-inner-icon="ri-user-star-line" hide-details="auto" required placeholder="Buscar por nombre o cédula/RUC..." clearable :custom-filter="clientFilter" class="flex-grow-1 rounded-lg bg-white" bg-color="white">
                    <template #item="{ props, item }">
                      <VListItem v-bind="props" :title="getClientName(item.raw)" :subtitle="item.raw?.n_document" />
                    </template>
                  </VAutocomplete>
                  <VMenu>
                    <template #activator="{ props }">
                      <VBtn v-bind="props" color="primary" variant="flat" icon="ri-user-add-line" style="height: 48px; width: 48px;" class="rounded-lg elevation-2"/>
                    </template>
                    <VList class="rounded-lg elevation-4">
                      <VListItem prepend-icon="ri-user-line" title="Consumidor Final" @click="isClientFinalAddDialogVisible = true" />
                      <VListItem prepend-icon="ri-building-line" title="Empresa / Negocio" @click="isClientCompanyAddDialogVisible = true" />
                    </VList>
                  </VMenu>
                </div>
              </VCol>
              <VCol cols="12" md="6">
                <label class="text-subtitle-2 font-weight-bold text-grey-darken-1 mb-2 d-block">Asignar Vehículo (Opcional)</label>
                <div class="d-flex gap-3 align-start">
                  <VAutocomplete v-model="sale.vehicle_id" :items="vehicles" item-title="license_plate" item-value="id" variant="outlined" density="comfortable" prepend-inner-icon="ri-car-line" hide-details="auto" placeholder="Buscar placa..." clearable class="flex-grow-1 rounded-lg bg-white">
                    <template #item="{ props, item }">
                      <VListItem v-bind="props" :title="item.raw.license_plate" :subtitle="\`\${item.raw.model || ''}\`" />
                    </template>
                  </VAutocomplete>
                  <VBtn color="success" variant="flat" icon="ri-add-line" style="height: 48px; width: 48px;" class="rounded-lg elevation-2" @click="isVehicleAddDialogVisible = true"/>
                </div>
              </VCol>
              <VCol cols="12" md="6">
                <label class="text-subtitle-2 font-weight-bold text-grey-darken-1 mb-2 d-block">Kilometraje Actual (Opcional)</label>
                <VTextField v-model="sale.mileage" type="number" variant="outlined" density="comfortable" prepend-inner-icon="ri-speed-up-line" hide-details="auto" class="rounded-lg bg-white" placeholder="Ej. 45000"/>
              </VCol>
            </VRow>
          </div>
        </VCard>

        <!-- 3. PRODUCTOS Y SERVICIOS -->
        <VCard class="mb-8 elevation-4 rounded-xl border-0 overflow-hidden">
          <div class="bg-gradient-to-r from-primary to-primary-darken-1 pa-6 text-white position-relative overflow-hidden">
            <div class="position-absolute" style="top: -20px; right: -20px; opacity: 0.1;">
              <VIcon icon="ri-shopping-bag-3-fill" size="150" />
            </div>
            <h2 class="text-h5 font-weight-bold d-flex align-center position-relative z-10">
              <VAvatar color="white" size="36" class="mr-3 text-primary font-weight-black shadow-sm">3</VAvatar>
              Detalle de Productos o Servicios
            </h2>
          </div>
          <div class="bg-white pa-6">
            <VAutocomplete v-model="searchProduct" :items="products" item-title="displayTitle" return-object placeholder="Buscador inteligente: Ingresa código, nombre o categoría..." prepend-inner-icon="ri-search-2-line" variant="outlined" density="comfortable" clearable :custom-filter="productFilter" @update:model-value="onProductSelected" class="mb-6 rounded-lg elevation-1 bg-white" hide-details>
              <template #item="{ props, item }">
                <VListItem v-bind="props" :title="item.raw.name || item.raw.description" :subtitle="(item.raw.sku || item.raw.code) ? \`SKU: \${item.raw.sku || item.raw.code}\` : ''" />
              </template>
            </VAutocomplete>

            <div v-if="sale.items.length === 0" class="text-center pa-12 rounded-xl bg-grey-lighten-5 border-dashed border-2 border-opacity-25 border-primary my-6">
              <VIcon icon="ri-inbox-archive-line" size="72" color="grey-lighten-1" class="mb-4"/>
              <div class="text-h5 text-grey-darken-2 font-weight-bold mb-2">Aún no hay productos</div>
              <div class="text-body-1 text-grey">Utiliza el buscador superior para agregar ítems a la venta.</div>
            </div>

            <div v-else class="rounded-xl overflow-hidden border border-opacity-25 elevation-1">
              <VTable class="text-no-wrap">
                <thead class="bg-grey-lighten-4">
                  <tr>
                    <th class="text-uppercase text-caption font-weight-black text-grey-darken-2 py-4">Descripción del Ítem</th>
                    <th class="text-uppercase text-caption font-weight-black text-grey-darken-2 py-4" style="width: 120px;">Cantidad</th>
                    <th class="text-uppercase text-caption font-weight-black text-grey-darken-2 py-4" style="width: 150px;">P. Unitario</th>
                    <th class="text-uppercase text-caption font-weight-black text-grey-darken-2 py-4" style="width: 150px;">Descuento</th>
                    <th class="text-uppercase text-caption font-weight-black text-right text-grey-darken-2 py-4" style="width: 150px;">Subtotal</th>
                    <th style="width: 60px;"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(item, index) in sale.items" :key="item.id || item.product_id || index" class="hover-bg-grey-lighten-5 transition-colors">
                    <td class="pa-4">
                      <VTextField v-model="item.description" variant="outlined" density="compact" hide-details="auto" :rules="[requiredRule]" bg-color="white" class="rounded"/>
                    </td>
                    <td class="pa-4">
                      <VTextField v-model.number="item.quantity" type="number" min="1" variant="outlined" density="compact" hide-details="auto" :rules="[requiredRule]" bg-color="white" class="rounded font-weight-bold text-center"/>
                    </td>
                    <td class="pa-4">
                      <VTextField v-model.number="item.price" type="number" min="0" step="0.01" variant="outlined" density="compact" hide-details="auto" :rules="[requiredRule]" prefix="$" bg-color="white" class="rounded"/>
                    </td>
                    <td class="pa-4">
                      <VTextField v-model.number="item.discount" type="number" min="0" step="0.01" variant="outlined" density="compact" hide-details="auto" prefix="$" bg-color="white" class="rounded text-error"/>
                    </td>
                    <td class="pa-4 text-right text-subtitle-1 font-weight-black text-primary">
                      \${{ ((item.quantity * item.price) - (item.discount || 0)).toFixed(2) }}
                    </td>
                    <td class="pa-4 text-center">
                      <VBtn icon="ri-delete-bin-5-fill" variant="text" color="error" size="small" @click="removeItem(index)" class="rounded-circle hover-elevation-2 transition-all"/>
                    </td>
                  </tr>
                </tbody>
              </VTable>
            </div>
            
            <div class="mt-8">
              <label class="text-subtitle-1 font-weight-bold text-grey-darken-2 d-flex align-center mb-3">
                <VIcon icon="ri-edit-2-fill" class="mr-2 text-primary" size="20"/> Notas u Observaciones (Visible en PDF)
              </label>
              <VTextarea v-model="sale.observations" placeholder="Escribe aquí garantías, detalles del servicio, etc..." variant="outlined" density="comfortable" hide-details rows="3" class="rounded-xl" bg-color="grey-lighten-5"/>
            </div>
          </div>
        </VCard>

        <!-- 4. TOTALES Y PAGO -->
        <VCard class="mb-10 elevation-5 rounded-xl border-0 overflow-hidden" style="background: linear-gradient(145deg, #ffffff, #f8f9fa);">
          <div class="pa-8">
            <h2 class="text-h4 font-weight-black d-flex align-center text-grey-darken-4 mb-8 pb-4 border-b">
              <VAvatar color="primary" size="42" class="mr-4 text-white font-weight-black shadow-lg">4</VAvatar>
              Cierre y Pagos
            </h2>

            <VRow>
              <!-- Sección de Pagos -->
              <VCol cols="12" md="7" class="border-e pr-md-8">
                <template v-if="sale.document_type !== 'quote'">
                  <!-- Venta a Crédito Toggle -->
                  <div class="d-flex align-center justify-space-between mb-8 pa-5 bg-gradient-to-r from-primary-lighten-5 to-white rounded-xl border-2 border-primary border-opacity-25 elevation-1">
                    <div class="d-flex align-center">
                      <VAvatar color="primary" variant="elevated" size="48" class="mr-4 shadow-sm">
                         <VIcon icon="ri-hand-coin-fill" size="24" color="white"/>
                      </VAvatar>
                      <div>
                        <div class="font-weight-black text-primary text-h6">¿Enviar a Cuentas por Cobrar?</div>
                        <div class="text-caption text-grey-darken-1 mt-1 font-weight-medium">Activa esto si el cliente pagará a crédito o en cuotas.</div>
                      </div>
                    </div>
                    <VSwitch v-model="sale.is_credited" color="primary" density="comfortable" hide-details inset @change="onCreditChange" class="ml-4 transform-scale-125" />
                  </div>

                  <!-- Distribución de Pagos -->
                  <div v-if="!sale.is_credited" class="animate-fade-in">
                    <div class="d-flex justify-space-between align-center mb-6">
                      <span class="text-h6 font-weight-bold text-grey-darken-3">Métodos de Pago Recibidos</span>
                      <VBtn color="primary" variant="tonal" prepend-icon="ri-add-circle-fill" class="rounded-pill font-weight-black px-5 elevation-1" @click="addPaymentDistribution">Agregar Otro</VBtn>
                    </div>
                    
                    <div class="d-flex flex-column gap-5">
                      <VCard v-for="(dist, index) in paymentDistributions" :key="dist.id || index" variant="flat" class="rounded-xl border border-opacity-25 bg-white elevation-2">
                        <div class="pa-5 position-relative">
                          <VBtn v-if="paymentDistributions.length > 1" icon="ri-close-circle-fill" size="small" variant="text" color="error" class="position-absolute" style="top: 10px; right: 10px; z-index: 2;" @click="removePaymentDistribution(index)"/>
                          
                          <div class="text-subtitle-1 font-weight-black mb-4 text-primary d-flex align-center">
                            <VIcon icon="ri-wallet-3-fill" size="24" class="mr-2"/> Pago #{{ index + 1 }}
                          </div>
                          <VRow dense class="align-center">
                            <VCol cols="12" sm="4">
                              <label class="text-caption font-weight-bold text-grey-darken-1 mb-1 d-block">Forma</label>
                              <VSelect v-model="dist.payment_method" :items="paymentMethods" item-title="title" item-value="value" variant="outlined" density="comfortable" hide-details :rules="[requiredRule]" @update:model-value="(val) => onPaymentMethodChange(dist, val)" class="rounded-lg"/>
                            </VCol>
                            <VCol cols="12" sm="4">
                              <label class="text-caption font-weight-bold text-grey-darken-1 mb-1 d-block">Destino</label>
                              <VSelect v-if="dist.payment_method === 'Transferencia'" v-model="dist.account_id" :items="accounts" item-title="name" item-value="id" variant="outlined" density="comfortable" hide-details :rules="[requiredRule]" class="rounded-lg"/>
                              <VTextField v-else :value="dist.payment_method === 'Efectivo' ? 'Caja Fuerte / Efectivo' : ''" variant="solo-filled" density="comfortable" hide-details bg-color="grey-lighten-4" flat readonly class="rounded-lg"/>
                              <input v-if="dist.payment_method === 'Efectivo'" v-model="dist.account_id" type="hidden">
                            </VCol>
                            <VCol cols="12" sm="4">
                              <label class="text-caption font-weight-bold text-grey-darken-1 mb-1 d-block">Valor ($)</label>
                              <VTextField v-model.number="dist.amount" type="number" min="0" step="0.01" variant="outlined" density="comfortable" hide-details :rules="[requiredRule]" prefix="$" class="font-weight-black text-h6 rounded-lg text-primary"/>
                            </VCol>
                          </VRow>
                        </div>
                      </VCard>
                    </div>

                    <div v-if="paymentDistributions.length > 0" class="mt-6 pa-5 rounded-xl d-flex justify-space-between align-center elevation-2 transition-colors" :class="remainingAmount === 0 ? 'bg-success text-white' : 'bg-error text-white'">
                      <span class="text-h6 font-weight-bold d-flex align-center">
                        <VIcon :icon="remainingAmount === 0 ? 'ri-checkbox-circle-fill' : 'ri-error-warning-fill'" size="28" class="mr-3"/>
                        {{ remainingAmount === 0 ? 'Distribución Exacta' : 'Monto Pendiente de Asignar' }}
                      </span>
                      <span class="text-h4 font-weight-black">\${{ Math.abs(remainingAmount).toFixed(2) }}</span>
                    </div>
                  </div>
                </template>
                <div v-else class="h-100 d-flex flex-column align-center justify-center text-center pa-8 bg-grey-lighten-5 rounded-xl border-dashed border-2">
                  <VIcon icon="ri-file-search-line" size="80" color="grey-lighten-1" class="mb-4"/>
                  <h3 class="text-h5 font-weight-bold text-grey-darken-2 mb-2">Modo Cotización</h3>
                  <p class="text-body-1 text-grey-darken-1">No necesitas registrar pagos. Este documento es solo informativo y no afecta las finanzas ni el inventario real.</p>
                </div>
              </VCol>

              <!-- Resumen de Totales (Gran Formato) -->
              <VCol cols="12" md="5" class="pl-md-8 d-flex flex-column justify-center">
                <div class="pa-8 rounded-xl bg-white border-2 border-primary border-opacity-25 elevation-3 position-relative overflow-hidden">
                  <div class="position-absolute" style="top: 0; left: 0; right: 0; height: 6px; background: linear-gradient(90deg, var(--v-theme-primary), var(--v-theme-info));"></div>
                  
                  <h3 class="text-h5 font-weight-black text-grey-darken-3 mb-6">Resumen Financiero</h3>
                  
                  <div class="d-flex justify-space-between mb-4 text-h6">
                    <span class="text-grey-darken-1 font-weight-medium">Subtotal:</span>
                    <span class="font-weight-bold text-grey-darken-4">\${{ grossSubtotal.toFixed(2) }}</span>
                  </div>
                  <div v-if="totalDiscount > 0" class="d-flex justify-space-between mb-4 text-h6 text-error">
                    <span class="font-weight-medium">Descuentos Aplicados:</span>
                    <span class="font-weight-black">-\${{ totalDiscount.toFixed(2) }}</span>
                  </div>
                  <div class="d-flex justify-space-between mb-4 text-h6">
                    <span class="text-grey-darken-1 font-weight-medium">Base Imponible:</span>
                    <span class="font-weight-bold text-grey-darken-4">\${{ subtotal.toFixed(2) }}</span>
                  </div>
                  <div v-if="sale.document_type === 'invoice'" class="d-flex justify-space-between mb-6 text-h6">
                    <span class="text-grey-darken-1 font-weight-medium">IVA (15%):</span>
                    <span class="font-weight-bold text-grey-darken-4">\${{ taxAmount.toFixed(2) }}</span>
                  </div>
                  
                  <VDivider class="my-6 border-opacity-50"/>
                  
                  <div class="text-center mt-4">
                    <div class="text-h6 text-grey-darken-2 text-uppercase letter-spacing-1 font-weight-black mb-2">
                      {{ sale.document_type === 'quote' ? 'TOTAL COTIZACIÓN' : 'TOTAL A PAGAR' }}
                    </div>
                    <div class="text-h1 font-weight-black text-primary" style="font-size: 4.5rem !important;">
                      <span class="text-h3 mr-1">$</span>{{ total.toFixed(2) }}
                    </div>
                  </div>
                </div>
              </VCol>
            </VRow>
          </div>
        </VCard>

        <!-- Errores y Botones Finales (Mega Botones) -->
        <VAlert v-if="showValidationError" color="error" variant="elevated" class="mb-8 rounded-xl elevation-3" border="start" closable @click:close="showValidationError = false">
          <div class="d-flex align-center pa-2">
            <VIcon icon="ri-error-warning-fill" class="mr-4" size="32"/>
            <span class="text-h6 font-weight-bold">{{ validationErrorMessage }}</span>
          </div>
        </VAlert>

        <div class="d-flex flex-column flex-sm-row justify-center gap-6 mb-12 mt-6">
          <VBtn variant="tonal" color="secondary" size="x-large" class="rounded-pill font-weight-bold px-10" to="/sales/list" :disabled="loader.loading" style="height: 64px; font-size: 1.1rem;">
            Cancelar
          </VBtn>
          
          <VBtn v-if="sale.document_type !== 'quote'" color="warning" variant="elevated" size="x-large" class="rounded-pill font-weight-bold px-10 elevation-3" :loading="loader.loading" @click.prevent="dispatchSale" style="height: 64px; font-size: 1.1rem;">
            <VIcon icon="ri-truck-fill" class="mr-3" size="24"/> Despachar Mercadería
          </VBtn>

          <VBtn type="submit" color="primary" size="x-large" class="rounded-pill font-weight-black px-12 elevation-5 text-white" :loading="loader.loading" style="height: 64px; font-size: 1.2rem; min-width: 300px;">
            <VIcon icon="ri-check-double-fill" class="mr-3" size="28"/>
            {{ sale.document_type === 'quote' ? 'Generar Cotización' : (sale.is_credited ? 'Registrar Venta a Crédito' : 'Cobrar y Finalizar') }}
          </VBtn>
        </div>
      </VForm>
    </div>

    <!-- Diálogos se mantienen igual -->
    <ClientFinalAddDialog v-if="isClientFinalAddDialogVisible" v-model:isDialogVisible="isClientFinalAddDialogVisible" @add-client-final="handleClientAdded" />
    <ClientCompanyAddDialog v-if="isClientCompanyAddDialogVisible" v-model:isDialogVisible="isClientCompanyAddDialogVisible" @add-client-company="handleClientAdded" />
    <VehicleAddDialog v-if="isVehicleAddDialogVisible" v-model:isDialogVisible="isVehicleAddDialogVisible" @add-vehicle="handleVehicleAdded" />

    <!-- Diálogo OT optimizado visualmente -->
    <VDialog v-model="isWorkOrderImportDialogVisible" max-width="900px">
      <VCard class="rounded-xl border-0 elevation-10">
        <VCardTitle class="bg-gradient-to-r from-info to-info-darken-1 pa-6 text-white">
          <div class="d-flex align-center justify-space-between">
            <span class="text-h5 font-weight-black d-flex align-center">
              <VIcon icon="ri-download-cloud-fill" class="mr-3"/> Importar Orden de Trabajo
            </span>
            <VBtn icon="ri-close-circle-fill" variant="text" size="large" color="white" @click="isWorkOrderImportDialogVisible = false" />
          </div>
        </VCardTitle>
        <VCardText class="pa-0">
          <div v-if="isLoadingWorkOrders" class="text-center pa-12">
            <VProgressCircular indeterminate color="info" size="80" width="8" />
            <p class="mt-6 text-h5 text-grey-darken-2 font-weight-bold">Buscando órdenes listas...</p>
          </div>
          <div v-else-if="readyWorkOrders.length === 0" class="text-center pa-12 bg-grey-lighten-5">
            <VIcon icon="ri-inbox-archive-fill" size="100" color="grey-lighten-1" />
            <p class="mt-6 text-h5 text-grey-darken-2 font-weight-bold">No hay órdenes listas para facturar</p>
          </div>
          <VTable v-else hover class="bg-white">
            <thead class="bg-grey-lighten-4">
              <tr>
                <th class="font-weight-black text-uppercase text-caption text-grey-darken-3 py-4">Orden</th>
                <th class="font-weight-black text-uppercase text-caption text-grey-darken-3 py-4">Cliente</th>
                <th class="font-weight-black text-uppercase text-caption text-grey-darken-3 py-4">Vehículo</th>
                <th class="font-weight-black text-uppercase text-caption text-grey-darken-3 py-4 text-center">Acción</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="wo in readyWorkOrders" :key="wo.id" class="hover-bg-grey-lighten-5 transition-colors">
                <td class="pa-4 font-weight-black text-info text-h6">{{ wo.number }}</td>
                <td class="pa-4 font-weight-bold text-grey-darken-3">{{ getClientName(wo.client) }}</td>
                <td class="pa-4 text-grey-darken-1">{{ wo.vehicle ? \`\${wo.vehicle.license_plate}\` : 'N/A' }}</td>
                <td class="pa-4 text-center">
                  <VBtn color="info" variant="elevated" size="large" class="rounded-pill font-weight-bold elevation-2" @click="selectWorkOrder(wo)">Importar Ahora</VBtn>
                </td>
              </tr>
            </tbody>
          </VTable>
        </VCardText>
      </VCard>
    </VDialog>
  </div>
</template>`;

const match = content.match(/<template>[\s\S]*<\/template>/);
if (match) {
    content = content.replace(match[0], newTemplate);
    fs.writeFileSync(addFile, content, 'utf8');
    console.log("Successfully replaced template in add.vue with ULTRA PREMIUM vertical layout");
} else {
    console.log("Template tag not found in add.vue");
}
