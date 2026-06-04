import nodemailer from 'nodemailer'
import { masterPrisma } from '@restaurant/master-database'

export type SmtpConfig = {
  host: string
  port: number
  user: string
  pass: string
  from: string
  secure?: boolean
}

/** Lit la config SMTP : DB (MasterSetting key='smtp') prioritaire, fallback env vars */
export async function loadSmtpConfig(): Promise<SmtpConfig | null> {
  const row = await masterPrisma.masterSetting.findUnique({
    where: { key: 'smtp' },
  }).catch(() => null)

  if (row?.value) {
    const v = row.value as Partial<SmtpConfig>
    if (v.host && v.user && v.pass) {
      return {
        host: v.host,
        port: Number(v.port) || 587,
        user: v.user,
        pass: v.pass,
        from: v.from || process.env.EMAIL_FROM || 'noreply@sakafio.mg',
        secure: v.secure ?? (Number(v.port) === 465),
      }
    }
  }

  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (host && user && pass) {
    const port = Number(process.env.SMTP_PORT || 587)
    return {
      host,
      port,
      user,
      pass,
      from: process.env.EMAIL_FROM || 'noreply@sakafio.mg',
      secure: port === 465,
    }
  }
  return null
}

async function getTransporter(): Promise<{ transporter: nodemailer.Transporter; from: string } | null> {
  const cfg = await loadSmtpConfig()
  if (!cfg) {
    console.warn('[email] SMTP non configuré (ni MasterSetting ni env vars) — emails non envoyés')
    return null
  }
  const t = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  })
  return { transporter: t, from: cfg.from }
}

export type TenantWelcomeEmailInput = {
  to: string                  // contactEmail ou adminEmail
  tenantName: string
  slug: string
  adminEmail: string
  adminPassword: string
  urls: {
    admin: string
    pos: string
    kds: string
    client: string
    api: string
  }
}

/**
 * Envoie l'email de bienvenue au client (URLs + credentials admin initial).
 * Non-bloquant : si SMTP non configuré, log un warning et continue.
 * Retourne true si envoyé, false si skipped/échoué.
 */
export async function sendTenantWelcomeEmail(input: TenantWelcomeEmailInput): Promise<boolean> {
  const ctx = await getTransporter()
  if (!ctx) return false
  const { transporter: t, from } = ctx

  const html = `
<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>Bienvenue sur Sakafio</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f5;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">

    <div style="background:linear-gradient(135deg,#EA580C,#F97316);padding:24px;color:#fff;">
      <div style="font-size:24px;font-weight:700;">Sakafio</div>
      <div style="font-size:14px;opacity:.85;margin-top:4px;">Logiciel pour votre restaurant et bar</div>
    </div>

    <div style="padding:24px;color:#1e293b;">
      <h1 style="font-size:20px;margin:0 0 8px;">Bienvenue, ${escapeHtml(input.tenantName)} 👋</h1>
      <p style="font-size:14px;line-height:1.6;color:#475569;margin:0 0 20px;">
        Votre instance Sakafio est prête. Voici vos accès — conservez ce message dans un endroit sûr.
      </p>

      <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:12px;margin-bottom:20px;font-size:13px;color:#92400e;">
        ⚠️ <strong>Important :</strong> changez votre mot de passe à la première connexion depuis le menu Paramètres.
      </div>

      <h2 style="font-size:14px;text-transform:uppercase;color:#64748b;margin:24px 0 8px;letter-spacing:.5px;">
        Identifiants de connexion
      </h2>
      <table style="width:100%;font-size:14px;border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0;color:#64748b;width:140px;">Email</td>
          <td style="padding:8px 0;font-family:monospace;">${escapeHtml(input.adminEmail)}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#64748b;">Mot de passe</td>
          <td style="padding:8px 0;font-family:monospace;background:#f1f5f9;border-radius:4px;padding-left:6px;padding-right:6px;">${escapeHtml(input.adminPassword)}</td>
        </tr>
      </table>

      <h2 style="font-size:14px;text-transform:uppercase;color:#64748b;margin:24px 0 8px;letter-spacing:.5px;">
        Vos URLs
      </h2>
      <table style="width:100%;font-size:13px;border-collapse:collapse;">
        <tr><td style="padding:6px 0;color:#64748b;width:140px;">Admin manager</td><td style="padding:6px 0;"><a href="${input.urls.admin}" style="color:#EA580C;text-decoration:none;font-family:monospace;">${input.urls.admin}</a></td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Caisse (POS)</td><td style="padding:6px 0;"><a href="${input.urls.pos}" style="color:#EA580C;text-decoration:none;font-family:monospace;">${input.urls.pos}</a></td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Cuisine (KDS)</td><td style="padding:6px 0;"><a href="${input.urls.kds}" style="color:#EA580C;text-decoration:none;font-family:monospace;">${input.urls.kds}</a></td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Site client</td><td style="padding:6px 0;"><a href="${input.urls.client}" style="color:#EA580C;text-decoration:none;font-family:monospace;">${input.urls.client}</a></td></tr>
      </table>

      <div style="margin-top:24px;text-align:center;">
        <a href="${input.urls.admin}/login" style="display:inline-block;background:#EA580C;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
          Se connecter à mon admin
        </a>
      </div>

      <p style="font-size:12px;color:#94a3b8;margin-top:32px;text-align:center;">
        Une question ? Répondez à cet email ou contactez support@sakafio.mg.
      </p>
    </div>
  </div>
</body></html>`

  const text = `
Bienvenue sur Sakafio — ${input.tenantName}

Vos identifiants :
  Email      : ${input.adminEmail}
  Mot de passe : ${input.adminPassword}

⚠️ Changez votre mot de passe à la première connexion (menu Paramètres).

Vos URLs :
  Admin manager : ${input.urls.admin}
  Caisse (POS)  : ${input.urls.pos}
  Cuisine (KDS) : ${input.urls.kds}
  Site client   : ${input.urls.client}

Se connecter : ${input.urls.admin}/login

Une question ? Répondez à cet email ou contactez support@sakafio.mg.
`.trim()

  try {
    const info = await t.sendMail({
      from,
      to: input.to,
      subject: `Bienvenue sur Sakafio — ${input.tenantName}`,
      text,
      html,
    })
    console.log(`[email] Sent welcome to ${input.to}: ${info.messageId}`)
    return true
  } catch (err) {
    console.error(`[email] Failed to send welcome to ${input.to}:`, err)
    return false
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

/** Envoie un email de test simple. Utilise la config SMTP enregistrée. */
export async function sendTestEmail(to: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getTransporter()
  if (!ctx) return { ok: false, error: 'SMTP non configuré' }
  try {
    await ctx.transporter.sendMail({
      from: ctx.from,
      to,
      subject: 'Test SMTP Sakafio Master',
      text: `Bonjour,\n\nCet email confirme que ta configuration SMTP fonctionne.\n\nEnvoyé depuis Sakafio Master à ${new Date().toLocaleString('fr-FR')}.`,
      html: `<p>Bonjour,</p><p>Cet email confirme que ta configuration SMTP fonctionne. ✅</p><p style="color:#94a3b8;font-size:12px;">Envoyé depuis Sakafio Master à ${new Date().toLocaleString('fr-FR')}.</p>`,
    })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Erreur inconnue' }
  }
}
