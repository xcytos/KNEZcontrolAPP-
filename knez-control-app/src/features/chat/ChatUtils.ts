export const parseMessageContent = (text: string) => {
  const thinkRegex = /<think>([\s\S]*?)<\/think>/g;
  const parts: Array<{ type: string; content: string; title?: string }> = [];
  let lastIndex = 0;
  let match;

  while ((match = thinkRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const contentBefore = text.substring(lastIndex, match.index);
      if (contentBefore) {
        parts.push({ type: 'text', content: contentBefore });
      }
    }
    parts.push({ type: 'think', content: match[1] });
    lastIndex = thinkRegex.lastIndex;
  }
  
  if (lastIndex < text.length) {
    const remaining = text.substring(lastIndex);
    if (remaining) {
      parts.push({ type: 'text', content: remaining });
    }
  }

  const systemRegex = /\[SYSTEM:\s*([^\]]+)\]\n/g;
  const exploded: Array<{ type: string; content: string; title?: string }> = [];
  for (const p of parts) {
    if (p.type !== "text") {
      exploded.push(p);
      continue;
    }
    const raw = p.content;
    const matches = [...raw.matchAll(systemRegex)];
    if (matches.length === 0) {
      exploded.push(p);
      continue;
    }
    let cursor = 0;
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      const start = m.index ?? 0;
      const headerEnd = start + m[0].length;
      const nextStart = i + 1 < matches.length ? (matches[i + 1].index ?? raw.length) : raw.length;
      if (start > cursor) {
        const before = raw.slice(cursor, start);
        if (before) exploded.push({ type: "text", content: before });
      }
      const title = (m[1] ?? "").trim();
      const body = raw.slice(headerEnd, nextStart).replace(/^\n+/, "");
      exploded.push({ type: "system", title, content: body.trimEnd() });
      cursor = nextStart;
    }
    if (cursor < raw.length) {
      const tail = raw.slice(cursor);
      if (tail) exploded.push({ type: "text", content: tail });
    }
  }

  return exploded;
};

export const formatMarkdown = (text: string) => {
  // Very basic markdown parser for code blocks and emphasis
  // We split by code blocks first
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const contentBefore = text.substring(lastIndex, match.index);
      if (contentBefore) {
          parts.push({ type: 'text', content: contentBefore });
      }
    }
    parts.push({ type: 'code', language: match[1] || 'text', content: match[2] });
    lastIndex = codeBlockRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    const remaining = text.substring(lastIndex);
    if (remaining) {
        parts.push({ type: 'text', content: remaining });
    }
  }

  return parts;
};

export const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

export const exportChat = (messages: any[], sessionId: string) => {
  const content = messages.map(m => `[${m.from.toUpperCase()} - ${m.createdAt}]\n${m.text}\n`).join('\n---\n\n');
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `session-${sessionId}-${new Date().toISOString().slice(0,10)}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
