'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { DOCS, SUGGESTED } from '../lib/docs';

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
    { role: 'ai', text: 'Add a document, then ask me anything about your return. Pick a question below or type your own.', mode: null },
  ]);
  const [asked, setAsked] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [copyMsg, setCopyMsg] = useState('');
  const [logoOk, setLogoOk] = useState(false);

  useEffect(() => {
    const im = new Image();
    im.onload = () => setLogoOk(true);
    im.src = '/intuit-logo.svg';
  }, []);
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
      update({ mode, prog: readyDocs.length ? `Based on ${readyDocs.length} document${readyDocs.length > 1 ? 's' : ''}` : 'No documents added yet' });
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
      'Summary for your tax expert',
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
      <div className="topbar">
        <div className="lockup">
          {logoOk ? (
            <img src="/intuit-logo.svg" alt="Intuit" className="logo" onError={() => setLogoOk(false)} />
          ) : (
            <span className="logo-text">Intuit</span>
          )}
          <span className="divider" aria-hidden="true" />
          <span className="product">Tax Copilot</span>
        </div>
        <span className="tag">Concept</span>
      </div>
      <header>
        <h1>Upload a document, ask questions, hand a clean summary to an expert</h1>
        <p className="lede">Add your tax documents, ask questions in plain language, and send an expert a summary so they don't start from scratch.</p>
      </header>

      <div className="grid">
        <div className="col">
          <section className="panel" aria-label="Documents">
            <div className="row"><h2>Documents</h2>{docs.length > 0 && <span className="label">{docs.length} added</span>}</div>
            {docs.length === 0 && <div className="empty">Add a document to get started. The copilot reads it and pulls out the numbers that matter.</div>}
            {docs.map((d) => {
              const doc = DOCS[d.key];
              return (
                <div className="doc" key={d.key}>
                  <div className="name">{doc.name}</div>
                  <ul className="steps">
                    {doc.steps.slice(0, Math.max(1, d.done + (d.done < doc.steps.length ? 1 : 0))).map((s, i) => (
                      <li key={s}><span className="mk">{i < d.done ? '✓' : '…'}</span><span>{s}</span></li>
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
              <button onClick={() => addDoc('w2')} disabled={docKeys.includes('w2')}>Add a sample W-2</button>
              <button onClick={() => addDoc('nec')} disabled={docKeys.includes('nec')}>Add a sample 1099-NEC</button>
            </div>
          </section>

          <section className="panel sum" aria-label="Summary for an expert">
            <div className="row"><h2>Summary for your tax expert</h2></div>
            {docKeys.length === 0 && asked.length === 0 ? (
              <div className="none">This fills in as you add documents and ask questions, so an expert can pick up where you left off.</div>
            ) : (
              <>
                <h3>Documents received</h3>
                {docKeys.length ? <ul>{docKeys.map((k) => <li key={k}>{DOCS[k].name}</li>)}</ul> : <div className="none">None yet</div>}
                <h3>Questions asked</h3>
                {asked.length ? <ul>{asked.map((q) => <li key={q}>{q}</li>)}</ul> : <div className="none">None yet</div>}
                <h3>Open items</h3>
                {items.length ? <ul>{items.map((q) => <li key={q}>{q}</li>)}</ul> : <div className="none">None yet</div>}
                <div className="row"><button onClick={copy}>Copy summary</button><span className="label">{copyMsg}</span></div>
              </>
            )}
          </section>
        </div>

        <section className="panel copilot" aria-label="Copilot">
          <div className="row"><h2>Copilot</h2></div>
          <div className="chat" ref={chatRef} aria-live="polite">
            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.role}`}>
                {m.role === 'ai' && m.prog && (
                  <span className="prog">{m.prog}</span>
                )}
                {m.text}
                {m.streaming && <span className="caret" />}
              </div>
            ))}
          </div>
          <div className="chips suggest">
            {SUGGESTED.map((q) => <button key={q} onClick={() => ask(q)} disabled={busy}>{q}</button>)}
          </div>
          <form className="ask" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={300} placeholder="Ask about your return" aria-label="Your question" />
            <button className="primary" type="submit" disabled={busy || !input.trim()}>Ask</button>
          </form>
        </section>
      </div>

    </main>
  );
}
