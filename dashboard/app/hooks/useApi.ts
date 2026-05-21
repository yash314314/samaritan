"use client";

import { useState, useEffect, useCallback } from "react";

interface UseApiOptions {
  enabled?: boolean;
  refetchInterval?: number;
}

export function useApi<T>(
  fetchFn: () => Promise<T>,
  options: UseApiOptions = {}
) {
  const { enabled = true, refetchInterval } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchFn();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setLoading(false);
    }
  }, [fetchFn]);

  useEffect(() => {
    if (!enabled) return;
    refetch();
    if (refetchInterval) {
      const interval = setInterval(refetch, refetchInterval);
      return () => clearInterval(interval);
    }
  }, [enabled, refetchInterval, refetch]);

  return { data, loading, error, refetch };
}