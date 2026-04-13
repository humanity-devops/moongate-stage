import Stripe from 'stripe';

export interface CreateCheckoutSessionParams {
  orderId: string;
  lineItems: Array<{
    name: string;
    description?: string;
    amount: number; // in cents
    quantity: number;
  }>;
  currency: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
  customerEmail?: string;
}

export interface CheckoutSession {
  id: string;
  url: string;
  expiresAt: Date;
}

export function createStripeClient(secretKey: string): {
  createCheckoutSession(params: CreateCheckoutSessionParams): Promise<CheckoutSession>;
  constructWebhookEvent(payload: string | Buffer, signature: string, secret: string): Stripe.Event;
} {
  const stripe = new Stripe(secretKey, { apiVersion: '2024-10-28.acacia' });

  return {
    async createCheckoutSession(params) {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        line_items: params.lineItems.map(item => ({
          price_data: {
            currency: params.currency.toLowerCase(),
            product_data: {
              name: item.name,
              description: item.description,
            },
            unit_amount: Math.round(item.amount * 100), // Convert to cents
          },
          quantity: item.quantity,
        })),
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        customer_email: params.customerEmail,
        metadata: {
          orderId: params.orderId,
          ...params.metadata,
        },
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30 minutes
      });

      return {
        id: session.id,
        url: session.url!,
        expiresAt: new Date(session.expires_at * 1000),
      };
    },

    constructWebhookEvent(payload, signature, secret) {
      return stripe.webhooks.constructEvent(payload, signature, secret);
    },
  };
}

export function handleStripeWebhook(
  event: Stripe.Event,
): { type: string; orderId?: string; sessionId?: string } {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      return {
        type: 'payment_succeeded',
        orderId: session.metadata?.orderId,
        sessionId: session.id,
      };
    }
    case 'checkout.session.expired': {
      const session = event.data.object as Stripe.Checkout.Session;
      return {
        type: 'checkout_expired',
        orderId: session.metadata?.orderId,
        sessionId: session.id,
      };
    }
    default:
      return { type: event.type };
  }
}
