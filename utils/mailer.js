const nodemailer = require("nodemailer");

let activeBrevoSender;

const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, character => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&#39;",
  '"': "&quot;"
})[character]);

const parseSender = () => {
  const configured = process.env.MAIL_FROM || process.env.SMTP_USER || "";
  const match = configured.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  return {
    name: process.env.BREVO_SENDER_NAME || match?.[1]?.trim() || "Raavana Thalaigal Trust",
    email: process.env.BREVO_SENDER_EMAIL || match?.[2]?.trim() || configured.trim()
  };
};

const getTransport = () => {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    const error = new Error("Email delivery is not configured.");
    error.status = 503;
    throw error;
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: SMTP_SECURE === "true",
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
};

const sendViaBrevo = async ({ to, subject, html }) => {
  const sender = parseSender();
  if (!sender.email) {
    const error = new Error("BREVO_SENDER_EMAIL or MAIL_FROM must contain a verified sender email.");
    error.status = 503;
    throw error;
  }

  if (activeBrevoSender !== sender.email.toLowerCase()) {
    const sendersResponse = await fetch("https://api.brevo.com/v3/senders", {
      headers: {
        accept: "application/json",
        "api-key": process.env.BREVO_API_KEY
      },
      signal: AbortSignal.timeout(15000)
    });
    const sendersPayload = await sendersResponse.json().catch(() => ({}));
    if (!sendersResponse.ok) {
      const error = new Error(sendersPayload.message || "Could not verify the Brevo sender.");
      error.status = 502;
      throw error;
    }
    const isActive = (sendersPayload.senders || []).some(candidate =>
      candidate.active && candidate.email?.toLowerCase() === sender.email.toLowerCase()
    );
    if (!isActive) {
      const error = new Error(`The Brevo sender ${sender.email} is not verified or active.`);
      error.status = 503;
      throw error;
    }
    activeBrevoSender = sender.email.toLowerCase();
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": process.env.BREVO_API_KEY,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      sender,
      to: [{ email: to }],
      subject,
      htmlContent: html
    }),
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    const details = await response.json().catch(() => ({}));
    const error = new Error(details.message || `Brevo email delivery failed with status ${response.status}.`);
    error.status = 502;
    throw error;
  }
};

const sendEmail = async message => {
  const provider = process.env.EMAIL_PROVIDER?.trim().toLowerCase();
  if (provider === "brevo" || (!provider && process.env.BREVO_API_KEY)) return sendViaBrevo(message);
  const transport = getTransport();
  return transport.sendMail({ ...message, from: process.env.MAIL_FROM || process.env.SMTP_USER });
};

const sendSignupOtp = async ({ email, name, otp, expiresInMinutes }) => {
  const safeName = escapeHtml(name);

  await sendEmail({
    to: email,
    subject: "Verify your Raavana Thalaigal Trust account",
    text: `Hello ${name}, your verification code is ${otp}. It expires in ${expiresInMinutes} minutes.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#172033">
        <h2 style="color:#126f6b">Verify your account</h2>
        <p>Hello ${safeName},</p>
        <p>Use this verification code to complete your Raavana Thalaigal Trust registration:</p>
        <div style="margin:24px 0;padding:18px;border-radius:12px;background:#eef8f7;text-align:center;font-size:32px;font-weight:700;letter-spacing:10px;color:#126f6b">${otp}</div>
        <p>This code expires in ${expiresInMinutes} minutes. If you did not request it, you can ignore this email.</p>
      </div>
    `,
  });
};

const sendPasswordResetOtp = async ({ email, name, otp, expiresInMinutes }) => {
  const safeName = escapeHtml(name);

  await sendEmail({
    to: email,
    subject: "Reset your Raavana Thalaigal Trust password",
    text: `Hello ${name}, your password reset code is ${otp}. It expires in ${expiresInMinutes} minutes.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#172033">
        <h2 style="color:#126f6b">Reset your password</h2>
        <p>Hello ${safeName},</p>
        <p>Use this verification code to reset your Raavana Thalaigal Trust password:</p>
        <div style="margin:24px 0;padding:18px;border-radius:12px;background:#eef8f7;text-align:center;font-size:32px;font-weight:700;letter-spacing:10px;color:#126f6b">${otp}</div>
        <p>This code expires in ${expiresInMinutes} minutes. If you did not request a password reset, you can ignore this email.</p>
      </div>
    `,
  });
};

module.exports = { sendPasswordResetOtp, sendSignupOtp };
