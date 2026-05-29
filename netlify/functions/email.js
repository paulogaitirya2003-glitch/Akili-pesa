// netlify/functions/email.js
// ─────────────────────────────────────────────────────────────────────────────
// Sends OTP verification emails for Akili Pesa.
//
// Supports TWO providers — configure whichever you have:
//
//   PROVIDER 1 — Resend (recommended, free tier 3 000 emails/month)
//     Set env var:  RESEND_API_KEY=re_xxxxxxxxxxxx
//     Sign up at:   https://resend.com
//
//   PROVIDER 2 — Gmail SMTP via Nodemailer (good for personal projects)
//     Set env vars: GMAIL_USER=youraddress@gmail.com
//                   GMAIL_PASS=your-app-password   ← 16-char Google App Password
//     Guide:        https://support.google.com/accounts/answer/185833
//
//   PROVIDER 3 — Any generic SMTP (SendGrid, Brevo, Mailgun, etc.)
//     Set env vars: SMTP_HOST=smtp.sendgrid.net
//                   SMTP_PORT=587
//                   SMTP_USER=apikey
//                   SMTP_PASS=SG.xxxxxxxx
//                   SMTP_FROM=noreply@yourdomain.com
//
// If NONE of the above are configured the function returns 503 and the
// React app falls back to showing the OTP on-screen (demo mode).
// ─────────────────────────────────────────────────────────────────────────────

const nodemailer = require("nodemailer");

// ── HTML email template ────────────────────────────────────────────────────
function buildEmailHTML(name, otp) {
  return `<!DOCTYPE html>
<html lang="sw">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Akili Pesa — OTP</title>
</head>
<body style="margin:0;padding:0;background:#080D1A;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#080D1A;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:420px;background:#101724;border-radius:24px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.5);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#00D4AA,#00956E);padding:32px 28px;text-align:center;">
              <div style="font-size:48px;margin-bottom:8px;">🦁</div>
              <div style="color:#fff;font-size:26px;font-weight:900;letter-spacing:-1px;">Akili Pesa</div>
              <div style="color:rgba(255,255,255,0.8);font-size:13px;margin-top:4px;">Mshauri wako wa fedha</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 28px;">
              <p style="color:#7A8BA4;font-size:14px;margin:0 0 6px 0;letter-spacing:1px;text-transform:uppercase;">Habari,</p>
              <h2 style="color:#EDF2FF;font-size:22px;font-weight:800;margin:0 0 16px 0;">${escapeHtml(name)} 👋</h2>
              <p style="color:#7A8BA4;font-size:15px;line-height:1.6;margin:0 0 28px 0;">
                Nambari yako ya uthibitisho (OTP) kwa Akili Pesa ni:
              </p>

              <!-- OTP Box -->
              <div style="background:#18243A;border:2px solid #00D4AA;border-radius:16px;padding:24px;text-align:center;margin-bottom:28px;">
                <div style="color:#7A8BA4;font-size:12px;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;">Nambari ya Uthibitisho</div>
                <div style="color:#00D4AA;font-size:42px;font-weight:900;letter-spacing:10px;font-family:'Courier New',monospace;">${otp}</div>
                <div style="color:#7A8BA4;font-size:12px;margin-top:10px;">Inaisha baada ya dakika 10</div>
              </div>

              <p style="color:#7A8BA4;font-size:13px;line-height:1.6;margin:0 0 8px 0;">
                ⚠️ Usiitumie nambari hii mtu yeyote. Akili Pesa haitawahi kukuuliza OTP yako.
              </p>
              <p style="color:#7A8BA4;font-size:13px;line-height:1.6;margin:0;">
                Kama hukukuomba OTP hii, puuza barua hii.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#18243A;padding:20px 28px;text-align:center;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="color:#4A6080;font-size:11px;margin:0;">
                © ${new Date().getFullYear()} Akili Pesa · Jua Pesa Yako Inaenda Wapi 💚
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Send via Resend REST API (no extra npm package needed) ─────────────────
async function sendViaResend(to, name, otp) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Akili Pesa <noreply@yourdomain.com>", // ← change to your verified domain
      to: [to],
      subject: `${otp} — Nambari yako ya Akili Pesa`,
      html: buildEmailHTML(name, otp),
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error ${res.status}: ${err}`);
  }
}

// ── Send via Nodemailer (Gmail or generic SMTP) ────────────────────────────
async function sendViaNodemailer(to, name, otp) {
  let transportConfig;

  if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
    // Gmail App Password
    transportConfig = {
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    };
  } else if (process.env.SMTP_HOST) {
    // Generic SMTP (SendGrid, Brevo, Mailgun …)
    transportConfig = {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_PORT === "465",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    };
  } else {
    throw new Error("No SMTP config found");
  }

  const transporter = nodemailer.createTransport(transportConfig);
  const fromAddress = process.env.SMTP_FROM || process.env.GMAIL_USER;

  await transporter.sendMail({
    from: `"Akili Pesa 🦁" <${fromAddress}>`,
    to,
    subject: `${otp} — Nambari yako ya Akili Pesa`,
    html: buildEmailHTML(name, otp),
    text: `Habari ${name}!\n\nNambari yako ya uthibitisho wa Akili Pesa ni: ${otp}\n\nInaisha dakika 10. Usishirikishe mtu yeyote.\n\n— Akili Pesa`,
  });
}

// ── Main handler ───────────────────────────────────────────────────────────
exports.handler = async function (event) {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  const { to, otp, name } = body;

  if (!to || !otp || !name) {
    return { statusCode: 400, body: "Missing fields: to, otp, name" };
  }

  // Basic email validation
  if (!to.includes("@") || !to.includes(".")) {
    return { statusCode: 400, body: "Invalid email address" };
  }

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  try {
    if (process.env.RESEND_API_KEY) {
      await sendViaResend(to, name, otp);
    } else if (process.env.GMAIL_USER || process.env.SMTP_HOST) {
      await sendViaNodemailer(to, name, otp);
    } else {
      // No provider configured → tell the React app to fall back to demo mode
      return {
        statusCode: 503,
        headers,
        body: JSON.stringify({
          error: "No email provider configured",
          hint: "Set RESEND_API_KEY or GMAIL_USER+GMAIL_PASS in Netlify env vars",
        }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, message: "OTP imetumwa!" }),
    };
  } catch (err) {
    console.error("Email send error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Imeshindwa kutuma barua pepe", detail: err.message }),
    };
  }
};
