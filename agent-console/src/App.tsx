import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';

const AgentConsolePage = lazy(() => import('./AgentConsolePage'));

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/console/login', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  return isAuthenticated ? <>{children}</> : <Navigate to="/console/login" replace />;
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
        <Router basename="/">
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/console/login" element={<Login />} />
              <Route
                path="/console/*"
                element={
                  <ProtectedRoute>
                    <AgentConsolePage />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/console" replace />} />
            </Routes>
          </Suspense>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
