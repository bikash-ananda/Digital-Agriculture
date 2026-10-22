const express = require('express');
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/farmerDataController');

const router = express.Router();
router.use(authenticate);

const opt = (n) => body(n).optional({ values: 'falsy' });
const num = (n, max) => opt(n).isFloat({ min: 0, max }).withMessage(`${n} must be between 0 and ${max}`);
const int = (n, max) => opt(n).isInt({ min: 0, max }).withMessage(`${n} must be a whole number up to ${max}`);
const inList = (n, list) => opt(n).isIn(list).withMessage(`${n}: invalid value`);
const text = (n, max) => opt(n).trim().isLength({ max }).withMessage(`${n} is too long`);
const idRule = param('id').isInt({ min: 1 });
const farmRule = param('farmId').isInt({ min: 1 });
const FY = opt('fiscal_year').matches(/^\d{4}\/\d{2}$/).withMessage('Fiscal year format: 2083/84');

const E = {
  farmer_type: ['individual', 'group', 'cooperative', 'company', 'private_farm'], category: ['subsistence', 'small', 'medium', 'large'],
  education: ['no_formal', 'basic', 'secondary', 'higher_secondary', 'bachelor', 'master_plus'],
  occupation: ['agriculture', 'livestock', 'agri_business', 'service', 'foreign_employment', 'business', 'other'],
  income: ['lt_100k', '100k_300k', '300k_600k', '600k_1m', 'gt_1m'], method: ['field_survey', 'office', 'import', 'self_registered'],
  ownership: ['owned', 'leased', 'shared', 'government'], irrigation: ['none', 'rainfed', 'drip', 'sprinkler', 'canal', 'other'],
  land_use: ['cultivated', 'orchard', 'fallow', 'pasture', 'mixed'], soil: ['sandy', 'loam', 'clay', 'silty', 'gravelly', 'other'],
  water: ['rain_only', 'spring_water', 'river_canal', 'tube_well', 'tank', 'municipal', 'lake_pond', 'other'], road: ['none', 'trail', 'seasonal', 'all_weather'],
  season: ['spring', 'summer', 'winter', 'perennial', 'year_round'], system: ['open_field', 'greenhouse', 'tunnel', 'nursery', 'orchard', 'terrace', 'hydroponic', 'other'],
  seed: ['own_saved', 'local_market', 'agro_vet', 'government', 'cooperative', 'imported', 'other'],
  loss: ['none', 'disease', 'pest', 'drought', 'flood', 'hail', 'landslide', 'soil_erosion', 'frost', 'storm', 'wild_animals', 'post_harvest', 'other'],
  market: ['local_market', 'wholesaler', 'cooperative', 'direct_consumer', 'export', 'processing', 'self_consumed'],
  organic: ['conventional', 'organic', 'transitioning', 'ipm'], cstatus: ['planned', 'growing', 'harvested', 'failed'],
  animal: ['cattle', 'buffalo', 'goat', 'sheep', 'pig', 'poultry_layer', 'poultry_broiler', 'duck', 'fish_pond', 'beehive', 'other'],
  purpose: ['milk', 'meat', 'eggs', 'fish', 'honey', 'manure', 'draught', 'mixed'],
  input: ['chemical_fertilizer', 'organic_manure', 'compost', 'pesticide', 'biopesticide', 'herbicide', 'seed', 'other'],
  unit: ['kg', 'g', 'l', 'ml', 'piece', 'packet'], isource: ['agro_vet', 'cooperative', 'government', 'own', 'other'],
  asset: ['plastic_tunnel', 'greenhouse', 'drip_irrigation', 'sprinkler', 'water_tank', 'pond', 'power_tiller', 'tractor', 'sprayer', 'cold_storage', 'nursery', 'collection_center', 'solar_pump', 'other'],
  condition: ['good', 'fair', 'poor'], support: ['own', 'government', 'ngo', 'cooperative', 'loan', 'other']
};

router.get('/:id/summary', authorize('farmers.view'), idRule, validate, c.summary);
router.put('/:id/profile', authorize('datacenter.collect'), idRule, [
  inList('farmer_type', E.farmer_type), text('national_farmer_id', 30), inList('farmer_category', E.category), int('member_count', 1000000),
  int('household_members', 60), int('agri_workers', 60), inList('education_level', E.education), int('farming_experience_years', 90),
  inList('main_occupation', E.occupation), inList('income_band', E.income), inList('collection_method', E.method)
], validate, c.updateProfile);
router.post('/:id/verification', authorize('datacenter.collect'), idRule, [
  body('status').isIn(['draft', 'submitted', 'verified', 'rejected']), text('note', 255)
], validate, c.setVerification);

