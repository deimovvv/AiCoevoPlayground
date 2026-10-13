/**
 * Dirección del backend. En desarrollo, el FastAPI local; en producción, la que defina
 * VITE_API_BASE al compilar (infra-v1). Archivo sin dependencias: lo importa todo el frontend
 * sin riesgo de ciclos de import.
 */
export const API_BASE: string = (import.meta.env.VITE_API_BASE as string | undefined) ?? "http://127.0.0.1:8000";
