import { fiscalYearOf } from './dc';

const FARMER_TYPES = ['individual', 'group', 'cooperative', 'company', 'private_farm'];
const YES = { type: 'checkbox', wide: true };

export const PROFILE_FIELDS = [
  { k: 'farmer_type', ne: 'कृषकको प्रकार', en: 'Farmer type', type: 'select', options: FARMER_TYPES },
  { k: 'national_farmer_id', ne: 'राष्ट्रिय कृषक दर्ता ID', en: 'National farmer registry ID', type: 'text' },
  { k: 'farmer_category', ne: 'कृषक वर्ग', en: 'Farmer category', type: 'select', options: ['subsistence', 'small', 'medium', 'large'] },
  { k: 'member_count', ne: 'सदस्य संख्या (समूह / सहकारी)', en: 'Members (group / cooperative)', type: 'number', min: 1, showIf: (v) => v.farmer_type && v.farmer_type !== 'individual' },
  { k: 'household_members', ne: 'परिवार सदस्य संख्या', en: 'Household members', type: 'number', min: 1, max: 60 },
  { k: 'agri_workers', ne: 'कृषिमा संलग्न सदस्य', en: 'Members working in agriculture', type: 'number', min: 0, max: 60 },
  { k: 'education_level', ne: 'शिक्षा', en: 'Education', type: 'select', options: ['no_formal', 'basic', 'secondary', 'higher_secondary', 'bachelor', 'master_plus'] },
  { k: 'farming_experience_years', ne: 'खेती अनुभव (वर्ष)', en: 'Farming experience (years)', type: 'number', min: 0, max: 90 },
  { k: 'main_occupation', ne: 'मुख्य पेशा', en: 'Main occupation', type: 'select', options: ['agriculture', 'livestock', 'agri_business', 'service', 'foreign_employment', 'business', 'other'] },
  { k: 'income_band', ne: 'वार्षिक आम्दानी दायरा', en: 'Annual income band', type: 'select', options: ['lt_100k', '100k_300k', '300k_600k', '600k_1m', 'gt_1m'] },
  { k: 'collection_method', ne: 'तथ्याङ्क सङ्कलन विधि', en: 'Data collection method', type: 'select', options: ['field_survey', 'office', 'import', 'self_registered'] },
  { k: 'uses_smartphone', ne: 'स्मार्टफोन प्रयोग गर्छ', en: 'Uses a smartphone', ...YES },
  { k: 'consent_data_use', ne: 'सहमति: कार्यालयको सेवा तथा योजनाका लागि तथ्याङ्क प्रयोग गर्न', en: 'Consent: data may be used for office services and planning', ...YES },
  { k: 'consent_research', ne: 'सहमति: अनुसन्धानका लागि गुमनाम (anonymized) तथ्याङ्क प्रयोग गर्न', en: 'Consent: anonymized data may be used for research', ...YES }
];

export const FARM_ADD_FIELDS = [
  { k: 'name', ne: 'फार्मको नाम', en: 'Farm name', type: 'text', req: true },
  { k: 'area_sqm', ne: 'क्षेत्रफल', en: 'Area', type: 'land' },
  { k: 'ownership_type', ne: 'स्वामित्व', en: 'Ownership', type: 'select', options: ['owned', 'leased', 'shared', 'government'], def: 'owned' },
  { k: 'irrigation_type', ne: 'सिँचाइ', en: 'Irrigation', type: 'select', options: ['none', 'rainfed', 'drip', 'sprinkler', 'canal', 'other'], def: 'none' },
  { k: 'address', ne: 'ठेगाना / टोल', en: 'Address / tole', type: 'text', wide: true }
];

