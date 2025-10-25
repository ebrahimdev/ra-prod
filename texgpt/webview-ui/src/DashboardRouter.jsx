import React from 'react';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import PrivateRoute from './components/PrivateRoute';
import AuthPage from './pages/Auth/AuthPage';
import OnboardingPage from './pages/Onboarding/OnboardingPage';
import DashboardPage from './pages/Dashboard/DashboardPage';
import NotFound from './pages/NotFound';
import './styles/global.css';

function App() {
  return (
    <AuthProvider>
      <MemoryRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/auth" replace />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route
              path="/onboarding"
              element={
                <PrivateRoute>
                  <OnboardingPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <DashboardPage />
                </PrivateRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      </MemoryRouter>
    </AuthProvider>
  );
}

export default App;
