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

  const html = `<!DOCTYPE html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Bienvenue sur Sakafio</title>
  <!--[if mso]><style>td,th{font-family:Arial,sans-serif!important;}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#fff8f1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;-webkit-text-size-adjust:100%;">

  <!-- Preheader (caché mais visible dans la preview du client mail) -->
  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#fff8f1;">
    Votre instance Sakafio est prête. Cliquez pour vous connecter à votre admin.
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:linear-gradient(180deg,#fff8f1 0%,#fff 30%);background-color:#fff8f1;">
    <tr>
      <td align="center" style="padding:32px 16px 48px 16px;">

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;">

          <!-- ── Logo header ──────────────────────────── -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <div style="font-size:28px;font-weight:800;color:#EA580C;letter-spacing:-.5px;line-height:1;">
                <span style="display:inline-block;width:36px;height:36px;background:#EA580C;border-radius:50%;vertical-align:middle;margin-right:8px;text-align:center;line-height:36px;font-size:18px;">🍽️</span>Sakafio
              </div>
              <div style="font-size:12px;color:#94a3b8;margin-top:4px;letter-spacing:.5px;text-transform:uppercase;">
                Restaurant &amp; bar management
              </div>
            </td>
          </tr>

          <!-- ── Carte principale ─────────────────────── -->
          <tr>
            <td style="background:#ffffff;border-radius:16px;box-shadow:0 1px 3px rgba(15,23,42,.04),0 8px 32px rgba(15,23,42,.06);overflow:hidden;">

              <!-- Hero -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="background:linear-gradient(135deg,#EA580C 0%,#F97316 50%,#FB923C 100%);padding:40px 32px;text-align:center;">
                    <div style="font-size:48px;line-height:1;margin-bottom:8px;">🎉</div>
                    <h1 style="font-size:24px;font-weight:700;color:#ffffff;margin:0 0 8px;line-height:1.2;">
                      Bienvenue, ${escapeHtml(input.tenantName)}
                    </h1>
                    <p style="font-size:14px;color:#ffedd5;margin:0;line-height:1.5;">
                      Votre instance Sakafio est prête à servir vos clients
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Corps -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="padding:32px;">

                    <!-- Intro -->
                    <p style="font-size:15px;line-height:1.6;color:#475569;margin:0 0 24px;">
                      Tout est configuré : votre admin, votre caisse, votre cuisine et votre site client. Vous trouverez ci-dessous vos accès personnels.
                    </p>

                    <!-- Card credentials -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fefce8;border:1px solid #fde68a;border-radius:12px;margin-bottom:24px;">
                      <tr>
                        <td style="padding:20px;">
                          <div style="font-size:11px;font-weight:700;color:#a16207;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">
                            🔐 Vos identifiants
                          </div>
                          <div style="font-size:12px;color:#78716c;margin-bottom:4px;">Email</div>
                          <div style="font-family:'SFMono-Regular',Consolas,monospace;font-size:14px;color:#1c1917;font-weight:600;margin-bottom:12px;word-break:break-all;">
                            ${escapeHtml(input.adminEmail)}
                          </div>
                          <div style="font-size:12px;color:#78716c;margin-bottom:4px;">Mot de passe</div>
                          <div style="font-family:'SFMono-Regular',Consolas,monospace;font-size:14px;color:#1c1917;font-weight:600;background:#fef3c7;padding:8px 12px;border-radius:6px;border:1px dashed #fcd34d;display:inline-block;word-break:break-all;">
                            ${escapeHtml(input.adminPassword)}
                          </div>
                          <div style="font-size:12px;color:#a16207;margin-top:12px;line-height:1.5;">
                            ⚠️ <strong>Changez ce mot de passe</strong> à votre 1<sup>re</sup> connexion (menu Paramètres &gt; Mon compte).
                          </div>
                        </td>
                      </tr>
                    </table>

                    <!-- CTA principal -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td align="center" style="padding:8px 0 32px;">
                          <a href="${input.urls.admin}/login" style="display:inline-block;background:linear-gradient(135deg,#EA580C 0%,#F97316 100%);color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:10px;box-shadow:0 4px 12px rgba(234,88,12,.3);">
                            Accéder à mon espace admin →
                          </a>
                        </td>
                      </tr>
                    </table>

                    <!-- Séparateur -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:24px;">
                      <tr>
                        <td style="border-top:1px solid #e2e8f0;font-size:0;line-height:0;">&nbsp;</td>
                      </tr>
                    </table>

                    <!-- Vos URLs -->
                    <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:16px;">
                      Vos 4 applications
                    </div>

                    ${appLinkRow('🍽️', 'Admin (manager)', 'Gestion menu, stocks, clients, finances', input.urls.admin)}
                    ${appLinkRow('💳', 'POS (caisse)', 'Prise de commande + encaissement', input.urls.pos)}
                    ${appLinkRow('👨‍🍳', 'KDS (cuisine)', 'Affichage commandes en cuisine', input.urls.kds)}
                    ${appLinkRow('🛒', 'Site client', 'Menu public + commande en ligne', input.urls.client)}

                  </td>
                </tr>
              </table>

              <!-- Footer carte -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="background:#f8fafc;padding:24px 32px;border-top:1px solid #e2e8f0;">
                    <div style="font-size:13px;color:#475569;line-height:1.6;">
                      <strong style="color:#1e293b;">Besoin d'aide ?</strong><br>
                      Répondez simplement à cet email ou contactez nous sur <a href="mailto:support@sakafio.mg" style="color:#EA580C;text-decoration:none;font-weight:600;">support@sakafio.mg</a>.
                    </div>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- ── Footer externe ───────────────────────── -->
          <tr>
            <td align="center" style="padding:24px 16px 0;font-size:11px;color:#94a3b8;line-height:1.6;">
              © ${new Date().getFullYear()} Sakafio — Logiciel pour votre restaurant et bar.<br>
              Cet email contient vos identifiants — ne le partagez avec personne.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const text = `
