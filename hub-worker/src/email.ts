import type { Env } from "./env";

// ─── Resend transactional email ──────────────────────────────────────
//
// Thin wrapper around the Resend /emails REST API. The worker never
// depends on the full Resend SDK (it would balloon the bundle); we
// just POST JSON. FROM_EMAIL must be on a domain that's verified in
// the Resend console — otherwise Resend returns 403 and the signup
// flow surfaces that to the user.

export interface SendResult {
  ok: boolean;
  error?: string;
}

export async function sendEmail(
  env: Env,
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<SendResult> {
  if (!env.RESEND_API_KEY) {
    // Dev fallback — log the mail instead of sending so the
    // verification flow stays testable without Resend credentials.
    console.log(`[email stub] to=${to} subject=${subject}\n${text}`);
    return { ok: true };
  }

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.FROM_EMAIL,
      to,
      subject,
      html,
      text,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    return { ok: false, error: `Resend ${resp.status}: ${body.slice(0, 400)}` };
  }
  return { ok: true };
}

/**
 * Build the verification-code email. We keep both an HTML and a text
 * body; some clients still reject HTML-only mail as spam and Resend
 * bills the same either way.
 */
export function verificationEmail(code: string, minutesValid: number): { subject: string; html: string; text: string } {
  const subject = `Your Arcanum Hub verification code: ${code}`;
  const text = `Welcome to Arcanum Hub!

Your verification code is: ${code}

This code expires in ${minutesValid} minutes. Enter it in the app to finish creating your account.

If you didn't request this, you can safely ignore this email.
— Arcanum Hub
`;
  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#0b1418;font-family:Georgia,'Times New Roman',serif;color:#d9c8ad;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#11212a;border:1px solid #2b4750;border-radius:8px;">
      <tr>
        <td style="padding:28px 28px 16px 28px;">
          <h1 style="margin:0 0 12px 0;font-family:'Cinzel',Georgia,serif;font-size:20px;letter-spacing:0.12em;color:#f6e3b3;text-transform:uppercase;">Arcanum Hub</h1>
          <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;">Welcome! Enter this code in the app to finish creating your account:</p>
          <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:32px;letter-spacing:0.35em;color:#f6e3b3;background:#0b1418;border:1px solid #2b4750;border-radius:6px;padding:16px 20px;text-align:center;">${code}</div>
          <p style="margin:16px 0 0 0;font-size:13px;line-height:1.6;color:#8da3a8;">This code expires in ${minutesValid} minutes.</p>
          <p style="margin:8px 0 0 0;font-size:13px;line-height:1.6;color:#8da3a8;">If you didn't request this, you can safely ignore this email.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  return { subject, html, text };
}
