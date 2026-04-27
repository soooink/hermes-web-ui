import { readFile, writeFile, mkdir, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from 'node:crypto'
import * as OTPAuth from 'otpauth'

const APP_HOME = join(homedir(), '.hermes-web-ui')
const TOTP_FILE = join(APP_HOME, '.totp')

/** Derive a 32-byte encryption key from the server's auth token */
async function getEncryptionKey(): Promise<Buffer> {
  if (process.env.AUTH_TOKEN) {
    return scryptSync(process.env.AUTH_TOKEN, 'totp-encryption', 32)
  }
  const tokenFile = join(APP_HOME, '.token')
  try {
    const token = (await readFile(tokenFile, 'utf-8')).trim()
    return scryptSync(token, 'totp-encryption', 32)
  } catch {
    const keyFile = join(APP_HOME, '.totp.key')
    try {
      return Buffer.from((await readFile(keyFile)).toString('hex'), 'hex')
    } catch {
      const key = randomBytes(32)
      await mkdir(APP_HOME, { recursive: true })
      await writeFile(keyFile, key.toString('hex'), { mode: 0o600 })
      return key
    }
  }
}

/** Encrypt a hex string to base64 ciphertext */
async function encrypt(plaintext: string): Promise<string> {
  const key = await getEncryptionKey()
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

/** Decrypt a ciphertext to hex string */
async function decrypt(ciphertext: string): Promise<string> {
  const key = await getEncryptionKey()
  const [ivHex, authTagHex, encrypted] = ciphertext.split(':')
  const decipher = createDecipheriv('aes-256-gcm', key as Buffer, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

export interface TotpConfig {
  secret: string
  issuer: string
  accountName: string
  created_at: number
}

/** Check if TOTP is configured */
export async function isTotpConfigured(): Promise<boolean> {
  return existsSync(TOTP_FILE)
}

/** Load and decrypt the TOTP config */
export async function loadTotpConfig(): Promise<TotpConfig | null> {
  try {
    const encrypted = await readFile(TOTP_FILE, 'utf-8')
    const plaintext = await decrypt(encrypted.trim())
    return JSON.parse(plaintext) as TotpConfig
  } catch {
    return null
  }
}

/** Save TOTP config (encrypted) */
export async function saveTotpConfig(config: TotpConfig): Promise<void> {
  const plaintext = JSON.stringify(config)
  const encrypted = await encrypt(plaintext)
  await mkdir(APP_HOME, { recursive: true })
  await writeFile(TOTP_FILE, encrypted, { mode: 0o600 })
}

/** Delete TOTP config */
export async function deleteTotpConfig(): Promise<void> {
  try {
    await unlink(TOTP_FILE)
  } catch { /* file may not exist */ }
}

/** Generate a new TOTP secret */
export function generateTotpSecret(accountName: string): { secret: OTPAuth.Secret; totp: OTPAuth.TOTP } {
  const secret = new OTPAuth.Secret({ size: 20 })
  const totp = new OTPAuth.TOTP({
    issuer: 'Hermes Web UI',
    label: accountName,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret,
  })
  return { secret, totp }
}

/** Verify a TOTP token against the stored secret */
export async function verifyTotpToken(token: string): Promise<boolean> {
  const config = await loadTotpConfig()
  if (!config) return false
  const totp = new OTPAuth.TOTP({
    issuer: config.issuer,
    label: config.accountName,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(config.secret),
  })
  const delta = totp.validate({ token, window: 1 })
  return delta !== null
}
