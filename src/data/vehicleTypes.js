export const vehicleTypes = [
  { id: 1, name: 'Sedan' },
  { id: 2, name: 'Hatchback' },
  { id: 3, name: 'Camioneta' },
  { id: 4, name: 'SUV' },
  { id: 5, name: 'Furgoneta' },
  { id: 6, name: 'Camion' },
  { id: 7, name: 'Jeep' },
  { id: 8, name: 'Coupe' },
  { id: 9, name: 'Convertible' },
  { id: 10, name: 'Minivan' },
  { id: 11, name: 'Pickup' },
  { id: 12, name: 'Van' },
]

export const getVehicleTypeOptions = () => {
  return vehicleTypes.map(type => ({
    title: type.name,
    value: type.id,
  }))
}

export const getVehicleTypeNameById = id => {
  if (!id) return 'No especificado'
  
  // Soporte para IDs antiguos guardados como string o ids numéricos
  const numericId = parseInt(id)
  const type = vehicleTypes.find(t => t.id === numericId)
  
  // Si no se encuentra como ID numérico, buscar por nombre (compatibilidad con datos antiguos)
  if (!type) {
    const typeByName = vehicleTypes.find(t => t.name.toLowerCase() === String(id).toLowerCase())
    if (typeByName) return typeByName.name
  }
  
  return type ? type.name : id
}

export const getVehicleTypeColor = id => {
  const numericId = parseInt(id)

  const colors = {
    1: 'primary',      // Sedan
    2: 'info',         // Hatchback
    3: 'success',      // Camioneta
    4: 'warning',      // SUV
    5: 'secondary',    // Furgoneta
    6: 'error',        // Camion
    7: 'brown',        // Jeep
    8: 'deep-purple',  // Coupe
    9: 'pink',         // Convertible
    10: 'cyan',        // Minivan
    11: 'teal',        // Pickup
    12: 'indigo',       // Van
  }
  
  return colors[numericId] || 'grey'
}

export const vehicleUsageTypes = [
  { value: 'particular', title: 'Particular (~35 km/día)', icon: 'ri-car-line', color: 'primary' },
  { value: 'taxi', title: 'Taxi / Transporte (~130 km/día)', icon: 'ri-taxi-line', color: 'warning' },
  { value: 'comercial', title: 'Comercial / Flota (~80 km/día)', icon: 'ri-truck-line', color: 'info' },
  { value: 'pesado', title: 'Transporte Pesado (~160 km/día)', icon: 'ri-truck-fill', color: 'error' },
]

export const getVehicleUsageTypeOptions = () => {
  return vehicleUsageTypes.map(u => ({
    title: u.title,
    value: u.value,
  }))
}

export const getVehicleUsageTypeLabel = value => {
  const usage = vehicleUsageTypes.find(u => u.value === value)
  return usage ? usage.title : (value ? String(value).toUpperCase() : 'Particular')
}