export const FARM_EDIT_FIELDS = [
  { k: 'name', ne: 'फार्मको नाम', en: 'Farm name', type: 'text', req: true },
  { k: 'area_sqm', ne: 'क्षेत्रफल', en: 'Area', type: 'land' },
  { k: 'irrigated_area_sqm', ne: 'सिँचित क्षेत्रफल', en: 'Irrigated area', type: 'land' },
  { k: 'ownership_type', ne: 'स्वामित्व', en: 'Ownership', type: 'select', options: ['owned', 'leased', 'shared', 'government'] },
  { k: 'irrigation_type', ne: 'सिँचाइ', en: 'Irrigation', type: 'select', options: ['none', 'rainfed', 'drip', 'sprinkler', 'canal', 'other'] },
  { k: 'land_use', ne: 'जमिनको प्रयोग', en: 'Land use', type: 'select', options: ['cultivated', 'orchard', 'fallow', 'pasture', 'mixed'] },
  { k: 'soil_type', ne: 'माटोको प्रकार', en: 'Soil type', type: 'select', options: ['sandy', 'loam', 'clay', 'silty', 'gravelly', 'other'] },
  { k: 'water_source', ne: 'पानीको स्रोत', en: 'Water source', type: 'select', options: ['rain_only', 'spring_water', 'river_canal', 'tube_well', 'tank', 'municipal', 'lake_pond', 'other'] },
  { k: 'altitude_m', ne: 'उचाइ (मि.)', en: 'Altitude (m)', type: 'number', min: 0, max: 9000 },
  { k: 'road_access', ne: 'सडक पहुँच', en: 'Road access', type: 'select', options: ['none', 'trail', 'seasonal', 'all_weather'] },
  { k: 'distance_to_market_km', ne: 'बजारसम्म दूरी (कि.मि.)', en: 'Distance to market (km)', type: 'number', min: 0, max: 500, step: '0.1' },
  { k: 'local_level_id', ne: 'स्थानीय तह', en: 'Local level', type: 'level' },
  { k: 'ward_no', ne: 'वडा नं.', en: 'Ward no.', type: 'number', min: 1, max: 35 },
  { k: 'latitude', ne: 'अक्षांश (Latitude)', en: 'Latitude', type: 'number', step: 'any' },
  { k: 'longitude', ne: 'देशान्तर (Longitude)', en: 'Longitude', type: 'number', step: 'any' },
  { k: 'address', ne: 'ठेगाना', en: 'Address', type: 'text' },
  { k: 'terrace_farming', ne: 'सिँढीखेत (गरा) खेती', en: 'Terrace farming', type: 'checkbox' },
  { k: 'organic_certified', ne: 'प्राङ्गारिक प्रमाणित', en: 'Organic certified', type: 'checkbox' }
];

