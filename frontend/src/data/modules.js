export const groups = [
  { key: 'main', label: { ne: 'मुख्य', en: 'Main' } },
  { key: 'services', label: { ne: 'सेवा तथा अभिलेख', en: 'Services and records' } },
  { key: 'learn', label: { ne: 'सिकाइ तथा ज्ञान', en: 'Learning and knowledge' } },
  { key: 'smart', label: { ne: 'स्मार्ट कृषि तथा तथ्याङ्क', en: 'Smart agriculture and data' } },
  { key: 'office', label: { ne: 'कार्यालय', en: 'Office' } }
];

export const modules = [
  { to: '/app', end: true, perm: 'dashboard.view', group: 'main', icon: 'LayoutDashboard', label: { ne: 'ड्यासबोर्ड', en: 'Dashboard' }, desc: { ne: 'तपाईंको कार्य सारांश', en: 'Your work at a glance' } },
  { to: '/app/profile', perm: null, group: 'main', icon: 'User', label: { ne: 'मेरो प्रोफाइल', en: 'My profile' }, desc: { ne: 'खाता तथा भूमिका विवरण', en: 'Your account and role' } },
  { to: '/app/farmers', perm: 'farmers.view', group: 'services', icon: 'Users', label: { ne: 'कृषकहरू', en: 'Farmers' }, desc: { ne: 'दर्ता, प्रोफाइल, उत्पादन र यन्त्र', en: 'Registration, profiles, production and devices' } },
  { to: '/app/farms', perm: 'farms.view', group: 'services', icon: 'Wheat', label: { ne: 'फार्म / साइट', en: 'Farms and sites' }, desc: { ne: 'फार्म, ग्रीनहाउस र खेतबारी', en: 'Farms, greenhouses and fields' } },
  { to: '/app/programs', perm: 'programs.view', group: 'services', icon: 'ClipboardList', label: { ne: 'कृषि कार्यक्रम', en: 'Agriculture programs' }, desc: { ne: 'कार्यक्रम, लाभग्राही र प्रगति', en: 'Programs, beneficiaries and progress' } },
  { to: '/app/notices', perm: 'notices.view', group: 'services', icon: 'Megaphone', label: { ne: 'सूचना', en: 'Notices' }, desc: { ne: 'सूचना तथा समाचार व्यवस्थापन', en: 'Manage notices and news' } },
  { to: '/app/learning', perm: 'learning.view', group: 'learn', icon: 'GraduationCap', label: { ne: 'सिकाइ केन्द्र', en: 'Learning center' }, desc: { ne: 'पाठ्यक्रम, भिडियो र तालिम सामग्री', en: 'Courses, videos and training material' } },
  { to: '/app/knowledge', perm: 'knowledge.view', group: 'learn', icon: 'BookOpen', label: { ne: 'कृषि ज्ञान केन्द्र', en: 'Knowledge center' }, desc: { ne: 'बाली अनुसारका सन्दर्भ जानकारी', en: 'Crop-by-crop reference information' } },
  { to: '/app/smart-farming', perm: 'smart_farming.view', group: 'smart', icon: 'Cpu', label: { ne: 'स्मार्ट फार्मिङ', en: 'Smart farming' }, desc: { ne: 'ग्रीनहाउस अनुगमन र नियन्त्रण', en: 'Greenhouse monitoring and control' } },
  { to: '/app/data-center', perm: 'datacenter.view', group: 'smart', icon: 'Database', label: { ne: 'डाटा केन्द्र', en: 'Data Center' }, desc: { ne: 'जिल्लाव्यापी तथ्याङ्क र विश्लेषण', en: 'District-wide data and analysis' } },
  { to: '/app/research', perm: 'research.view', group: 'smart', icon: 'FlaskConical', label: { ne: 'अनुसन्धान प्रयोगशाला', en: 'Research Lab' }, desc: { ne: 'सेन्सर तथ्याङ्कको विश्लेषण र प्रयोग', en: 'Analysis and experiments on sensor data' } },
  { to: '/app/reports', perm: 'reports.view', group: 'smart', icon: 'BarChart3', label: { ne: 'प्रतिवेदन', en: 'Reports' }, desc: { ne: 'आधिकारिक प्रतिवेदन', en: 'Official reports' } },
  { to: '/app/documents', perm: 'documents.view', group: 'office', icon: 'Folder', label: { ne: 'कागजातहरू', en: 'Documents' }, desc: { ne: 'फारम, निर्देशिका र प्रकाशन', en: 'Forms, guidelines and publications' } },
  { to: '/app/admin', perm: 'users.view', group: 'office', icon: 'Settings', label: { ne: 'प्रशासन', en: 'Administration' }, desc: { ne: 'प्रयोगकर्ता, भूमिका र लग', en: 'Users, roles and logs' } }
];

