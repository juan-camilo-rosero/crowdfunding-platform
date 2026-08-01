import type { AuthErrorCode } from "@/lib/auth/auth-errors";

export const es = {
  app: {
    nombre: "Investors 180",
    descripcion: "Portal de inversionistas de Investors 180 Group.",
  },

  login: {
    titulo: "Investors 180",
    subtitulo: "Ingresa para consultar tus inversiones.",
    continuarConGoogle: "Continuar con Google",
    conectando: "Conectando…",
    errores: {
      "sesion-requerida": "Inicia sesión para continuar.",
      "codigo-faltante": "No recibimos la respuesta de Google. Inténtalo de nuevo.",
      "intercambio-fallido":
        "No pudimos completar el inicio de sesión. Inténtalo de nuevo.",
      "proveedor-rechazado":
        "Google no autorizó el acceso. Inténtalo de nuevo.",
      "perfil-no-encontrado":
        "Tu cuenta se creó pero no encontramos tu perfil. Contacta al equipo de Investors 180.",
      "cuenta-suspendida":
        "Tu cuenta está suspendida. Contacta al equipo de Investors 180.",
      "cuenta-desactivada":
        "Tu cuenta está desactivada. Contacta al equipo de Investors 180.",
    } satisfies Record<AuthErrorCode, string>,
  },

  // Placeholders temporales del Sprint 1 (se reemplazan al construir las vistas reales).
  inicio: {
    titulo: "Inicio",
    sesionIniciadaComo: "Sesión iniciada como",
    rol: "Rol",
    estado: "Estado",
  },

  onboarding: {
    titulo: "Onboarding",
    estado: "Estado",
    onboardingCompletado: "Onboarding completado",
    si: "Sí",
    no: "No",
  },
} as const;
