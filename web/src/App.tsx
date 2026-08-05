import { Suspense, lazy } from "react";
import { Link, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { SkeletonCard } from "./components/ui/States";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const NewRun = lazy(() => import("./pages/NewRun"));
const LiveRun = lazy(() => import("./pages/LiveRun"));
const RunReport = lazy(() => import("./pages/RunReport"));
const RunHistory = lazy(() => import("./pages/RunHistory"));
const RepairsCenter = lazy(() => import("./pages/RepairsCenter"));
const DemoControls = lazy(() => import("./pages/DemoControls"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const TreeSitterOptimizerPage = lazy(() => import("./tso/ui/TreeSitterOptimizerPage"));
const ConnectRepo = lazy(() => import("./pages/ConnectRepo"));
const SREObservability = lazy(() => import("./pages/SREObservability"));

function RouteFallback() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading view</span>
      <SkeletonCard rows={2} />
      <SkeletonCard rows={4} />
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <p className="text-3xl font-semibold text-fg">404</p>
      <p className="max-w-sm text-sm text-muted">
        That route does not exist. Head back to the dashboard to pick up where you left off.
      </p>
      <Link to="/" className="text-sm text-accent hover:underline">
        Return to dashboard
      </Link>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route
          index
          element={
            <ErrorBoundary>
              <Suspense fallback={<RouteFallback />}>
                <Dashboard />
              </Suspense>
            </ErrorBoundary>
          }
        />
        <Route
          path="runs/new"
          element={
            <ErrorBoundary>
              <Suspense fallback={<RouteFallback />}>
                <NewRun />
              </Suspense>
            </ErrorBoundary>
          }
        />
        <Route
          path="sre"
          element={
            <ErrorBoundary>
              <Suspense fallback={<RouteFallback />}>
                <SREObservability />
              </Suspense>
            </ErrorBoundary>
          }
        />
        <Route
          path="runs"
          element={
            <ErrorBoundary>
              <Suspense fallback={<RouteFallback />}>
                <RunHistory />
              </Suspense>
            </ErrorBoundary>
          }
        />
        <Route
          path="runs/:runId"
          element={
            <ErrorBoundary>
              <Suspense fallback={<RouteFallback />}>
                <RunReport />
              </Suspense>
            </ErrorBoundary>
          }
        />
        <Route
          path="runs/:runId/live"
          element={
            <ErrorBoundary>
              <Suspense fallback={<RouteFallback />}>
                <LiveRun />
              </Suspense>
            </ErrorBoundary>
          }
        />
        <Route
          path="repo"
          element={
            <ErrorBoundary>
              <Suspense fallback={<RouteFallback />}>
                <ConnectRepo />
              </Suspense>
            </ErrorBoundary>
          }
        />
        <Route
          path="repairs"
          element={
            <ErrorBoundary>
              <Suspense fallback={<RouteFallback />}>
                <RepairsCenter />
              </Suspense>
            </ErrorBoundary>
          }
        />
        <Route
          path="optimizer"
          element={
            <ErrorBoundary>
              <Suspense fallback={<RouteFallback />}>
                <TreeSitterOptimizerPage />
              </Suspense>
            </ErrorBoundary>
          }
        />
        <Route
          path="demo"
          element={
            <ErrorBoundary>
              <Suspense fallback={<RouteFallback />}>
                <DemoControls />
              </Suspense>
            </ErrorBoundary>
          }
        />
        <Route
          path="settings"
          element={
            <ErrorBoundary>
              <Suspense fallback={<RouteFallback />}>
                <SettingsPage />
              </Suspense>
            </ErrorBoundary>
          }
        />
        <Route
          path="*"
          element={
            <ErrorBoundary>
              <NotFound />
            </ErrorBoundary>
          }
        />
      </Route>
    </Routes>
  );
}
