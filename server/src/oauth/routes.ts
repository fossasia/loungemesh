import { Router } from 'express';
import { authorize, token, userinfo } from './controller.js';

const router = Router();

router.get('/authorize', authorize);
router.post('/token', token);
router.get('/userinfo', userinfo);

export default router;
