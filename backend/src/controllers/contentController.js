const db = require('../config/db');
const { logAudit } = require('../utils/audit');

const isSuper = (req) => req.user.roles.includes('super_admin');
const orgFilter = (req, column = 'organization_id') => isSuper(req)
  ? { sql: '', params: [] }
  : { sql: ` WHERE ${column} = ?`, params: [req.user.organization_id] };

function organizationId(req) {
  return req.user.organization_id || (isSuper(req) ? Number(req.body.organization_id) || null : null);
}

exports.programs = async (req, res, next) => {
  try {
    const scope = orgFilter(req, 'p.organization_id');
    const [rows] = await db.query(
      `SELECT p.id, p.code, p.name_ne, p.name_en, p.description, p.fiscal_year, p.target_beneficiaries,
              p.eligibility, p.budget, p.start_date, p.end_date, p.status, p.created_at,
              (SELECT COUNT(*) FROM program_beneficiaries pb WHERE pb.program_id = p.id) AS applicants,
              (SELECT COUNT(*) FROM program_beneficiaries pb WHERE pb.program_id = p.id AND pb.status IN ('approved','supported','completed')) AS selected,
              (SELECT COUNT(*) FROM trainings t WHERE t.program_id = p.id) AS training_count
         FROM programs p${scope.sql} ORDER BY p.start_date DESC, p.id DESC`, scope.params);
    res.json(rows);
  } catch (e) { next(e); }
};
exports.createProgram = async (req, res, next) => {
  try {
    const org = organizationId(req);
    if (!org) return res.status(400).json({ message: 'Your account needs an organization before creating a program' });
    const b = req.body;
    const [r] = await db.query('INSERT INTO programs SET ?', [{
      organization_id: org, name_ne: b.name_ne, name_en: b.name_en || null, description: b.description || null,
      fiscal_year: b.fiscal_year || null, target_beneficiaries: b.target_beneficiaries || null,
      eligibility: b.eligibility || null, budget: b.budget ?? null, start_date: b.start_date || null,
      end_date: b.end_date || null, status: b.status || 'draft', created_by: req.user.id
    }]);
    const code = `PRG-${String(r.insertId).padStart(5, '0')}`;
    await db.query('UPDATE programs SET code = ? WHERE id = ?', [code, r.insertId]);
    await logAudit(req.user.id, 'program_create', 'program', r.insertId, { code, name: b.name_en || b.name_ne }, req);
    res.status(201).json({ id: r.insertId, code });
  } catch (e) { next(e); }
};

exports.updateProgram = async (req, res, next) => {
  try {
    const scope = orgFilter(req, 'p.organization_id');
    const [found] = await db.query(`SELECT p.id FROM programs p WHERE p.id = ?${scope.sql ? ` AND p.organization_id = ?` : ''} LIMIT 1`, [req.params.id, ...scope.params]);
    if (!found.length) return res.status(404).json({ message: 'Program not found' });
    const allowed = ['name_ne', 'name_en', 'description', 'fiscal_year', 'target_beneficiaries', 'eligibility', 'budget', 'start_date', 'end_date', 'status'];
    const changes = Object.fromEntries(allowed.filter((k) => req.body[k] !== undefined).map((k) => [k, req.body[k] === '' ? null : req.body[k]]));
    if (!Object.keys(changes).length) return res.status(400).json({ message: 'No changes supplied' });
    await db.query('UPDATE programs SET ? WHERE id = ?', [changes, req.params.id]);
    await logAudit(req.user.id, 'program_update', 'program', req.params.id, { fields: Object.keys(changes) }, req);
    res.json({ message: 'Program updated' });
  } catch (e) { next(e); }
};

