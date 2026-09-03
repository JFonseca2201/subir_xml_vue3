import { ofetch } from 'ofetch'

function parseJwt(token) {
  try {
    // Aquí separamos la segunda parte (el payload) que contiene los datos como la fecha de expiración
    const base64Url = token.split('.')[1] // Obtenemos el payload que está en formato base64Url

    // El formato base64Url usa '-' y '_' en lugar de '+' y '/' respectivamente
    // Necesitamos reemplazarlos para que sea decodificable en base64
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')

    // Decodificamos la cadena base64
    // atob() convierte la cadena base64 a texto legible
    // Luego usamos decodeURIComponent para manejar correctamente los caracteres especiales
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2) // Convertimos a formato URI
    }).join(''))

    // Finalmente convertimos el payload decodificado a un objeto JSON y lo retornamos
    return JSON.parse(jsonPayload)
  } catch (e) {
    return null
  }
}

function isTokenExpired(token) {
  const decodedToken = parseJwt(token)
  if (!decodedToken || !decodedToken.exp) {
    return true // Token inválido o sin fecha de expiración
  }
  const currentTime = Math.floor(Date.now() / 1000) // Tiempo actual en segundos
  
  return decodedToken.exp < currentTime // Retorna true si el token ha expirado
}

export const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname

    // Si accedemos por IP de red (ej: 192.168.100.4), adaptamos la llamada de API a esa misma IP
    if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `http://${hostname}:8000/api/`
    }
  }
  
  return envUrl || 'http://127.0.0.1:8000/api/'
}

export const $api = ofetch.create({
  baseURL: getApiBaseUrl(),
  async onRequest(response) {
    const accessToken = localStorage.getItem("token")
    if (accessToken && isTokenExpired(accessToken) && response.request != "auth/login") {
      localStorage.removeItem("token")
      localStorage.removeItem("user")

      console.log("Su sesion a expirado. Inicie sesión nuevamnente.")
      setTimeout(() => {
        window.location.href = '/login'
      }, 100)
    }
    let options = response.options
    options.headers = {
      Accept: 'application/json',
      ...options.headers,
    }
    if (accessToken && response.request !== 'auth/login' && response.request !== 'auth/register') {
      options.headers.Authorization = `Bearer ${accessToken}`
    }
  },
}) 
