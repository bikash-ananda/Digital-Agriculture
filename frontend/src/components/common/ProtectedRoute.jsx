import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="p-10 text-center text-gray-600">Loading...</div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}
