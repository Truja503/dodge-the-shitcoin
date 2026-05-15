const BLINK_API = "https://api.blink.sv/graphql";

async function blinkRequest(query, variables = {}, apiKey = process.env.BLINK_API_KEY) {
  if (!apiKey) throw new Error("Missing Blink API key");

  const res = await fetch(BLINK_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();

  if (!res.ok || json.errors) {
    console.error("Blink API error:", JSON.stringify(json, null, 2));
    throw new Error("Blink API error");
  }

  return json.data;
}

async function createInvoice({ walletId, amountSats, memo, externalId }) {
  const query = `
    mutation LnInvoiceCreate($input: LnInvoiceCreateInput!) {
      lnInvoiceCreate(input: $input) {
        invoice {
          paymentRequest
          paymentHash
          paymentSecret
          satoshis
          paymentStatus
        }
        errors {
          message
        }
      }
    }
  `;

  const data = await blinkRequest(query, {
    input: {
      walletId,
      amount: amountSats,
      memo,
      externalId,
      expiresIn: 10,
    },
  }, process.env.BLINK_RECEIVE_API_KEY || process.env.BLINK_API_KEY);

  const payload = data.lnInvoiceCreate;

  if (payload.errors?.length) {
    throw new Error(payload.errors[0].message);
  }

  return payload.invoice;
}

async function getInvoiceStatus(paymentHash) {
  const query = `
    query LnInvoicePaymentStatusByHash($input: LnInvoicePaymentStatusByHashInput!) {
      lnInvoicePaymentStatusByHash(input: $input) {
        paymentHash
        paymentPreimage
        paymentRequest
        status
      }
    }
  `;

  const data = await blinkRequest(query, {
    input: { paymentHash },
  }, process.env.BLINK_READ_API_KEY || process.env.BLINK_API_KEY);

  return data.lnInvoicePaymentStatusByHash;
}

module.exports = {
  createInvoice,
  getInvoiceStatus,
};