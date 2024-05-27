import fs, { rm } from "node:fs/promises";

import AudioRecorder from 'node-audiorecorder';

import {
  ChatHistory,
  ClipEmbedding,
  Document,
  IngestionPipeline,
  MetadataMode,
  NodeWithScore,
  ObjectIndex,
  Ollama,
  QueryEngineTool,
  QuestionsAnsweredExtractor,
  ReActAgent,
  RouterQueryEngine,
  Settings,
  SimilarityType,
  SimpleChatEngine,
  SimpleChatHistory,
  SimpleDirectoryReader,
  SimpleNodeParser,
  SimpleToolNodeMapping,
  SummaryExtractor,
  SummaryIndex,
  TitleExtractor,
  VectorStoreIndex,
  similarity,
  storageContextFromDefaults,
} from "llamaindex";

import { WikipediaTool, extractWikipedia } from "./extractWikipedia.js";
import { createInterface } from "readline/promises";
import { stdin, stdout } from "node:process";
import { createWriteStream } from "node:fs";
import { exec } from 'child_process';
import { promisify } from 'util';

import textToSpeech from '@google-cloud/text-to-speech';

const execPromise = promisify(exec);

const wikiTitles = ["Brazil", "Canada"];

const ollama = new Ollama({ model: "llama3", options: { temperature: 0 } });

// Use Ollama LLM and Embed Model
Settings.llm = ollama;
Settings.embedModel = ollama;

// Settings.callbackManager.on('llm-tool-call', (e) => {
//   console.log(e);
// });


