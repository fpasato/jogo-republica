
import express from 'express';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Node não carrega .env automaticamente neste servidor. Preserva variáveis
// já definidas no ambiente e completa apenas as que estiverem ausentes.
try {
  const envFile = readFileSync(resolve(process.cwd(), '.env'), 'utf8');
  for (const line of envFile.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, '$2');
    process.env[match[1]] = value;
  }
} catch {
  // .env é opcional quando a chave é fornecida pelo ambiente do processo.
}

const app = express();
app.use(express.json({ limit: '1mb' }));

const API_KEY = process.env.GROQ_API_KEY;
const PORT = 3001;

app.get('/api/groq/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/groq/chat', async (req, res) => {
  if (!API_KEY) {
    return res.status(500).json({ error: 'GROQ_API_KEY não configurada.' });
  }

  const { model, messages, temperature, top_p, max_tokens } = req.body ?? {};

  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: 'Mensagens inválidas.' });
  }


  try {
    const response = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model || 'openai/gpt-oss-20b',
          messages,
          temperature,
          ...(top_p !== undefined ? { top_p } : {}),
          max_tokens: max_tokens ?? 4096,
          response_format: { type: 'json_object' },
        }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Erro da Groq:', response.status, data);

      return res.status(response.status).json({
        error: data?.error?.message || 'Erro na API da Groq.',
      });
    }

    const choice = data.choices?.[0];
    const content = choice?.message?.content;

    console.log('Modelo:', model || 'openai/gpt-oss-20b');
    console.log('Motivo do término:', choice?.finish_reason);
    console.log('Conteúdo recebido:', content);

    if (typeof content !== 'string' || !content.trim()) {
      console.error(
        'Resposta sem conteúdo:',
        JSON.stringify(data),
      );

      return res.status(502).json({
        error: 'A Groq retornou conteúdo vazio.',
        finishReason: choice?.finish_reason ?? null,
      });
    }

    return res.json({
      content,
      promptTokens: data.usage?.prompt_tokens,
      responseTokens: data.usage?.completion_tokens,
    });
  } catch (error) {
    console.error('Erro ao consultar Groq:', error);

    return res.status(502).json({
      error: 'Falha ao consultar a API da Groq.',
    });
  }

});

app.listen(PORT, () => {
  console.log(`Servidor da Groq disponível na porta ${PORT}.`);
});
