export const parseMessageContent = (text: string) => {
  // 1. Extract <think> blocks
  const thinkRegex = /<think>([\s\S]*?)<\/think>/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = thinkRegex.exec(text)) !== null) {
    // Content before think
    if (match.index > lastIndex) {
      const contentBefore = text.substring(lastIndex, match.index);
      if (contentBefore) {
          parts.push({ type: 'text', content: contentBefore });
      }
    }
    // Think content
    parts.push({ type: 'think', content: match[1] });
    lastIndex = thinkRegex.lastIndex;
  }
  
  // Remaining content
  if (lastIndex < text.length) {
    const remaining = text.substring(lastIndex);
    if (remaining) {
        parts.push({ type: 'text', content: remaining });
    }
  }

  return parts;
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