exports.addBeneficiary = async (req, res, next) => {
  try {
    const programScope = orgFilter(req, 'organization_id');
    const [program] = await db.query(`SELECT id FROM programs WHERE id = ?${programScope.sql}`, [req.params.id, ...programScope.params]);
    if (!program.length) return res.status(404).json({ message: 'Program not found' });
    const farmerScope = orgFilter(req, 'organization_id');
    const [farmer] = await db.query(`SELECT id FROM farmers WHERE id = ?${farmerScope.sql}`, [req.body.farmer_id, ...farmerScope.params]);
    if (!farmer.length) return res.status(404).json({ message: 'Farmer not found in your organization' });
    await db.query('INSERT INTO program_beneficiaries SET ?', [{
      program_id: req.params.id, farmer_id: req.body.farmer_id, status: req.body.status || 'applied',
      support_amount: req.body.support_amount ?? null, remarks: req.body.remarks || null
    }]);
    await logAudit(req.user.id, 'program_beneficiary_add', 'program', req.params.id, { farmer_id: req.body.farmer_id, status: req.body.status || 'applied' }, req);
    res.status(201).json({ message: 'Beneficiary application recorded' });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'This farmer is already listed for the program' });
    next(e);
  }
};

exports.beneficiaries = async (req, res, next) => {
  try {
    const scope = orgFilter(req, 'p.organization_id');
    const [rows] = await db.query(
      `SELECT pb.id, pb.farmer_id, f.farmer_code, f.full_name_ne, f.full_name_en, pb.status,
              pb.support_amount, pb.remarks, pb.applied_at
         FROM program_beneficiaries pb JOIN programs p ON p.id = pb.program_id
         JOIN farmers f ON f.id = pb.farmer_id WHERE p.id = ?${scope.sql.replace(' WHERE ', ' AND ')} ORDER BY pb.applied_at DESC LIMIT 250`,
      [req.params.id, ...scope.params]);
    res.json(rows);
  } catch (e) { next(e); }
};

exports.updateBeneficiary = async (req, res, next) => {
  try {
    const scope = orgFilter(req, 'p.organization_id');
    const [found] = await db.query(
      `SELECT pb.id FROM program_beneficiaries pb JOIN programs p ON p.id = pb.program_id
        WHERE p.id = ? AND pb.id = ?${scope.sql.replace(' WHERE ', ' AND ')} LIMIT 1`, [req.params.id, req.params.beneficiaryId, ...scope.params]);
    if (!found.length) return res.status(404).json({ message: 'Beneficiary application not found' });
    const changes = {};
    ['status', 'support_amount', 'remarks'].forEach((key) => {
      if (req.body[key] !== undefined) changes[key] = req.body[key] === '' ? null : req.body[key];
    });
    if (!Object.keys(changes).length) return res.status(400).json({ message: 'No changes supplied' });
    await db.query('UPDATE program_beneficiaries SET ? WHERE id = ?', [changes, req.params.beneficiaryId]);
    await logAudit(req.user.id, 'program_beneficiary_update', 'program', req.params.id, { beneficiary_id: req.params.beneficiaryId, fields: Object.keys(changes) }, req);
    res.json({ message: 'Beneficiary status updated' });
  } catch (e) { next(e); }
};

exports.trainings = async (req, res, next) => {
  try {
    const scope = orgFilter(req, 't.organization_id');
    const [rows] = await db.query(
      `SELECT t.id, t.program_id, t.title_ne, t.title_en, t.venue, t.start_date, t.end_date, t.status,
              p.name_en AS program_en, p.name_ne AS program_ne,
              (SELECT COUNT(*) FROM training_participants tp WHERE tp.training_id = t.id) AS participants
         FROM trainings t LEFT JOIN programs p ON p.id = t.program_id${scope.sql} ORDER BY t.start_date DESC, t.id DESC`, scope.params);
    res.json(rows);
  } catch (e) { next(e); }
};

