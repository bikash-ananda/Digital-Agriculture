export const modules = [
  { to: '/app', end: true, perm: 'dashboard.view', label: { ne: 'ड्यासबोर्ड', en: 'Dashboard' } },
  { to: '/app/profile', perm: null, label: { ne: 'मेरो प्रोफाइल', en: 'My Profile' } },
  { to: '/app/farmers', perm: 'farmers.view', label: { ne: 'कृषकहरू', en: 'Farmers' } },
  { to: '/app/farms', perm: 'farms.view', label: { ne: 'फार्म / साइट', en: 'Farms / Sites' } },
  { to: '/app/programs', perm: 'programs.view', label: { ne: 'कृषि कार्यक्रम', en: 'Agriculture Programs' } },
  { to: '/app/notices', perm: 'notices.view', label: { ne: 'सूचना', en: 'Notices' } },
  { to: '/app/learning', perm: 'learning.view', label: { ne: 'सिकाइ केन्द्र', en: 'Learning Center' } },
  { to: '/app/knowledge', perm: 'knowledge.view', label: { ne: 'कृषि ज्ञान केन्द्र', en: 'Agriculture Knowledge' } },
  { to: '/app/smart-farming', perm: 'smart_farming.view', label: { ne: 'स्मार्ट फार्मिङ', en: 'Smart Farming' } },
  { to: '/app/data-center', perm: 'datacenter.view', label: { ne: 'डाटा केन्द्र', en: 'Data Center' } },
  { to: '/app/documents', perm: 'documents.view', label: { ne: 'कागजातहरू', en: 'Documents' } },
  { to: '/app/reports', perm: 'reports.view', label: { ne: 'प्रतिवेदन', en: 'Reports' } },
  { to: '/app/admin', perm: 'users.view', label: { ne: 'प्रशासन', en: 'Administration' } }
];