router.get('/:id/production', authorize('farmers.view'), idRule, validate, c.listProduction);
router.get('/:id/livestock', authorize('farmers.view'), idRule, validate, c.listLivestock);
router.get('/:id/inputs', authorize('farmers.view'), idRule, validate, c.listInputs);
router.get('/:id/assets', authorize('farmers.view'), idRule, validate, c.listAssets);
router.get('/:id/devices', authorize('farmers.view'), idRule, validate, c.listDevices);

router.put('/farms/:farmId/details', authorize('datacenter.collect'), farmRule, [
  opt('name').trim().isLength({ max: 200 }), num('area_sqm', 1e8), inList('ownership_type', E.ownership), inList('irrigation_type', E.irrigation),
  inList('land_use', E.land_use), inList('soil_type', E.soil), inList('water_source', E.water), num('irrigated_area_sqm', 1e8),
  opt('altitude_m').isInt({ min: 0, max: 9000 }), inList('road_access', E.road), num('distance_to_market_km', 500),
  opt('latitude').isFloat({ min: -90, max: 90 }), opt('longitude').isFloat({ min: -180, max: 180 }),
  opt('local_level_id').isInt({ min: 1 }), opt('ward_no').isInt({ min: 1, max: 35 }), text('address', 255)
], validate, c.updateFarm);

router.post('/farms/:farmId/production', authorize('datacenter.collect'), farmRule, [
  body('crop_id').isInt({ min: 1 }).withMessage('Select a crop'), FY, inList('season', E.season), inList('production_system', E.system), inList('seed_source', E.seed),
  text('variety', 100), num('area_sqm', 1e8), int('plant_count', 10000000), int('bearing_plants', 10000000),
  opt('planting_date').isISO8601(), opt('harvest_start').isISO8601(), opt('harvest_end').isISO8601(),
  num('production_kg', 1e9), num('loss_kg', 1e9), inList('loss_cause', E.loss), num('sold_kg', 1e9), num('avg_price_npr_per_kg', 100000),
  inList('market_channel', E.market), inList('organic_status', E.organic), inList('status', E.cstatus), text('notes', 500), opt('growing_unit_id').isInt({ min: 1 })
], validate, c.addProduction);

router.post('/farms/:farmId/livestock', authorize('datacenter.collect'), farmRule, [
  body('animal_type').isIn(E.animal).withMessage('Select an animal type'), text('breed', 100), int('head_count', 10000000), num('pond_area_sqm', 1e7),
  inList('purpose', E.purpose), num('annual_output_qty', 1e9), text('output_unit', 20), FY
], validate, c.addLivestock);

router.post('/farms/:farmId/inputs', authorize('datacenter.collect'), farmRule, [
  body('input_type').isIn(E.input).withMessage('Select an input type'), body('quantity').isFloat({ min: 0, max: 1e9 }).withMessage('Quantity is required'),
  inList('unit', E.unit), text('product_name', 150), num('cost_npr', 1e9), inList('source', E.isource), opt('applied_on').isISO8601(), opt('crop_id').isInt({ min: 1 }), FY
], validate, c.addInputs);

router.post('/farms/:farmId/assets', authorize('datacenter.collect'), farmRule, [
  body('asset_type').isIn(E.asset).withMessage('Select an asset type'), opt('quantity').isInt({ min: 1, max: 10000 }), num('area_sqm', 1e7),
  opt('year_installed').isInt({ min: 1950, max: 2100 }), inList('condition_status', E.condition), inList('support_source', E.support), text('notes', 255)
], validate, c.addAssets);

router.post('/farms/:farmId/devices', authorize('devices.create'), farmRule, [
  body('device_code').trim().matches(/^[A-Za-z0-9_-]{3,50}$/).withMessage('Device code: 3-50 letters, digits, - or _'),
  inList('ownership', ['office', 'farmer', 'loan', 'donor']), inList('device_type', ['esp32', 'esp8266', 'other']),
  inList('unit_type', ['greenhouse', 'tunnel', 'open_field']), text('unit_name', 150), inList('preset', ['none', 'starter', 'extended']),
  opt('growing_unit_id').isInt({ min: 1 }), opt('installed_at').isISO8601()
], validate, c.provisionDevice);

router.delete('/records/:type/:rid', authorize('datacenter.collect'), [
  param('type').isIn(['production', 'livestock', 'inputs', 'assets']), param('rid').isInt({ min: 1 })
], validate, c.removeRecord);

module.exports = router;
