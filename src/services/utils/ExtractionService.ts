
import { knezClient } from "../knez/KnezClient";
import { governanceService } from "../governance/GovernanceService";

export type ExtractionMode = 'news' | 'github' | 'raw';

export interface ExtractionResult {
  source: string;
  mode: ExtractionMode;
  extracted_at: string;
  summary: string;
  data: any;
  error?: string;
}

export class ExtractionService {
  private isTauriRuntime(): boolean {
    const w = window as any;
    return !!w.__TAURI_INTERNALS__ || !!w.__TAURI__ || !!w.__TAURI_IPC__;
  }

  private proxyUrl(url: string): string {
    const trimmed = url.trim();
    if (!/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://r.jina.ai/${trimmed}`;
  }

  private async fetchTextWithFallback(url: string, timeoutMs = 6500): Promise<{ text: string; finalUrl: string }> {
    const attempt = async (u: string) => {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(u, { signal: controller.signal });
        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
        return await response.text();
      } finally {
        clearTimeout(timeoutId);
      }
    };

    const proxied = this.proxyUrl(url);
    if (!this.isTauriRuntime()) {
      const allowed = await governanceService.isExternalFetchAllowed();
      if (!allowed) throw new Error("mcp_permission_denied:external_fetch_blocked_by_governance");
      return { text: await attempt(proxied), finalUrl: proxied };
    }
    try {
      return { text: await attempt(url), finalUrl: url };
    } catch {
      const allowed = await governanceService.isExternalFetchAllowed();
      if (!allowed) throw new Error("mcp_permission_denied:external_fetch_blocked_by_governance");
      return { text: await attempt(proxied), finalUrl: proxied };
    }
  }

  async search(query: string, _limit = 5, _timeoutMs = 3500): Promise<Array<{ title: string; url: string; snippet?: string }>> {
    const q = query.trim();
    if (!q) return [];
    
    try {
      return []; 
    } catch (e) {
      return [];
    }
  }
  
  async extract(url: string, mode: ExtractionMode, timeoutMs = 6500): Promise<ExtractionResult> {
    try {
      if (url.includes("knez-internal")) {
         await knezClient.addKnowledge({ title: "Extraction", content: url });
      }

      // FORENSIC AUDIT FIX (MCP-002):
      // Direct fetch to external URLs blocked by CORS.
      // We must use a proxy. Since we don't have a guaranteed backend proxy for arbitrary URLs yet,
      // we will attempt the fetch but catch the CORS error explicitly to report it correctly.
      
      try {
        const { text, finalUrl } = await this.fetchTextWithFallback(url, timeoutMs);
        
        let summary = `Extracted ${text.length} chars.`;
        let keywords: string[] = [];
        let finalData: any = {
           title: "Unknown Title", 
           keywords,
           content_snippet: text.substring(0, 500) + "..."
        };
        
        // Attempt DOM parsing if in browser
        if (typeof DOMParser !== 'undefined') {
          const parser = new DOMParser();
          const doc = parser.parseFromString(text, 'text/html');
          finalData.title = doc.title || "No Title";
          const metaDesc = doc.querySelector('meta[name="description"]')?.getAttribute('content');
          if (metaDesc) finalData.description = metaDesc;
        }

        if (mode === 'github') {
           // Github API might work if CORS allows, but likely rate limited.
           // Leaving as is but wrapping in safer try/catch blocks in original code
           const repoMatch = url.match(/github\.com\/([^/]+)\/([^/]+)/);
           if (repoMatch) {
              try {
                const apiUrl = `https://api.github.com/repos/${repoMatch[1]}/${repoMatch[2]}`;
                const apiResp = await fetch(apiUrl); // GitHub API enables CORS, so this is technically "okay" but better via MCP
                if (apiResp.ok) {
                   const repoData = await apiResp.json();
                   summary = `GitHub Repo: ${repoData.full_name}`;
                   finalData = {
                      name: repoData.name,
                      description: repoData.description,
                      stars: repoData.stargazers_count,
                      forks: repoData.forks_count,
                      language: repoData.language,
                      open_issues: repoData.open_issues_count,
                      updated_at: repoData.updated_at,
                      topics: repoData.topics
                   };
                   keywords = repoData.topics || [];
                }
              } catch (e) {
                 // Fallback
              }
           }
           
           if (!finalData.stars) {
               const starsMatch = text.match(/aria-label="(\d+) users starred this repository"/);
               if (starsMatch) keywords.push(`⭐ ${starsMatch[1]}`);
           }
        } else if (mode === 'news') {
           if (text.toLowerCase().includes("openai")) keywords.push("OpenAI");
           if (text.toLowerCase().includes("deepseek")) keywords.push("DeepSeek");
           if (text.toLowerCase().includes("anthropic")) keywords.push("Anthropic");
        }
        
        finalData.keywords = keywords;

        return {
          source: url,
          mode,
          extracted_at: new Date().toISOString(),
          summary: finalUrl !== url ? `${summary} (via proxy)` : summary,
          data: finalData
        };
      } catch (e: any) {
        if (String(e?.message ?? e).includes("mcp_permission_denied:external_fetch_blocked_by_governance")) {
          return {
            source: url,
            mode,
            extracted_at: new Date().toISOString(),
            summary: "Extraction Blocked (Governance)",
            data: { ok: false, error: { code: "mcp_permission_denied", message: "external_fetch_blocked_by_governance" } },
            error: "mcp_permission_denied:external_fetch_blocked_by_governance"
          };
        }
        if (String(e).includes("Failed to fetch") || String(e).includes("NetworkError")) {
           return {
            source: url,
            mode,
            extracted_at: new Date().toISOString(),
            summary: "Extraction Blocked (CORS)",
            data: {},
            error: "Browser blocked request. Use MCP 'fetch' tool instead."
          };
        }
        throw e;
      }

    } catch (e: any) {
      return {
        source: url,
        mode,
        extracted_at: new Date().toISOString(),
        summary: "Extraction Failed",
        data: {},
        error: e.message
      };
    }
  }
}

export const extractionService = new ExtractionService();
