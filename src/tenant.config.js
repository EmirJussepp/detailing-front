// =========================================================
//  TENANT CONFIG · Personalización por cliente
//  Cambiá solo este archivo para adaptar el sistema
// =========================================================

import logoElite from "./assets/img/logoelite.jpg"

export const tenant = {
  // Identidad del cliente
  nombre: "Elite Car-Shop",
  nombreCorto: "Elite",
  rubro: "Car Detailing & Accesorios",

  // Logo (importado arriba)
  logo: logoElite,
  logoRadius: "6px",

  // Colores (usados en CSS variables dinámicas)
  colors: {
    accent:        "#c9a227",   // dorado Elite
    accentHover:   "#dbb840",
    accentSoft:    "rgba(201, 162, 39, 0.14)",
    accentBorder:  "rgba(201, 162, 39, 0.28)",
    accentMuted:   "rgba(255, 255, 255, 0.28)",
    bgBase:        "#0d0a06",
    bgPanel:       "rgba(18, 14, 10, 0.98)",
    sidebarBg:     "linear-gradient(180deg, #0d0a06 0%, #0a0804 100%)",
  },

  // Textos del sistema
  textos: {
    loginTitulo:   "Iniciar sesión",
    loginSub:      "Accedé al panel de gestión de Elite Car-Shop.",
    homeEyebrow:   "Inicio",
    homeTitulo:    "Principal",
    homeSub:       "Accesos rápidos y entradas principales del sistema.",
  },

  // Firma del desarrollador (siempre visible, discreta)
  developer: {
    nombre: "3Byte",
    texto:  "Powered by 3Byte",
    color:  "rgba(201, 162, 39, 0.75)",
  },
}