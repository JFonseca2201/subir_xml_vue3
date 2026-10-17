<script setup>
const themes = [
  {
    name: 'system',
    label: 'Sistema',
    icon: 'ri-macbook-line',
  },
  {
    name: 'light',
    label: 'Claro',
    icon: 'ri-sun-line',
  },
  {
    name: 'dark',
    label: 'Oscuro',
    icon: 'ri-moon-clear-line',
  },
  {
    name: 'dark-glass',
    label: 'Oscuro Transparente',
    icon: 'ri-moon-cloudy-line',
  },
  {
    name: 'semi-dark-glass',
    label: 'Medio Transparente',
    icon: 'ri-contrast-line',
  },
  {
    name: 'light-glass',
    label: 'Transparente Claro',
    icon: 'ri-sun-cloudy-line',
  },
]
</script>

<template>
  <ThemeSwitcher :themes="themes" />
</template>
