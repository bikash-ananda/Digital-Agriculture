import { useAuth } from '../../context/useAuth';

import { Link } from 'react-router-dom';

export default function Profile() {
  const { user } = useAuth();
  const rows = [['Username', user.username], ['Name', user.fullNameEn], ['Email', user.email || '-'], ['Position', user.position || '-'], ['Roles', user.roles.join(', ')]];
  return (
    <div className="max-w-xl">
      <h2 className="text-2xl font-bold text-gov-blue mb-4">My Profile</h2>
      <div className="bg-white rounded shadow divide-y">
        {rows.map(([k, v]) => (
          <div key={k} className="flex p-3 text-sm"><span className="w-32 font-medium text-gray-500">{k}</span><span>{v}</span></div>
        ))}
      </div>
      <Link to="/change-password" className="inline-flex mt-5 bg-agri-green hover:bg-green-800 text-white px-5 py-2.5 rounded-md font-semibold text-sm">
        Change password
      </Link>
    </div>
  );
}
