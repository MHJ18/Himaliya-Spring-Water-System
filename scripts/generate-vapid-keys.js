/* Generate a VAPID key pair for Web Push background notifications.
 *
 * The public half becomes REACT_APP_VAPID_PUBLIC_KEY (safe to expose — it ships
 * to every browser and pins each push subscription). The private half becomes
 * the VAPID_PRIVATE_KEY secret on the send-push Edge Function and must never be
 * committed or sent to the client.
 *
 * Usage:  node scripts/generate-vapid-keys.js
 *
 * Uses only Node's built-in crypto, so there is no dependency on the `web-push`
 * CLI. Output is the raw URL-safe base64 format the Push API and web-push expect
 * (65-byte uncompressed public point, 32-byte private scalar).
 */

const crypto = require('crypto');

const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
});

const pub = publicKey.export({ format: 'jwk' });
const prv = privateKey.export({ format: 'jwk' });
const fromB64Url = (value) => Buffer.from(value, 'base64url');

// Uncompressed EC point: 0x04 || X(32) || Y(32).
const publicRaw = Buffer.concat([
  Buffer.from([0x04]),
  fromB64Url(pub.x),
  fromB64Url(pub.y),
]);
const privateRaw = fromB64Url(prv.d);

process.stdout.write(
  [
    'VAPID key pair generated. Store the private key like a password.',
    '',
    'Client build env (.env / hosting provider):',
    `  REACT_APP_VAPID_PUBLIC_KEY=${publicRaw.toString('base64url')}`,
    '',
    'send-push Edge Function secret (supabase secrets set ...):',
    `  VAPID_PRIVATE_KEY=${privateRaw.toString('base64url')}`,
    '',
  ].join('\n'),
);
