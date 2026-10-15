export const groups = [
  { key: 'main', label: { ne: 'मुख्य', en: 'Main' } },
  { key: 'services', label: { ne: 'सेवा तथा अभिलेख', en: 'Services and records' } },
  { key: 'learn', label: { ne: 'कृषि ज्ञान केन्द्र', en: 'Agriculture Knowledge Center' } },
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
  { to: '/app/knowledge', perm: 'knowledge.view', group: 'learn', icon: 'BookOpen', label: { ne: 'कृषि ज्ञान केन्द्र', en: 'Agriculture Knowledge Center' }, desc: { ne: 'सिकाइ, खेल, डिजिटल पुस्तकालय र अनुसन्धान एउटै ठाउँमा', en: 'Learning, games, the digital library and research in one place' } },
  { to: '/app/console', perm: 'smart_farming.view', group: 'smart', icon: 'Gauge', label: { ne: 'ग्रीनहाउस कन्सोल', en: 'Greenhouse Console' }, desc: { ne: 'अनुगमन, पम्प नियन्त्रण, स्वचालन र एआई विश्लेषण', en: 'Monitoring, pump control, automation and AI analysis' } },
  { to: '/app/smart-farming', perm: 'smart_farming.view', group: 'smart', icon: 'Cpu', label: { ne: 'स्मार्ट फार्मिङ', en: 'Smart farming' }, desc: { ne: 'ग्रीनहाउस अनुगमन र नियन्त्रण', en: 'Greenhouse monitoring and control' } },
  { to: '/app/smart-farming/chat', perm: 'smart_farming.view', group: 'smart', icon: 'MessageCircle', label: { ne: 'टोली च्याट', en: 'Team chat' }, desc: { ne: 'प्रत्यक्ष सन्देश, फाइल र आवाज/भिडियो कल', en: 'Direct messages, files, and voice/video calls' } },
  { to: '/app/data-center', perm: 'datacenter.view', group: 'smart', icon: 'Database', label: { ne: 'डाटा केन्द्र', en: 'Data Center' }, desc: { ne: 'जिल्लाव्यापी तथ्याङ्क र विश्लेषण', en: 'District-wide data and analysis' } },
  { to: '/app/reports', perm: 'reports.view', group: 'smart', icon: 'BarChart3', label: { ne: 'प्रतिवेदन', en: 'Reports' }, desc: { ne: 'आधिकारिक प्रतिवेदन', en: 'Official reports' } },
  { to: '/app/admin', perm: 'users.view', group: 'office', icon: 'Settings', label: { ne: 'प्रशासन', en: 'Administration' }, desc: { ne: 'प्रयोगकर्ता, भूमिका र लग', en: 'Users, roles and logs' } }
];
