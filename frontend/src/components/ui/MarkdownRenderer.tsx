/**
 * Lightweight markdown renderer — no deps, handles the subset Claude uses:
 * headings, bold, italic, code, blockquote, unordered + ordered lists, hr, links.
 */

import { type CSSProperties } from 'react';

interface Props {
  content: string;
  className?: string;
  style?: CSSProperties;
}

type Token =
  | { t: 'h1' | 'h2' | 'h3' | 'h4'; text: string }
  | { t: 'hr' }
  | { t: 'blockquote'; text: string }
  | { t: 'ul'; items: string[] }
  | { t: 'ol'; items: string[] }
  | { t: 'codeblock'; lang: string; code: string }
  | { t: 'p'; text: string };

function tokenize(src: string): Token[] {
  const lines = src.split('\n');
  const tokens: Token[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code fence
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      tokens.push({ t: 'codeblock', lang, code: codeLines.join('\n') });
      i++;
      continue;
    }

    // Headings
    const h4 = line.match(/^####\s+(.*)/);
    if (h4) { tokens.push({ t: 'h4', text: h4[1] }); i++; continue; }
    const h3 = line.match(/^###\s+(.*)/);
    if (h3) { tokens.push({ t: 'h3', text: h3[1] }); i++; continue; }
    const h2 = line.match(/^##\s+(.*)/);
    if (h2) { tokens.push({ t: 'h2', text: h2[1] }); i++; continue; }
    const h1 = line.match(/^#\s+(.*)/);
    if (h1) { tokens.push({ t: 'h1', text: h1[1] }); i++; continue; }

    // HR
    if (/^[-*_]{3,}$/.test(line.trim())) { tokens.push({ t: 'hr' }); i++; continue; }

    // Blockquote
    if (line.startsWith('> ')) { tokens.push({ t: 'blockquote', text: line.slice(2) }); i++; continue; }

    // Unordered list
    if (/^[-*+]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*+]\s/, ''));
        i++;
      }
      tokens.push({ t: 'ul', items });
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ''));
        i++;
      }
      tokens.push({ t: 'ol', items });
      continue;
    }

    // Empty line — skip
    if (line.trim() === '') { i++; continue; }

    // Paragraph
    const pLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== '' && !lines[i].startsWith('#') && !lines[i].startsWith('```') && !/^[-*+]\s/.test(lines[i]) && !/^\d+\.\s/.test(lines[i]) && !lines[i].startsWith('> ') && !/^[-*_]{3,}$/.test(lines[i].trim())) {
      pLines.push(lines[i]);
      i++;
    }
    if (pLines.length > 0) tokens.push({ t: 'p', text: pLines.join(' ') });
  }

  return tokens;
}

