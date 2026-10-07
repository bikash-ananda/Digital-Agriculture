import { useTranslation } from 'react-i18next';
import { staff } from '../../data/office';

export default function Staff() {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'ne';
  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h2 className="text-2xl font-bold text-gov-blue border-b-2 border-gov-red pb-2 mb-4">{lang === 'ne' ? 'कर्मचारी विवरण' : 'Staff Details'}</h2>
      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-3">{lang === 'ne' ? 'नाम' : 'Name'}</th>
              <th className="p-3">{lang === 'ne' ? 'पद' : 'Position'}</th>
              <th className="p-3">{lang === 'ne' ? 'समूह' : 'Group'}</th>
              <th className="p-3">{lang === 'ne' ? 'मोबाइल' : 'Mobile'}</th>
              <th className="p-3">{lang === 'ne' ? 'इमेल' : 'Email'}</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.name} className="border-t">
                <td className="p-3 font-medium">{s.name}</td>
                <td className="p-3">{s.post}</td>
                <td className="p-3">{s.group}</td>
                <td className="p-3">{s.phone}</td>
                <td className="p-3 break-all">{s.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
