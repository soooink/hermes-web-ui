import type { Context } from 'koa'
import * as QRCode from 'qrcode'
import * as OTPAuth from 'otpauth'
import {
  generateTotpSecret,
  saveTotpConfig,
  loadTotpConfig,
  deleteTotpConfig,
  isTotpConfigured,
  verifyTotpToken,
} from '../services/totp'
import { getToken } from '../services/auth'
import { getCredentials } from '../services/credentials'

/** GET /api/auth/totp/status — returns whether TOTP is configured */
export async function totpStatus(ctx: Context) {
  ctx.body = {
    totpEnabled: await isTotpConfigured(),
  }
}

/** POST /api/auth/totp/setup — generate TOTP secret and QR code (protected) */
export async function totpSetup(ctx: Context) {
  if (await isTotpConfigured()) {
    ctx.status = 409
    ctx.body = { error: 'TOTP is already configured' }
    return
  }

  const cred = await getCredentials()
  const accountName = cred?.username || 'user'

  const { secret, totp } = generateTotpSecret(accountName)
  const otpauthUri = totp.toString()
  const qrDataUri = await QRCode.toDataURL(otpauthUri)

  ctx.body = {
    secret: secret.base32,
    otpauthUri,
    qrDataUri,
  }
}

/** POST /api/auth/totp/verify — verify initial code and activate TOTP (protected) */
export async function totpActivate(ctx: Context) {
  const { secret: secretBase32, token } = ctx.request.body as { secret?: string; token?: string }
  if (!secretBase32 || !token) {
    ctx.status = 400
    ctx.body = { error: 'TOTP secret and token are required' }
    return
  }

  const cred = await getCredentials()
  const accountName = cred?.username || 'user'

  const totp = new OTPAuth.TOTP({
    issuer: 'Hermes Web UI',
    label: accountName,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  })

  const delta = totp.validate({ token, window: 1 })
  if (delta === null) {
    ctx.status = 400
    ctx.body = { error: 'Invalid TOTP token' }
    return
  }

  await saveTotpConfig({
    secret: secretBase32,
    issuer: 'Hermes Web UI',
    accountName,
    created_at: Date.now(),
  })

  ctx.body = { success: true }
}

/** POST /api/auth/totp/login — verify TOTP code and return auth token (public) */
export async function totpLogin(ctx: Context) {
  const { token } = ctx.request.body as { token?: string }
  if (!token) {
    ctx.status = 400
    ctx.body = { error: 'TOTP token is required' }
    return
  }

  if (!(await isTotpConfigured())) {
    ctx.status = 401
    ctx.body = { error: 'TOTP is not configured' }
    return
  }

  const valid = await verifyTotpToken(token)
  if (!valid) {
    ctx.status = 401
    ctx.body = { error: 'Invalid TOTP token' }
    return
  }

  const authToken = await getToken()
  if (!authToken) {
    ctx.status = 500
    ctx.body = { error: 'Auth is disabled on this server' }
    return
  }

  ctx.body = { token: authToken }
}

/** DELETE /api/auth/totp — disable TOTP (protected) */
export async function disableTotp(ctx: Context) {
  await deleteTotpConfig()
  ctx.body = { success: true }
}
