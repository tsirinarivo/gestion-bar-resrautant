import { execFile, spawn } from 'child_process'
import { promisify } from 'util'
import { randomBytes } from 'crypto'
import path from 'path'
import { masterPrisma, Tenant, TenantStatus } from '@restaurant/master-database'
import { sendTenantWelcomeEmail } from './email'

const execFileP = promisify(execFile)

const BASE_PORT = 4100
const PORTS_PER_TENANT = 10
const ROOT_DIR = process.env.RESTAURANT_ROOT || '/opt/restaurant'
const SCRIPT_NEW = path.join(ROOT_DIR, 'deploy', 'new-tenant.sh')
const SCRIPT_DELETE = path.join(ROOT_DIR, 'deploy', 'delete-tenant.sh')

export type CreateTenantInput = {
  slug: string
  name: string
  contactName?: string
  contactEmail: string
  contactPhone?: string
  notes?: string
}

function randomSecret(bytes = 48): string {
  return randomBytes(bytes).toString('base64url')
}

function randomPassword(): string {
  return randomBytes(24).toString('base64url')
}

export async function allocateNextPortBlock(): Promise<number> {
  const max = await masterPrisma.tenant.aggregate({
    _max: { apiPort: true },
  })
  const last = max._max.apiPort ?? BASE_PORT - PORTS_PER_TENANT
  return last + PORTS_PER_TENANT
}

export async function createTenantRecord(input: CreateTenantInput): Promise<Tenant> {
  const slugRegex = /^[a-z][a-z0-9-]{1,30}$/
  if (!slugRegex.test(input.slug)) {
    throw new Error('Slug invalide (a-z, 0-9, tirets, 2-31 chars)')
  }

  const existing = await masterPrisma.tenant.findUnique({
    where: { slug: input.slug },
  })
  if (existing) throw new Error('Ce slug est déjà utilisé')

  const apiPort = await allocateNextPortBlock()

  // try/catch sur P2002 : si 2 POST simultanés passent le findUnique ci-dessus,
  // la contrainte @unique sur slug rejette le 2e create avec une erreur Prisma
  // cryptique. On la translate en message utilisateur clair.
  try {
    return await masterPrisma.tenant.create({
      data: {
        slug: input.slug,
        subdomain: input.slug,
        name: input.name,
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        notes: input.notes,
        status: TenantStatus.PROVISIONING,
        dbName: `tenant_${input.slug.replace(/-/g, '_')}`,
        apiPort,
        webPort: apiPort + 1,
        posPort: apiPort + 2,
        kdsPort: apiPort + 3,
        clientPort: apiPort + 4,
        dbPassword: randomPassword(),
        jwtSecret: randomSecret(),
        jwtRefreshSecret: randomSecret(),
        apiCrossSecret: randomSecret(),
      },
    })
  } catch (err: any) {
    if (err?.code === 'P2002') {
      throw new Error('Ce slug a été pris pendant la création — réessayez avec un autre slug')
    }
    throw err
  }
}

export async function runProvisioningScript(
  tenant: Tenant,
  adminEmail: string,
  adminPassword: string,
  adminFirstName = 'Admin',
  adminLastName = 'Principal'
): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    TENANT_SLUG: tenant.slug,
    TENANT_NAME: tenant.name,
    TENANT_DB_NAME: tenant.dbName,
    TENANT_DB_PASSWORD: tenant.dbPassword,
    TENANT_API_PORT: String(tenant.apiPort),
    TENANT_WEB_PORT: String(tenant.webPort),
    TENANT_POS_PORT: String(tenant.posPort),
    TENANT_KDS_PORT: String(tenant.kdsPort),
    TENANT_CLIENT_PORT: String(tenant.clientPort),
    TENANT_JWT_SECRET: tenant.jwtSecret,
    TENANT_JWT_REFRESH_SECRET: tenant.jwtRefreshSecret,
    TENANT_CROSS_SECRET: tenant.apiCrossSecret,
    TENANT_SUBDOMAIN: tenant.subdomain,
    ADMIN_EMAIL: adminEmail,
    ADMIN_PASSWORD: adminPassword,
    ADMIN_FIRST_NAME: adminFirstName,
    ADMIN_LAST_NAME: adminLastName,
  }

  try {
    const { stdout, stderr } = await execFileP('bash', [SCRIPT_NEW], {
      env,
      cwd: ROOT_DIR,
      timeout: 10 * 60 * 1000,
      maxBuffer: 10 * 1024 * 1024,
    })
    return { ok: true, stdout, stderr }
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message: string }
    return {
      ok: false,
      stdout: e.stdout ?? '',
      stderr: (e.stderr ?? '') + '\n' + e.message,
    }
  }
}

/**
 * Provisioning en BACKGROUND (fire-and-forget). Écrit des TenantEvent au fur
 * et à mesure pour que l'UI puisse afficher un live log. Marque le tenant
 * ACTIVE ou ERROR à la fin. À utiliser au lieu de runProvisioningScript()
 * quand on ne veut pas bloquer la réponse HTTP pendant 5-10 min.
 */
