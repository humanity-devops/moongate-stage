export interface EmailConfig {
  provider: 'resend' | 'smtp';
  from: string;
  resendApiKey?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
}

export interface EmailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export interface EmailClient {
  send(message: EmailMessage): Promise<{ id?: string }>;
}

export function createEmailClient(config: EmailConfig): EmailClient {
  if (config.provider === 'resend' && config.resendApiKey) {
    const { Resend } = require('resend');
    const resend = new Resend(config.resendApiKey);
    return {
      async send(message) {
        const result = await resend.emails.send({
          from: config.from,
          to: Array.isArray(message.to) ? message.to : [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
          reply_to: message.replyTo,
        });
        return { id: result.id };
      },
    };
  }

  // Console provider for dev/test without SMTP
  if (config.provider === 'smtp' && !config.smtpHost) {
    return {
      async send(message) {
        console.log('[email:console]', JSON.stringify({ to: message.to, subject: message.subject }));
        return {};
      },
    };
  }

  // Default to SMTP (nodemailer) — works with Mailpit in dev
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: config.smtpHost ?? 'localhost',
    port: config.smtpPort ?? 1025,
    auth: config.smtpUser ? { user: config.smtpUser, pass: config.smtpPass } : undefined,
    secure: false,
  });

  return {
    async send(message) {
      const info = await transporter.sendMail({
        from: config.from,
        to: Array.isArray(message.to) ? message.to.join(', ') : message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        replyTo: message.replyTo,
      });
      return { id: info.messageId };
    },
  };
}

export function createEmailClientFromEnv(): EmailClient {
  const provider = (process.env.EMAIL_PROVIDER ?? 'console') as 'resend' | 'smtp' | 'console';
  if (provider === 'console' || (provider as string) === 'console') {
    return {
      async send(message: EmailMessage) {
        console.log('[email:console]', JSON.stringify({ to: message.to, subject: message.subject }));
        return {};
      },
    };
  }
  return createEmailClient({
    provider: (process.env.EMAIL_PROVIDER ?? 'smtp') as 'resend' | 'smtp',
    from: process.env.EMAIL_FROM ?? 'noreply@moongate.xyz',
    resendApiKey: process.env.RESEND_API_KEY,
    smtpHost: process.env.SMTP_HOST ?? 'localhost',
    smtpPort: parseInt(process.env.SMTP_PORT ?? '1025'),
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
  });
}

// Email templates
export function bidSubmittedEmail(params: {
  companyName: string;
  contactName: string;
  itemTitle: string;
  proposedBudget: number;
  currency: string;
  eventName: string;
  adminUrl: string;
}): EmailMessage {
  return {
    to: params.adminUrl, // placeholder - should be organizer email
    subject: `New private offer: ${params.companyName} → ${params.itemTitle}`,
    html: `
      <h2>New Private Offer Received</h2>
      <p><strong>${params.companyName}</strong> (${params.contactName}) has submitted a private offer for <strong>${params.itemTitle}</strong> at <strong>${params.proposedBudget.toLocaleString()} ${params.currency}</strong>.</p>
      <p><a href="${params.adminUrl}">View in Admin Console →</a></p>
    `,
    text: `New private offer from ${params.companyName} for ${params.itemTitle}: ${params.proposedBudget} ${params.currency}. Review at: ${params.adminUrl}`,
  };
}

export function bidAcceptedEmail(params: {
  contactName: string;
  contactEmail: string;
  itemTitle: string;
  eventName: string;
  agreedPrice: number;
  currency: string;
}): EmailMessage {
  return {
    to: params.contactEmail,
    subject: `Great news! Your offer for ${params.itemTitle} has been accepted`,
    html: `
      <h2>Your Offer Has Been Accepted!</h2>
      <p>Hi ${params.contactName},</p>
      <p>We're excited to confirm that your private offer for <strong>${params.itemTitle}</strong> at <strong>${params.agreedPrice.toLocaleString()} ${params.currency}</strong> has been accepted.</p>
      <p>Our team will be in touch shortly with the next steps, including payment and asset collection details.</p>
      <p>Thank you for sponsoring ${params.eventName}!</p>
    `,
    text: `Hi ${params.contactName}, your offer for ${params.itemTitle} has been accepted. Our team will be in touch shortly.`,
  };
}