exports.createTraining = async (req, res, next) => {
  try {
    const org = organizationId(req);
    if (!org) return res.status(400).json({ message: 'Your account needs an organization before scheduling training' });
    const b = req.body;
    if (b.program_id) {
      const scope = orgFilter(req, 'organization_id');
      const [program] = await db.query(`SELECT id FROM programs WHERE id = ?${scope.sql}`, [b.program_id, ...scope.params]);
      if (!program.length) return res.status(404).json({ message: 'Program not found' });
    }
    const [r] = await db.query('INSERT INTO trainings SET ?', [{
      organization_id: org, program_id: b.program_id || null, title_ne: b.title_ne, title_en: b.title_en || null,
      venue: b.venue || null, start_date: b.start_date || null, end_date: b.end_date || null, status: b.status || 'planned'
    }]);
    await logAudit(req.user.id, 'training_create', 'training', r.insertId, { title: b.title_en || b.title_ne }, req);
    res.status(201).json({ id: r.insertId });
  } catch (e) { next(e); }
};

exports.notices = async (req, res, next) => {
  try {
    const scope = orgFilter(req, 'n.organization_id');
    const canManage = req.user.permissions.includes('notices.update') || req.user.permissions.includes('notices.publish');
    const visibility = canManage ? '' : ' AND n.is_published = 1 AND (n.published_at IS NULL OR n.published_at <= NOW())';
    const [rows] = await db.query(
      `SELECT n.id, n.category, n.title_ne, n.title_en, n.body, n.file_path, n.published_at,
              n.deadline_date, n.is_published, n.created_at
         FROM notices n${scope.sql}${visibility} ORDER BY COALESCE(n.published_at, n.created_at) DESC, n.id DESC LIMIT 200`, scope.params);
    res.json(rows);
  } catch (e) { next(e); }
};

exports.createNotice = async (req, res, next) => {
  try {
    const org = organizationId(req);
    if (!org) return res.status(400).json({ message: 'Your account needs an organization before publishing a notice' });
    const b = req.body;
    const publish = Boolean(b.is_published) && req.user.permissions.includes('notices.publish');
    const [r] = await db.query('INSERT INTO notices SET ?', [{
      organization_id: org, category: b.category || 'notice', title_ne: b.title_ne, title_en: b.title_en || null,
      body: b.body || null, file_path: b.file_path || null, deadline_date: b.deadline_date || null,
      is_published: publish ? 1 : 0, published_at: publish ? new Date() : null, created_by: req.user.id
    }]);
    await logAudit(req.user.id, publish ? 'notice_publish' : 'notice_create', 'notice', r.insertId, { title: b.title_en || b.title_ne }, req);
    res.status(201).json({ id: r.insertId, is_published: publish });
  } catch (e) { next(e); }
};

exports.updateNotice = async (req, res, next) => {
  try {
    const scope = orgFilter(req, 'n.organization_id');
    const [found] = await db.query(`SELECT n.id FROM notices n WHERE n.id = ?${scope.sql ? ' AND n.organization_id = ?' : ''} LIMIT 1`, [req.params.id, ...scope.params]);
    if (!found.length) return res.status(404).json({ message: 'Notice not found' });
    const allowed = ['category', 'title_ne', 'title_en', 'body', 'file_path', 'deadline_date'];
    const changes = Object.fromEntries(allowed.filter((k) => req.body[k] !== undefined).map((k) => [k, req.body[k] === '' ? null : req.body[k]]));
    if (req.body.is_published !== undefined) {
      if (req.body.is_published && !req.user.permissions.includes('notices.publish')) return res.status(403).json({ message: 'Publishing permission required' });
      changes.is_published = req.body.is_published ? 1 : 0;
      changes.published_at = req.body.is_published ? new Date() : null;
    }
    if (!Object.keys(changes).length) return res.status(400).json({ message: 'No changes supplied' });
    await db.query('UPDATE notices SET ? WHERE id = ?', [changes, req.params.id]);
    await logAudit(req.user.id, changes.is_published ? 'notice_publish' : 'notice_update', 'notice', req.params.id, { fields: Object.keys(changes) }, req);
    res.json({ message: 'Notice updated' });
  } catch (e) { next(e); }
};