async function main() {
  /*
  await extractWikipedia(wikiTitles);

  const countryDocs: Record<string, Document> = {};

  for (const title of wikiTitles) {
    const path = `./src/tmp_data/${title}.txt`;
    const text = await fs.readFile(path, "utf-8");
    const document = new Document({ text: text, id_: path });
    countryDocs[title] = document;
  }

  const storageContext = await storageContextFromDefaults({
    persistDir: "./storage",
  });

  // TODO: fix any
  const documentAgents: any = {};
  const queryEngines: any = {};

  for (const title of wikiTitles) {
    console.log(`Processing ${title}`);

    const nodes = new SimpleNodeParser({
      chunkSize: 200,
      chunkOverlap: 20,
    }).getNodesFromDocuments([countryDocs[title]]);

    console.log(`Creating index for ${title}`);

    const vectorIndex = await VectorStoreIndex.init({
      storageContext: storageContext,
      nodes,
    });

    const summaryIndex = await SummaryIndex.init({
      nodes,
    });

    console.log(`Creating query engines for ${title}`);

    const vectorQueryEngine = summaryIndex.asQueryEngine();
    const summaryQueryEngine = summaryIndex.asQueryEngine();

    const queryEngineTools = [
      new QueryEngineTool({
        queryEngine: vectorQueryEngine,
        metadata: {
          name: "vector_tool",
          description: `Useful for questions related to specific aspects of ${title} (e.g. the history, arts and culture, sports, demographics, or more).`,
        },
      }),
      new QueryEngineTool({
        queryEngine: summaryQueryEngine,
        metadata: {
          name: "summary_tool",
          description: `Useful for any requests that require a holistic summary of EVERYTHING about ${title}. For questions about more specific sections, please use the vector_tool.`,
        },
      }),
    ];

    console.log(`Creating agents for ${title}`);

    const agent = new ReActAgent({
      tools: queryEngineTools,
      llm: ollama,
    });

    documentAgents[title] = agent;
    queryEngines[title] = vectorIndex.asQueryEngine();
  }

  const allTools: QueryEngineTool[] = [];

  console.log(`Creating tools for all countries`);

  for (const title of wikiTitles) {
    const wikiSummary = `This content contains Wikipedia articles about ${title}. Use this tool if you want to answer any questions about ${title}`;

    console.log(`Creating tool for ${title}`);

    const docTool = new QueryEngineTool({
      queryEngine: documentAgents[title],
      metadata: {
        name: `tool_${title}`,
        description: wikiSummary,
      },
    });

    allTools.push(docTool);
  }

  console.log("creating tool mapping");

  const toolMapping = SimpleToolNodeMapping.fromObjects(allTools);

  const objectIndex = await ObjectIndex.fromObjects(
    allTools,
    toolMapping,
    VectorStoreIndex,
  );

  const topAgent = new ReActAgent({
    toolRetriever: await objectIndex.asRetriever({}),
    llm: ollama,
    chatHistory: [
      {
        content:
          "You are an agent designed to answer queries about a set of given countries. Please always use the tools provided to answer a question. Do not rely on prior knowledge.",
        role: "system",
      },
    ],
  });

  const response = await topAgent.chat({
    message: "Tell me the differences between Brazil and Canada history?",
  });

  console.log(response);
  */

  const chat = new SimpleChatEngine({
    llm: ollama,
    chatHistory: new SimpleChatHistory({
      messages: [
        {
          role: 'system',
          content: 'ALWAYS ANSWER IN FRENCH',
        }
      ],
    }),
  });


  const rl = createInterface({
    input: stdin,
    output: stdout,
  })
  /*
  const agent = new ReActAgent({
    llm: ollama,
    tools: [ new WikipediaTool() ],
    verbose: false,
  });
  */
  const client = new textToSpeech.TextToSpeechClient({
    credentials: {
      "client_id": "764086051850-6qr4p6gpi6hn506pt8ejuq83di341hur.apps.googleusercontent.com",
      "client_secret": "d-FL95Q19q7MQmFpd7hHD0Ty",
      "quota_project_id": "fifth-glider-387220",
      "refresh_token": "1//03w5IfBu6fmXuCgYIARAAGAMSNwF-L9Ir3cC1YZRB18IiYuu64bJdpwS_QWoXDeqVG19D9QjaSGyNETP6biuy2ViCVQW7XCsRJAk",
      "type": "authorized_user"
    }
  });

  while (true) {
    console.log();
    const query = await rl.question('[User]: ');
    /*
    try {

      const response = await agent.chat({
        message: query,
        chatHistory: [
          {
            content: 'Always answer in french',
            role: "system",
          },
        ],
        stream: true,
      });
      for await (const res of response) {
        process.stdout.write(res.response.delta);
      }
    }
    catch (e) {
      console.error(e);
    }
    */
    const stream = await chat.chat({ message: query, stream: false });
    console.log(stream.response);
    const request: textToSpeech.protos.google.cloud.texttospeech.v1.ISynthesizeSpeechRequest = {
      input: { text: stream.response },
      // Select the language and SSML voice gender (optional)
      voice: { languageCode: 'en-US', ssmlGender: 'NEUTRAL' },
      // select the type of audio encoding
      audioConfig: { audioEncoding: 'MP3' },
    };
    const [response] = await client.synthesizeSpeech(request);
    const res = await fetch(`https://api.streamelements.com/kappa/v2/speech?voice=fr-FR-Wavenet-B&text=${stream.response}`);
    if (res.status === 200) {
      const blob = await res.blob();
      const buffer = await blob.arrayBuffer();
      createWriteStream('speech.mp3').write(Buffer.from(buffer));
      await execPromise('mpg123 ./speech.mp3', { windowsHide: true });
      await rm('./speech.mp3');
    }
    else {
      console.error(`Request failed with status code ${res.status}`);
    }

    /*
    for await (const chunk of stream) {
      process.stdout.write(chunk.response);

    }
    */

  }
}


async function rag() {
  // Load essay from abramov.txt in Node
  const path = "./data.txt";

  const essay = await fs.readFile(path, "utf-8");

  // Create Document object with essay
  const document = new Document({ text: essay, id_: path, });

  // Split text and create embeddings. Store them in a VectorStoreIndex
  const index = await VectorStoreIndex.fromDocuments([document]);

  // Query the index
  const queryEngine = index.asQueryEngine();

  const rl = createInterface({
    input: stdin,
    output: stdout,
  });

  while (true) {
    console.log();
    const query = await rl.question('[User]: ');

    const { response, sourceNodes } = await queryEngine.query({
      query: `${query}\nANSWER IN FRENCH`,
    });

    // Output response with sources
    console.log(response);

    /*
    if (sourceNodes) {
      sourceNodes.forEach((source: NodeWithScore, index: number) => {
        console.log(
          `\n${index}: Score: ${source.score} - ${source.node.getContent(MetadataMode.NONE).substring(0, 50)}...\n`,
        );
      });
    }
    */
  }

}

