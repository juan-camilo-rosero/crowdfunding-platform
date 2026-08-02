import type { AuthErrorCode } from "@/lib/auth/auth-errors";

// Keys are in English (code); values are the Spanish text rendered to users.
export const es = {
  app: {
    name: "Investors 180",
    description: "Portal de inversionistas de Investors 180 Group.",
  },

  login: {
    title: "Crea tu cuenta",
    subtitle: "Consulta en tiempo real el estado y avance de tus inversiones",
    emailLabel: "Correo electrónico",
    emailPlaceholder: "Ingresa tu correo electrónico",
    continue: "Continuar",
    // Shown inside the primary button while the request is in flight.
    continuing: "Verificando correo…",
    dividerOr: "o",
    signInWithGoogle: "Continuar con Google",
    connecting: "Conectando…",
    logoAlt: "Investors 180 Group",
    // One caption per carousel slide, same order as the images.
    // Kept short so each stays on a single line, and free of figures or return
    // promises (see views.md).
    carouselSlides: [
      "Invierte en bienes raíces en Florida desde cualquier lugar",
      "Sigue el avance de tus proyectos en tiempo real",
      "Todos tus documentos y movimientos en un solo lugar",
      "Transparencia completa en cada etapa de tu inversión",
    ],
    // {n} is replaced with the slide number.
    goToSlide: "Ir a la imagen {n}",
    errors: {
      "missing-code": "No recibimos la respuesta de Google. Inténtalo de nuevo.",
      "exchange-failed":
        "No pudimos completar el inicio de sesión. Inténtalo de nuevo.",
      "provider-rejected": "Google no autorizó el acceso. Inténtalo de nuevo.",
      "profile-not-found":
        "Tu cuenta se creó pero no encontramos tu perfil. Contacta al equipo de Investors 180.",
      "account-suspended":
        "Tu cuenta está suspendida. Contacta al equipo de Investors 180.",
      "account-deactivated":
        "Tu cuenta está desactivada. Contacta al equipo de Investors 180.",
    } satisfies Record<AuthErrorCode, string>,
  },

  home: {
    title: "Inicio",
    signedInAs: "Sesión iniciada como",
    role: "Rol",
    status: "Estado",

    kpi: {
      invested: "Total invertido",
      // {n} is replaced with the number of active projects.
      investedIn: "Trabajando en {n} proyectos",
      investedInOne: "Trabajando en 1 proyecto",
      investedNone: "Aún no tienes inversiones activas",

      yield: "Rendimiento recibido",
      yieldFrom: "De proyectos ya cerrados",
      yieldNone: "Aún no has recibido rendimientos",

      returnPct: "Retorno acumulado",
      returnFrom: "Sobre el capital ya liquidado",
      // Shown when nothing has been liquidated yet: the ratio is not measurable.
      returnEmpty: "—",

      projects: "Mis proyectos",
      // {n} is replaced with the count.
      projectsActive: "{n} activos",
      projectsActiveOne: "1 activo",
      projectsNone: "Sin proyectos",
      projectsHint: "Con capital vigente",
      projectsEmptyHint: "Explora el catálogo para empezar",
    },

    distribution: {
      title: "Distribución de tu capital",
      centerLabel: "Invertido actualmente",
      empty: "Aún no tienes capital invertido",
      emptyHint: "Cuando inviertas, aquí verás cómo se reparte tu capital",
    },

    contributions: {
      title: "Tus últimos aportes",
      // {amount} and {project} are replaced at render time.
      item: "Invertiste {amount} en {project}",
      empty: "Aún no tienes aportes registrados",
      emptyHint: "Tus movimientos aparecerán aquí",
    },
  },

  onboarding: {
    title: "Onboarding",
    status: "Estado",
    onboardingCompleted: "Onboarding completado",
    yes: "Sí",
    no: "No",
    // Temporary Sprint 1 button: stands in for the real personal-data form
    // (full name, phone, city/country) built later.
    temporaryNotice:
      "Pantalla temporal. El formulario de datos personales se construye en el sprint de onboarding básico.",
    completeData: "Completar datos (temporal)",
    saving: "Guardando…",
    saveError: "No pudimos guardar tus datos. Inténtalo de nuevo.",
  },

  catalog: {
    title: "Portafolio Investors 180",
    placeholder: "Pantalla temporal. Aquí va el catálogo de proyectos del grupo.",
  },

  account: {
    // Capability label under the user's name in the sidebar footer.
    admin: "Administrador",
    investor: "Inversionista",
    visitor: "Visitante",
    openMenu: "Abrir menú de cuenta",
    signOut: "Cerrar sesión",
    signingOut: "Cerrando sesión…",
  },

  nav: {
    search: "Buscar",
    toggleSidebar: "Contraer menú",
    investorSection: "Menú",
    adminSection: "Admin",
    adminPanel: "Panel de administrador",
    salesFunnel: "Embudo de ventas",
    home: "Inicio",
    catalog: "Catálogo",
    myInvestments: "Mis inversiones",
    transactions: "Transacciones",
    documents: "Documentos",
    requests: "Solicitudes",
    profile: "Perfil",
    adminHome: "Panel",
    projects: "Proyectos",
    investors: "Inversionistas",
    capital: "Capital",
    budget: "Presupuesto",
    tasks: "Tareas",
    reports: "Reportes",
    users: "Usuarios",
    pipeline: "Pipeline",
    approvals: "Aprobaciones",
  },

  placeholder: {
    notice: "Pantalla pendiente de construcción.",
  },

  admin: {
    title: "Panel de administrador",
    saveChanges: "Guardar cambios",
    saving: "Guardando…",
    unsavedNotice: "Tienes cambios sin guardar",
    saveSuccess: "Cambios guardados",
    saveError: "No pudimos guardar los cambios. No se aplicó ninguno.",
    notAuthorized: "No tienes permiso para guardar cambios.",
    loadError: "No pudimos cargar esta tabla.",
    emptyTable: "Esta tabla todavía no tiene registros.",
    discardConfirm:
      "Tienes cambios sin guardar. Si continúas se perderán. ¿Quieres salir de todos modos?",
  },

  pipeline: {
    // Filter that narrows the funnel by stage.
    allStages: "Todas las etapas",
    filterLabel: "Filtrar por etapa",
  },

  // Server-side validation messages. `{campo}` is replaced with the column label.
  validation: {
    required: "El campo '{campo}' es obligatorio. Por favor complétalo para poder guardar.",
    invalidNumber: "El valor de '{campo}' debe ser un número. Revisa que no haya letras ni caracteres especiales.",
    invalidDate: "La fecha en '{campo}' no es válida. Asegúrate de seleccionarla correctamente.",
    invalidEmail: "El correo en '{campo}' no tiene un formato válido (ejemplo: usuario@correo.com).",
    invalidUrl: "El enlace en '{campo}' debe empezar con 'http://' o 'https://'.",
    invalidPhone: "El teléfono en '{campo}' debe incluir el indicativo del país (ejemplo: +573001112233).",
    invalidOption: "Has seleccionado una opción en '{campo}' que no es válida. Por favor, elige una de la lista.",
    invalidBoolean: "El campo '{campo}' solo acepta opciones de sí o no.",
    negativeAmount: "El monto en '{campo}' no puede ser un número negativo.",
    percentRange: "El porcentaje en '{campo}' debe estar entre 0 y 100.",
    readOnly: "El campo '{campo}' no se puede editar directamente desde esta tabla.",
    emptyBatch: "No tienes cambios pendientes por guardar.",
    unknownTable: "Hubo un problema interno: la tabla que intentas guardar no existe.",
  },
} as const;
