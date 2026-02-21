import type { NotionSourceConfig, RepoSourceConfig, SourceSummary } from "@velogen/shared";

function formatSourceDisplayValue(source: SourceSummary): string {
  if (!source.config) {
    return source.id;
  }

  if (source.type === "repo") {
    const repoConfig = source.config as RepoSourceConfig;
    if (repoConfig.repoUrl && repoConfig.repoUrl.length > 0) {
      return repoConfig.repoUrl;
    }
    if (repoConfig.repoPath && repoConfig.repoPath.length > 0) {
      return repoConfig.repoPath;
    }
  } else if (source.type === "notion") {
    const notionConfig = source.config as NotionSourceConfig;
    if (notionConfig.pageId && notionConfig.pageId.length > 0) {
      return notionConfig.pageId;
    }
  }

  return source.id;
}

function extractTitleFromMarkdown(markdown: string): string | null {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

function buildMarkdownFileName(title: string): string {
  return `${title.replace(/[^a-zA-Z0-9가-힣\s-_]/g, "").replace(/\s+/g, "-").toLowerCase()}.md`;
}

export { buildMarkdownFileName, extractTitleFromMarkdown, formatSourceDisplayValue };
