const fs = require('fs');
const path = require('path');

const iconPath = path.join(__dirname, '..', 'icon.png');
const b64 = fs.readFileSync(iconPath).toString('base64');
const apiKey = 'nhp_95TmDQKQNbsEWNYQK8IqcIK_snqF6uJq';
const models = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-3-flash', 'auto'];

async function testModel(model) {
  const res = await fetch('http://127.0.0.1:8317/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'Return JSON only: {"image_summary":"icon logo","printed_elements":"icon shape"}' },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } }
        ]
      }],
      temperature: 0.35
    })
  });
  const text = await res.text();
  console.log(`\n=== ${model} HTTP ${res.status} ===`);
  console.log(text.slice(0, 500));
}

async function main() {
  for (const model of models) {
    try {
      await testModel(model);
    } catch (error) {
      console.error(model, 'ERR', error.message);
    }
  }
}

main().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
