import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { ReviewDecision } from "../../../shared/contracts";
import { toast } from "../store/toast";

/** Terminal statuses stop the poll loop on the run detail endpoint. */
const isLive = (status?: string): boolean => status === "running" || status === "queued";

export function useRuns(params: { status?: string; ticket?: string } = {}) {
  return useQuery({
    queryKey: ["runs", params],
    queryFn: () => api.listRuns(params),
    refetchInterval: 10_000,
  });
}

export function useRun(runId: string | undefined) {
  return useQuery({
    queryKey: ["run", runId],
    queryFn: () => api.getRun(runId as string),
    enabled: Boolean(runId),
    // Poll while the engine is still working; the live view owns SSE, this is the safety net.
    refetchInterval: (query) => (isLive(query.state.data?.summary.status) ? 2_500 : false),
  });
}

export function useStats() {
  return useQuery({ queryKey: ["stats"], queryFn: api.stats, refetchInterval: 15_000 });
}

export function useRepairs(params: { status?: string; runId?: string } = {}) {
  return useQuery({
    queryKey: ["repairs", params],
    queryFn: () => api.listRepairs(params),
    refetchInterval: 15_000,
  });
}

export function useReviewRepair() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      repairId,
      decision,
      note,
    }: {
      repairId: string;
      decision: ReviewDecision;
      note?: string;
    }) => api.reviewRepair(repairId, decision, note),
    onSuccess: (repair) => {
      toast.success(
        `Repair ${repair.review?.decision ?? "updated"}`,
        repair.review?.decision === "reverted"
          ? "Cached locator cleared — the next run resolves it fresh."
          : `${repair.oldLocator} → ${repair.newLocator}`,
      );
      void queryClient.invalidateQueries({ queryKey: ["repairs"] });
      void queryClient.invalidateQueries({ queryKey: ["run", repair.runId] });
      void queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (error: Error) => toast.error("Could not record the review", error.message),
  });
}

export function useSettings() {
  return useQuery({ queryKey: ["settings"], queryFn: api.settings });
}
