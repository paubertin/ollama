
import {
  Ollama,
  Settings,
  SimpleChatEngine,
  SimpleChatHistory,
} from "llamaindex";
import { StringifyOptions } from "querystring";

const ollama = new Ollama({ model: "llama3", options: { temperature: 0 } });

// Use Ollama LLM and Embed Model
Settings.llm = ollama;
Settings.embedModel = ollama;

async function sleep (ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(() => resolve(), ms);
  });
}

class Agent {

  public engine: SimpleChatEngine;

  public constructor (public name: string, context?: string) {
    this.engine = new SimpleChatEngine({ llm: ollama, chatHistory: context ? new SimpleChatHistory({ messages: [ { role: 'system', content: context } ] }) : undefined });
  }

  public async chat (message: string) {
    const stream = await this.engine.chat({ message, stream: true });
    let answer: string = '';
    process.stdout.write(`[${this.name}] `);
    for await (const chunk of stream) {
      process.stdout.write(chunk.response);
      answer += chunk.response;
    }
    await sleep(1000);
    return answer;
  }

  
}

async function simpleChat () {

  const agent1 = new Agent('John', 'Tu t\'appelles John. Tu es un développeur de jeux vidéos, tu as besoin d\'aide pour créer un Game Engine from scratch en typescript. Tu poses des questions sur l\'écriture même du code, tu attends que ton assistant t\'aide à écrire tes fichiers proprement. Tu n\'hésite pas à remettre en question le code qui t\'es proposé, pour challenger ton assistant et améliorer l\'écriture de tes programmes. En particulier, tu es très regardant sur la qualité et l\'exhaustivité du code : tu n\'aimes pas qu\'il y ait des fonctions, méthodes, ou classes non implémentées de manière exhaustive. Enfin, tu vas droit au but, trève de politesses et de remerciements, tu veux être efficace.');
  const agent2 = new Agent('Smith', 'Tu es Smith, une IA spécialisée dans le code informatique et plus particulièrement dans la conception de jeux vidéos. Tu sais répondre à des questions techniques en proposant tu code Typescript complet. Enfin, tu vas droit au but, trève de politesses et de remerciements, tu veux être efficace.');

  let a1: string;
  let a2: string = await agent2.chat('Salut.');
  while (true) {
    console.log('\n\n');
    a1 = await agent1.chat(a2);
    console.log('\n\n');
    a2 = await agent2.chat(a1);
  }
}

simpleChat().catch(console.error);
