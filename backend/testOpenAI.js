// backend/testOpenAI.js
// Isolated OpenAI connectivity check. Run: node testOpenAI.js
const openai = require('./utils/openaiClient');

async function main() {
  const key = process.env.OPENAI_API_KEY;
  console.log('🔑 OPENAI_API_KEY present:', key ? `yes (…${key.slice(-6)})` : 'NO');
  if (!key) process.exit(1);

  // 1) Embeddings — used by upload indexing and chat retrieval.
  try {
    const emb = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: 'Bonjour, ceci est un test de connexion.',
      encoding_format: 'float',
    });
    console.log(`✅ Embeddings OK — vector length ${emb.data[0].embedding.length}`);
  } catch (err) {
    console.error('❌ Embeddings FAILED:', err.status || '', err.message);
  }

  // 2) Chat completion — used to generate answers.
  try {
    const chat = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      temperature: 0,
      messages: [{ role: 'user', content: 'Réponds uniquement avec le mot: PONG' }],
    });
    console.log('✅ Chat OK — reply:', JSON.stringify(chat.choices[0].message.content));
  } catch (err) {
    console.error('❌ Chat FAILED:', err.status || '', err.message);
  }
}

main();
