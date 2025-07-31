import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'

// Update theme color meta tag based on CSS variables
const updateThemeColor = () => {
  const computedStyle = getComputedStyle(document.documentElement);
  const bgColor = computedStyle.getPropertyValue('--color-bg-primary').trim();
  const themeColorMeta = document.getElementById('theme-color-meta') as HTMLMetaElement;
  if (themeColorMeta && bgColor) {
    themeColorMeta.content = bgColor;
  }
};

// Watch for theme changes
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
      setTimeout(updateThemeColor, 0); // Let CSS update first
    }
  });
});

observer.observe(document.documentElement, { attributes: true });

// Initial update
document.addEventListener('DOMContentLoaded', updateThemeColor);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)