export function runProvisioningScriptAsync(
  tenant: Tenant,
  userId: string | null,
  adminEmail: string,
  adminPassword: string,
  adminFirstName = 'Admin',
  adminLastName = 'Principal',
): void {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    TENANT_SLUG: tenant.slug,
    TENANT_NAME: tenant.name,
    TENANT_DB_NAME: tenant.dbName,
    TENANT_DB_PASSWORD: tenant.dbPassword,
    TENANT_API_PORT: String(tenant.apiPort),
    TENANT_WEB_PORT: String(tenant.webPort),
    TENANT_POS_PORT: String(tenant.posPort),
    TENANT_KDS_PORT: String(tenant.kdsPort),
    TENANT_CLIENT_PORT: String(tenant.clientPort),
    TENANT_JWT_SECRET: tenant.jwtSecret,
    TENANT_JWT_REFRESH_SECRET: tenant.jwtRefreshSecret,
    TENANT_CROSS_SECRET: tenant.apiCrossSecret,
    TENANT_SUBDOMAIN: tenant.subdomain,
    ADMIN_EMAIL: adminEmail,
    ADMIN_PASSWORD: adminPassword,
    ADMIN_FIRST_NAME: adminFirstName,
    ADMIN_LAST_NAME: adminLastName,
  }

  const child = spawn('bash', [SCRIPT_NEW], { env, cwd: ROOT_DIR })

  let stdoutBuf = ''
  let stderrBuf = ''
  // Throttle : on n'écrit pas un event par ligne (trop), on flush par ligne
  // significative (header ═══) ou tous les 50 lines de stdout/stderr accumulées.
  let lineBufferStdout: string[] = []

  const flushBuffer = async () => {
    if (lineBufferStdout.length === 0) return
    const details = lineBufferStdout.join('\n').slice(-2000)
    lineBufferStdout = []
    await masterPrisma.tenantEvent.create({
      data: { tenantId: tenant.id, userId, type: 'PROVISIONING_LOG', details },
    }).catch(() => { /* non bloquant */ })
  }

  child.stdout.on('data', (chunk: Buffer) => {
    const text = chunk.toString()
    stdoutBuf += text
    for (const line of text.split('\n')) {
      if (!line.trim()) continue
      lineBufferStdout.push(line)
      // Header → flush immédiat pour un effet "étape par étape"
      if (line.includes('═══') || line.includes('✅') || line.includes('❌') || line.includes('⚠️')) {
        void flushBuffer()
      } else if (lineBufferStdout.length >= 50) {
        void flushBuffer()
      }
    }
  })

  child.stderr.on('data', (chunk: Buffer) => {
    stderrBuf += chunk.toString()
  })

  child.on('close', async (code) => {
    await flushBuffer()
    const ok = code === 0
    try {
      if (ok) {
        await masterPrisma.tenant.update({
          where: { id: tenant.id },
          data: {
            status: TenantStatus.ACTIVE,
            provisionedAt: new Date(),
            lastDeployedAt: new Date(),
          },
        })
        await masterPrisma.tenantEvent.create({
          data: {
            tenantId: tenant.id,
            userId,
            type: 'PROVISIONED',
            details: `Admin ${adminEmail} créé. Exit code ${code}.`,
          },
        })

        // Envoi de l'email de bienvenue (URLs + credentials).
        // Non-bloquant : si SMTP non configuré ou échec, on log et on
        // continue (le provisioning reste ACTIVE, juste l'event d'envoi
        // sera en EMAIL_FAILED). L'admin peut récupérer les infos depuis
        // l'UI master de toute facon.
        const sub = tenant.subdomain
        const emailSent = await sendTenantWelcomeEmail({
          to: tenant.contactEmail || adminEmail,
          tenantName: tenant.name,
          slug: tenant.slug,
          adminEmail,
          adminPassword,
          urls: {
            admin: `https://admin-${sub}.sakafio.mg`,
            pos: `https://pos-${sub}.sakafio.mg`,
            kds: `https://kds-${sub}.sakafio.mg`,
            client: `https://${sub}.sakafio.mg`,
            api: `https://api-${sub}.sakafio.mg`,
          },
        }).catch(() => false)
        await masterPrisma.tenantEvent.create({
          data: {
            tenantId: tenant.id,
            userId,
            type: emailSent ? 'EMAIL_SENT' : 'EMAIL_FAILED',
            details: emailSent
              ? `Email de bienvenue envoyé à ${tenant.contactEmail || adminEmail}`
              : `Échec envoi email (SMTP non configuré ?) — communiquer manuellement les identifiants à ${tenant.contactEmail || adminEmail}`,
          },
        }).catch(() => { /* non bloquant */ })
      } else {
        await masterPrisma.tenant.update({
          where: { id: tenant.id },
          data: { status: TenantStatus.ERROR },
        })
        await masterPrisma.tenantEvent.create({
          data: {
            tenantId: tenant.id,
            userId,
            type: 'PROVISION_FAILED',
            details: (stderrBuf || stdoutBuf).slice(-3000) + `\nExit code: ${code}`,
          },
        })
      }
    } catch (err) {
      console.error('[provisioning] post-close update failed:', err)
    }
  })

  child.on('error', async (err) => {
    await masterPrisma.tenant.update({
      where: { id: tenant.id },
      data: { status: TenantStatus.ERROR },
    }).catch(() => {})
    await masterPrisma.tenantEvent.create({
      data: {
        tenantId: tenant.id,
        userId,
        type: 'PROVISION_FAILED',
        details: `Spawn error: ${err.message}`,
      },
    }).catch(() => {})
  })
}

export async function runDeletionScript(
  tenant: Pick<Tenant, 'slug' | 'dbName'>
): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    TENANT_SLUG: tenant.slug,
    TENANT_DB_NAME: tenant.dbName,
  }

  try {
    const { stdout, stderr } = await execFileP('bash', [SCRIPT_DELETE], {
      env,
      cwd: ROOT_DIR,
      timeout: 5 * 60 * 1000,
      maxBuffer: 10 * 1024 * 1024,
    })
    return { ok: true, stdout, stderr }
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message: string }
    return {
      ok: false,
      stdout: e.stdout ?? '',
      stderr: (e.stderr ?? '') + '\n' + e.message,
    }
  }
}
