export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { to, name, resetUrl } = await request.json();
    const RESEND_API_KEY = env.RESEND_API_KEY || env.RESEND_API_KEY_email || 're_XjxWC9po_PTu57eFrBJeiSuTMtKyWopMj';

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'Missing API key' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: 'Boost by FCR <noreply@boostbyfcr.se>',
        to: to,
        subject: 'Återställ ditt lösenord',
        html: '<div style="font-family: Arial, sans-serif; max-width: 600px;"><h2>Återställ ditt lösenord</h2><p>Hej ' + name + ',</p><p>Du har begärt att återställa ditt lösenord. Klicka på länken nedan:</p><p style="margin: 24px 0;"><a href="' + resetUrl + '" style="background: #e0bd4a; color: #1e3a5f; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Återställ lösenord</a></p><p style="color: #999; font-size: 12px;">Länken är giltig i 1 timme.</p><p>Om du inte begärt detta, ignorera detta meddelande.</p></div>',
      }),
    });

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
