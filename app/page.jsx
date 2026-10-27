'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { DOCS, SUGGESTED } from '../lib/docs';

const ENV = process.env.NEXT_PUBLIC_VERCEL_ENV || 'local';
const ENV_LABEL = ENV === 'production' ? 'Production deployment' : ENV === 'preview' ? 'Preview deployment (review link)' : 'Local build';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function openItems(docKeys, asked) {
  const items = [];
  if (docKeys.includes('w2') && asked.length) items.push('Confirm state withholding is entered once');
  if (docKeys.includes('nec')) items.push('Review self-employment income');
  const text = asked.join(' ').toLowerCase();
  if (text.includes('refund')) items.push('Review the refund change with an expert');
  if ((text.includes('freelance') || text.includes('1099')) && !docKeys.includes('nec')) items.push('Get the 1099-NEC for freelance income');
  return items;
}

export default function Page() {
  const [docs, setDocs] = useState([]); // [{key, done:number}]
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'Upload a sample document, then ask me anything about it. Try one of the questions below or type your own.', mode: null },
  ]);
  const [asked, setAsked] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [copyMsg, setCopyMsg] = useState('');
  const chatRef = useRef(null);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  const docKeys = docs.map((d) => d.key);

  async function addDoc(key) {
    if (docKeys.includes(key)) return;
    setDocs((d) => [...d, { key, done: 0 }]);
    for (let i = 1; i <= DOCS[key].steps.length; i++) {
      await sleep(600);
      setDocs((d) => d.map((x) => (x.key === key ? { ...x, done: i } : x)));
    }
  }

  async function ask(question) {
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setInput('');
    setAsked((a) => (a.includes(q) ? a : [...a, q]));
    const readyDocs = docs.filter((d) => d.done >= DOCS[d.key].steps.length).map((d) => d.key);
    setMessages((m) => [...m, { role: 'me', text: q }, { role: 'ai', text: '', mode: null, streaming: true, prog: 'Reading your documents' }]);
    const update = (patch) => setMessages((m) => { const c = m.slice(); c[c.length - 1] = { ...c[c.length - 1], ...patch }; return c; });
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, docs: readyDocs }),
      });
      const mode = res.headers.get('X-Answer-Mode') || 'simulated';
      update({ mode, prog: readyDocs.length ? `Used ${readyDocs.length} document${readyDocs.length > 1 ? 's' : ''}` : 'No documents yet' });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        update({ text });
      }
      update({ streaming: false });
    } catch {
      update({ text: 'Something went wrong. Try again.', streaming: false, mode: 'error' });
    }
    setBusy(false);
  }

  const items = openItems(docKeys, asked);

  function summaryText() {
    return [
      'Summary for an expert (concept, sample data)',
      'Documents: ' + (docKeys.length ? docKeys.map((k) => DOCS[k].name).join(', ') : 'none yet'),
      'Questions: ' + (asked.length ? asked.join(' | ') : 'none yet'),
      'Open items: ' + (items.length ? items.join('; ') : 'none yet'),
    ].join('\n');
  }

  async function copy() {
    try { await navigator.clipboard.writeText(summaryText()); setCopyMsg('Copied'); }
    catch { setCopyMsg('Copy blocked. Select the text instead'); }
    setTimeout(() => setCopyMsg(''), 2500);
  }

  return (
    <main className="wrap">
      <header>
        <div className="tags">
          <span className="tag">Concept</span>
          <span className="tag">Sample data only</span>
          <span className="tag">{ENV_LABEL}</span>
        </div>
        <h1>Upload a document, ask questions, hand a clean summary to an expert</h1>
        <p className="lede">A concept for the AI-native tax direction Intuit has announced, built on Next.js and the Vercel AI SDK. It is not an Intuit product, and every number is made up.</p>
      </header>

      <div className="grid">
        <div className="col">
          <section className="panel" aria-label="Documents">
            <div className="row"><h2>Documents</h2><span className="label">{docs.length} uploaded</span></div>
            {docs.map((d) => {
              const doc = DOCS[d.key];
              return (
                <div className="doc" key={d.key}>
                  <div className="name">{doc.name}</div>
                  <ul className="steps">
                    {doc.steps.slice(0, Math.max(1, d.done + (d.done < doc.steps.length ? 1 : 0))).map((s, i) => (
                      <li key={s}><span className="mk">{i < d.done ? 'ok' : '...'}</span><span>{s}</span></li>
                    ))}
                  </ul>
                  {d.done >= doc.steps.length && (
                    <div className="fields">
                      {doc.fields.map(([k, v]) => (<Fragment key={k}><span className="k">{k}</span><span className="v">{v}</span></Fragment>))}
                    </div>
                  )}
                </div>
              );
            })}
            <div className="chips">
              <button onClick={() => addDoc('w2')} disabled={docKeys.includes('w2')}>Upload sample W-2</button>
              <button onClick={() => addDoc('nec')} disabled={docKeys.includes('nec')}>Upload sample 1099-NEC</button>
            </div>
          </section>

          <section className="panel sum" aria-label="Summary for an expert">
            <div className="row"><h2>Summary for an expert</h2><span className="label">Built as you go</span></div>
            <h3>Documents received</h3>
            {docKeys.length ? <ul>{docKeys.map((k) => <li key={k}>{DOCS[k].name}</li>)}</ul> : <div className="none">None yet</div>}
            <h3>Questions asked</h3>
            {asked.length ? <ul>{asked.map((q) => <li key={q}>{q}</li>)}</ul> : <div className="none">None yet</div>}
            <h3>Open items</h3>
            {items.length ? <ul>{items.map((q) => <li key={q}>{q}</li>)}</ul> : <div className="none">None yet</div>}
            <div className="row"><button onClick={copy}>Copy summary</button><span className="label">{copyMsg}</span></div>
          </section>
        </div>

        <section className="panel" aria-label="Copilot">
          <div className="row"><h2>Copilot</h2><span className="label">Answers stream in</span></div>
          <div className="chat" ref={chatRef} aria-live="polite">
            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.role}`}>
                {m.role === 'ai' && m.prog && (
                  <span className="prog">{m.prog}{m.mode === 'live' ? ' · live AI via AI Gateway' : m.mode === 'simulated' ? ' · simulated answer' : ''}</span>
                )}
                {m.text}
                {m.streaming && <span className="caret" />}
              </div>
            ))}
          </div>
          <div className="chips">
            {SUGGESTED.map((q) => <button key={q} onClick={() => ask(q)} disabled={busy}>{q}</button>)}
          </div>
          <form className="ask" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={300} placeholder="Ask about the sample return" aria-label="Your question" />
            <button className="primary" type="submit" disabled={busy || !input.trim()}>Ask</button>
          </form>
        </section>
      </div>

      <section aria-label="What this shows">
        <div className="label" style={{ marginBottom: 8 }}>What this shows about Vercel (proposed for Intuit)</div>
        <div className="shows">
          <div className="panel"><b>v0</b><p>Screens like these can start as v0 prototypes, so teams try a working version before writing production code.</p></div>
          <div className="panel"><b>Deployment platform</b><p>This page shipped as a preview link for review, then was promoted to production. Every change gets its own link, with rollback if needed.</p></div>
          <div className="panel"><b>AI SDK and AI Gateway</b><p>Answers stream word by word from a model routed through AI Gateway. If the model is unavailable, a sample answer streams instead.</p></div>
        </div>
      </section>
      <footer>Concept for discussion. Not affiliated with or endorsed by Intuit. Do not enter real personal or tax information.</footer>
    </main>
  );
}
