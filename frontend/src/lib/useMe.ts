import { createContext, useContext } from "react";
import type { Me } from "./api";

/** Quién está mirando (studio-v2 §3). Lo llena <MeProvider> (MeContext.tsx). */
export const MeContext = createContext<Me | null>(null);

export function useMe(): Me {
    const me = useContext(MeContext);
    if (!me) throw new Error("useMe adentro de MeProvider");
    return me;
}
