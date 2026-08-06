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
      returnFrom: "Sobre capital liquidado",
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
    title: "Cuéntanos sobre ti",
    subtitle: "Necesitamos algunos datos para completar tu perfil",
    // Read-only line giving context; the email is not editable here.
    signedInAs: "Estás usando",

    fullNameLabel: "Nombre completo",
    fullNamePlaceholder: "Como aparece en tu documento",
    documentLabel: "Cédula o documento",
    documentPlaceholder: "Solo números",
    phoneLabel: "Teléfono",
    phonePlaceholder: "300 123 4567",
    cityLabel: "Ciudad",
    cityPlaceholder: "Empieza a escribir tu ciudad",

    submit: "Continuar",
    saving: "Guardando…",
    saveError: "No pudimos guardar tus datos. Inténtalo de nuevo.",

    country: {
      selectLabel: "Selecciona tu país",
      searchPlaceholder: "Busca un país",
      noResults: "Ningún país coincide",
    },

    city: {
      searching: "Buscando ciudades…",
      noResults: "No encontramos esa ciudad",
      error: "No pudimos buscar ciudades ahora.",
      retry: "Reintentar",
      // Required by the Places API (New) when predictions show without a map.
      attribution: "Powered by Google",
    },

    errors: {
      fullNameShort: "Escribe tu nombre completo (mínimo 2 caracteres).",
      fullNameLong: "Ese nombre es demasiado largo.",
      fullNameFormat: "El nombre solo puede tener letras, espacios y guiones.",
      documentFormat: "El documento solo puede tener números, sin puntos ni espacios.",
      documentLength: "El documento debe tener entre 6 y 12 dígitos.",
      phoneCountry: "Selecciona un país válido.",
      phoneFormat: "El teléfono solo puede tener números, sin espacios ni guiones.",
      phoneLength: "El teléfono debe tener entre 6 y 15 dígitos.",
      cityRequired: "Selecciona tu ciudad.",
      citySelect: "Elige una ciudad de la lista para continuar.",
    },
  },

  catalog: {
    title: "Portafolio Investors 180 Group",
    // Sets the tone of the showcase: describes what the portfolio is, without
    // figures, projections or any wording that could read as a return promise.
    subtitle:
      "Conoce los proyectos del grupo en Florida: en qué etapa está cada uno, cuánto capital busca y qué ofrece.",

    filters: {
      status: "Estado del proyecto",
      city: "Ciudad",
      type: "Tipo de proyecto",
      progress: "Porcentaje de avance",
      // Leading entry of each dropdown; turns that filter off.
      allStatuses: "Todos los estados",
      allCities: "Todas las ciudades",
      allTypes: "Todos los tipos",
      allProgress: "Todo el avance",
      clear: "Limpiar filtros",
    },

    // {n} is replaced with the number of projects listed.
    resultsCount: "{n} proyectos",
    resultsCountOne: "1 proyecto",

    // Card: public marketing figures of the project.
    // Bar of the catalogue variant: how much of the goal is already raised.
    raised: "Recaudado",
    notFundraising: "Sin captación abierta por ahora",
    // Caption under projects.offered_return. Deliberately says "ofrecido": it
    // is what the project offers to raise capital, NOT what any investor has
    // agreed to (that one lives in "mis inversiones").
    offeredReturn: "Retorno ofrecido",
    returnOnRequest: "Condiciones disponibles con el equipo",
    alreadyInvested: "Ya inviertes aquí",

    // No project matches the current filter combination.
    emptyFiltered: "Ningún proyecto coincide con estos filtros",
    emptyFilteredHint:
      "Prueba con otra combinación o vuelve a ver todo el portafolio.",
    // The rare case: the portfolio has no projects at all.
    empty: "Aún no hay proyectos publicados",
    emptyHint:
      "Estamos preparando las próximas oportunidades. Vuelve pronto para conocerlas.",
  },

  projects: {
    // Display labels for projects.status. The stored values are lowercase and
    // some read better with a leading preposition.
    status: {
      "en evaluación": "En evaluación",
      "en reserva": "En reserva",
      permisos: "En permisos",
      construcción: "En construcción",
      vendido: "Vendido",
      rentado: "Rentado",
      pausado: "Pausado",
    } as Record<string, string>,
    // Title is composed as "{tipo} en {ciudad}, Florida".
    type: {
      lote: "Lote",
      casa: "Casa",
      triplex: "Triplex",
      multifamily: "Multifamily",
    } as Record<string, string>,
    state: "Florida",
    untitled: "Proyecto",
    imageAlt: "Foto del proyecto",
    noImage: "Sin foto todavía",
  },

  investmentCard: {
    // Bar of the personal-position variant: how the work is coming along.
    workProgress: "Avance de obra",
    noProgress: "Avance aún no reportado",
    expectedReturn: "Retorno esperado",
    expectedAnnualReturn: "Retorno anual esperado",
    // Shown when the position's contributions disagree on the agreed return.
    mixedReturn: "Varios",
    noReturn: "—",
    seeMore: "Ver más",
  },

  myInvestments: {
    title: "Mis inversiones",
    // Home only: the home shows a preview, this leads to the full screen.
    seeAll: "Ver todas mis inversiones",
    // Dedicated screen only; the home section needs no subtitle.
    subtitle:
      "El detalle de cada proyecto en el que tienes capital: cuánto tienes, qué pactaste y cómo avanza la obra.",
    empty: "Aún no tienes inversiones activas",
    emptyHint:
      "Explora el portafolio de Investors 180 y encuentra un proyecto que te interese.",
    emptyAction: "Ver el portafolio",
    // Filters are on, and this combination matches none of their projects.
    emptyFiltered: "Ninguna de tus inversiones coincide con estos filtros",
    emptyFilteredHint:
      "Prueba con otra combinación o vuelve a ver todas tus inversiones.",
    // {n} is replaced with the number of positions listed.
    resultsCount: "{n} inversiones",
    resultsCountOne: "1 inversión",
  },

  transactions: {
    title: "Transacciones",
    // Frames the table as a record of what happened, with no editorialising.
    subtitle: "El registro de los movimientos de tu capital, del más reciente al más antiguo.",

    columns: {
      date: "Fecha",
      project: "Proyecto",
      type: "Tipo",
      amount: "Monto",
    },

    // Display labels for the four values stored in transactions.type. Earnings
    // and capital returns stay separate, never merged (CLAUDE.md).
    type: {
      aporte: "Aporte",
      rendimiento: "Rendimiento",
      "devolución de capital": "Devolución de capital",
      reasignación: "Reasignación",
    } as Record<string, string>,

    filters: {
      project: "Proyecto",
      type: "Tipo de movimiento",
      allProjects: "Todos los proyectos",
      allTypes: "Todos los movimientos",
      clear: "Limpiar filtros",
    },

    // {n} is replaced with the number of rows listed.
    resultsCount: "{n} movimientos",
    resultsCountOne: "1 movimiento",

    tableCaption: "Tus movimientos de capital",

    empty: "Aún no tienes movimientos registrados",
    emptyHint:
      "Aquí aparecerán tus aportes, rendimientos y devoluciones de capital en cuanto se registren.",
    emptyFiltered: "Ningún movimiento coincide con estos filtros",
    emptyFilteredHint: "Prueba con otra combinación o vuelve a ver todos tus movimientos.",

    loadError: "No pudimos cargar tus movimientos.",
    retry: "Reintentar",
  },

  documents: {
    title: "Documentos",
    subtitle:
      "Los documentos de tus proyectos y los tuyos propios, del más reciente al más antiguo.",

    columns: {
      docType: "Tipo de documento",
      project: "Nombre del proyecto",
      date: "Fecha",
      download: "Descargar",
    },

    // Display labels for the twelve values stored in documents.doc_type. The
    // stored values mix English and Spanish; these are all Spanish.
    type: {
      deed: "Escritura",
      "property record": "Registro de propiedad",
      survey: "Levantamiento topográfico",
      planos: "Planos",
      permisos: "Permisos",
      presupuesto: "Presupuesto",
      contrato: "Contrato",
      "operating agreement": "Acuerdo operativo",
      facturas: "Facturas",
      "estados de cuenta": "Estados de cuenta",
      reportes: "Reportes",
      "certificado de aporte": "Certificado de aporte",
    } as Record<string, string>,

    // Shown in the project column, and as a filter option, when the document
    // has no project attached.
    noProject: "General",

    filters: {
      project: "Proyecto",
      allProjects: "Todos los proyectos",
      clear: "Limpiar filtros",
    },

    // {n} is replaced with the number of rows listed.
    resultsCount: "{n} documentos",
    resultsCountOne: "1 documento",

    tableCaption: "Tus documentos disponibles",

    download: "Descargar",
    // {name} is replaced with the document's name.
    downloadLabel: "Descargar {name}",
    downloading: "Abriendo…",
    downloadError: "No pudimos abrir este documento.",
    downloadDenied: "No tienes acceso a este documento.",
    noFile: "Este documento aún no tiene archivo.",

    // Copy fixed by views.md.
    empty: "Aún no tienes documentos disponibles",
    emptyHint:
      "Aquí aparecerán los documentos de tus proyectos en cuanto se publiquen.",
    emptyFiltered: "Ningún documento coincide con este filtro",
    emptyFilteredHint: "Prueba con otro proyecto o vuelve a ver todos tus documentos.",

    loadError: "No pudimos cargar tus documentos.",
    retry: "Reintentar",
  },

  requests: {
    title: "Solicitudes",
    subtitle:
      "Tus solicitudes de reasignación de capital y en qué estado va cada una.",

    columns: {
      date: "Fecha",
      from: "Origen",
      to: "Destino",
      amount: "Monto",
      status: "Estado",
    },

    // Display labels for the three values stored in
    // reassignment_requests.status. Already Spanish in the database; routed
    // through here so the visible text has a single source.
    status: {
      pendiente: "Pendiente",
      aprobada: "Aprobada",
      rechazada: "Rechazada",
    } as Record<string, string>,

    // Shown when a request points at a project that no longer resolves.
    unknownProject: "Proyecto no disponible",

    filters: {
      toProject: "Proyecto de destino",
      status: "Estado",
      allProjects: "Todos los destinos",
      allStatuses: "Todos los estados",
      clear: "Limpiar filtros",
    },

    // {n} is replaced with the number of rows listed.
    resultsCount: "{n} solicitudes",
    resultsCountOne: "1 solicitud",

    tableCaption: "Tus solicitudes de reasignación",

    empty: "Aún no tienes solicitudes",
    emptyHint:
      "Cuando pidas mover capital entre proyectos, aquí verás cada solicitud y su estado.",
    emptyFiltered: "Ninguna solicitud coincide con estos filtros",
    emptyFilteredHint:
      "Prueba con otra combinación o vuelve a ver todas tus solicitudes.",

    loadError: "No pudimos cargar tus solicitudes.",
    retry: "Reintentar",

    // ---- Creating a request -------------------------------------------------
    create: {
      open: "Nueva solicitud",
      title: "Nueva solicitud de reasignación",
      description:
        "Pide mover capital de un proyecto a otro. El equipo de Investors 180 revisará tu solicitud.",

      fromLabel: "Proyecto de origen",
      fromPlaceholder: "Elige de dónde sale el capital",
      toLabel: "Proyecto de destino",
      toPlaceholder: "Elige a dónde quieres moverlo",
      amountLabel: "Monto a reasignar",
      amountPlaceholder: "0",
      // {amount} is replaced with the formatted available capital.
      available: "Disponible: {amount}",
      availableHint:
        "Es tu capital vigente en ese proyecto, menos lo que ya tienes en solicitudes pendientes.",

      submit: "Enviar solicitud",
      submitting: "Enviando…",
      cancel: "Cancelar",

      // Legal framing. Sending this is a REQUEST, not a transfer.
      footnote:
        "Esta solicitud será revisada por el equipo de Investors 180. Enviarla no reasigna tu capital de inmediato.",

      noCapital: "No tienes capital disponible para reasignar",
      noCapitalHint:
        "Cuando tengas capital vigente en algún proyecto podrás pedir moverlo desde aquí.",
      noDestinations: "No hay proyectos disponibles como destino por ahora",

      success: "Tu solicitud quedó registrada y está pendiente de revisión.",
    },

    errors: {
      sameProject: "El origen y el destino deben ser proyectos distintos.",
      fromRequired: "Elige el proyecto de origen.",
      toRequired: "Elige el proyecto de destino.",
      amountPositive: "El monto debe ser mayor que cero.",
      amountNumber: "El monto solo puede tener números.",
      // {amount} is replaced with the formatted available capital.
      amountTooHigh: "El monto supera tu capital disponible ({amount}).",
      invalidSource: "Ese proyecto de origen no está disponible para reasignar.",
      invalidDestination: "Ese proyecto no puede recibir capital ahora mismo.",
      notInvestor: "Tu cuenta no tiene inversiones vinculadas.",
      saveFailed: "No pudimos registrar tu solicitud. Inténtalo de nuevo.",
    },
  },

  common: {
    cancel: "Cancelar",
  },

  projectDetail: {
    back: "Volver al portafolio",
    photoAlt: "Foto del proyecto",
    // {n} is the photo number, for the alt text of the gallery.
    photoAltNumbered: "Foto {n} del proyecto",
    noPhotos: "Este proyecto aún no tiene fotos publicadas",
    // Subtitle under the title. {status} and {progress} are filled at render.
    statusWithProgress: "{status} - avance del {progress}%",

    tabs: {
      // Names the tab group for assistive tech, not shown on screen.
      ariaLabel: "Secciones del proyecto",
      summary: "Resumen",
      progress: "Avance",
      reports: "Reportes",
      documents: "Documentos",
      myInvestment: "Mi inversión",
    },

    summary: {
      descriptionEmpty:
        "Estamos preparando la descripción de este proyecto. Escríbenos y te contamos los detalles.",
      sellingPoints: "Argumentos de venta",
      sellingPointsEmpty:
        "Aún no publicamos los argumentos de este proyecto. El equipo puede contártelos directamente.",
    },

    calculator: {
      title: "Calcula tu rentabilidad estimada",
      amountLabel: "¿Cuánto quieres invertir?",
      amountPlaceholder: "10,000",
      termLabel: "¿Por cuánto tiempo?",
      // {n} is the number of months.
      termMonths: "{n} meses",
      totalLabel: "Rendimiento total estimado",
      monthlyLabel: "Rendimiento mensual estimado",
      // {min} and {max} are already formatted as currency.
      range: "entre {min} y {max}",
      chartTitle: "Acumulado mes a mes",
      chartMin: "Escenario bajo",
      chartMax: "Escenario alto",
      // Never hidden: this is what keeps the simulation from reading as a promise.
      disclaimer:
        "Simulación ilustrativa. Los rendimientos son estimados, no constituyen una oferta ni una garantía de retorno.",
      amountEmpty: "Escribe un monto para ver la estimación.",
    },

    interest: {
      title: "Me interesa este proyecto",
      subtitle: "Completa estos campos y te contactaremos pronto",
      disclaimer:
        "Enviar este formulario no constituye un compromiso de inversión",
      amountLabel: "¿Cuánto te interesa invertir?",
      amountPlaceholder: "Monto aproximado en USD",
      commentsLabel: "¿Tienes algún comentario?",
      commentsPlaceholder: "Cuéntanos qué te gustaría saber",
      submit: "Enviar",
      // Shown after the stub submit, until the real endpoint is wired up.
      pending: "Enviando…",
      mockNotice:
        "El envío de este formulario se conecta en el siguiente sprint.",
    },

    progress: {
      title: "Avance de obra",
      // {n} is the percentage.
      current: "El proyecto va en el {n}% de ejecución",
      notReported: "El avance de obra aún no se ha reportado",
      milestonesTitle: "Hitos de la obra",
      milestonesEmpty: "Todavía no hay hitos registrados para este proyecto",
      milestonesEmptyHint:
        "Aparecerán aquí a medida que el equipo los reporte.",
    },

    reports: {
      title: "Reportes mensuales",
      empty: "Este proyecto aún no tiene reportes",
      emptyHint:
        "Publicamos un reporte por mes con el avance de obra y el uso del capital.",
      physical: "Avance físico",
      financial: "Avance financiero",
      capitalUsed: "Capital usado en el mes",
      decisions: "Decisiones",
      risks: "Riesgos",
      nextSteps: "Próximos pasos",
      openPdf: "Ver reporte en PDF",
      photoAlt: "Foto del reporte",
    },

    documents: {
      title: "Documentos del proyecto",
      empty: "Aún no hay documentos disponibles",
      emptyHint:
        "Cuando el equipo publique documentos de este proyecto, los verás aquí.",
      open: "Abrir",
      // Falls back when a document has no date recorded.
      noDate: "Sin fecha",
      // documents.name is nullable; the row still deserves a label.
      untitled: "Documento sin nombre",
    },

    myInvestment: {
      title: "Mi inversión en este proyecto",
      soon: "Próximamente",
      soonHint:
        "Aquí verás el detalle de tu posición en este proyecto: tu capital, tus movimientos y tus documentos.",
    },
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
