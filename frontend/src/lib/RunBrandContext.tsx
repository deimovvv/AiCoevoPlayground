import { createContext, useContext } from "react";
import type { Brand } from "./api";

/**
 * Marca DUEÑA de la corrida abierta, que no siempre es la marca activa: abrís un run de
 * Geely teniendo Koxis seleccionada. Todo lo que actúa sobre el contenido del run
 * (regenerar un clip, guardar una regla, autoguardar) usa ésta. Antes usaba la activa y
 * mezclaba marcas: referencias y reglas de otra marca, o el run reasignado a otra.
 */
export const RunBrandContext = createContext<Brand | null>(null);

/** La marca del run; null si no hay corrida (usar la activa en ese caso). */
export function useRunBrand(): Brand | null {
  return useContext(RunBrandContext);
}