🎉 Bienvenue ${input.tenantName} !

Votre instance Sakafio est prête à servir vos clients.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔐 VOS IDENTIFIANTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Email        : ${input.adminEmail}
  Mot de passe : ${input.adminPassword}

⚠️  Changez ce mot de passe à votre 1re connexion
   (Paramètres > Mon compte).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 SE CONNECTER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ${input.urls.admin}/login

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 VOS 4 APPLICATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🍽️  Admin (manager)
   Gestion menu, stocks, clients, finances
   ${input.urls.admin}

💳 POS (caisse)
   Prise de commande + encaissement
   ${input.urls.pos}

👨‍🍳 KDS (cuisine)
   Affichage commandes en cuisine
   ${input.urls.kds}

🛒 Site client
   Menu public + commande en ligne
   ${input.urls.client}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Besoin d'aide ? Répondez à cet email
ou écrivez à support@sakafio.mg.

© ${new Date().getFullYear()} Sakafio — Logiciel pour votre restaurant et bar
Cet email contient vos identifiants — ne le partagez avec personne.
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

function appLinkRow(emoji: string, title: string, desc: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:8px;">
    <tr>
      <td style="padding:14px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td width="44" valign="middle" style="font-size:24px;line-height:1;width:44px;padding-right:12px;">${emoji}</td>
            <td valign="middle">
              <div style="font-size:14px;font-weight:600;color:#1e293b;line-height:1.3;">${title}</div>
              <div style="font-size:12px;color:#64748b;margin-top:2px;line-height:1.4;">${desc}</div>
              <a href="${url}" style="display:inline-block;font-family:'SFMono-Regular',Consolas,monospace;font-size:11px;color:#EA580C;text-decoration:none;margin-top:4px;word-break:break-all;">${url}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`
}

/** Envoie un email de test simple. Utilise la config SMTP enregistrée. */
export async function sendTestEmail(to: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getTransporter()
  if (!ctx) return { ok: false, error: 'SMTP non configuré' }
  const now = new Date().toLocaleString('fr-FR')
  try {
    await ctx.transporter.sendMail({
      from: ctx.from,
      to,
      subject: '✅ Test SMTP Sakafio — config OK',
      text: `Test SMTP réussi !\n\nCet email confirme que ta configuration SMTP fonctionne correctement.\nLes prochains tenants créés depuis https://master.sakafio.mg recevront leurs identifiants automatiquement.\n\nEnvoyé le ${now}.`,
      html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#fff8f1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fff8f1;">
    <tr><td align="center" style="padding:48px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:480px;background:#fff;border-radius:16px;box-shadow:0 1px 3px rgba(15,23,42,.04),0 8px 32px rgba(15,23,42,.06);overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#10B981 0%,#059669 100%);padding:32px;text-align:center;color:#fff;">
          <div style="font-size:48px;line-height:1;margin-bottom:8px;">✅</div>
          <h1 style="font-size:22px;font-weight:700;margin:0;line-height:1.3;">Test SMTP réussi !</h1>
        </td></tr>
        <tr><td style="padding:32px;text-align:center;">
          <p style="font-size:15px;line-height:1.6;color:#475569;margin:0 0 16px;">
            Ta configuration SMTP fonctionne parfaitement. Les <strong>prochains clients</strong> créés depuis le master recevront leurs identifiants automatiquement.
          </p>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px;font-size:12px;color:#166534;margin-top:16px;">
            🎉 Tout est prêt. Tu peux créer ton premier client tenant.
          </div>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center;line-height:1.5;">
          Envoyé le ${now}<br>
          © ${new Date().getFullYear()} Sakafio
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
    })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Erreur inconnue' }
  }
}
