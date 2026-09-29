const nodemailer = require("nodemailer");

const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, character => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&#39;",
  '"': "&quot;"
})[character]);

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
  });
};

const sendSignupOtp = async ({ email, name, otp, expiresInMinutes }) => {
  const transport = getTransport();
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  const safeName = escapeHtml(name);

  await transport.sendMail({
    from,
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

module.exports = { sendSignupOtp };