exports.documents = async (req, res, next) => {
  try {
    const scope = orgFilter(req, 'd.organization_id');
    const canManage = req.user.permissions.includes('documents.create') || req.user.permissions.includes('documents.update');
    const visibility = canManage ? '' : ' AND d.is_public = 1';
    const [rows] = await db.query(
      `SELECT d.id, d.category, d.title_ne, d.title_en, d.file_path, d.fiscal_year, d.is_public, d.created_at
         FROM documents d${scope.sql}${visibility} ORDER BY d.created_at DESC, d.id DESC LIMIT 300`, scope.params);
    res.json(rows);
  } catch (e) { next(e); }
};

exports.createDocument = async (req, res, next) => {
  try {
    const org = organizationId(req);
    if (!org) return res.status(400).json({ message: 'Your account needs an organization before adding a document' });
    const b = req.body;
    const [r] = await db.query('INSERT INTO documents SET ?', [{
      organization_id: org, category: b.category || 'other', title_ne: b.title_ne, title_en: b.title_en || null,
      file_path: b.file_path, fiscal_year: b.fiscal_year || null,
      is_public: b.is_public === false ? 0 : 1, uploaded_by: req.user.id
    }]);
    await logAudit(req.user.id, 'document_create', 'document', r.insertId, { title: b.title_en || b.title_ne }, req);
    res.status(201).json({ id: r.insertId });
  } catch (e) { next(e); }
};

exports.learning = async (req, res, next) => {
  try {
    const canManage = req.user.permissions.includes('learning.update') || req.user.permissions.includes('learning.publish');
    const visibility = canManage ? '' : " WHERE c.status = 'published'";
    const [courses] = await db.query(
      `SELECT c.id, c.title_ne, c.title_en, c.description, c.level, c.status, c.created_at,
              COUNT(DISTINCT l.id) AS lesson_count, COALESCE(MAX(e.progress_percent), 0) AS progress_percent,
              COALESCE(MAX(e.status), 'not_enrolled') AS enrollment_status
         FROM courses c LEFT JOIN course_lessons l ON l.course_id = c.id
         LEFT JOIN course_enrollments e ON e.course_id = c.id AND e.user_id = ?${visibility}
        GROUP BY c.id ORDER BY c.created_at DESC`, [req.user.id]);
    const [resources] = await db.query("SELECT id, title_ne, title_en, resource_type, url, file_path, description FROM learning_resources WHERE status = 'published' ORDER BY created_at DESC LIMIT 100");
    res.json({ courses, resources });
  } catch (e) { next(e); }
};

exports.createCourse = async (req, res, next) => {
  try {
    const publish = req.body.status === 'published' && req.user.permissions.includes('learning.publish');
    const [r] = await db.query('INSERT INTO courses SET ?', [{
      title_ne: req.body.title_ne || req.body.title_en, title_en: req.body.title_en || null,
      description: req.body.description || null, level: req.body.level || 'beginner',
      status: publish ? 'published' : 'draft', created_by: req.user.id
    }]);
    await logAudit(req.user.id, publish ? 'course_publish' : 'course_create', 'course', r.insertId, { title: req.body.title_en || req.body.title_ne }, req);
    res.status(201).json({ id: r.insertId, status: publish ? 'published' : 'draft' });
  } catch (e) { next(e); }
};

exports.updateCourse = async (req, res, next) => {
  try {
    const [found] = await db.query('SELECT id FROM courses WHERE id = ? LIMIT 1', [req.params.id]);
    if (!found.length) return res.status(404).json({ message: 'Course not found' });
    if (req.body.status === 'published' && !req.user.permissions.includes('learning.publish')) return res.status(403).json({ message: 'Publishing permission required' });
    const allowed = ['title_ne', 'title_en', 'description', 'level', 'status'];
    const changes = Object.fromEntries(allowed.filter((k) => req.body[k] !== undefined).map((k) => [k, req.body[k] === '' ? null : req.body[k]]));
    if (!Object.keys(changes).length) return res.status(400).json({ message: 'No changes supplied' });
    await db.query('UPDATE courses SET ? WHERE id = ?', [changes, req.params.id]);
    await logAudit(req.user.id, changes.status === 'published' ? 'course_publish' : 'course_update', 'course', req.params.id, { fields: Object.keys(changes) }, req);
    res.json({ message: 'Course updated' });
  } catch (e) { next(e); }
};

