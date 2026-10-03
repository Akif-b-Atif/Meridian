// Runs before first paint so the page never flashes the wrong theme.
// It is an external file because the Content-Security-Policy forbids inline scripts.
;(function () {
  var theme = null
  try {
    theme = localStorage.getItem('meridian.theme')
  } catch (e) {
    theme = null
  }
  if (theme !== 'light' && theme !== 'dark') {
    theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  var root = document.documentElement
  root.setAttribute('data-theme', theme)
  root.style.colorScheme = theme
})()
