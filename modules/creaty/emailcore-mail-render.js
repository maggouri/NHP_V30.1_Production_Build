/** Safe HTML email rendering — adapted from maggouri/emailcore public/admin/js/mail.js */

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export function detectTextDirection(text = '') {
  const sample = String(text || '').slice(0, 800);
  const rtlChars = (sample.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g) || []).length;
  const ltrChars = (sample.match(/[A-Za-z]/g) || []).length;
  if (rtlChars > ltrChars * 1.15) return 'rtl';
  if (ltrChars > rtlChars * 1.15) return 'ltr';
  return 'auto';
}

export function buildReplySubject(subject = '') {
  const clean = String(subject || '').trim() || '(بدون عنوان)';
  return /^re:/i.test(clean) ? clean : `Re: ${clean}`;
}

export function buildQuotedReplyBody(message = {}) {
  const text = String(message.body_text || '').trim()
    || stripHtml(message.body_html || '').trim();
  const from = String(message.from_addr || '').trim();
  const date = String(message.received_at || '').trim();
  const header = [from, date].filter(Boolean).join(' · ');
  const quoted = text
    ? text.split('\n').map((line) => `> ${line}`).join('\n')
    : '> …';
  return `\n\n---\n${header}\n${quoted}`;
}

export function stripHtml(html = '') {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  return (doc.body?.textContent || '').replace(/\s+/g, ' ').trim();
}

function normalizeCid(value) {
  return String(value || '').replace(/^<|>$/g, '').trim().toLowerCase();
}

function attachmentDataUrl(att) {
  const b64 = att.contentBase64 || att.content_base64;
  if (!b64) return null;
  const ct = att.contentType || att.content_type || 'application/octet-stream';
  return `data:${ct};base64,${b64}`;
}

export function resolveCidReferences(html, attachments = []) {
  if (!html || !Array.isArray(attachments) || !attachments.length) return html || '';
  let out = String(html);
  for (const att of attachments) {
    const dataUrl = attachmentDataUrl(att);
    if (!dataUrl) continue;
    const cidRaw = att.contentId || att.content_id || '';
    const cid = normalizeCid(cidRaw);
    if (!cid) continue;
    const patterns = [
      new RegExp(`cid:${cid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi'),
      new RegExp(`cid:${cidRaw.replace(/^<|>$/g, '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi'),
    ];
    for (const re of patterns) out = out.replace(re, dataUrl);
  }
  return out;
}

export function textToLinkedHtml(text) {
  const safe = escapeHtml(text || '');
  return safe.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>',
  );
}

export function sanitizeEmailHtml(html, { dir = 'auto' } = {}) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  doc.querySelectorAll('script, iframe, object, embed, form, input, button, textarea, select, meta, link').forEach((el) => el.remove());
  doc.querySelectorAll('*').forEach((el) => {
    [...el.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = String(attr.value || '').trim();
      if (name.startsWith('on')) el.removeAttribute(attr.name);
      if ((name === 'href' || name === 'src') && /^javascript:/i.test(value)) el.removeAttribute(attr.name);
    });
    if (el.tagName === 'A') {
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    }
    if (el.tagName === 'IMG') {
      el.setAttribute('loading', 'lazy');
      el.style.maxWidth = '100%';
      el.style.height = 'auto';
    }
  });

  const bodyDir = dir === 'auto' ? '' : ` dir="${dir}"`;
  return `<!doctype html><html${bodyDir}><head><base target="_blank"><meta charset="utf-8"><style>
    body{margin:0;padding:14px;background:#0f1419;color:#e8edf4;font-family:system-ui,-apple-system,Segoe UI,Tahoma,Arial,sans-serif;line-height:1.55;overflow-wrap:anywhere;unicode-bidi:plaintext;}
    a{color:#38bdf8;text-decoration:none} a:hover{text-decoration:underline}
    img{max-width:100%;height:auto;border-radius:8px;display:block;margin:10px 0;}
    table{max-width:100%;border-collapse:collapse} td,th{padding:4px;vertical-align:top}
    pre{white-space:pre-wrap;overflow:auto;background:#121a26;padding:10px;border-radius:8px}
    blockquote{border-inline-start:3px solid #3b4a6b;margin:8px 0;padding:4px 12px;color:#b8c4d9}
  </style></head><body${bodyDir}>${doc.body.innerHTML}</body></html>`;
}

export function renderEmailBodyMarkup(message = {}) {
  const attachments = Array.isArray(message.attachments) ? message.attachments : [];
  let html = resolveCidReferences(String(message.body_html || '').trim(), attachments);
  const text = String(message.body_text || '').trim();
  const dir = detectTextDirection(`${message.subject || ''}\n${text || stripHtml(html)}`);

  if (html) {
    const srcdoc = escapeHtml(sanitizeEmailHtml(html, { dir }));
    return `<iframe class="creaty-emailcore-html-frame" sandbox="allow-popups allow-popups-to-escape-sandbox" srcdoc="${srcdoc}" loading="lazy" title="محتوى الرسالة"></iframe>`;
  }

  if (text) {
    const preview = text.slice(0, 6000);
    return `<div class="creaty-emailcore-body-text" dir="${dir}">${textToLinkedHtml(preview)}${text.length > 6000 ? '…' : ''}</div>`;
  }

  return '<div class="creaty-emailcore-body-empty">لا يوجد محتوى قابل للعرض.</div>';
}

export function formatMessageDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  try {
    return date.toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' });
  } catch (_) {
    return date.toLocaleString();
  }
}
