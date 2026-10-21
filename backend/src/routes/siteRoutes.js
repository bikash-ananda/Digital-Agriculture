const express = require('express');
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize, authorizeRole } = require('../middleware/auth');
const ctrl = require('../controllers/siteController');

const router = express.Router();
router.use(authenticate);

const idRule = param('id').isInt({ min: 1 });
const opt = (name) => body(name).optional({ values: 'falsy' });

router.get('/sites', authorize('smart_farming.view'), ctrl.listSites);
router.get('/sites/:id', authorize('smart_farming.view'), idRule, validate, ctrl.getSite);

router.post('/sites', authorize('smart_farming.create'), [
  body('name_en').trim().notEmpty().withMessage('Site name (English) is required').isLength({ max: 200 }),
  opt('name_ne').trim().isLength({ max: 200 }),
  opt('site_type').isIn(['demonstration', 'farm', 'research', 'other']),
  opt('local_level_id').isInt({ min: 1 }),
  opt('address').trim().isLength({ max: 255 }),
  opt('latitude').isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  opt('longitude').isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude')
], validate, ctrl.createSite);

router.put('/sites/:id/location', authorize('smart_farming.create'), idRule, [
  opt('latitude').isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  opt('longitude').isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude')
], validate, ctrl.updateLocation);

router.post('/sites/:id/units', authorize('smart_farming.create'), idRule, [
  body('unit_type').isIn(['greenhouse', 'tunnel', 'open_field']).withMessage('Invalid unit type'),
  body('name_en').trim().notEmpty().withMessage('Name is required').isLength({ max: 150 }),
  opt('name_ne').trim().isLength({ max: 150 }),
  opt('area_sqm').isFloat({ min: 0 }).withMessage('Invalid area')
], validate, ctrl.createUnit);

router.post('/sites/:id/devices', authorize('devices.create'), idRule, [
  body('device_code').trim().matches(/^[A-Za-z0-9_-]{3,50}$/).withMessage('Device code: 3-50 letters, digits, - or _'),
  opt('growing_unit_id').isInt({ min: 1 }),
  opt('device_type').isIn(['esp32', 'esp8266', 'other']),
  opt('installed_at').isISO8601()
], validate, ctrl.createDevice);

router.get('/devices/:id', authorize('devices.view'), idRule, validate, ctrl.getDevice);
router.post('/devices/:id/rotate-key', authorizeRole('super_admin'), idRule, validate, ctrl.rotateKey);
router.get('/devices/:id/wifi-commands', authorize('devices.view'), idRule, validate, ctrl.listWifiCommands);
router.post('/devices/:id/wifi-commands', authorize('devices.update'), idRule, [
  body('ssid').isString().custom((ssid) => typeof ssid === 'string' && Buffer.byteLength(ssid, 'utf8') >= 1 && Buffer.byteLength(ssid, 'utf8') <= 32 && ![...ssid].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)).withMessage('Network name must be 1 to 32 printable UTF-8 bytes'),
  body('password').optional().isString().custom((password) => password === '' || (Buffer.byteLength(password, 'utf8') >= 8 && Buffer.byteLength(password, 'utf8') <= 63) || /^[A-Fa-f0-9]{64}$/.test(password)).withMessage('Password must be empty for an open network, 8-63 UTF-8 bytes, or 64 hexadecimal characters')
], validate, ctrl.queueWifiCommand);

router.post('/devices/:id/sensors', authorize('devices.create'), idRule, [
  body('sensor_type').isIn(['temperature', 'humidity', 'soil_moisture', 'ec', 'light', 'water_level', 'ph', 'other', 'soil_temperature', 'co2', 'leaf_wetness', 'water_temperature', 'flow', 'pressure', 'wind_speed', 'rainfall']),
  opt('channel_key').matches(/^[a-z0-9_]{2,30}$/).withMessage('Channel key: 2-30 lowercase letters, digits or _'),
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  opt('unit').trim().isLength({ max: 20 }),
  opt('model').trim().isLength({ max: 100 }),
  opt('min_valid').isFloat(), opt('max_valid').isFloat()
], validate, ctrl.addSensor);

router.post('/devices/:id/actuators', authorize('devices.create'), idRule, [
  body('actuator_type').isIn(['irrigation', 'misting', 'fan', 'light', 'other', 'heater', 'vent', 'shade', 'fertigation', 'pump', 'relay']),
  opt('relay_channel').isInt({ min: 0, max: 64 }), opt('gpio_pin').isInt({ min: 0, max: 48 }),
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  opt('max_runtime_seconds').isInt({ min: 1, max: 86400 }).withMessage('Max runtime must be 1-86400 seconds')
], validate, ctrl.addActuator);

router.put('/devices/:id/actuators/:actuatorId', authorize('devices.update'), idRule, param('actuatorId').isInt({ min: 1 }), [
  body('actuator_type').isIn(['irrigation', 'misting', 'fan', 'light', 'other', 'heater', 'vent', 'shade', 'fertigation', 'pump', 'relay']),
  body('relay_channel').optional({ nullable: true, values: 'falsy' }).isInt({ min: 1, max: 64 }),
  body('name').trim().notEmpty().isLength({ max: 100 }),
  body('max_runtime_seconds').isInt({ min: 1, max: 86400 }).withMessage('Max runtime must be 1-86400 seconds')
], validate, ctrl.updateActuator);

module.exports = router;


