// Simple notification utility
export const showNotification = (message, type = 'info') => {
  // Check if we're in a browser environment
  if (typeof window !== 'undefined') {
    // Create a simple notification element
    const notification = document.createElement('div')

    notification.className = `notification notification-${type}`
    notification.textContent = message
        
    // Add styles
    notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 9999;
            transform: translateX(100%);
            transition: transform 0.3s ease;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        `
        
    // Set background color based on type
    switch (type) {
    case 'success':
      notification.style.backgroundColor = '#4caf50'
      break
    case 'error':
      notification.style.backgroundColor = '#f44336'
      break
    case 'warning':
      notification.style.backgroundColor = '#ff9800'
      break
    default:
      notification.style.backgroundColor = '#2196f3'
    }
        
    // Add to DOM
    document.body.appendChild(notification)
        
    // Animate in
    setTimeout(() => {
      notification.style.transform = 'translateX(0)'
    }, 100)
        
    // Remove after 3 seconds
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)'
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification)
        }
      }, 300)
    }, 3000)
  }
}
