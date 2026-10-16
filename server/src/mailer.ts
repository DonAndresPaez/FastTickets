import nodemailer, { type Transporter } from "nodemailer";
import { env, isProduction } from "./config/env";

let transporter: Promise<Transporter> | undefined;

async function createTransporter(): Promise<Transporter> {
  if (env.smtp.host) {
    return nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: { user: env.smtp.user, pass: env.smtp.pass },
    });
  }
  if (isProduction) throw new Error("SMTP_HOST is required in production");

  const account = await nodemailer.createTestAccount();
  console.log("[mail] No SMTP_HOST set, using a temporary Ethereal inbox");
  return nodemailer.createTransport({
    host: account.smtp.host,
    port: account.smtp.port,
    secure: account.smtp.secure,
    auth: { user: account.user, pass: account.pass },
  });
}

function getTransporter(): Promise<Transporter> {
  // created on first use; retried next time if it failed
  transporter ??= createTransporter().catch((err: unknown) => {
    transporter = undefined;
    throw err;
  });
  return transporter;
}

export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  const info = await (await getTransporter()).sendMail({ from: env.smtp.from, to, subject, text });
  const preview = nodemailer.getTestMessageUrl(info);
  if (preview) console.log(`[mail] Sent to ${to}, view it at ${preview}`);
}
