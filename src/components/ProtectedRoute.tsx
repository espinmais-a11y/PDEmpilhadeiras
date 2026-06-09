import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({ requireApproval = true }: { requireApproval?: boolean }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#121414] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#caf300]"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (requireApproval && profile && !profile.is_approved) {
    return <Navigate to="/waiting-approval" replace />;
  }

  return <Outlet />;
}

export function AdminRoute() {
  const { profile, loading } = useAuth();

  if (loading) return null;
  if (profile?.role?.toString().toLowerCase().trim() !== 'admin') return <Navigate to="/" replace />;

  return <Outlet />;
}

// forced sync