exports.addLesson = async (req, res, next) => {
  try {
    const [course] = await db.query('SELECT id FROM courses WHERE id = ? LIMIT 1', [req.params.id]);
    if (!course.length) return res.status(404).json({ message: 'Course not found' });
    const b = req.body;
    const [r] = await db.query('INSERT INTO course_lessons SET ?', [{
      course_id: req.params.id, sort_order: b.sort_order || 0, title_ne: b.title_ne || b.title_en,
      title_en: b.title_en || null, content_type: b.content_type || 'text', content_url: b.content_url || null,
      body: b.body || null, duration_minutes: b.duration_minutes || null
    }]);
    await logAudit(req.user.id, 'course_lesson_create', 'course', req.params.id, { lesson_id: r.insertId }, req);
    res.status(201).json({ id: r.insertId });
  } catch (e) { next(e); }
};

exports.createLearningResource = async (req, res, next) => {
  try {
    const publish = req.body.status === 'published' && req.user.permissions.includes('learning.publish');
    const b = req.body;
    const [r] = await db.query('INSERT INTO learning_resources SET ?', [{
      title_ne: b.title_ne || b.title_en, title_en: b.title_en || null, resource_type: b.resource_type || 'material',
      url: b.url || null, file_path: b.file_path || null, description: b.description || null,
      status: publish ? 'published' : 'draft', created_by: req.user.id
    }]);
    await logAudit(req.user.id, publish ? 'learning_resource_publish' : 'learning_resource_create', 'learning_resource', r.insertId, { title: b.title_en || b.title_ne }, req);
    res.status(201).json({ id: r.insertId, status: publish ? 'published' : 'draft' });
  } catch (e) { next(e); }
};

exports.course = async (req, res, next) => {
  try {
    const canManage = req.user.permissions.includes('learning.update') || req.user.permissions.includes('learning.publish');
    const [courses] = await db.query(`SELECT id, title_ne, title_en, description, level, status FROM courses WHERE id = ?${canManage ? '' : " AND status = 'published'"} LIMIT 1`, [req.params.id]);
    if (!courses.length) return res.status(404).json({ message: 'Course not found' });
    const [lessons] = await db.query('SELECT id, sort_order, title_ne, title_en, content_type, content_url, body, duration_minutes FROM course_lessons WHERE course_id = ? ORDER BY sort_order, id', [req.params.id]);
    const [[enrollment]] = await db.query('SELECT status, progress_percent FROM course_enrollments WHERE course_id = ? AND user_id = ? LIMIT 1', [req.params.id, req.user.id]);
    res.json({ course: courses[0], lessons, enrollment: enrollment || null });
  } catch (e) { next(e); }
};

exports.enroll = async (req, res, next) => {
  try {
    const [course] = await db.query("SELECT id FROM courses WHERE id = ? AND status = 'published' LIMIT 1", [req.params.id]);
    if (!course.length) return res.status(404).json({ message: 'Published course not found' });
    await db.query("INSERT INTO course_enrollments (course_id, user_id, status, progress_percent) VALUES (?, ?, 'enrolled', 0) ON DUPLICATE KEY UPDATE status = IF(status = 'completed', status, 'enrolled')", [req.params.id, req.user.id]);
    res.status(201).json({ message: 'You are enrolled' });
  } catch (e) { next(e); }
};

exports.progress = async (req, res, next) => {
  try {
    const progress = Number(req.body.progress_percent);
    await db.query("UPDATE course_enrollments SET progress_percent = ?, status = IF(? = 100, 'completed', 'enrolled') WHERE course_id = ? AND user_id = ?", [progress, progress, req.params.id, req.user.id]);
    res.json({ progress_percent: progress });
  } catch (e) { next(e); }
};

