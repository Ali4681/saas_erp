import { createHmac, timingSafeEqual } from 'crypto';

export type InvoiceSharePayload = {
  companyId: string;
  invoiceId: string;
  theme: string;
  format: string;
  exp: number;
};

function secret() {
  return process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-me';
}

export function signInvoiceShareToken(payload: InvoiceSharePayload): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyInvoiceShareToken(token: string): InvoiceSharePayload {
  const [body, sig] = token.split('.');
  if (!body || !sig) {
    throw new Error('Invalid share token');
  }
  const expected = createHmac('sha256', secret()).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error('Invalid share token signature');
  }
  const payload = JSON.parse(
    Buffer.from(body, 'base64url').toString('utf8'),
  ) as InvoiceSharePayload;
  if (!payload.companyId || !payload.invoiceId || !payload.exp) {
    throw new Error('Invalid share token payload');
  }
  if (Date.now() > payload.exp) {
    throw new Error('Share token expired');
  }
  return payload;
}
