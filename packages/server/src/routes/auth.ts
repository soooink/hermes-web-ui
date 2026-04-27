import Router from '@koa/router'
import * as ctrl from '../controllers/auth'
import * as totpCtrl from '../controllers/totp'

// Public routes (no auth required)
export const authPublicRoutes = new Router()
authPublicRoutes.get('/api/auth/status', ctrl.authStatus)
authPublicRoutes.post('/api/auth/login', ctrl.login)
authPublicRoutes.get('/api/auth/totp/status', totpCtrl.totpStatus)
authPublicRoutes.post('/api/auth/totp/login', totpCtrl.totpLogin)

// Protected routes (auth required)
export const authProtectedRoutes = new Router()
authProtectedRoutes.post('/api/auth/setup', ctrl.setupPassword)
authProtectedRoutes.post('/api/auth/change-password', ctrl.changePassword)
authProtectedRoutes.post('/api/auth/change-username', ctrl.changeUsername)
authProtectedRoutes.delete('/api/auth/password', ctrl.removePassword)
authProtectedRoutes.post('/api/auth/totp/setup', totpCtrl.totpSetup)
authProtectedRoutes.post('/api/auth/totp/verify', totpCtrl.totpActivate)
authProtectedRoutes.delete('/api/auth/totp', totpCtrl.disableTotp)
