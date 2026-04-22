import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { authGuard } from '../guards/auth.guard';
import { validate, validateParams } from '../guards/validate.guard';
import { registerHostSchema, registerHostPartTwoSchema, loginHostSchema, loginCreatorSchema, userExistSchema, hostIdParamSchema } from '../dtos/validation/auth.schema';
import { authLimiter } from '../app';

const router = Router();
const authController = new AuthController();

router.post('/register-host', authLimiter, validate(registerHostSchema), authController.registerHost);
router.post('/register-host-part-two/:host_id', authLimiter, validateParams(hostIdParamSchema), validate(registerHostPartTwoSchema), authController.registerHostPartTwo);
router.post('/login-host', authLimiter, validate(loginHostSchema), authController.loginHost);

router.post('/login-creator', authLimiter, validate(loginCreatorSchema), authController.loginCreator);
router.post('/link-accounts-creator', authLimiter, authController.linkAccountsCreator);
router.post('/sync-accounts', authGuard, authController.syncAccounts);
router.post('/user-exist', validate(userExistSchema), authController.userExist);

export default router;
