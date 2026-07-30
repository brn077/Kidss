// Vercel serverless function
// Rota: /api/stripe-webhook
//
// O QUE FAZ:
// 1. Recebe o evento "checkout.session.completed" do Stripe (pagamento confirmado de verdade)
// 2. Verifica a assinatura do Stripe (garante que a chamada é mesmo deles)
// 3. Repassa o evento "Purchase" pro Meta Conversions API
//
// ENV VARS NECESSÁRIAS (configurar na Vercel):
//   STRIPE_SECRET_KEY        -> já configurada (mesma da criação do checkout)
//   STRIPE_WEBHOOK_SECRET    -> gerada ao criar o webhook no Dashboard do Stripe (whsec_...)
//   META_PIXEL_ID            -> 1269943107869825
//   META_CAPI_ACCESS_TOKEN   -> gerado em Events Manager > seu Pixel > Configurações > Conversions API
//
// COMO CRIAR O WEBHOOK NO STRIPE:
// Dashboard do Stripe > Developers > Webhooks > Add endpoint
//   URL: https://SEUDOMINIO.com/api/stripe-webhook
//   Evento pra escutar: checkout.session.completed
// Depois de criar, o Stripe mostra o "Signing secret" (whsec_...) — copia pra STRIPE_WEBHOOK_SECRET.

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const crypto = require('crypto');

// Necessário pra ler o corpo cru da requisição (o Stripe exige isso pra verificar a assinatura)
module.exports.config = {
  api: { bodyParser: false },
};

function buffer(readable) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readable.on('data', (chunk) => chunks.push(chunk));
    readable.on('end', () => resolve(Buffer.concat(chunks)));
    readable.on('error', reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const sig = req.headers['stripe-signature'];
  const rawBody = await buffer(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Assinatura do webhook inválida:', err.message);
    return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
  }

  if (event.type !== 'checkout.session.completed') {
    // Não é o evento que nos interessa — responde OK pra Stripe não ficar reenviando.
    return res.status(200).json({ ignored: true, type: event.type });
  }

  const session = event.data.object;
  const customerEmail = session.customer_details?.email || '';
  const amountTotal = session.amount_total; // em centavos
  const currency = session.currency || 'usd';

  const hashedEmail = customerEmail
    ? crypto.createHash('sha256').update(customerEmail.trim().toLowerCase()).digest('hex')
    : undefined;

  const capiPayload = {
    data: [
      {
        event_name: 'Purchase',
        event_time: Math.floor(Date.now() / 1000),
        event_id: session.id, // evita duplicar se o pixel do navegador também disparar
        action_source: 'website',
        user_data: hashedEmail ? { em: [hashedEmail] } : {},
        custom_data: {
          currency: currency,
          value: amountTotal / 100,
        },
      },
    ],
  };

  try {
    const fbRes = await fetch(
      `https://graph.facebook.com/v20.0/${process.env.META_PIXEL_ID}/events?access_token=${process.env.META_CAPI_ACCESS_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(capiPayload),
      }
    );
    const fbData = await fbRes.json();

    if (!fbRes.ok) {
      console.error('Erro ao enviar pro Meta Conversions API:', fbData);
      return res.status(500).json({ error: 'Meta CAPI error', details: fbData });
    }

    console.log('Purchase enviado pro Meta Conversions API com sucesso:', fbData);
    return res.status(200).json({ success: true, fbResponse: fbData });
  } catch (err) {
    console.error('Erro inesperado:', err);
    return res.status(500).json({ error: err.message });
  }
};
