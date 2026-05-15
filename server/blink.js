const BLINK_API = "https://api.blink.sv/graphql";
const crypto = require("crypto");
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
async function createInvoice({ walletId, amountSats, memo }) {
  const cleanWalletId = String(walletId || "").trim();
  const cleanAmount = Number(amountSats);
  const cleanMemo = String(memo || "Tournament entry").slice(0, 120);

  if (!cleanWalletId) {
    throw new Error("Missing BLINK_WALLET_ID");
  }

  if (!Number.isInteger(cleanAmount) || cleanAmount <= 0) {
    throw new Error(`Invalid amountSats: ${amountSats}`);
  }

  const input = {
    walletId: cleanWalletId,
    amount: cleanAmount,
    memo: cleanMemo,
    expiresIn: 10
  };

  console.log("Blink invoice input:", {
    ...input,
    walletId: cleanWalletId.slice(0, 6) + "..."
  });

  const query = `
    mutation lnInvoiceCreate($input: LnInvoiceCreateInput!) {
      lnInvoiceCreate(input: $input) {
        errors {
          message
          path
          code
        }
        invoice {
          paymentRequest
          paymentHash
          paymentSecret
          paymentStatus
          satoshis
        }
      }
    }
  `;

  const data = await blinkRequest(
    query,
    { input },
    process.env.BLINK_RECEIVE_API_KEY || process.env.BLINK_API_KEY
  );

  const payload = data.lnInvoiceCreate;

  if (payload.errors?.length) {
    throw new Error(payload.errors.map(e => e.message).join(", "));
  }

  if (!payload.invoice) {
    throw new Error("Blink did not return invoice");
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