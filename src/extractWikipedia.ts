import fs from "fs";
import path from "path";
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

const dataPath = path.join(__dirname, "tmp_data");

const extractWikipediaTitle = async (title: string) => {
  const fileExists = fs.existsSync(path.join(dataPath, `${title}.txt`));

  if (fileExists) {
    console.log(`Arquivo já existe para o título: ${title}`);
    return;
  }

  const queryParams = new URLSearchParams({
    action: "query",
    format: "json",
    titles: title,
    prop: "extracts",
    explaintext: "true",
  });

  const url = `https://en.wikipedia.org/w/api.php?${queryParams}`;

  const response = await fetch(url);
  const data: any = await response.json();

  const pages = data.query.pages;
  const page = pages[Object.keys(pages)[0]];
  const wikiText = page.extract;

  await new Promise((resolve) => {
    fs.writeFile(path.join(dataPath, `${title}.txt`), wikiText, (err: any) => {
      if (err) {
        console.error(err);
        resolve(title);
        return;
      }
      console.log(`${title} stored!`);

      resolve(title);
    });
  });
};

export const extractWikipedia = async (titles: string[]) => {
  if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath);
  }

  for await (const title of titles) {
    await extractWikipediaTitle(title);
  }

  console.log("Extration finished!");
};

import type { JSONSchemaType } from "ajv";
import { BaseTool, ToolMetadata } from "llamaindex";
import wiki from "./wiki/index.js";

type WikipediaParameter = {
  query: string;
  lang?: string;
};

export type WikipediaToolParams = {
  metadata?: ToolMetadata<JSONSchemaType<WikipediaParameter>>;
};

const DEFAULT_META_DATA: ToolMetadata<JSONSchemaType<WikipediaParameter>> = {
  name: "wikipedia_tool",
  description: "A tool that uses a query engine to search Wikipedia.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The query to search for",
      },
      lang: {
        type: "string",
        description: "The language to search in",
        nullable: true,
      },
    },
    required: ["query"],
  },
};

export class WikipediaTool implements BaseTool<WikipediaParameter> {
  private readonly DEFAULT_LANG = "fr";
  metadata: ToolMetadata<JSONSchemaType<WikipediaParameter>>;

  constructor(params?: WikipediaToolParams) {
    this.metadata = params?.metadata || DEFAULT_META_DATA;
  }

  async loadData(
    page: string,
    lang: string = this.DEFAULT_LANG,
  ): Promise<string> {
    wiki.setLang(lang);
    const pageResult = await wiki.page(page, { autoSuggest: false });
    const content = await pageResult.content();
    return content;
  }

  async call({
    query,
    lang = this.DEFAULT_LANG,
  }: WikipediaParameter): Promise<string> {
    wiki.setLang(lang);
    const searchResult = await wiki.search(query); //  wiki.default.search(query);
    if (searchResult.results.length === 0) return "No search results.";
    return await this.loadData(searchResult.results[0].title, lang);
  }
}

// Dis moi ce que tu sais au sujet du Soanan ?