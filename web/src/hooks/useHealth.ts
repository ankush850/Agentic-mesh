import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

/** Polls `/api/health` so the top bar always reflects provider availability. */
export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: api.health,
    refetchInterval: 15_000,
    staleTime: 5_000,
    retry: 1,
  });
}
