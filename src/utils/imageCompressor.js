/**
 * Image Compressor Utility
 * Optimiza y comprime imágenes del lado del cliente antes de enviarlas al servidor.
 * Reduce archivos de cámara/galería de 10MB+ a ~150KB-300KB manteniendo texto y comprobantes nítidos.
 */

export async function compressImage(file, options = {}) {
  // Si no es un archivo o no es una imagen (ej. PDF), devolver intacto
  if (!file || !(file instanceof Blob) || !file.type.startsWith('image/')) {
    return file
  }

  // Si es un GIF o SVG, no comprimir para evitar perder animaciones o vectores
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return file
  }

  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.82,
    outputType = 'image/jpeg',
  } = options

  try {
    let sourceImageBitmap = null
    let width = 0
    let height = 0

    // 1. Cargar imagen de la forma más rápida disponible
    if (typeof createImageBitmap === 'function') {
      try {
        sourceImageBitmap = await createImageBitmap(file)
        width = sourceImageBitmap.width
        height = sourceImageBitmap.height
      } catch (e) {
        sourceImageBitmap = null
      }
    }

    if (!sourceImageBitmap) {
      // Fallback tradicional usando HTMLImageElement
      const img = await new Promise((resolve, reject) => {
        const image = new Image()
        const url = URL.createObjectURL(file)
        image.onload = () => {
          URL.revokeObjectURL(url)
          resolve(image)
        }
        image.onerror = err => {
          URL.revokeObjectURL(url)
          reject(err)
        }
        image.src = url
      })
      width = img.naturalWidth || img.width
      height = img.naturalHeight || img.height
      sourceImageBitmap = img
    }

    // Si la imagen ya es pequeña y pesa menos de 300KB, no es necesario recomprimir
    if (file.size <= 300 * 1024 && width <= maxWidth && height <= maxHeight) {
      if (sourceImageBitmap.close) sourceImageBitmap.close()
      return file
    }

    // 2. Calcular nuevas dimensiones proporcionales
    let targetWidth = width
    let targetHeight = height

    if (targetWidth > maxWidth || targetHeight > maxHeight) {
      const ratio = Math.min(maxWidth / targetWidth, maxHeight / targetHeight)
      targetWidth = Math.round(targetWidth * ratio)
      targetHeight = Math.round(targetHeight * ratio)
    }

    // 3. Dibujar en canvas
    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight
    const ctx = canvas.getContext('2d', { alpha: false })

    // Fondo blanco para imágenes con transparencia convertidas a JPEG
    if (outputType === 'image/jpeg') {
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, targetWidth, targetHeight)
    }

    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(sourceImageBitmap, 0, 0, targetWidth, targetHeight)

    if (sourceImageBitmap.close) {
      sourceImageBitmap.close()
    }

    // 4. Exportar como Blob
    const compressedBlob = await new Promise(resolve => {
      canvas.toBlob(resolve, outputType, quality)
    })

    if (!compressedBlob || compressedBlob.size >= file.size) {
      // Si por alguna razón la compresión dio un archivo más grande, conservar original
      return file
    }

    // 5. Reconstruir objeto File con el nombre original
    const rawName = file.name || 'comprobante.jpg'
    const cleanName = rawName.replace(/\.[^/.]+$/, '') + (outputType === 'image/jpeg' ? '.jpg' : '.webp')

    return new File([compressedBlob], cleanName, {
      type: outputType,
      lastModified: Date.now(),
    })
  } catch (error) {
    console.warn('No se pudo comprimir la imagen, usando original:', error)
    return file
  }
}

/**
 * Comprime un arreglo de archivos de forma concurrente
 */
export async function compressFiles(files, options = {}) {
  if (!Array.isArray(files) || files.length === 0) return []
  return Promise.all(files.map(f => compressImage(f, options)))
}
