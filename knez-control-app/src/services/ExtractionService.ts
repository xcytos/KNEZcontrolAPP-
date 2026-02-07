
import { knezClient } from "./KnezClient";

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
  
  async extract(url: string, mode: ExtractionMode): Promise<ExtractionResult> {
    try {
      if (url.includes("knez-internal")) {
         await knezClient.addKnowledge({ title: "Extraction", content: url });
      }

      const response = await fetch(url);
      if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
      
      const text = await response.text();
      
      let summary = `Extracted ${text.length} chars.`;
      let keywords: string[] = [];
      let finalData: any = {
         title: "Unknown Title", // We can't easily parse DOM without DOMParser in pure TS service if not in browser context, but we are in browser context here (React app)
         keywords,
         content_snippet: text.substring(0, 500) + "..."
      };
      
      // Attempt DOM parsing if in browser
      if (typeof DOMParser !== 'undefined') {
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        finalData.title = doc.title || "No Title";
        // Extract meta description
        const metaDesc = doc.querySelector('meta[name="description"]')?.getAttribute('content');
        if (metaDesc) finalData.description = metaDesc;
      }

      if (mode === 'github') {
         const repoMatch = url.match(/github\.com\/([^/]+)\/([^/]+)/);
         if (repoMatch) {
            try {
              const apiUrl = `https://api.github.com/repos/${repoMatch[1]}/${repoMatch[2]}`;
              const apiResp = await fetch(apiUrl);
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
        summary,
        data: finalData
      };

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
