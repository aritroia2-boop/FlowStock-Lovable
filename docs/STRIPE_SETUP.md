# Stripe Subscription Setup Guide

## Overview
FlowStock uses a single monthly subscription plan to unlock all restaurant features. This guide covers configuration, webhook setup, admin management, and troubleshooting.

---

## Configuration Values

### 1. Price ID
- **Location**: `src/lib/subscriptionService.ts`
- **Current Value**: `price_1SYzmMPTY1BjOCKcgTX09rOi`
- **How to change**: Update the `SUBSCRIPTION_PRICE_ID` constant if you create a new Stripe price

```typescript
export const SUBSCRIPTION_PRICE_ID = 'price_1SYzmMPTY1BjOCKcgTX09rOi';
export const SUBSCRIPTION_PRICE = '178.99 RON';
```

### 2. Success & Cancel URLs
- Set dynamically in the frontend when calling checkout
- **Default success URL**: `${origin}/success`
- **Default cancel URL**: `${origin}/cancel`
- No configuration needed - automatically uses the current origin

---

## Webhook Setup

### Step 1: Add Webhook Endpoint in Stripe Dashboard

1. Go to **Stripe Dashboard** → **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Enter your endpoint URL:
   ```
   https://xrboxwuwzvlyizuupeya.supabase.co/functions/v1/stripe-webhook
   ```
4. Select **Latest API version**

### Step 2: Enable Required Events

Select these events (minimum required):

- ✅ `checkout.session.completed`
- ✅ `customer.subscription.deleted`
- ✅ `customer.subscription.updated`

Optional (recommended):
- ✅ `invoice.payment_failed`

### Step 3: Copy Webhook Signing Secret

1. After creating the endpoint, copy the **Signing secret** (starts with `whsec_`)
2. This secret is already configured in your Lovable Cloud secrets as `STRIPE_WEBHOOK_SECRET`
3. If you need to update it, contact support

---

## Admin Flag Management

### Setting Admin Access (Owner Only)

The `is_admin` flag grants full access to restaurant features without requiring a subscription. **Only you (the owner) should set this flag.**

#### Option 1: Via Lovable Cloud Backend UI
1. Open your backend dashboard
2. Navigate to the **profiles** table
3. Find your user row by email
4. Set `is_admin` to `true`

#### Option 2: Via SQL (in backend SQL editor)
```sql
UPDATE profiles 
SET is_admin = true 
WHERE email = 'your@email.com';
```

**Security Note**: Never expose this toggle to end users. This is for owner/admin use only.

---

## Access Control Logic

### Restaurant Features (Restricted)
These features require `is_subscribed = true` OR `is_admin = true`:

- ✅ Restaurant creation
- ✅ Restaurant settings management
- ✅ Inventory management
- ✅ Recipes management
- ✅ Orders processing
- ✅ Audit logs
- ✅ Team management

### Personal Features (Open)
These features are available without subscription:

- ✅ Personal profile settings
- ✅ View pricing page

### Guard Implementation
All restricted pages use the `useSubscriptionGuard()` hook which automatically redirects non-subscribed, non-admin users to the pricing page.

---

## Testing

### Test Checkout Flow

1. **Stripe Test Mode**:
   - Ensure you're in test mode (toggle in Stripe Dashboard)
   - Test card: `4242 4242 4242 4242`
   - Expiry: Any future date
   - CVC: Any 3 digits
   - ZIP: Any 5 digits

2. **Test Flow**:
   ```
   1. Login to FlowStock
   2. Navigate to restricted feature (e.g., Inventory)
   3. Should redirect to /pricing
   4. Click "Subscribe Now"
   5. Complete checkout with test card
   6. Should redirect to /success
   7. User should now have access to all features
   ```

### View Logs

#### Edge Function Logs
- Access via **Lovable Cloud Backend** → **Functions** → Select function
- Look for logs starting with `[CREATE-CHECKOUT]`, `[WEBHOOK]`, `[CUSTOMER-PORTAL]`

#### Stripe Events
- **Stripe Dashboard** → **Developers** → **Events**
- Filter by webhook endpoint
- Check event delivery status and response codes

---

## Event Payload Examples

### checkout.session.completed
```json
{
  "type": "checkout.session.completed",
  "data": {
    "object": {
      "id": "cs_test_...",
      "customer": "cus_...",
      "subscription": "sub_...",
      "metadata": {
        "userId": "uuid-here"
      },
      "mode": "subscription"
    }
  }
}
```

