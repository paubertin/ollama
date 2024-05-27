import { ChatOllama } from "@langchain/community/chat_models/ollama";
import { Document } from "langchain/document";
import { PuppeteerWebBaseLoader } from "langchain/document_loaders/web/puppeteer";
import { OllamaEmbeddings } from "langchain/embeddings/ollama";
import { ChatPromptTemplate } from "langchain/prompts";
import { CharacterTextSplitter } from "langchain/text_splitter";
import { Chroma } from "langchain/vectorstores/chroma";

const model = new ChatOllama({ model: 'llama2' });

const urls = [
  "https://ollama.com/",
  "https://ollama.com/blog/windows-preview",
  "https://ollama.com/blog/openai-compatibility",
];

// Load documents from URLs
const loadDocuments = async (urls: string[]) => {
  const loadedDocs = await Promise.all(urls.map(url => new PuppeteerWebBaseLoader(url).load()));
  return loadedDocs.flat();
};

// Split documents into chunks
const splitDocuments = (docs: Document[]) => {
  const text_splitter = new CharacterTextSplitter({ chunkSize: 7500, chunkOverlap: 100 });
  return text_splitter.splitDocuments(docs);
};

// Convert documents to embeddings and store them
const convertToEmbeddings = async (doc_splits: Document[]) => {
  const vectorstore = await Chroma.fromDocuments(doc_splits, new OllamaEmbeddings({ model: 'nomic-embed-text' }), { collectionName: 'rag-chroma' });
  return vectorstore.asRetriever();
};

// Define before RAG chain
const beforeRagChain = async () => {
  const docsList = await loadDocuments(urls);
  const docSplits = await splitDocuments(docsList);
  const retriever = await convertToEmbeddings(docSplits);

  console.log("Before RAG\n");

  const beforeRagTemplate = "What is {topic}";
  const beforeRagPrompt = ChatPromptTemplate.fromTemplate(beforeRagTemplate);
  const beforeRagOutput = await beforeRagPrompt.invoke({ topic: "Ollama" });
  console.log(beforeRagOutput);
};

void beforeRagChain();