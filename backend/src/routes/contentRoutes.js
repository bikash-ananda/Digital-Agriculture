const express = require('express');
const { body, param } = require('express-validator');
const rateLimit = require('express-rate-limit');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/contentController');

const router = express.Router();
const id = param('id').isInt({ min: 1 });
const paperId = param('paperId').isInt({ min: 1 });
const optionalDate = (field) => body(field).optional({ values: 'falsy' }).isISO8601().withMessage(`${field} must be a valid date`);
const safeLink = (value) => !value || /^https?:\/\//i.test(value) || (value.startsWith('/') && !value.startsWith('//'));
const publicCommentLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false,
  message: { message: 'Comment limit reached. Please try again later.' } });
const innovationSubmitLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false,
  message: { message: 'Innovation idea limit reached. Please try again later.' } });

// Public read-only Knowledge Center endpoints. Public comments enter moderation first.
router.get('/public/articles', c.publicArticles);
router.get('/public/news', c.publicNews);
router.get('/public/papers', c.publicPapers);
router.get('/public/papers/:paperId/comments', paperId, validate, c.publicPaperComments);
router.post('/public/papers/:paperId/comments', publicCommentLimit, paperId, [
  body('display_name').optional({ values: 'falsy' }).trim().isLength({ min: 2, max: 100 }),
  body('body').trim().isLength({ min: 10, max: 3000 }).withMessage('Comment must be 10 to 3000 characters')
], validate, c.createPublicPaperComment);
router.get('/public/training', c.publicCourses);
router.get('/public/training/:id', id, validate, c.publicCourse);
router.get('/public/library', c.publicLibrary);
router.get('/public/innovations', c.publicInnovations);

router.use(authenticate);

router.get('/innovations/mine', authorize('knowledge.view'), c.myInnovations);
router.get('/innovations/manage', authorize('knowledge.publish'), c.manageInnovations);
router.post('/innovations', innovationSubmitLimit, authorize('knowledge.view'), [
  body('title').trim().notEmpty().isLength({ max: 255 }),
  body('category').isIn(['climate_smart', 'water_soil', 'crop_health', 'post_harvest', 'digital', 'other']),
  body('problem').trim().isLength({ min: 20, max: 4000 }),
  body('solution').trim().isLength({ min: 20, max: 4000 }),
  body('crops').optional({ values: 'falsy' }).trim().isLength({ max: 300 }),
  body('location').optional({ values: 'falsy' }).trim().isLength({ max: 180 }),
  body('expected_impact').optional({ values: 'falsy' }).trim().isLength({ max: 2000 })
], validate, c.submitInnovation);
router.put('/innovations/:id/review', authorize('knowledge.publish'), id, [
  body('status').isIn(['reviewing', 'pilot', 'showcase', 'declined']),
  body('review_note').optional({ values: 'falsy' }).trim().isLength({ max: 5000 })
], validate, c.reviewInnovation);

router.post('/papers', authorize('knowledge.create'), [
  body('title').trim().notEmpty().isLength({ max: 300 }),
  body('author_names').trim().notEmpty().isLength({ max: 500 }),
  body('affiliation').optional({ values: 'falsy' }).trim().isLength({ max: 300 }),
  body('abstract').trim().notEmpty().isLength({ min: 30, max: 10000 }),
  body('keywords').optional({ values: 'falsy' }).trim().isLength({ max: 500 }),
  body('topic').optional({ values: 'falsy' }).trim().isLength({ max: 100 }),
  body('publication_year').optional({ values: 'falsy' }).isInt({ min: 1900, max: 2100 }),
  body('doi').optional({ values: 'falsy' }).trim().isLength({ max: 150 }),
  body('organization_id').optional({ values: 'falsy' }).isInt({ min: 1 }),
  body('full_text_url').optional({ values: 'falsy' }).isString().isLength({ max: 500 }).bail().custom(safeLink).withMessage('Use a relative path or an HTTP(S) link')
], validate, c.submitPaper);
router.get('/papers/mine', authorize('knowledge.view'), c.myPapers);
router.get('/papers/manage', authorize('knowledge.publish'), c.managePapers);
router.put('/papers/:id/review', authorize('knowledge.publish'), id, [
  body('status').isIn(['published', 'rejected']), body('review_note').optional({ values: 'falsy' }).trim().isLength({ max: 5000 })
], validate, c.reviewPaper);
router.get('/moderation/comments', authorize('knowledge.publish'), c.pendingComments);
router.put('/moderation/comments/:id', authorize('knowledge.publish'), id, [
  body('status').isIn(['approved', 'rejected'])
], validate, c.moderateComment);