export function magicLinkEmail(params: {
  email: string;
  magicUrl: string;
  appName?: string;
}): EmailMessage {
  const app = params.appName ?? 'Moongate';
  return {
    to: params.email,
    subject: `Your ${app} sign-in link`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#06060a;color:#fff;border-radius:12px">
        <h2 style="margin:0 0 8px;font-size:20px">Sign in to ${app}</h2>
        <p style="color:#9ca3af;margin:0 0 24px">Click the button below — this link expires in 15 minutes.</p>
        <a href="${params.magicUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Sign In →</a>
        <p style="color:#6b7280;font-size:12px;margin:24px 0 0">If you didn't request this, you can safely ignore it.</p>
      </div>`,
    text: `Sign in to ${app}: ${params.magicUrl} (expires in 15 minutes)`,
  };
}

export function bidCounteredEmail(params: {
  contactName: string;
  contactEmail: string;
  itemTitle: string;
  eventName: string;
  offeredPrice: number;
  currency: string;
  message?: string;
  portalUrl: string;
}): EmailMessage {
  return {
    to: params.contactEmail,
    subject: `Counter-offer received for ${params.itemTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#06060a;color:#fff;border-radius:12px">
        <h2 style="margin:0 0 8px">Counter-offer received</h2>
        <p style="color:#9ca3af">Hi ${params.contactName}, the organizer of <strong style="color:#fff">${params.eventName}</strong> has sent a counter-offer for <strong style="color:#fff">${params.itemTitle}</strong>.</p>
        <div style="background:#1f2937;border-radius:8px;padding:16px;margin:20px 0">
          <div style="color:#9ca3af;font-size:12px;text-transform:uppercase;letter-spacing:0.05em">Proposed price</div>
          <div style="font-size:24px;font-weight:700;color:#fff;margin-top:4px">${params.currency} ${params.offeredPrice.toLocaleString()}</div>
          ${params.message ? `<div style="color:#d1d5db;font-size:14px;margin-top:12px;font-style:italic">"${params.message}"</div>` : ''}
        </div>
        <a href="${params.portalUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Review Counter-Offer →</a>
      </div>`,
    text: `Hi ${params.contactName}, you received a counter-offer of ${params.currency} ${params.offeredPrice} for ${params.itemTitle}. Review at: ${params.portalUrl}`,
  };
}

export function bidRejectedEmail(params: {
  contactName: string;
  contactEmail: string;
  itemTitle: string;
  eventName: string;
  portalUrl: string;
}): EmailMessage {
  return {
    to: params.contactEmail,
    subject: `Update on your bid for ${params.itemTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#06060a;color:#fff;border-radius:12px">
        <h2 style="margin:0 0 8px">Bid update</h2>
        <p style="color:#9ca3af">Hi ${params.contactName}, unfortunately your bid for <strong style="color:#fff">${params.itemTitle}</strong> at ${params.eventName} was not accepted at this time.</p>
        <p style="color:#9ca3af">Browse other opportunities:</p>
        <a href="${params.portalUrl}" style="display:inline-block;background:#374151;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">View Portal →</a>
      </div>`,
    text: `Hi ${params.contactName}, your bid for ${params.itemTitle} was not accepted. Browse other opportunities at: ${params.portalUrl}`,
  };
}

export function paymentSucceededEmail(params: {
  contactName: string;
  contactEmail: string;
  eventName: string;
  total: number;
  currency: string;
  invoiceNumber: string;
  portalUrl: string;
}): EmailMessage {
  return {
    to: params.contactEmail,
    subject: `Payment confirmed — ${params.invoiceNumber}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#06060a;color:#fff;border-radius:12px">
        <h2 style="margin:0 0 8px;color:#22c55e">Payment confirmed</h2>
        <p style="color:#9ca3af">Hi ${params.contactName}, your payment for <strong style="color:#fff">${params.eventName}</strong> has been received.</p>
        <div style="background:#1f2937;border-radius:8px;padding:16px;margin:20px 0">
          <div style="display:flex;justify-content:space-between">
            <span style="color:#9ca3af">Total</span>
            <span style="font-weight:700">${params.currency} ${params.total.toLocaleString()}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:8px">
            <span style="color:#9ca3af">Invoice</span>
            <span>${params.invoiceNumber}</span>
          </div>
        </div>
        <a href="${params.portalUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">View Invoice →</a>
      </div>`,
    text: `Payment confirmed for ${params.eventName}. Total: ${params.currency} ${params.total}. Invoice: ${params.invoiceNumber}. View at: ${params.portalUrl}`,
  };
}

export function depositConfirmedEmail(params: {
  contactName: string;
  contactEmail: string;
  eventName: string;
  packageTitle: string;
  depositAmount: number;
  balanceDueAmount: number;
  fullAmount: number;
  currency: string;
  finalPaymentDueAt: string | null;
  portalUrl: string;
}): EmailMessage {
  const dueLabel = params.finalPaymentDueAt
    ? new Date(params.finalPaymentDueAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'as advised by the organizer';
  return {
    to: params.contactEmail,
    subject: `Deposit confirmed — your ${params.packageTitle} sponsorship is secured`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#06060a;color:#fff;border-radius:12px">
        <h2 style="margin:0 0 8px;color:#22c55e">Sponsorship secured!</h2>
        <p style="color:#9ca3af">Hi ${params.contactName}, your deposit for <strong style="color:#fff">${params.packageTitle}</strong> at <strong style="color:#fff">${params.eventName}</strong> has been received.</p>
        <div style="background:#1f2937;border-radius:8px;padding:16px;margin:20px 0">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px">
            <span style="color:#9ca3af">Deposit paid</span>
            <span style="font-weight:600;color:#22c55e">${params.currency} ${params.depositAmount.toLocaleString()}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:8px">
            <span style="color:#9ca3af">Balance due</span>
            <span style="font-weight:600">${params.currency} ${params.balanceDueAmount.toLocaleString()}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:1px solid #374151">
            <span style="color:#9ca3af">Full package price</span>
            <span style="font-weight:700">${params.currency} ${params.fullAmount.toLocaleString()}</span>
          </div>
        </div>
        <p style="color:#9ca3af;font-size:14px">Your final payment of <strong style="color:#fff">${params.currency} ${params.balanceDueAmount.toLocaleString()}</strong> is due by <strong style="color:#fff">${dueLabel}</strong>. You can complete it any time from your sponsor portal.</p>
        <a href="${params.portalUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Complete Final Payment →</a>
      </div>`,
    text: `Hi ${params.contactName}, your deposit of ${params.currency} ${params.depositAmount} for ${params.packageTitle} is confirmed. Balance of ${params.currency} ${params.balanceDueAmount} is due by ${dueLabel}. Pay at: ${params.portalUrl}`,
  };
}

export function finalPaymentReminderEmail(params: {
  contactName: string;
  contactEmail: string;
  eventName: string;
  packageTitle: string;
  balanceDueAmount: number;
  currency: string;
  finalPaymentDueAt: string | null;
  portalUrl: string;
}): EmailMessage {
  const dueLabel = params.finalPaymentDueAt
    ? new Date(params.finalPaymentDueAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'as soon as possible';
  return {
    to: params.contactEmail,
    subject: `Final payment reminder — ${params.packageTitle} (${params.eventName})`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#06060a;color:#fff;border-radius:12px">
        <h2 style="margin:0 0 8px;color:#f59e0b">Final payment reminder</h2>
        <p style="color:#9ca3af">Hi ${params.contactName}, your final payment for <strong style="color:#fff">${params.packageTitle}</strong> at <strong style="color:#fff">${params.eventName}</strong> is due.</p>
        <div style="background:#1f2937;border-radius:8px;padding:16px;margin:20px 0">
          <div style="color:#9ca3af;font-size:12px;text-transform:uppercase;letter-spacing:0.05em">Amount due</div>
          <div style="font-size:24px;font-weight:700;color:#fff;margin-top:4px">${params.currency} ${params.balanceDueAmount.toLocaleString()}</div>
          <div style="color:#f59e0b;font-size:13px;margin-top:8px">Due by: ${dueLabel}</div>
        </div>
        <a href="${params.portalUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Complete Payment →</a>
      </div>`,
    text: `Hi ${params.contactName}, your final payment of ${params.currency} ${params.balanceDueAmount} for ${params.packageTitle} is due by ${dueLabel}. Pay at: ${params.portalUrl}`,
  };
}

export function sponsorApplicationReceivedEmail(params: {
  name: string;
  email: string;
  appUrl: string;
}): EmailMessage {
  return {
    to: params.email,
    subject: 'Application received — Moongate',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#06060a;color:#fff;border-radius:12px">
        <h2 style="margin:0 0 8px">Application received</h2>
        <p style="color:#9ca3af">Hi ${params.name}, thanks for applying to Moongate. We've received your application and will review it shortly.</p>
        <p style="color:#9ca3af;font-size:14px">Please verify your email to proceed:</p>
        <a href="${params.appUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Verify Email →</a>
      </div>`,
    text: `Hi ${params.name}, thanks for applying to Moongate. Please verify your email: ${params.appUrl}`,
  };
}

export function sponsorApplicationApprovedEmail(params: {
  name: string;
  email: string;
  loginUrl: string;
}): EmailMessage {
  return {
    to: params.email,
    subject: "You're in — your Moongate account is ready",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#06060a;color:#fff;border-radius:12px">
        <h2 style="margin:0 0 8px;color:#22c55e">Welcome to Moongate!</h2>
        <p style="color:#9ca3af">Hi ${params.name}, your sponsor account has been approved. You can now log in and start discovering sponsorship opportunities.</p>
        <a href="${params.loginUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Access Your Portal →</a>
      </div>`,
    text: `Hi ${params.name}, your Moongate sponsor account is approved. Log in at: ${params.loginUrl}`,
  };
}

export function membershipInviteEmail(params: {
  name: string;
  email: string;
  inviteUrl: string;
  organizationName: string;
  role: string;
}): EmailMessage {
  return {
    to: params.email,
    subject: `You've been invited to join ${params.organizationName} on Moongate`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#06060a;color:#fff;border-radius:12px">
        <h2 style="margin:0 0 8px">You've been invited</h2>
        <p style="color:#9ca3af">Hi ${params.name}, you've been invited to join <strong style="color:#fff">${params.organizationName}</strong> as <strong style="color:#fff">${params.role}</strong>.</p>
        <a href="${params.inviteUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Accept Invitation →</a>
      </div>`,
    text: `You've been invited to join ${params.organizationName} as ${params.role}. Accept at: ${params.inviteUrl}`,
  };
}

export function tenantCreatedEmail(params: {
  name: string;
  email: string;
  tenantName: string;
  adminUrl: string;
}): EmailMessage {
  return {
    to: params.email,
    subject: `Your organization "${params.tenantName}" is ready`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#06060a;color:#fff;border-radius:12px">
        <h2 style="margin:0 0 8px;color:#22c55e">Organization created!</h2>
        <p style="color:#9ca3af">Hi ${params.name}, your Moongate organization <strong style="color:#fff">${params.tenantName}</strong> is ready. Start by creating your first event.</p>
        <a href="${params.adminUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Go to Admin Console →</a>
      </div>`,
    text: `Hi ${params.name}, your organization ${params.tenantName} is ready. Go to admin: ${params.adminUrl}`,
  };
}
