<script setup>
import { ref, computed, onMounted } from 'vue'
import { $api } from '@/utils/api'

const props = defineProps({
    isDialogVisible: {
        type: Boolean,
        required: true,
    }
})

const emit = defineEmits(['update:isDialogVisible', 'selectEmployee'])

// Estado
const loading = ref(false)
const searchQuery = ref('')
const employees = ref([])
const selectedEmployee = ref(null)

// Headers para la tabla
const headers = ref([
    { title: 'ID', key: 'id', sortable: true },
    { title: 'Nombre', key: 'full_name', sortable: true },
    { title: 'DNI', key: 'dni', sortable: true },
    { title: 'Cargo', key: 'position', sortable: true },
    { title: 'Salario', key: 'salary', sortable: true },
    { title: 'Estado', key: 'status', sortable: true },
    { title: 'Acciones', key: 'actions', sortable: false }
])

// Computed properties
const filteredEmployees = computed(() => {
    if (!searchQuery.value) return employees.value

    const query = searchQuery.value.toLowerCase()
    return employees.value.filter(employee =>
        (employee.name && employee.name.toLowerCase().includes(query)) ||
        (employee.surname && employee.surname.toLowerCase().includes(query)) ||
        (employee.full_name && employee.full_name.toLowerCase().includes(query)) ||
        (employee.dni && employee.dni.toLowerCase().includes(query)) ||
        (employee.position && employee.position.toLowerCase().includes(query)) ||
        (employee.email && employee.email.toLowerCase().includes(query))
    )
})

const getEmployeeStatus = (state) => {
    return state === 1 ? 'Activo' : 'Inactivo'
}

const getStatusColor = (state) => {
    return state === 1 ? 'success' : 'error'
}

const getDepartmentColor = (department) => {
    const colors = {
        'Ventas': 'success',
        'Administración': 'primary',
        'Técnico': 'warning',
        'Contabilidad': 'info',
        'Recursos Humanos': 'purple',
        'Logística': 'orange',
        'Marketing': 'pink'
    }
    return colors[department] || 'grey'
}

const getPaymentTypeColor = (type) => {
    const colors = {
        'Quincenal': 'warning',
        'Mensual': 'info',
        'Semanal': 'primary'
    }
    return colors[type] || 'grey'
}

const formatCurrency = (amount) => {
    if (!amount || amount === 0) return '$0.00'
    return new Intl.NumberFormat('es-EC', {
        style: 'currency',
        currency: 'USD'
    }).format(amount)
}

// Métodos
const loadEmployees = async () => {
    loading.value = true
    try {
        const resp = await $api("employees", {
            method: "GET",
            onResponseError({ response }) {
                console.error('Error response:', response._data);
            },
        });

        if (resp.status === 200) {
            // La API devuelve datos paginados según el controlador
            employees.value = resp.data?.employees || [];
        } else {
            // En caso de error, usar datos simulados
            const mockEmployees = [
                {
                    id: 1,
                    name: 'Carlos',
                    surname: 'Rodríguez',
                    full_name: 'Carlos Rodríguez',
                    position: 'Vendedor Senior',
                    salary: 1500.00,
                    status: 1,
                    email: 'carlos@empresa.com',
                    phone: '0987654321',
                    hire_date: '2022-03-15',
                    dni: '1712345678'
                },
                {
                    id: 2,
                    name: 'Ana',
                    surname: 'Martínez',
                    full_name: 'Ana Martínez',
                    position: 'Asistente Administrativa',
                    salary: 1200.00,
                    status: 1,
                    email: 'ana@empresa.com',
                    phone: '0987654322',
                    hire_date: '2021-08-20',
                    dni: '1723456789'
                },
                {
                    id: 3,
                    name: 'Luis',
                    surname: 'Sánchez',
                    full_name: 'Luis Sánchez',
                    position: 'Técnico Especialista',
                    salary: 1800.00,
                    status: 1,
                    email: 'luis@empresa.com',
                    phone: '0987654323',
                    hire_date: '2020-05-10',
                    dni: '1734567890'
                }
            ]
            employees.value = mockEmployees
        }
    } catch (error) {
        console.error('Error al cargar empleados:', error);
        // En caso de error, usar datos simulados
        employees.value = [];
    } finally {
        loading.value = false;
    }
}

const selectEmployee = (employee) => {
    selectedEmployee.value = employee
    emit('selectEmployee', employee)
    closeDialog()
}

const closeDialog = () => {
    emit('update:isDialogVisible', false)
    selectedEmployee.value = null
    searchQuery.value = ''
}