async function agent() {
  const reader = new SimpleDirectoryReader();
  const documents = await reader.loadData("./data");
  const index = await VectorStoreIndex.fromDocuments(documents);
  const retriever = index.asRetriever({ similarityTopK: 10 });
  const queryEngine = index.asQueryEngine({
    retriever,
  });

  // define the query engine as a tool
  const tools = [
    new QueryEngineTool({
      queryEngine: queryEngine,
      metadata: {
        name: "san_francisco_budget_tool",
        description: `This tool can answer detailed questions about the individual components of the budget of San Francisco in 2023-2024.`,
      },
    }),
  ];

  // create the agent
  const agent = new ReActAgent({ llm: ollama, tools });

  let response = await agent.chat({
    message: "What's the budget of San Francisco in 2023-2024?",
  });

  console.log(response);

}

async function simpleChat() {

  const chat = new SimpleChatEngine({
    llm: ollama,
    chatHistory: new SimpleChatHistory({
      messages: [
        {
          role: 'system',
          content: 'Answer in french. ALWAYS ACT AS IF YOU WERE A REAL HUMAN. ANSWER LIKE A HUMAN. NEVER MENTION THAT YOU ARE AN AI OR A LANGUAGE MODEL.',
        }
      ],
    }),
  });

  const rl = createInterface({
    input: stdin,
    output: stdout,
  });

  while (true) {
    console.log();
    const query = await rl.question('[User]: ');
    const answer = await chat.chat({
      message: query,
    });
    console.log(answer.response);
  }
}

async function metadata() {

  const clip = new ClipEmbedding();

  // Get text embeddings
  const text1 = "a car";
  const textEmbedding1 = await clip.getTextEmbedding(text1);
  const text2 = "a football match";
  const textEmbedding2 = await clip.getTextEmbedding(text2);

  // Get image embedding
  const image =
    "https://www.automobile-magazine.fr/asset/cms/840x394/73570/config/56401/ce-scenic-se-passe-des-feux-de-jour-a-diodes-situes-sous-les-phares-de-certaines-renault-megane-koleos-ou-talisman.jpg";
  const imageEmbedding = await clip.getImageEmbedding(image);

  // Calc similarity
  const sim1 = similarity(
    textEmbedding1,
    imageEmbedding,
    SimilarityType.DEFAULT,
  );
  const sim2 = similarity(
    textEmbedding2,
    imageEmbedding,
    SimilarityType.DEFAULT,
  );

  console.log(`Similarity between "${text1}" and the image is ${sim1}`);
  console.log(`Similarity between "${text2}" and the image is ${sim2}`);

}

import NodeMic from 'node-mic';
import { spawn, spawnSync } from "node:child_process";

async function audio() {
  const mic = new NodeMic({
    rate: 16000,
    channels: 1,
    threshold: 6,
    fileType: 'wav',
  });

  const micInputStream = mic.getAudioStream();
  const outputFileStream = createWriteStream('output.wav');

  micInputStream.pipe(outputFileStream);

  micInputStream.on('data', (data) => {
    // Do something with the data.
  });

  micInputStream.on('error', (err) => {
    console.log(`Error: ${err.message}`);
  });

  micInputStream.on('started', () => {
    console.log('Started');
  });

  micInputStream.on('stopped', () => {
    console.log('Stopped');

  });

  micInputStream.on('paused', () => {
    console.log('Paused');
    setTimeout(() => {
      mic.resume();
    }, 5000);
  });

  micInputStream.on('unpaused', () => {
    console.log('Unpaused');
    setTimeout(() => {
      mic.stop();
    }, 5000);
  });

  micInputStream.on('silence', () => {
    console.log('Silence');
  });

  micInputStream.on('exit', (code) => {
    console.log(`Exited with code: ${code}`);
  });

  mic.start();
  setTimeout(() => {
    mic.stop();
    console.log('ffmpeg');
    exec('sox -t wav -r 16000 -c 1 ./output.wav -t mp3 ./output.mp3', (error, stdout, stderr) => {
      if (error) {
        console.error(`error: ${error.message}`);
        return;
      }
    
      if (stderr) {
        console.error(`stderr: ${stderr}`);
        return;
      }
    
      console.log(`stdout:\n${stdout}`);
    });
    // ret.on('error', (e) => console.error(e));
    // ret.on('message', (m) => console.log(m));
    console.log('done');
  }, 2000);

}

audio().catch(console.error);
