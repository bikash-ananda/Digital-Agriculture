const express = require('express');
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/farmerController');

const router = express.Router();
router.use(authenticate);

const f = (name, isCreate) => (isCreate ? body(name) : body(name).optional());
const farmerRules = (isCreate) => [
  f('full_name_en', isCreate).trim().notEmpty().withMessage('Full name (English) is required').isLength({ max: 150 }),
  body('full_name_ne').optional({ values: 'falsy' }).trim().isLength({ max: 150 }),
  body('gender').optional({ values: 'falsy' }).isIn(['male', 'female', 'other']).withMessage('Invalid gender'),
  body('date_of_birth').optional({ values: 'falsy' }).isISO8601().withMessage('Invalid date'),
  body('phone').optional({ values: 'falsy' }).matches(/^[0-9+\-\s]{7,20}$/).withMessage('Invalid phone number'),
  body('email').optional({ values: 'falsy' }).isEmail().withMessage('Invalid email'),
  body('local_level_id').optional({ values: 'falsy' }).isInt({ min: 1 }),
  body('ward_no').optional({ values: 'falsy' }).isInt({ min: 1, max: 35 }).withMessage('Ward must be 1-35'),
  body('address').optional({ values: 'falsy' }).trim().isLength({ max: 255 }),
  body('group_name').optional({ values: 'falsy' }).trim().isLength({ max: 150 })
];
const idRule = param('id').isInt({ min: 1 });

const farmRules = [
  idRule,
  body('name').trim().notEmpty().withMessage('Farm name is required').isLength({ max: 200 }),
  body('area_sqm').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('Invalid area'),
  body('ownership_type').optional({ values: 'falsy' }).isIn(['owned', 'leased', 'shared', 'government']),
  body('irrigation_type').optional({ values: 'falsy' }).isIn(['none', 'rainfed', 'drip', 'sprinkler', 'canal', 'other']),
  body('local_level_id').optional({ values: 'falsy' }).isInt({ min: 1 }),
  body('ward_no').optional({ values: 'falsy' }).isInt({ min: 1, max: 35 }),
  body('address').optional({ values: 'falsy' }).trim().isLength({ max: 255 })
];

router.get('/', authorize('farmers.view'), ctrl.list);
router.get('/farms', authorize('farms.view'), ctrl.listFarms);
router.post('/', authorize('farmers.create'), farmerRules(true), validate, ctrl.create);
router.get('/:id', authorize('farmers.view'), idRule, validate, ctrl.getOne);
router.put('/:id', authorize('farmers.update'), idRule, farmerRules(false), validate, ctrl.update);
router.delete('/:id', authorize('farmers.delete'), idRule, validate, ctrl.remove);
router.post('/:id/farms', authorize('farms.create'), farmRules, validate, ctrl.addFarm);

module.exports = router;
