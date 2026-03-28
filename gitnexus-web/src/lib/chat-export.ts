import type { ChatMessage } from '../core/llm/types';

interface ChatExportPayload {
  filename: string;
  content: string;
}

const FILE_REF_REGEX = /\[\[([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9]+(?::\d+(?:[-–]\d+)?)?)\]\]/g;
const NODE_REF_REGEX = /\[\[(?:graph:)?(Class|Function|Method|Interface|File|Folder|Variable|Enum|Type|CodeElement):([^\]]+)\]\]/g;

const normalizeGroundingSyntax = (markdown: string): string => {
  const parts = markdown.split('```');

  for (let index = 0; index < parts.length; index += 2) {
    parts[index] = parts[index]
      .replace(FILE_REF_REGEX, (_match, ref: string) => `\`${ref.trim()}\``)
      .replace(
        NODE_REF_REGEX,
        (_match, nodeType: string, nodeName: string) => `\`${nodeType}:${nodeName.trim()}\``
      );
  }

  return parts.join('```');
};

const getAssistantContent = (message: ChatMessage): string => {
  if (message.steps && message.steps.length > 0) {
    const finalContent = message.steps
      .filter((step) => step.type === 'content' && typeof step.content === 'string')
      .map((step) => step.content?.trim() ?? '')
      .filter(Boolean)
      .join('\n\n')
      .trim();

    if (finalContent) {
      return finalContent;
    }
  }

  return message.content.trim();
};

const slugifyProjectName = (projectName: string): string =>
  projectName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'project';

const formatHeaderTimestamp = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

const formatFilenameTimestamp = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
};

export const createChatExport = (
  messages: ChatMessage[],
  projectName: string,
  exportedAt: Date = new Date()
): ChatExportPayload => {
  const safeProjectName = projectName.trim() || 'project';
  const sections: string[] = [
    '# Nexus AI Conversation',
    '',
    `- Repository: ${safeProjectName}`,
    `- Exported: ${formatHeaderTimestamp(exportedAt)}`,
  ];

  for (const message of messages) {
    if (message.role === 'tool') {
      continue;
    }

    const rawContent =
      message.role === 'assistant'
        ? getAssistantContent(message)
        : message.content.trim();

    if (!rawContent) {
      continue;
    }

    sections.push('');
    sections.push('---');
    sections.push('');
    sections.push(message.role === 'assistant' ? '## Nexus AI' : '## You');
    sections.push('');
    sections.push(normalizeGroundingSyntax(rawContent));
  }

  return {
    filename: `gitnexus-${slugifyProjectName(safeProjectName)}-chat-${formatFilenameTimestamp(exportedAt)}.md`,
    content: sections.join('\n').trimEnd() + '\n',
  };
};

export const downloadChatExport = (payload: ChatExportPayload): void => {
  const blob = new Blob([payload.content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = payload.filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
};
