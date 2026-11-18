import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import AdminDashboard from './pages/AdminDashboard';
import PhcDashboard from './pages/PhcDashboard';
import AshaDashboard from './pages/AshaDashboard';
import VillagesList from './pages/VillagesList';
import Settings from './pages/Settings';
import Profile from './pages/Profile';

const DashboardRouter = () => {
  const role = (localStorage.getItem('userRole') || '').toUpperCase();

  if (!role) {
    return <Navigate to="/login" replace />;
  }

  switch (role) {
    case 'ADMIN':
      return <AdminDashboard />;
    case 'PHC':
      return <PhcDashboard />;
    case 'ASHA':
      return <AshaDashboard />;
    default:
      return <Navigate to="/login" replace />;
  }
};

const AppLayout = () => {
  const location = useLocation();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup';

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      {!isAuthPage && <Sidebar />}
      <main className="flex-1 overflow-x-hidden">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/dashboard" element={<DashboardRouter />} />
          <Route path="/villages" element={<VillagesList />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}

export default App;
