import { useAuth } from '../../context/AuthContext';

export default function RequirePermission({ perm, children }) {
  const { can } = useAuth();
  if (!can(perm)) {
    return <div className="p-6 bg-red-50 text-red-700 rounded">403 - You do not have permission to view this page.</div>;
  }
  return children;
}