// Montar componente
onMounted(() => {
    if (props.isDialogVisible) {
        loadEmployees()
    }
})

// Watch para cargar datos cuando se abre el diálogo
const watchDialogVisible = () => {
    if (props.isDialogVisible && employees.value.length === 0) {
        loadEmployees()
    }
}
</script>

<template>
    <VDialog max-width="1200" v-model="props.isDialogVisible" persistent>
        <VCard class="pa-sm-8 pa-4">
            <!-- Botón cerrar -->
            <DialogCloseBtn variant="text" size="default" @click="closeDialog" />

            <!-- Header -->
            <VCardText class="text-center pb-6">
                <VIcon icon="ri-team-line" size="42" color="primary" class="mb-3" />
                <h4 class="text-h4 font-weight-bold mb-1">Lista de Empleados</h4>
                <p class="text-body-2 text-medium-emphasis">
                    Seleccione un empleado de la lista
                </p>
            </VCardText>

            <VDivider class="mb-6" />

            <!-- Buscador -->
            <VCardText class="pb-4">
                <VTextField v-model="searchQuery" label="Buscar empleado..." prepend-inner-icon="ri-search-line"
                    placeholder="Buscar por nombre, cargo, departamento..." clearable variant="outlined"
                    density="compact" />
            </VCardText>

            <!-- Tabla de empleados -->
            <VCardText>
                <VDataTable :headers="headers" :items="filteredEmployees" :loading="loading"
                    loading-text="Cargando empleados..." no-data-text="No se encontraron empleados" class="elevation-1"
                    :items-per-page="10" :sort-by="[{ key: 'full_name', order: 'asc' }]">
                    <!-- Columna de nombre -->
                    <template #item.full_name="{ item }">
                        <div class="d-flex align-center">
                            <VAvatar size="32" color="primary" class="me-2">
                                <VIcon size="16" icon="ri-user-3-line" />
                            </VAvatar>
                            <div>
                                <div class="text-body-2 font-weight-medium">{{ item.full_name }}</div>
                                <div class="text-caption text-medium-emphasis">{{ item.email }}</div>
                            </div>
                        </div>
                    </template>

                    <!-- Columna de cargo -->
                    <template #item.position="{ item }">
                        <div class="text-body-2">{{ item.position }}</div>
                    </template>

                    <!-- Columna de departamento -->
                    <template #item.department="{ item }">
                        <VChip :color="getDepartmentColor(item.department)" size="small" variant="tonal">
                            {{ item.department }}
                        </VChip>
                    </template>

                    <!-- Columna de salario -->
                    <template #item.salary="{ item }">
                        <div class="text-body-2 font-weight-bold text-success">
                            {{ formatCurrency(item.salary) }}
                        </div>
                    </template>

                    <!-- Columna de tipo de pago -->
                    <template #item.type_payment="{ item }">
                        <VChip :color="getPaymentTypeColor(item.type_payment)" size="small" variant="tonal">
                            {{ item.type_payment }}
                        </VChip>
                    </template>

                    <!-- Columna de estado -->
                    <template #item.state="{ item }">
                        <VChip :color="getStatusColor(item.state)" size="small" variant="tonal">
                            {{ getEmployeeStatus(item.state) }}
                        </VChip>
                    </template>

                    <!-- Columna de acciones -->
                    <template #item.actions="{ item }">
                        <div class="d-flex gap-1">
                            <VBtn color="primary" variant="tonal" size="small" prepend-icon="ri-check-line"
                                @click="selectEmployee(item)">
                                Seleccionar
                            </VBtn>
                        </div>
                    </template>
                </VDataTable>
            </VCardText>

            <VDivider class="mt-6" />

            <!-- Actions -->
            <VCardActions class="pa-4">
                <VBtn color="primary" variant="tonal" prepend-icon="ri-refresh-line" @click="loadEmployees"
                    :loading="loading" :disabled="loading">
                    Actualizar
                </VBtn>
                <VSpacer />
                <VBtn variant="outlined" color="secondary" prepend-icon="ri-close-line" @click="closeDialog">
                    Cerrar
                </VBtn>
            </VCardActions>
        </VCard>
    </VDialog>
</template>

<style scoped>
.v-card-title {
    border-radius: 12px 12px 0 0;
}

.text-h6 {
    color: #1976D2;
    border-bottom: 2px solid #1976D2;
    padding-bottom: 8px;
    margin-bottom: 16px;
}

.v-data-table {
    border-radius: 8px;
}

.v-avatar {
    background: linear-gradient(135deg, #1976D2 0%, #42A5F5 100%);
}
</style>
