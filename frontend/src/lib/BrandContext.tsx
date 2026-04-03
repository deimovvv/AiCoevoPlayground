import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import type { Brand } from "./api";
import { fetchBrands } from "./api";

interface BrandContextValue {
  brands: Brand[];
  activeBrand: Brand | null;
  setActiveBrandId: (id: string) => void;
  loading: boolean;
  refreshBrands: () => Promise<void>;
}

const BrandContext = createContext<BrandContextValue | null>(null);

const STORAGE_KEY = "coevo-active-brand-id";

export function BrandProvider({ children }: { children: ReactNode }) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [activeBrandId, setActiveBrandId] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY)
  );
  const [loading, setLoading] = useState(true);

  const loadBrands = useCallback(async () => {
    try {
      const data = await fetchBrands();
      setBrands(data);

      // If stored brand no longer exists, fallback to first
      if (data.length > 0) {
        const stored = localStorage.getItem(STORAGE_KEY);
        const exists = data.some((b) => b.id === stored);
        if (!exists) {
          const fallbackId = data[0].id;
          setActiveBrandId(fallbackId);
          localStorage.setItem(STORAGE_KEY, fallbackId);
        }
      }
    } catch (err) {
      console.error("Failed to load brands:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBrands();
  }, [loadBrands]);

  const handleSetActiveBrand = (id: string) => {
    setActiveBrandId(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  const activeBrand = brands.find((b) => b.id === activeBrandId) ?? null;

  return (
    <BrandContext.Provider
      value={{
        brands,
        activeBrand,
        setActiveBrandId: handleSetActiveBrand,
        loading,
        refreshBrands: loadBrands,
      }}
    >
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand() {
  const ctx = useContext(BrandContext);
  if (!ctx) throw new Error("useBrand must be used within BrandProvider");
  return ctx;
}
