const express = require('express');
const DocumentController = require('../controllers/documentController');
const { authenticateToken, requireEmployee } = require('../middleware/auth');

const router = express.Router();

// All document routes require authentication
router.use(authenticateToken);
router.use(requireEmployee);

// Employee document routes
router.get('/my-documents', DocumentController.getMyDocuments);
router.get('/download/:id', DocumentController.downloadDocument);
router.get('/types', DocumentController.getDocumentTypes);

module.exports = router;