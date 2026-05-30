// netlify/functions/email.js
// Inatuma OTP kwa Brevo API — fetch tu, hakuna npm packages

function buildEmailHTML(name, otp) {
  return `<!DOCTYPE html>
<html lang="sw">
<head><meta charset="UTF-8"><title>Akili Pesa OTP</title></head>
<body style="margin:0;padding:0;background:#080D1A;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" style="max-width:420px;background:#101724;border-radius:24px;overflow:hidden;">
        <tr>
          <td style="background:linear-gradient(135deg,#00D4AA,#00956E);padding:32px;text-align:center;">
            <div style="font-size:48px;">🦁</div>
            <div style="color:#fff;font-size:26px;font-weight:900;">Akili Pesa</div>
            <div style="color:rgba(255,255,255,0.8);font-size:13px;">Mshauri wako wa fedha</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h2 style="color:#EDF2FF;font-size:20px;margin:0 0 16px 0;">Habari ${name} 👋</h2>
            <p style="color:#7A8BA4;font-size:15px;margin:0 0 24px 0;">Nambari yako ya uthibitisho ni:</p>
            <div style="background:#18243A;border:2px solid #00D4AA;border-radius:16px;padding:24px;text-align:center;margin-bottom:24px;">
              <div style="color:#7A8BA4;font-size:11px;letter-spacing:2px;margin-bottom:8px;">OTP</div>
              <div style="color:#00D4AA;font-size:42px;font-weight:900;letter-spacing:10px;font-family:monospace;">${otp}</div>
              <div style="color:#7A8BA4;font-size:12px;margin-top:8px;">Inaisha baada ya dakika 10</div>
            </div>
            <p style="color:#7A8BA4;font-size:12px;">⚠️ Usishirikishe nambari hii na mtu yeyote.</p>
          </td>
        </tr>
        <tr>
          <td style="background:#18243A;padding:16px;text-align:center;">
            <p style="color:#4A6080;font-size:11px;margin:0;">© 2025 Akili Pesa 💚</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

exports.handler = async function (event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: "Method Not Allowed" };

  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  if (!BREVO_API_KEY) {
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({ error: "Weka BREVO_API_KEY kwenye Netlify env vars" }),
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { to, otp, name } = parsed;
  if (!to || !otp || !name) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing: to, otp, name" }) };
  }

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: {
          name: "Akili Pesa",
          email: process.env.BREVO_SENDER_EMAIL || "paulomkenya0@gmail.com",
        },
        to: [{ email: to, name: name }],
        subject: `${otp} — Nambari yako ya Akili Pesa`,
        htmlContent: buildEmailHTML(name, otp),
        textContent: `Habari ${name}!\n\nOTP yako ni: ${otp}\n\nInaisha dakika 10.\n\n— Akili Pesa`,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || JSON.stringify(data));
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, message: "OTP imetumwa!" }),
    };
  } catch (err) {
    console.error("Brevo error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Imeshindwa kutuma", detail: err.message }),
    };
  }
};