**What happens**:
1. Webhook verifies signature
2. Checks for `userId` in metadata
3. Idempotency check: verifies subscription not already processed
4. Updates `profiles` table:
   - `is_subscribed = true`
   - `stripe_customer_id = customer`
   - `stripe_subscription_id = subscription`
   - `subscription_status = 'active'`
5. Upserts to `subscriptions` table for detailed tracking

### customer.subscription.deleted
```json
{
  "type": "customer.subscription.deleted",
  "data": {
    "object": {
      "id": "sub_...",
      "customer": "cus_...",
      "status": "canceled",
      "metadata": {
        "userId": "uuid-here"
      }
    }
  }
}
```

**What happens**:
1. Finds user by `userId` in metadata (fallback: lookup by `stripe_subscription_id`)
2. Idempotency check: verifies not already canceled
3. Updates `profiles`:
   - `is_subscribed = false`
   - `subscription_status = 'canceled'`
4. Updates `subscriptions` table status

### customer.subscription.updated
```json
{
  "type": "customer.subscription.updated",
  "data": {
    "object": {
      "id": "sub_...",
      "status": "active|past_due|unpaid|canceled",
      "metadata": {
        "userId": "uuid-here"
      }
    }
  }
}
```

**What happens**:
- Syncs `is_subscribed` based on status (active/trialing = true, others = false)
- Updates `subscription_status` to match Stripe
- Upserts to `subscriptions` table

---

## Troubleshooting

### User Not Marked as Subscribed

**Symptoms**: User completed checkout but doesn't have access

**Checks**:
1. View webhook logs for errors
2. Verify webhook event was received (`checkout.session.completed`)
3. Check if `userId` is in session metadata
4. Query profiles table:
   ```sql
   SELECT is_subscribed, subscription_status, stripe_subscription_id 
   FROM profiles 
   WHERE email = 'user@email.com';
   ```

**Common causes**:
- Webhook signature verification failed
- `userId` missing from metadata
- Database update error (check webhook logs)

### Admin Bypass Not Working

**Symptoms**: Admin flag set but still redirected to pricing

**Checks**:
1. Verify flag is set:
   ```sql
   SELECT is_admin FROM profiles WHERE email = 'your@email.com';
   ```
2. Check user fetch includes `is_admin` field (verify in browser dev tools → Network)
3. Verify `useSubscriptionGuard` checks both `is_subscribed` OR `is_admin`

### Webhook Not Receiving Events

**Checks**:
1. **Stripe Dashboard** → **Developers** → **Webhooks**
   - Check endpoint status (should show recent events)
   - Look for failed deliveries
2. Verify endpoint URL is correct
3. Check `STRIPE_WEBHOOK_SECRET` is set correctly in secrets

### Customer Portal Not Opening

**Symptoms**: "Manage Billing" button fails

**Checks**:
1. Verify Stripe Customer Portal is activated:
   - **Stripe Dashboard** → **Settings** → **Customer portal**
   - Ensure portal is configured
2. Check user has `stripe_customer_id` in database
3. View edge function logs for `customer-portal` errors

---

## Database Schema

### Profiles Table (New Fields)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `is_subscribed` | BOOLEAN | `false` | Whether user has active subscription |
| `is_admin` | BOOLEAN | `false` | Admin bypass flag (owner only) |
| `stripe_customer_id` | TEXT | NULL | Stripe customer ID |
| `stripe_subscription_id` | TEXT | NULL | Stripe subscription ID |
| `subscription_status` | TEXT | `'none'` | active, canceled, past_due, unpaid, or none |

### Subscriptions Table (Existing)

Used for detailed subscription tracking and webhooks. Populated automatically by webhook events.

---

## Security Considerations

1. **Webhook Signature Verification**: All webhook events are verified using Stripe signatures
2. **Secrets Management**: All Stripe secrets stored securely in Lovable Cloud
3. **Admin Flag**: Only accessible via direct database access (no API exposure)
4. **Service Role Key**: Used only in webhook handler for bypassing RLS

---

## Support

For additional help:
- **Stripe Documentation**: https://stripe.com/docs
- **Webhook Testing**: Use Stripe CLI for local testing
- **Test Cards**: https://stripe.com/docs/testing

---

## Quick Reference

### Edge Functions
- `create-checkout-session`: Creates Stripe Checkout session
- `stripe-webhook`: Handles Stripe events
- `customer-portal`: Opens Stripe Customer Portal for billing management

### Frontend Components
- `PricingPage`: Shows subscription plan and handles checkout
- `SuccessPage`: Post-checkout success screen
- `CancelPage`: Checkout cancellation screen
- `SubscribeBanner`: Prompts non-subscribed users to upgrade

### Hooks
- `useSubscriptionGuard`: Protects restaurant features from non-subscribed users