// Public Knowledge Center feeds. Private drafts and unmoderated comments never leave the API.
exports.publicArticles = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT a.id, a.topic, a.title_ne, a.title_en, a.body, a.created_at,
              c.name_ne AS crop_ne, c.name_en AS crop_en
         FROM knowledge_articles a LEFT JOIN crops c ON c.id = a.crop_id
        WHERE a.status = 'published' ORDER BY a.updated_at DESC, a.id DESC LIMIT 100`);
    res.json(rows);
  } catch (e) { next(e); }
};

exports.publicNews = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT id, category, title_ne, title_en, body, file_path, published_at, created_at
         FROM notices
        WHERE is_published = 1 AND category IN ('news', 'press_release', 'program', 'training')
        ORDER BY COALESCE(published_at, created_at) DESC, id DESC LIMIT 12`);
    res.json(rows);
  } catch (e) { next(e); }
};

exports.publicPapers = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT id, title, author_names, affiliation, abstract, keywords, topic,
              publication_year, doi, full_text_url, published_at
         FROM research_papers WHERE status = 'published'
        ORDER BY published_at DESC, id DESC LIMIT 200`);
    res.json(rows);
  } catch (e) { next(e); }
};

exports.publicPaperComments = async (req, res, next) => {
  try {
    const [paper] = await db.query("SELECT id FROM research_papers WHERE id = ? AND status = 'published' LIMIT 1", [req.params.paperId]);
    if (!paper.length) return res.status(404).json({ message: 'Published research paper not found' });
    const [rows] = await db.query(
      `SELECT id, display_name, body, created_at FROM research_paper_comments
        WHERE paper_id = ? AND status = 'approved' ORDER BY created_at DESC LIMIT 100`, [req.params.paperId]);
    res.json(rows);
  } catch (e) { next(e); }
};

exports.createPublicPaperComment = async (req, res, next) => {
  try {
    const [paper] = await db.query("SELECT id FROM research_papers WHERE id = ? AND status = 'published' LIMIT 1", [req.params.paperId]);
    if (!paper.length) return res.status(404).json({ message: 'Published research paper not found' });
    const [result] = await db.query('INSERT INTO research_paper_comments SET ?', [{
      paper_id: req.params.paperId,
      display_name: (req.body.display_name || 'Community reader').trim().slice(0, 100),
      body: req.body.body.trim(), status: 'pending'
    }]);
    res.status(201).json({ id: result.insertId, message: 'Comment received and awaiting moderator review' });
  } catch (e) { next(e); }
};

exports.publicCourses = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT c.id, c.title_ne, c.title_en, c.description, c.level, c.created_at,
              COUNT(l.id) AS lesson_count
         FROM courses c LEFT JOIN course_lessons l ON l.course_id = c.id
        WHERE c.status = 'published' GROUP BY c.id ORDER BY c.created_at DESC LIMIT 100`);
    res.json(rows);
  } catch (e) { next(e); }
};

exports.publicCourse = async (req, res, next) => {
  try {
    const [courses] = await db.query(
      "SELECT id, title_ne, title_en, description, level FROM courses WHERE id = ? AND status = 'published' LIMIT 1", [req.params.id]);
    if (!courses.length) return res.status(404).json({ message: 'Published course not found' });
    const [lessons] = await db.query(
      'SELECT id, sort_order, title_ne, title_en, content_type, content_url, body, duration_minutes FROM course_lessons WHERE course_id = ? ORDER BY sort_order, id', [req.params.id]);
    res.json({ course: courses[0], lessons });
  } catch (e) { next(e); }
};