router.get('/discussions', authorize('knowledge.discuss'), c.officerDiscussions);
router.post('/discussions', authorize('knowledge.discuss'), [
  body('title').trim().notEmpty().isLength({ max: 255 }),
  body('topic').optional({ values: 'falsy' }).trim().isLength({ max: 100 })
], validate, c.createOfficerDiscussion);
router.get('/discussions/:id/messages', authorize('knowledge.discuss'), id, validate, c.officerDiscussionMessages);
router.post('/discussions/:id/messages', authorize('knowledge.discuss'), id, [
  body('body').trim().notEmpty().isLength({ min: 2, max: 5000 })
], validate, c.createOfficerDiscussionMessage);

router.get('/programs', authorize('programs.view'), c.programs);
router.post('/programs', authorize('programs.create'), [
  body('name_ne').trim().notEmpty().isLength({ max: 255 }), body('name_en').optional({ values: 'falsy' }).trim().isLength({ max: 255 }),
  body('description').optional({ values: 'falsy' }).isString().isLength({ max: 5000 }),
  body('fiscal_year').optional({ values: 'falsy' }).matches(/^\d{4}\/\d{4}$/),
  body('target_beneficiaries').optional({ values: 'falsy' }).isString().isLength({ max: 5000 }),
  body('eligibility').optional({ values: 'falsy' }).isString().isLength({ max: 5000 }),
  body('budget').optional({ values: 'falsy' }).isFloat({ min: 0 }), optionalDate('start_date'), optionalDate('end_date'),
  body('status').optional().isIn(['draft', 'open', 'ongoing', 'completed', 'cancelled'])
], validate, c.createProgram);
router.put('/programs/:id', authorize('programs.update'), id, [
  body('name_ne').optional().trim().notEmpty().isLength({ max: 255 }), body('name_en').optional({ values: 'null' }).trim().isLength({ max: 255 }),
  body('description').optional({ values: 'null' }).isString().isLength({ max: 5000 }),
  body('fiscal_year').optional({ values: 'null' }).matches(/^\d{4}\/\d{4}$/),
  body('target_beneficiaries').optional({ values: 'null' }).isString().isLength({ max: 5000 }),
  body('eligibility').optional({ values: 'null' }).isString().isLength({ max: 5000 }),
  body('budget').optional({ values: 'null' }).isFloat({ min: 0 }), optionalDate('start_date'), optionalDate('end_date'),
  body('status').optional().isIn(['draft', 'open', 'ongoing', 'completed', 'cancelled'])
], validate, c.updateProgram);
router.post('/programs/:id/beneficiaries', authorize('programs.update'), id, [
  body('farmer_id').isInt({ min: 1 }), body('status').optional().isIn(['applied', 'approved', 'rejected', 'supported', 'completed']),
  body('support_amount').optional({ values: 'falsy' }).isFloat({ min: 0 }), body('remarks').optional({ values: 'falsy' }).trim().isLength({ max: 255 })
], validate, c.addBeneficiary);
router.get('/programs/:id/beneficiaries', authorize('programs.view', 'farmers.view'), id, validate, c.beneficiaries);
router.put('/programs/:id/beneficiaries/:beneficiaryId', authorize('programs.update'), id, param('beneficiaryId').isInt({ min: 1 }), [
  body('status').optional().isIn(['applied', 'approved', 'rejected', 'supported', 'completed']),
  body('support_amount').optional({ values: 'null' }).isFloat({ min: 0 }), body('remarks').optional({ values: 'null' }).trim().isLength({ max: 255 })
], validate, c.updateBeneficiary);
router.get('/trainings', authorize('programs.view'), c.trainings);
router.post('/trainings', authorize('programs.create'), [
  body('title_ne').trim().notEmpty().isLength({ max: 255 }), body('title_en').optional({ values: 'falsy' }).trim().isLength({ max: 255 }),
  body('program_id').optional({ values: 'falsy' }).isInt({ min: 1 }), body('venue').optional({ values: 'falsy' }).trim().isLength({ max: 255 }),
  optionalDate('start_date'), optionalDate('end_date'), body('status').optional().isIn(['planned', 'ongoing', 'completed', 'cancelled'])
], validate, c.createTraining);

router.get('/notices', authorize('notices.view'), c.notices);
router.post('/notices', authorize('notices.create'), [
  body('category').optional().isIn(['notice', 'news', 'press_release', 'program', 'training']),
  body('title_ne').trim().notEmpty().isLength({ max: 300 }), body('title_en').optional({ values: 'falsy' }).trim().isLength({ max: 300 }),
  body('body').optional({ values: 'falsy' }).isString().isLength({ max: 10000 }), body('file_path').optional({ values: 'falsy' }).isString().isLength({ max: 500 }).bail().custom(safeLink).withMessage('Use a relative path or an HTTP(S) link'),
  optionalDate('deadline_date'), body('is_published').optional().isBoolean()
], validate, c.createNotice);
router.put('/notices/:id', authorize('notices.update'), id, [
  body('category').optional().isIn(['notice', 'news', 'press_release', 'program', 'training']),
  body('title_ne').optional().trim().notEmpty().isLength({ max: 300 }), body('title_en').optional({ values: 'null' }).trim().isLength({ max: 300 }),
  body('body').optional({ values: 'null' }).isString().isLength({ max: 10000 }), body('file_path').optional({ values: 'null' }).isString().isLength({ max: 500 }).bail().custom((v) => v === null || safeLink(v)).withMessage('Use a relative path or an HTTP(S) link'),
  optionalDate('deadline_date'), body('is_published').optional().isBoolean()
], validate, c.updateNotice);

