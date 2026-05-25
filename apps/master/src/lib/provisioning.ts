import { execFile } from 'child_process'
import { promisify } from 'util'
import { randomBytes } from 'crypto'
import path from 'path'
import { masterPrisma, Tenant, TenantStatus } from '@restaurant/master-database'

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

  return masterPrisma.tenant.create({
    data: {
      slug: input.slug,
      subdomain: input.slug,
      name: input.name,
      contactName: input.contactName,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      notes: input.notes,
      status: TenantStatus.PROVISIONING,
      dbName: `tenant_${input.slug}`,
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
