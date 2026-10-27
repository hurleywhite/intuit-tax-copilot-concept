import { streamText } from 'ai';
import { DOCS, fallbackAnswer } from '../../../lib/docs';

export const maxDuration = 30;

const MODEL = 'anthropic/claude-haiku-5.5';

function textResponse(text, mode) {
  const encoder = new TextEncoder();
  const words = text.split(/(\s+)/);
  const stream = new ReadableStream({
    async start(controller) {
      for (const w of words) {
        controller.enqueue(encoder.encode(w));
        await new Promise((r) => setTimeout(r, 18));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Answer-Mode': mode, 'Cache-Control': 'no-store' },
  });
}

export async function POST(req) {
  let body = {};
  try { body = await req.json(); } catch {}
  const question = String(body.question || '').slice(0, 300).trim();
  const docKeys = Array.isArray(body.docs) ? body.docs.filter((k) => k in DOCS) : [];
  if (!question) return new Response('Ask a question first.', { status: 400 });

  const context = docKeys.length
    ? docKeys.map((k) => `${DOCS[k].name}: ` + DOCS[k].fields.map(([a, b]) => `${a} ${b}`).join('; ')).join('\n')
    : 'No documents uploaded yet.';

  let failed = false;
  const result = streamText({
    model: MODEL,
    instructions:
      'You are a tax copilot. The documents below are samples. ' +
      'Answer in plain, friendly language in under 110 words, using only the document fields provided. ' +
      'Do not give definitive tax advice. For anything complex, suggest that an expert review it. ' +
      'Never ask for real personal information. If the question is not about taxes or these documents, ' +
      'say you can only help with questions about their return. No markdown headings.\n\nSample documents:\n' + context,
    prompt: question,
    maxOutputTokens: 350,
    onError: ({ error }) => { failed = true; console.error('ai-gateway-error', error?.message || error); },
  });

  const it = result.textStream[Symbol.asyncIterator]();
  let first;
  try {
    first = await Promise.race([
      it.next(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 12000)),
    ]);
  } catch (e) {
    failed = true;
    console.error('ai-first-chunk-error', e?.message || e);
  }
  if (failed || !first || first.done || !first.value) {
    return textResponse(fallbackAnswer(question, docKeys), 'simulated');
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(first.value));
      try {
        for (;;) {
          const { value, done } = await it.next();
          if (done) break;
          controller.enqueue(encoder.encode(value));
        }
      } catch {}
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Answer-Mode': 'live', 'Cache-Control': 'no-store' },
  });
}