router.get('/documents', authorize('documents.view'), c.documents);
router.post('/documents', authorize('documents.create'), [
  body('category').optional().isIn(['act', 'directive', 'procedure', 'criteria', 'book', 'form', 'report', 'progress', 'bulletin', 'other']),
  body('title_ne').trim().notEmpty().isLength({ max: 300 }), body('title_en').optional({ values: 'falsy' }).trim().isLength({ max: 300 }),
  body('file_path').trim().notEmpty().isLength({ max: 500 }).bail().custom(safeLink).withMessage('Use a relative path or an HTTP(S) link'), body('fiscal_year').optional({ values: 'falsy' }).matches(/^\d{4}\/\d{4}$/),
  body('is_public').optional().isBoolean()
], validate, c.createDocument);

router.get('/learning', authorize('learning.view'), c.learning);
router.post('/learning/courses', authorize('learning.create'), [
  body('title_ne').optional({ values: 'falsy' }).trim().isLength({ max: 255 }), body('title_en').optional({ values: 'falsy' }).trim().isLength({ max: 255 }),
  body().custom((b) => Boolean(b.title_ne || b.title_en)).withMessage('Enter a course title'),
  body('description').optional({ values: 'falsy' }).isString().isLength({ max: 5000 }),
  body('level').optional().isIn(['beginner', 'intermediate', 'advanced']), body('status').optional().isIn(['draft', 'published'])
], validate, c.createCourse);
router.put('/learning/courses/:id', authorize('learning.update'), id, [
  body('title_ne').optional().trim().notEmpty().isLength({ max: 255 }), body('title_en').optional({ values: 'null' }).trim().isLength({ max: 255 }),
  body('description').optional({ values: 'null' }).isString().isLength({ max: 5000 }),
  body('level').optional().isIn(['beginner', 'intermediate', 'advanced']), body('status').optional().isIn(['draft', 'published', 'archived'])
], validate, c.updateCourse);
router.post('/learning/courses/:id/lessons', authorize('learning.update'), id, [
  body('title_ne').optional({ values: 'falsy' }).trim().isLength({ max: 255 }), body('title_en').optional({ values: 'falsy' }).trim().isLength({ max: 255 }),
  body().custom((b) => Boolean(b.title_ne || b.title_en)).withMessage('Enter a lesson title'),
  body('sort_order').optional().isInt({ min: 0, max: 65535 }), body('content_type').optional().isIn(['video', 'text', 'pdf', 'link']),
  body('content_url').optional({ values: 'falsy' }).isString().isLength({ max: 500 }).bail().custom(safeLink).withMessage('Use a relative path or an HTTP(S) link'), body('body').optional({ values: 'falsy' }).isString().isLength({ max: 10000 }),
  body('duration_minutes').optional({ values: 'falsy' }).isInt({ min: 1, max: 65535 })
], validate, c.addLesson);
router.post('/learning/resources', authorize('learning.create'), [
  body('title_ne').optional({ values: 'falsy' }).trim().isLength({ max: 255 }), body('title_en').optional({ values: 'falsy' }).trim().isLength({ max: 255 }),
  body().custom((b) => Boolean(b.title_ne || b.title_en)).withMessage('Enter a resource title'),
  body('resource_type').optional().isIn(['video', 'manual', 'faq', 'material', 'other']), body('url').optional({ values: 'falsy' }).isString().isLength({ max: 500 }).bail().custom(safeLink).withMessage('Use a relative path or an HTTP(S) link'),
  body('file_path').optional({ values: 'falsy' }).isString().isLength({ max: 500 }), body('description').optional({ values: 'falsy' }).isString().isLength({ max: 5000 }),
  body('status').optional().isIn(['draft', 'published'])
], validate, c.createLearningResource);
router.get('/learning/courses/:id', authorize('learning.view'), id, validate, c.course);
router.post('/learning/courses/:id/enroll', authorize('learning.view'), id, validate, c.enroll);
router.put('/learning/courses/:id/progress', authorize('learning.view'), id, body('progress_percent').isInt({ min: 0, max: 100 }), validate, c.progress);

module.exports = router;
