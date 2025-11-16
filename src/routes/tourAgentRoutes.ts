import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth';
import {
  getAllTourAgents,
  getActiveTourAgents,
  getTourAgentById,
  getActiveTourAgentById,
  createTourAgent,
  updateTourAgent,
  deleteTourAgent,
  toggleTourAgentStatus,
  uploadTourAgentPhoto
} from '../controllers/tourAgentController';

const router = Router();

// Публичные маршруты
router.get('/public', getActiveTourAgents);                    // GET /api/tour-agents/public - активные турагенты
router.get('/public/:id', getActiveTourAgentById);             // GET /api/tour-agents/public/:id - активный турагент по ID

// Администраторские маршруты (требуют авторизацию)
router.get('/', authenticateJWT, getAllTourAgents);                             // GET /api/tour-agents - все турагенты
router.get('/:id', authenticateJWT, getTourAgentById);                          // GET /api/tour-agents/:id - турагент по ID
router.post('/', authenticateJWT, uploadTourAgentPhoto, createTourAgent);       // POST /api/tour-agents - создать турагента
router.put('/:id', authenticateJWT, uploadTourAgentPhoto, updateTourAgent);     // PUT /api/tour-agents/:id - обновить турагента
router.delete('/:id', authenticateJWT, deleteTourAgent);                        // DELETE /api/tour-agents/:id - удалить турагента
router.patch('/:id/toggle-status', authenticateJWT, toggleTourAgentStatus);     // PATCH /api/tour-agents/:id/toggle-status - переключить статус

export default router;