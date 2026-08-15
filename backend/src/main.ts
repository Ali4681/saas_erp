import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
// Prisma BigInt fields (e.g. nextInvoiceNumber) must be JSON-serializable
(BigInt.prototype as unknown as { toJSON?: () => string }).toJSON = function (
  this: bigint,
) {
  return this.toString();
};
function parseCorsOrigins(raw: string | undefined): boolean | string[] {
  const value = raw?.trim();
  if (!value) {
    return true;
  }
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
/** Base64 attachments expand ~33% vs raw file; UI allows up to 5MB. */
const BODY_LIMIT = '10mb';
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.setGlobalPrefix('api');
  app.useWebSocketAdapter(new WsAdapter(app));
  app.use(json({ limit: BODY_LIMIT }));
  app.use(urlencoded({ extended: true, limit: BODY_LIMIT }));
  app.enableCors({
    origin: parseCorsOrigins(process.env.CORS_ORIGINS),
    credentials: true,
  });
  const host = process.env.HOST ?? '0.0.0.0';
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, host);
}
bootstrap();
