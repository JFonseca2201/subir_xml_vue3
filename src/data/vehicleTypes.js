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
    value: type.id
  }))
}

export const getVehicleTypeNameById = (id) => {
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

export const getVehicleTypeColor = (id) => {
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
    12: 'indigo'       // Van
  }
  
  return colors[numericId] || 'grey'
}
