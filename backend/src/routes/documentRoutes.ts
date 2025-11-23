import { Router } from 'express';
import * as documentController from '../controllers/documentController';

const router = Router();

router.post('/', documentController.createDocument);
router.get('/', documentController.getDocuments);
router.get('/:id', documentController.getDocument);
router.delete('/:id', documentController.deleteDocument);

export default router;
