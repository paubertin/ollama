import mysql from 'mysql2/promise';
import {
  Document,
  Ollama,
  Settings,
  VectorStoreIndex,
  QdrantVectorStore,
  OllamaEmbedding,
  storageContextFromDefaults,
} from 'llamaindex';
import readline from 'node:readline/promises';
import { existsSync, writeFileSync } from 'fs';

const lamaLLM = new Ollama({ model: 'llama3', options: { temperature: 0 } });
Settings.llm = lamaLLM;
Settings.embedModel =  new OllamaEmbedding({ model: 'nomic-embed-text' });;

let dbConnection: mysql.Connection | undefined = undefined;
async function getDbConnection () {
  if (!dbConnection) {
    dbConnection = await mysql.createConnection({
      host: '172.17.0.2',
      user: 'scal',
      password: 'lgce',
      database: 'gly_voirie_dev',
      port: 3306,
    });
  }
  return dbConnection;
}

async function getFullKnownChaussee () {
  const connection = await getDbConnection();
  let query = 'SELECT DISTINCT nom1 as nom FROM `gis_chaussee` ORDER BY nom1 LIMIT 300';
  const result = await connection.query(query);
  return (result[0] as { nom: string }[]).filter((o) => Boolean(o.nom));
}


async function askLama () {
  const knownList = await getFullKnownChaussee();

  let index: VectorStoreIndex;
  if (!existsSync('./storage_gaet')) {
    // writeFileSync('./textdata.json', JSON.stringify(knownList));
    const documents = knownList.map((rue, idx) => new Document({ text: JSON.stringify(rue), id_: String(idx) }));
    // const vectorStore = new QdrantVectorStore({
    //   url: "http://localhost:6333",
    // });
    const storageContext = await storageContextFromDefaults({ /*vectorStore,*/ persistDir: './storage_gaet', });
    index = await VectorStoreIndex.fromDocuments(documents, { storageContext, logProgress: true });
  }
  else {
    // const vectorStore = new QdrantVectorStore({
    //   url: "http://localhost:6333",
    // });
    const storageContext = await storageContextFromDefaults({ /*vectorStore,*/ persistDir: './storage_gaet', });
    index = await VectorStoreIndex.init({ storageContext });
  }

  const queryEngine = index.asQueryEngine();

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  while (true) {
    const query = await rl.question("Query: ");
    console.time('Query');
    const { response } = await queryEngine.query({
      query: `Based on this user query: ${query}, find the best match in your known data.
      It can be exact match.
      The type of road is less important in matching.
      Answer with the exact line corresponding to the data you have in your context. ONLY THIS LINE, NO COMMENT OR EXPLANATIONS`,
    });
    console.log('response', response);
    console.timeEnd('Query')
  }
}

void askLama();
