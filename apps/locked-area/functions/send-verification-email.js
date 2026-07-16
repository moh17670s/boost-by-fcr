export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { to, name, verificationUrl } = await request.json();
  const RESEND_API_KEY = env.RESEND_API_KEY || env.RESEND_API_KEY_email;

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
      from: 'Boost by FCR <onboarding@resend.dev>',
      to,
      subject: 'Verifiera din e-post',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2>VÃ¤lkommen till Boost by FCR</h2>
          <p>Hej ${name},</p>
          <p>Tack fÃ¶r din registrering. Klicka pÃ¥ lÃ¤nken nedan fÃ¶r att verifiera din e-post:</p>
          <p><a href="${verificationUrl}">Verifiera min e-post</a></p>
        </div>
      `,
    }),
  });

  const data = await res.json();
  return new Response(JSON.stringify(data), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
}




