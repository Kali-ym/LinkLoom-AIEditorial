import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { request } from '../services/api';
import type { WorkflowInputSpec, WorkflowStepType } from '../services/agentService';

export interface StepReference {
  id: string;
  name: string;
  description?: string;
}

export interface StepTypeDescriptor {
  type: WorkflowStepType;
  label: string;
  icon: string;
  color: string;
  category: 'pipeline' | 'classic';
  description: string;
  configSchema?: WorkflowInputSpec;
  defaultConfig?: Record<string, unknown>;
  presets?: Array<{ id: string; label: string; description?: string; config: Record<string, unknown> }>;
  references?: StepReference[];
}

interface CatalogResponse {
  stepTypes: StepTypeDescriptor[];
  enums: {
    feedSourceTypes: Array<{ value: string; label: string; description?: string }>;
    adapterAllValue: string;
  };
}

interface CatalogContextValue {
  stepTypes: StepTypeDescriptor[];
  enums: CatalogResponse['enums'] | null;
  loading: boolean;
  error: string | null;
  getDef: (type: WorkflowStepType | string | undefined) => StepTypeDescriptor | undefined;
  getDefaultConfig: (type: WorkflowStepType | string) => Record<string, unknown>;
  refresh: () => Promise<void>;
}

const StepCatalogContext = createContext<CatalogContextValue | null>(null);

let cachedPromise: Promise<CatalogResponse> | null = null;

async function fetchCatalog(): Promise<CatalogResponse> {
  if (!cachedPromise) {
    cachedPromise = request('/api/workflows/step-types').catch((err) => {
      cachedPromise = null;
      throw err;
    });
  }
  return cachedPromise;
}

export const StepCatalogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [stepTypes, setStepTypes] = useState<StepTypeDescriptor[]>([]);
  const [enums, setEnums] = useState<CatalogResponse['enums'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCatalog();
      setStepTypes(data.stepTypes || []);
      setEnums(data.enums || null);
    } catch (e: any) {
      setError(e?.message || '加载步骤目录失败');
      setStepTypes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      setStepTypes([]);
      setEnums(null);
      setError(null);
      cachedPromise = null;
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const value = useMemo<CatalogContextValue>(() => {
    const byType = new Map<string, StepTypeDescriptor>();
    for (const def of stepTypes) byType.set(def.type, def);

    return {
      stepTypes,
      enums,
      loading,
      error,
      getDef: (type) => (type ? byType.get(String(type)) : undefined),
      getDefaultConfig: (type) => {
        const def = byType.get(String(type));
        return def?.defaultConfig ? deepClone(def.defaultConfig) : {};
      },
      refresh: async () => {
        cachedPromise = null;
        await load();
      }
    };
  }, [stepTypes, enums, loading, error]);

  return <StepCatalogContext.Provider value={value}>{children}</StepCatalogContext.Provider>;
};

export function useStepCatalog(): CatalogContextValue {
  const ctx = useContext(StepCatalogContext);
  if (!ctx) {
    throw new Error('useStepCatalog must be used within <StepCatalogProvider>');
  }
  return ctx;
}

function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  return JSON.parse(JSON.stringify(obj));
}