exports.publicLibrary = async (req, res, next) => {
  try {
    const [documents] = await db.query(
      `SELECT id, category, title_ne, title_en, file_path, fiscal_year, created_at
         FROM documents WHERE is_public = 1 ORDER BY created_at DESC, id DESC LIMIT 200`);
    const [resources] = await db.query(
      `SELECT id, title_ne, title_en, resource_type, url, file_path, description, created_at
         FROM learning_resources WHERE status = 'published' ORDER BY created_at DESC, id DESC LIMIT 200`);
    res.json({ documents, resources });
  } catch (e) { next(e); }
};

exports.submitPaper = async (req, res, next) => {
  try {
    const org = organizationId(req);
    const b = req.body;
    const [result] = await db.query('INSERT INTO research_papers SET ?', [{
      organization_id: org, title: b.title.trim(), author_names: b.author_names.trim(),
      affiliation: b.affiliation || null, abstract: b.abstract.trim(), keywords: b.keywords || null,
      topic: b.topic || null, publication_year: b.publication_year || null,
      doi: b.doi || null, full_text_url: b.full_text_url || null,
      status: 'submitted', submitted_by: req.user.id
    }]);
    await logAudit(req.user.id, 'research_paper_submit', 'research_paper', result.insertId, { title: b.title.trim() }, req);
    res.status(201).json({ id: result.insertId, status: 'submitted' });
  } catch (e) { next(e); }
};

