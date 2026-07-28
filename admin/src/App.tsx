import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { MessageDialogProvider } from './context/MessageDialogContext';
import { StepCatalogProvider } from './hooks/useStepCatalog';
import AppLayout from './components/Layout/AppLayout';
import DocumentTitleSync from './components/DocumentTitleSync';
import FaviconSync from './components/FaviconSync';

const Selection = lazy(() => import('./pages/Selection'));
const Generation = lazy(() => import('./pages/generation/GenerationPage'));
const StandalonePreview = lazy(() => import('./pages/StandalonePreview'));
const History = lazy(() => import('./pages/History'));
const Scheduling = lazy(() => import('./pages/scheduling'));
const Agents = lazy(() => import('./pages/agents/AgentsPage'));
const OpsCenter = lazy(() => import('./pages/ops/OpsCenterPage'));
const KnowledgeBase = lazy(() => import('./pages/KnowledgeBase'));
const Settings = lazy(() => import('./pages/settings/SettingsPage'));
const Login = lazy(() => import('./pages/Login'));

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

const PageFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-background-light text-slate-500 dark:bg-background-dark dark:text-text-secondary">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-primary dark:border-border-dark dark:border-t-primary" />
  </div>
);

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <MessageDialogProvider>
          <StepCatalogProvider>
          <Router basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <DocumentTitleSync />
            <FaviconSync />
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route
                  path="/preview"
                  element={
                    <ProtectedRoute>
                      <StandalonePreview />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/*"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <Routes>
                          <Route path="/" element={<Navigate to="/scheduling" replace />} />
                          <Route path="/selection" element={<Selection />} />
                          <Route path="/generation" element={<Generation />} />
                          <Route path="/history" element={<History />} />
                          <Route path="/scheduling" element={<Scheduling />} />
                          <Route path="/agents" element={<Agents />} />
                          <Route path="/ops" element={<OpsCenter />} />
                          <Route path="/knowledge" element={<KnowledgeBase />} />
                          <Route path="/settings" element={<Settings />} />
                        </Routes>
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </Suspense>
          </Router>
          </StepCatalogProvider>
          </MessageDialogProvider>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
