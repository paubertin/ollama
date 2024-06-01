import { Ollama } from '@langchain/community/llms/ollama';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { InMemoryChatMessageHistory } from '@langchain/core/chat_history';
import { RunnableWithMessageHistory, RunnableConfig } from '@langchain/core/runnables';
import { CheerioWebBaseLoader } from '@langchain/community/document_loaders/web/cheerio';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OllamaEmbeddings } from '@langchain/community/embeddings/ollama';
import { createRetrieverTool } from 'langchain/tools/retriever';
import { AgentExecutor, createOpenAIFunctionsAgent } from 'langchain/agents';
import { ChatOllama } from '@langchain/community/chat_models/ollama';
import { pull } from 'langchain/hub';
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { ChromaClient } from "chromadb";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { LanceDB } from "@langchain/community/vectorstores/lancedb";
import { connect } from "vectordb";
import { mkdir } from 'fs/promises';

async function getStore () {
  const dirPath = '/media/scal/Data1/scal/dev/ollama/src/database/lancedb';
  const dir = await mkdir(dirPath, { recursive: true });
  const db = await connect(dirPath);

  await db.createTable('vectors', []);

  return dirPath;
}

async function main () {
  const model = new ChatOllama({
    model: 'llama3',
    temperature: 1,
  });

  const loader = new CheerioWebBaseLoader(
    'https://docs.smith.langchain.com/user_guide'
  );
  const rawDocs = await loader.load();
  
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  const docs = await splitter.splitDocuments(rawDocs);
  
  const vectorstore = await MemoryVectorStore.fromDocuments(
    docs,
    new OllamaEmbeddings({ model: 'llama3' })
  );

  const retriever = vectorstore.asRetriever();

  const retrieverTool = createRetrieverTool(retriever, {
    name: 'langsmith_search',
    description:
      'Search for information about LangSmith. For any questions about LangSmith, you must use this tool!',
  });

  const tools = [retrieverTool];

  const agent = await createOpenAIFunctionsAgent({
    llm: model,
    tools,
    prompt: await pull<ChatPromptTemplate>(
      'hwchase17/openai-functions-agent'
    ),
  });

  const agentExecutor = new AgentExecutor({
    agent,
    tools,
  });

  const result1 = await agentExecutor.invoke({
    input: "hi!",
  });
  
  console.log(result1);
}

void getStore();