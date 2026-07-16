export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { to, name, subject, html } = await request.json();
  const RESEND_API_KEY = env.RESEND_API_KEY || env.RESEND_API_KEY_email || 're_XjxWC9po_PTu57eFrBJeiSuTMtKyWopMj';

  if (!RESEND_API_KEY) {
    console.error('âŒ Missing RESEND_API_KEY');
    return new Response('Missing API key', { status: 500 });
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'Boost by FCR <noreply@boostbyfcr.se>',
      to,
      subject,
      html,
    }),
  });

  const data = await res.json();
  return new Response(JSON.stringify(data), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
}

