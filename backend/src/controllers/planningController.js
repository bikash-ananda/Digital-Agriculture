const db = require('../config/db');
const { logAudit } = require('../utils/audit');
const planning = require('../services/kaskiPlanningService');

const FEEDBACK = new Set(['useful', 'not_useful', 'needs_review']);
const CODES = new Set([
  'no_farmer_records', 'improve_farm_location_data', 'complete_environment_profile',
  'collect_production_records', 'review_reported_crop_losses', 'review_data_use_consent'
]);

exports.get = async (req, res, next) => {
  try {
    res.json(await planning.getKaskiPlanning(req, req.query.fy));
  } catch (error) { next(error); }
};

exports.feedback = async (req, res, next) => {
  try {
    const { recommendation_code: code, local_level_id: levelId, feedback } = req.body;
    if (!CODES.has(code)) return res.status(400).json({ message: 'Unknown planning recommendation' });
    if (!FEEDBACK.has(feedback)) return res.status(400).json({ message: 'Choose useful, not useful, or needs review' });

    let localLevelId = null;
    if (levelId !== undefined && levelId !== null && levelId !== '') {
      if (!Number.isInteger(Number(levelId)) || Number(levelId) < 1) return res.status(400).json({ message: 'Invalid local level' });
      const [levels] = await db.query(
        `SELECT ll.id FROM local_levels ll JOIN districts d ON d.id = ll.district_id
          WHERE ll.id = ? AND d.name_en = 'Kaski'`, [Number(levelId)]);
      if (!levels.length) return res.status(400).json({ message: 'Local level is not in Kaski' });
      localLevelId = Number(levelId);
    }

    const [result] = await db.query(
      'INSERT INTO planning_recommendation_feedback (organization_id, local_level_id, recommendation_code, feedback, created_by) VALUES (?, ?, ?, ?, ?)',
      [req.user.organization_id || null, localLevelId, code, feedback, req.user.id]);
    await logAudit(req.user.id, 'planning_feedback', 'planning_recommendation', result.insertId, { code, local_level_id: localLevelId, feedback }, req);
    res.status(201).json({ id: result.insertId, message: 'Feedback saved for human review' });
  } catch (error) { next(error); }
};
