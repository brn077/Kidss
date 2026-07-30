// Vercel serverless function
// Rota: /api/create-checkout-session
// Requer a env var STRIPE_SECRET_KEY configurada no painel da Vercel.

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const origin = req.headers.origin || `https://${req.headers.host}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Mentes Brillantes™ 3X1',
              description: 'Ley de Murphy + El Gran Libro de los Porqués + Pequeños Líderes (PDF, entrega inmediata por mail).',
            },
            unit_amount: 500, // $5.00 — mudar aqui se o preço mudar
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/index.html`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    return res.status(500).json({ error: err.message });
  }
};