export const PRODUCTION_FIELDS = [
  { k: 'crop_id', ne: 'बाली', en: 'Crop', type: 'crop', req: true },
  { k: 'fiscal_year', ne: 'आर्थिक वर्ष (जस्तै २०८३/८४ → 2083/84)', en: 'Fiscal year (e.g. 2083/84)', type: 'text', def: fiscalYearOf(), req: true },
  { k: 'season', ne: 'मौसम', en: 'Season', type: 'select', options: ['spring', 'summer', 'winter', 'perennial', 'year_round'], def: 'summer' },
  { k: 'production_system', ne: 'उत्पादन प्रणाली', en: 'Production system', type: 'select', options: ['open_field', 'greenhouse', 'tunnel', 'nursery', 'orchard', 'terrace', 'hydroponic', 'other'], def: 'open_field' },
  { k: 'variety', ne: 'जात', en: 'Variety', type: 'text' },
  { k: 'seed_source', ne: 'बिउको स्रोत', en: 'Seed source', type: 'select', options: ['own_saved', 'local_market', 'agro_vet', 'government', 'cooperative', 'imported', 'other'] },
  { k: 'area_sqm', ne: 'खेती गरिएको क्षेत्रफल', en: 'Cultivated area', type: 'land' },
  { k: 'plant_count', ne: 'बिरुवा संख्या', en: 'Plant count', type: 'number', min: 0 },
  { k: 'bearing_plants', ne: 'फल दिने बिरुवा', en: 'Bearing plants', type: 'number', min: 0 },
  { k: 'planting_date', ne: 'रोपेको मिति', en: 'Planting date', type: 'date' },
  { k: 'harvest_start', ne: 'टिप्न सुरु', en: 'Harvest start', type: 'date' },
  { k: 'harvest_end', ne: 'टिप्न सकिएको', en: 'Harvest end', type: 'date' },
  { k: 'production_kg', ne: 'कुल उत्पादन (के.जी.)', en: 'Total production (kg)', type: 'number', min: 0, step: '0.01' },
  { k: 'sold_kg', ne: 'बिक्री (के.जी.)', en: 'Sold (kg)', type: 'number', min: 0, step: '0.01' },
  { k: 'loss_kg', ne: 'क्षति (के.जी.)', en: 'Loss (kg)', type: 'number', min: 0, step: '0.01' },
  { k: 'loss_cause', ne: 'क्षतिको कारण', en: 'Loss cause', type: 'select', options: ['none', 'disease', 'pest', 'drought', 'flood', 'hail', 'wild_animals', 'post_harvest', 'other'] },
  { k: 'avg_price_npr_per_kg', ne: 'औसत मूल्य (रु./के.जी.)', en: 'Average price (NPR/kg)', type: 'number', min: 0, step: '0.01' },
  { k: 'market_channel', ne: 'बजार माध्यम', en: 'Market channel', type: 'select', options: ['local_market', 'wholesaler', 'cooperative', 'direct_consumer', 'export', 'processing', 'self_consumed'] },
  { k: 'organic_status', ne: 'खेती विधि', en: 'Farming method', type: 'select', options: ['conventional', 'organic', 'transitioning', 'ipm'], def: 'conventional' },
  { k: 'status', ne: 'अवस्था', en: 'Status', type: 'select', options: ['planned', 'growing', 'harvested', 'failed'], def: 'harvested' },
  { k: 'notes', ne: 'टिप्पणी', en: 'Notes', type: 'text', wide: true }
];

export const LIVESTOCK_FIELDS = [
  { k: 'animal_type', ne: 'पशु / जीवको प्रकार', en: 'Animal type', type: 'select', req: true, options: ['cattle', 'buffalo', 'goat', 'sheep', 'pig', 'poultry_layer', 'poultry_broiler', 'duck', 'fish_pond', 'beehive', 'other'] },
  { k: 'breed', ne: 'नस्ल', en: 'Breed', type: 'text' },
  { k: 'head_count', ne: 'संख्या (घार / पोखरी भए सोही)', en: 'Count (hives / ponds if applicable)', type: 'number', min: 0, def: 0 },
  { k: 'pond_area_sqm', ne: 'पोखरीको क्षेत्रफल', en: 'Pond area', type: 'land', showIf: (v) => v.animal_type === 'fish_pond' },
  { k: 'purpose', ne: 'उद्देश्य', en: 'Purpose', type: 'select', options: ['milk', 'meat', 'eggs', 'fish', 'honey', 'manure', 'draught', 'mixed'] },
  { k: 'annual_output_qty', ne: 'वार्षिक उत्पादन परिमाण', en: 'Annual output quantity', type: 'number', min: 0, step: '0.01' },
  { k: 'output_unit', ne: 'एकाइ (लिटर, के.जी., थान)', en: 'Unit (litre, kg, pieces)', type: 'text' },
  { k: 'fiscal_year', ne: 'आर्थिक वर्ष', en: 'Fiscal year', type: 'text', def: fiscalYearOf(), req: true }
];

