/**
 * Extracts the latest progress message from a string containing <execution_progress> tags.
 * Supports both closed tags and trailing partial tags for streaming responses.
 */
export function extractLatestProgress(text: string): string | undefined {
  if (!text) return undefined;

  // 1. Find the last closed tag
  const closedRegex = /<execution_progress>\s*([\s\S]*?)\s*<\/execution_progress>/g;
  let lastClosedMatch: string | undefined;
  let match;

  // We iterate to find the absolute last one if multiple exist
  while ((match = closedRegex.exec(text)) !== null) {
    lastClosedMatch = match[1].trim();
  }

  // 2. Check for a trailing partial tag (streaming)
  // This looks for the LAST opening tag that isn't followed by a closing tag
  const lastOpenIndex = text.lastIndexOf("<execution_progress>");
  const lastCloseIndex = text.lastIndexOf("</execution_progress>");

  if (lastOpenIndex > lastCloseIndex) {
    const partial = text.slice(lastOpenIndex + "<execution_progress>".length).trim();
    // Ensure we don't capture other tags that might have started
    const firstTagIndex = partial.indexOf("<");
    if (firstTagIndex !== -1) {
      const content = partial.slice(0, firstTagIndex).trim();
      return content || lastClosedMatch;
    }
    return partial || lastClosedMatch;
  }

  return lastClosedMatch;
}
