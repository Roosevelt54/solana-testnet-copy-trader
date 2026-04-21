import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Wallets from './pages/Wallets';
import Trades from './pages/Trades';
import Login from './pages/Login';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#050812' }}><p className="text-gray-500 text-sm">Loading...</p></div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function Layout() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#050812' }}>
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
          <Route path="/wallets" element={<Protected><Wallets /></Protected>} />
          <Route path="/trades" element={<Protected><Trades /></Protected>} />
          <Route path="/login" element={<Login />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Layout />
      </BrowserRouter>
    </AuthProvider>
  );
}
