import application from '../application-server.cjs';

let handler;
export default {
  async fetch(request) {
    // Explicit launch gates: merely deploying or having an existing Resend key never enables collection.
    if (process.env.EXOM_FORM_ENABLED !== 'true' || process.env.EXOM_FORM_EDGE_LIMIT_VERIFIED !== 'true') {
      return Response.json({ error: 'El formulario no está disponible para envíos reales.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
    try {
      if (!handler) {
        const secret = process.env.EXOM_FORM_SECRET;
        if (!secret || Buffer.byteLength(secret) < 32) throw Error('Missing form secret');
        handler = application.createApplicationHandler({
          origin: 'https://www.exommethod.com', simulated: false, secret,
          send: application.createResendTransport({ apiKey: process.env.RESEND_API_KEY, from: process.env.RESEND_FORM_EMAIL })
        });
      }
      // Vercel overwrites this header; arbitrary client-forwarded IP headers are never trusted.
      const address = request.headers.get('x-vercel-forwarded-for');
      if (!address) throw Error('Missing platform address');
      return await handler(request, address);
    } catch {
      return Response.json({ error: 'El formulario no está disponible. Contacta con EXOM.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
  }
};