exports.myPapers = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT id, title, author_names, topic, publication_year, status, review_note, created_at, published_at
         FROM research_papers WHERE submitted_by = ? ORDER BY created_at DESC LIMIT 100`, [req.user.id]);
    res.json(rows);
  } catch (e) { next(e); }
};

exports.managePapers = async (req, res, next) => {
  try {
    const scope = orgFilter(req, 'rp.organization_id');
    const [rows] = await db.query(
      `SELECT rp.id, rp.title, rp.author_names, rp.affiliation, rp.abstract, rp.keywords, rp.topic,
              rp.publication_year, rp.doi, rp.full_text_url, rp.status, rp.review_note, rp.created_at,
              u.full_name_en AS submitter_name
         FROM research_papers rp LEFT JOIN users u ON u.id = rp.submitted_by
        ${scope.sql}${scope.sql ? ' AND' : ' WHERE'} rp.status = 'submitted'
        ORDER BY rp.created_at ASC LIMIT 200`, scope.params);
    res.json(rows);
  } catch (e) { next(e); }
};

exports.reviewPaper = async (req, res, next) => {
  try {
    const scope = orgFilter(req, 'rp.organization_id');
    const [papers] = await db.query(
      `SELECT rp.id FROM research_papers rp WHERE rp.id = ?${scope.sql ? ' AND rp.organization_id = ?' : ''} AND rp.status = 'submitted' LIMIT 1`,
      [req.params.id, ...scope.params]);
    if (!papers.length) return res.status(404).json({ message: 'Submitted paper not found' });
    const status = req.body.status;
    await db.query(
      `UPDATE research_papers SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = NOW(),
              published_at = IF(? = 'published', NOW(), NULL) WHERE id = ?`,
      [status, req.body.review_note || null, req.user.id, status, req.params.id]);
    await logAudit(req.user.id, `research_paper_${status}`, 'research_paper', req.params.id, {}, req);
    res.json({ message: status === 'published' ? 'Paper published' : 'Paper returned with review decision' });
  } catch (e) { next(e); }
};

exports.pendingComments = async (req, res, next) => {
  try {
    const scope = orgFilter(req, 'p.organization_id');
    const [rows] = await db.query(
      `SELECT c.id, c.display_name, c.body, c.created_at, p.title AS paper_title
         FROM research_paper_comments c JOIN research_papers p ON p.id = c.paper_id
        ${scope.sql}${scope.sql ? ' AND' : ' WHERE'} c.status = 'pending' ORDER BY c.created_at ASC LIMIT 250`, scope.params);
    res.json(rows);
  } catch (e) { next(e); }
};

exports.moderateComment = async (req, res, next) => {
  try {
    const scope = orgFilter(req, 'p.organization_id');
    const [comments] = await db.query(
      `SELECT c.id FROM research_paper_comments c JOIN research_papers p ON p.id = c.paper_id
        WHERE c.id = ?${scope.sql ? ' AND p.organization_id = ?' : ''} AND c.status = 'pending' LIMIT 1`,
      [req.params.id, ...scope.params]);
    if (!comments.length) return res.status(404).json({ message: 'Pending comment not found' });
    const [result] = await db.query(
      `UPDATE research_paper_comments SET status = ?, reviewed_by = ?, reviewed_at = NOW()
        WHERE id = ? AND status = 'pending'`, [req.body.status, req.user.id, req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Pending comment not found' });
    await logAudit(req.user.id, `research_comment_${req.body.status}`, 'research_paper_comment', req.params.id, {}, req);
    res.json({ message: 'Comment moderation saved' });
  } catch (e) { next(e); }
};

exports.officerDiscussions = async (req, res, next) => {
  try {
    const scope = orgFilter(req, 'd.organization_id');
    const [rows] = await db.query(
      `SELECT d.id, d.title, d.topic, d.status, d.created_at, d.updated_at,
              COALESCE(u.full_name_en, u.full_name_ne, 'Kaski officer') AS creator_name,
              (SELECT COUNT(*) FROM officer_discussion_messages m WHERE m.discussion_id = d.id) AS message_count
         FROM officer_discussions d LEFT JOIN users u ON u.id = d.created_by
        ${scope.sql} ORDER BY d.updated_at DESC LIMIT 100`, scope.params);
    res.json(rows);
  } catch (e) { next(e); }
};

exports.createOfficerDiscussion = async (req, res, next) => {
  try {
    const org = organizationId(req);
    if (!org) return res.status(400).json({ message: 'Your account needs an organization to start a staff discussion' });
    const [result] = await db.query('INSERT INTO officer_discussions SET ?', [{
      organization_id: org, title: req.body.title.trim(), topic: req.body.topic || null, created_by: req.user.id
    }]);
    res.status(201).json({ id: result.insertId });
  } catch (e) { next(e); }
};

exports.officerDiscussionMessages = async (req, res, next) => {
  try {
    const scope = orgFilter(req, 'd.organization_id');
    const [threads] = await db.query(
      `SELECT d.id FROM officer_discussions d WHERE d.id = ?${scope.sql ? ' AND d.organization_id = ?' : ''} LIMIT 1`,
      [req.params.id, ...scope.params]);
    if (!threads.length) return res.status(404).json({ message: 'Discussion not found' });
    const [rows] = await db.query(
      `SELECT m.id, m.body, m.created_at, m.sender_id,
              COALESCE(u.full_name_en, u.full_name_ne, 'Kaski officer') AS sender_name
         FROM officer_discussion_messages m LEFT JOIN users u ON u.id = m.sender_id
        WHERE m.discussion_id = ? ORDER BY m.created_at ASC LIMIT 500`, [req.params.id]);
    res.json(rows);
  } catch (e) { next(e); }
};

exports.createOfficerDiscussionMessage = async (req, res, next) => {
  try {
    const scope = orgFilter(req, 'd.organization_id');
    const [threads] = await db.query(
      `SELECT d.id, d.status FROM officer_discussions d WHERE d.id = ?${scope.sql ? ' AND d.organization_id = ?' : ''} LIMIT 1`,
      [req.params.id, ...scope.params]);
    if (!threads.length) return res.status(404).json({ message: 'Discussion not found' });
    if (threads[0].status !== 'open') return res.status(409).json({ message: 'This discussion is closed' });
    const [result] = await db.query('INSERT INTO officer_discussion_messages SET ?', [{
      discussion_id: req.params.id, sender_id: req.user.id, body: req.body.body.trim()
    }]);
    await db.query('UPDATE officer_discussions SET updated_at = NOW() WHERE id = ?', [req.params.id]);
    res.status(201).json({ id: result.insertId });
  } catch (e) { next(e); }
};