export const INPUT_FIELDS = [
  { k: 'input_type', ne: 'सामग्रीको प्रकार', en: 'Input type', type: 'select', req: true, options: ['chemical_fertilizer', 'organic_manure', 'compost', 'pesticide', 'biopesticide', 'herbicide', 'seed', 'other'] },
  { k: 'product_name', ne: 'उत्पादनको नाम', en: 'Product name', type: 'text' },
  { k: 'crop_id', ne: 'बाली (ऐच्छिक)', en: 'Crop (optional)', type: 'crop' },
  { k: 'quantity', ne: 'परिमाण', en: 'Quantity', type: 'number', min: 0, step: '0.01', req: true },
  { k: 'unit', ne: 'एकाइ', en: 'Unit', type: 'select', options: ['kg', 'g', 'l', 'ml', 'piece', 'packet'], def: 'kg' },
  { k: 'cost_npr', ne: 'लागत (रु.)', en: 'Cost (NPR)', type: 'number', min: 0, step: '0.01' },
  { k: 'source', ne: 'स्रोत', en: 'Source', type: 'select', options: ['agro_vet', 'cooperative', 'government', 'own', 'other'] },
  { k: 'applied_on', ne: 'प्रयोग मिति', en: 'Applied on', type: 'date' },
  { k: 'fiscal_year', ne: 'आर्थिक वर्ष', en: 'Fiscal year', type: 'text', def: fiscalYearOf(), req: true }
];

export const ASSET_FIELDS = [
  { k: 'asset_type', ne: 'सम्पत्ति / संरचना', en: 'Asset / structure', type: 'select', req: true, options: ['plastic_tunnel', 'greenhouse', 'drip_irrigation', 'sprinkler', 'water_tank', 'pond', 'power_tiller', 'tractor', 'sprayer', 'cold_storage', 'nursery', 'collection_center', 'solar_pump', 'other'] },
  { k: 'quantity', ne: 'संख्या', en: 'Quantity', type: 'number', min: 1, def: 1 },
  { k: 'area_sqm', ne: 'क्षेत्रफल', en: 'Area', type: 'land' },
  { k: 'year_installed', ne: 'स्थापना वर्ष (ई.सं.)', en: 'Year installed (AD)', type: 'number', min: 1950, max: 2100 },
  { k: 'condition_status', ne: 'अवस्था', en: 'Condition', type: 'select', options: ['good', 'fair', 'poor'] },
  { k: 'support_source', ne: 'सहयोग स्रोत', en: 'Support source', type: 'select', options: ['own', 'government', 'ngo', 'cooperative', 'loan', 'other'] },
  { k: 'notes', ne: 'टिप्पणी', en: 'Notes', type: 'text', wide: true }
];

export const DEVICE_FIELDS = [
  { k: 'farm_id', ne: 'फार्म', en: 'Farm', type: 'farm', req: true },
  { k: 'device_code', ne: 'यन्त्र कोड', en: 'Device code', type: 'text', req: true },
  { k: 'ownership', ne: 'स्वामित्व', en: 'Ownership', type: 'select', options: ['office', 'farmer', 'loan', 'donor'], def: 'office' },
  { k: 'device_type', ne: 'यन्त्र प्रकार', en: 'Device type', type: 'select', options: ['esp32', 'esp8266', 'other'], def: 'esp32' },
  { k: 'installed_at', ne: 'जडान मिति', en: 'Installed on', type: 'date' },
  { k: 'preset', ne: 'सेन्सर सेट', en: 'Sensor set', type: 'select', options: ['none', 'starter', 'extended'], def: 'starter' },
  { k: 'create_unit', ne: 'नयाँ ग्रीनहाउस / टनेल इकाई बनाउने', en: 'Create a new greenhouse / tunnel unit', type: 'checkbox', def: true, wide: true },
  { k: 'unit_type', ne: 'इकाईको प्रकार', en: 'Unit type', type: 'select', options: ['greenhouse', 'tunnel', 'open_field'], def: 'greenhouse', showIf: (v) => v.create_unit },
  { k: 'unit_name', ne: 'इकाईको नाम', en: 'Unit name', type: 'text', showIf: (v) => v.create_unit }
];
