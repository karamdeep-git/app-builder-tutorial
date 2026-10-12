const crypto = require('crypto');
const Oauth1a = require('oauth-1.0a');
require('dotenv').config();

const oauth = new Oauth1a({
  consumer: { key: process.env.COMMERCE_CONSUMER_KEY, secret: process.env.COMMERCE_CONSUMER_SECRET },
  signature_method: 'HMAC-SHA256',
  hash_function: (base, key) => crypto.createHmac('sha256', key).update(base).digest('base64'),
});
const token = { key: process.env.COMMERCE_ACCESS_TOKEN, secret: process.env.COMMERCE_ACCESS_TOKEN_SECRET };

const path = process.argv[2] || '';
const method = process.argv[3] || 'GET';
const body = process.argv[4];

const url = process.env.COMMERCE_BASE_URL + 'rest/V1/' + path;
const requestData = { url, method };
const header = oauth.toHeader(oauth.authorize(requestData, token));

const https = require('https');
const reqOptions = { method, headers: { ...header, 'Content-Type': 'application/json' } };
const req = https.request(url, reqOptions, (res) => {
  let data = '';
  res.on('data', (d) => (data += d));
  res.on('end', () => {
    console.log('STATUS', res.statusCode);
    console.log(data);
  });
});
if (body) req.write(body);
req.end();
