import { createHash, timingSafeEqual } from 'node:crypto'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import cookieParser from 'cookie-parser'
import express from 'express'
import { SignJWT, jwtVerify } from 'jose'
import { Polar } from '@polar-sh/sdk'
import { validateEvent } from '@polar-sh/sdk/webhooks'

const port = Number(process.env.PORT ?? 8787)
const production = process.env.NODE_ENV === 'production'
const appUrl = process.env.APP_URL ?? 'http://127.0.0.1:5173'
const adminEmail = (process.env.ADMIN_EMAIL ?? 'admin@contractlab.local').toLowerCase()
const adminPassword = process.env.ADMIN_PASSWORD ?? (production ? '' : 'contractlab-admin')
const sessionSecret = process.env.SESSION_SECRET ?? (production ? '' : 'contractlab-local-session-secret-change-me')
const polarToken = process.env.POLAR_ACCESS_TOKEN
const polarProductId = process.env.POLAR_PRODUCT_ID
const polarServer = process.env.POLAR_SERVER === 'production' ? 'production' : 'sandbox'
const polar = polarToken ? new Polar({ accessToken: polarToken, server: polarServer }) : null
const secret = new TextEncoder().encode(sessionSecret)
const paidEmails = new Set<string>()
const loginWindows = new Map<string, { count: number; resetAt: number }>()

if (production && (!sessionSecret || !adminPassword)) throw new Error('SESSION_SECRET and ADMIN_PASSWORD are required in production.')

const app = express()
app.disable('x-powered-by')
app.use((_, response, next) => {
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://*.polar.sh")
  next()
})

const sameOrigin = (request: express.Request, response: express.Response, next: express.NextFunction) => {
  const origin = request.get('origin')
  const localDevelopmentOrigin = !production && /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin ?? '')
  if (origin && origin !== new URL(appUrl).origin && !localDevelopmentOrigin) return response.status(403).json({ error: 'Origin not allowed.' })
  next()
}

const signSession = async (email: string, plan: 'pro' | 'admin') => new SignJWT({ email, plan })
  .setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt()
  .setExpirationTime('7d')
  .sign(secret)

const readSession = async (request: express.Request) => {
  const token = request.cookies?.contractlab_session
  if (!token || !sessionSecret) return null
  try {
    const { payload } = await jwtVerify(token, secret)
    if (typeof payload.email !== 'string' || !['pro', 'admin'].includes(String(payload.plan))) return null
    return { email: payload.email, plan: payload.plan as 'pro' | 'admin' }
  } catch {
    return null
  }
}

const setSession = async (response: express.Response, email: string, plan: 'pro' | 'admin') => {
  const token = await signSession(email, plan)
  response.cookie('contractlab_session', token, { httpOnly: true, sameSite: 'lax', secure: production, maxAge: 7 * 24 * 60 * 60 * 1000, path: '/' })
}

app.post('/api/polar/webhook', express.raw({ type: 'application/json', limit: '128kb' }), (request, response) => {
  const webhookSecret = process.env.POLAR_WEBHOOK_SECRET
  if (!webhookSecret) return response.status(503).json({ error: 'Polar webhook is not configured.' })
  try {
    const headers = Object.fromEntries(Object.entries(request.headers).flatMap(([key, value]) => typeof value === 'string' ? [[key, value]] : []))
    const event = validateEvent(request.body, headers, webhookSecret)
    if (event.type === 'order.paid' && (!polarProductId || event.data.productId === polarProductId)) paidEmails.add(event.data.customer.email.toLowerCase())
    return response.status(202).json({ received: true })
  } catch {
    return response.status(400).json({ error: 'Webhook signature or payload is invalid.' })
  }
})

app.use(express.json({ limit: '32kb' }))
app.use(cookieParser())

app.get('/api/health', (_, response) => response.json({ ok: true, polarConfigured: Boolean(polar && polarProductId) }))

app.get('/api/session', async (request, response) => {
  const session = await readSession(request)
  if (!session) return response.json({ email: null, plan: 'free', authenticated: false })
  return response.json({ ...session, authenticated: true })
})

app.post('/api/auth/admin', sameOrigin, async (request, response) => {
  const ip = request.ip ?? 'unknown'
  const now = Date.now()
  const window = loginWindows.get(ip)
  if (window && window.resetAt > now && window.count >= 8) return response.status(429).json({ error: 'Too many attempts. Try again later.' })
  if (!window || window.resetAt <= now) loginWindows.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 })
  else window.count += 1
  const email = String(request.body?.email ?? '').trim().toLowerCase()
  const password = String(request.body?.password ?? '')
  const expected = createHash('sha256').update(`${adminEmail}:${adminPassword}`).digest()
  const actual = createHash('sha256').update(`${email}:${password}`).digest()
  if (!adminPassword || !timingSafeEqual(expected, actual)) return response.status(401).json({ error: 'Email or password is incorrect.' })
  loginWindows.delete(ip)
  await setSession(response, adminEmail, 'admin')
  return response.json({ email: adminEmail, plan: 'admin', authenticated: true })
})

app.post('/api/auth/logout', sameOrigin, (_, response) => {
  response.clearCookie('contractlab_session', { path: '/' })
  response.status(204).end()
})

app.post('/api/polar/checkout', sameOrigin, async (request, response) => {
  if (!polar || !polarProductId) return response.status(503).json({ error: 'Polar is not configured. Add POLAR_ACCESS_TOKEN and POLAR_PRODUCT_ID.' })
  const email = String(request.body?.email ?? '').trim().toLowerCase()
  if (!/^\S+@\S+\.\S+$/.test(email)) return response.status(400).json({ error: 'Enter a valid email address.' })
  const externalCustomerId = createHash('sha256').update(email).digest('hex').slice(0, 32)
  try {
    const checkout = await polar.checkouts.create({
      products: [polarProductId],
      customerEmail: email,
      externalCustomerId,
      successUrl: `${appUrl}/?checkout_id={CHECKOUT_ID}`,
      returnUrl: appUrl,
      metadata: { contractlab_email: email },
    })
    return response.json({ url: checkout.url })
  } catch (error) {
    return response.status(502).json({ error: error instanceof Error ? error.message : 'Polar checkout could not be created.' })
  }
})

app.get('/api/polar/verify', async (request, response) => {
  if (!polar || !polarProductId) return response.status(503).json({ error: 'Polar is not configured.' })
  const checkoutId = String(request.query.checkout_id ?? '')
  if (!/^[a-zA-Z0-9-]{8,80}$/.test(checkoutId)) return response.status(400).json({ error: 'Invalid checkout ID.' })
  try {
    const checkout = await polar.checkouts.get({ id: checkoutId })
    if (checkout.status !== 'succeeded' || checkout.productId !== polarProductId || !checkout.customerEmail) return response.status(402).json({ error: 'Checkout has not completed.' })
    const email = checkout.customerEmail.toLowerCase()
    paidEmails.add(email)
    await setSession(response, email, 'pro')
    return response.json({ email, plan: 'pro', authenticated: true })
  } catch {
    return response.status(400).json({ error: 'Checkout verification failed.' })
  }
})

const distPath = resolve(process.cwd(), 'dist')
if (existsSync(distPath)) {
  app.use(express.static(distPath, { index: false, maxAge: production ? '1h' : 0 }))
  app.get('*splat', (_, response) => response.sendFile(resolve(distPath, 'index.html')))
}

app.listen(port, '127.0.0.1', () => {
  process.stdout.write(`ContractLab server listening on http://127.0.0.1:${port}\n`)
})