/** Parse inline markdown: **bold**, *italic*, `code`, [link](url) */
function Inline({ text }: { text: string }) {
  // Split on bold, italic, inline code, links
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  const patterns = [
    { re: /\*\*(.+?)\*\*/s, render: (m: RegExpExecArray) => <strong key={key++} style={{ fontWeight: 700, color: 'var(--color-text)' }}>{m[1]}</strong> },
    { re: /\*(.+?)\*/s,     render: (m: RegExpExecArray) => <em key={key++} style={{ fontStyle: 'italic' }}>{m[1]}</em> },
    { re: /`([^`]+)`/,      render: (m: RegExpExecArray) => (
      <code key={key++} style={{
        fontFamily: 'var(--font-mono)', fontSize: '0.85em',
        background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)',
        borderRadius: 4, padding: '1px 5px', color: 'var(--color-green)',
      }}>{m[1]}</code>
    )},
    { re: /\[([^\]]+)\]\(([^)]+)\)/, render: (m: RegExpExecArray) => (
      <a key={key++} href={m[2]} target="_blank" rel="noopener noreferrer"
        style={{ color: 'var(--color-blue)', textDecoration: 'underline', textUnderlineOffset: 2 }}>
        {m[1]}
      </a>
    )},
  ];

  while (remaining.length > 0) {
    let earliest: { idx: number; len: number; node: React.ReactNode } | null = null;

    for (const { re, render } of patterns) {
      const m = re.exec(remaining);
      if (m && (earliest === null || m.index < earliest.idx)) {
        earliest = { idx: m.index, len: m[0].length, node: render(m) };
      }
    }

    if (!earliest) {
      parts.push(remaining);
      break;
    }

    if (earliest.idx > 0) parts.push(remaining.slice(0, earliest.idx));
    parts.push(earliest.node);
    remaining = remaining.slice(earliest.idx + earliest.len);
  }

  return <>{parts}</>;
}

export default function MarkdownRenderer({ content, className, style }: Props) {
  const tokens = tokenize(content ?? '');

  const baseText: CSSProperties = { color: 'var(--color-text2)', lineHeight: 1.8 };

  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: 12, ...style }}>
      {tokens.map((tok, idx) => {
        switch (tok.t) {
          case 'h1': return (
            <h1 key={idx} style={{ margin: 0, fontSize: 20, fontWeight: 900, color: 'var(--color-text)', letterSpacing: '-0.01em', lineHeight: 1.3 }}>
              <Inline text={tok.text} />
            </h1>
          );
          case 'h2': return (
            <h2 key={idx} style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.01em', lineHeight: 1.3, paddingBottom: 4, borderBottom: '1px solid rgba(255,255,255,.06)' }}>
              <Inline text={tok.text} />
            </h2>
          );
          case 'h3': return (
            <h3 key={idx} style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.3 }}>
              <Inline text={tok.text} />
            </h3>
          );
          case 'h4': return (
            <h4 key={idx} style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--color-text2)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
              <Inline text={tok.text} />
            </h4>
          );
          case 'hr': return (
            <div key={idx} style={{ height: 1, background: 'rgba(255,255,255,.06)', margin: '4px 0' }} />
          );
          case 'blockquote': return (
            <div key={idx} style={{
              borderLeft: '3px solid var(--color-green)', paddingLeft: 14,
              background: 'rgba(0,230,118,.04)', borderRadius: '0 8px 8px 0', padding: '10px 14px',
            }}>
              <p style={{ margin: 0, fontSize: 13, ...baseText, fontStyle: 'italic' }}>
                <Inline text={tok.text} />
              </p>
            </div>
          );
          case 'ul': return (
            <ul key={idx} style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {tok.items.map((item, j) => (
                <li key={j} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ marginTop: 7, width: 5, height: 5, borderRadius: '50%', background: 'var(--color-green)', flexShrink: 0 }} />
                  <span style={{ fontSize: 13.5, ...baseText }}><Inline text={item} /></span>
                </li>
              ))}
            </ul>
          );
          case 'ol': return (
            <ol key={idx} style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {tok.items.map((item, j) => (
                <li key={j} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--color-green)', fontFamily: 'var(--font-mono)', minWidth: 20, textAlign: 'right', marginTop: 2, flexShrink: 0 }}>{j + 1}.</span>
                  <span style={{ fontSize: 13.5, ...baseText }}><Inline text={item} /></span>
                </li>
              ))}
            </ol>
          );
          case 'codeblock': return (
            <div key={idx} style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 10, overflow: 'hidden' }}>
              {tok.lang && (
                <div style={{ padding: '6px 14px', borderBottom: '1px solid rgba(255,255,255,.06)', fontSize: 10, fontWeight: 700, color: 'var(--color-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '.08em', textTransform: 'uppercase' }}>
                  {tok.lang}
                </div>
              )}
              <pre style={{ margin: 0, padding: '14px 16px', overflowX: 'auto', fontSize: 12, lineHeight: 1.7, fontFamily: 'var(--font-mono)', color: 'var(--color-text2)' }}>
                <code>{tok.code}</code>
              </pre>
            </div>
          );
          case 'p': return (
            <p key={idx} style={{ margin: 0, fontSize: 13.5, ...baseText }}>
              <Inline text={tok.text} />
            </p>
          );
          default: return null;
        }
      })}
    </div>
  );
}
