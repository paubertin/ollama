import ollama, { Message } from 'ollama';

import fs from 'fs/promises'

const systemPrompt = (await fs.readFile('./src/system.prompt')).toString();



interface Task {
  name: string;
  description: string;
}

class Agent {
  public task: Task;
  private llmClient: LLM;

  constructor(task: Task, llmClient: LLM) {
    this.task = task;
    this.llmClient = llmClient;
  }
  public async performTask(context: string): Promise<string> {
    // Utiliser le LLM pour générer une réponse spécifique à la tâche de l'agent
    const prompt = `Perform the following task based on the given context:
Task: ${this.task.name}
Description: ${this.task.description}
Context: ${context}`;

    const response = await this.llmClient.generateCompletion(prompt);

    return response;
  }
}

class LLM {
  public async generateCompletion(prompt: string) {
    console.log('GENERATE COMPLETION FOR: ', prompt);
    const res = await ollama.chat({
      model: 'llama2',
      messages: [
        {
          role: 'user',
          content: prompt,
        }
      ],
    });
    console.log('res: ', res.message.content);
    return res.message.content;
  }
}

class AgentCoordinator {
  private llmClient: LLM;
  private agents: Agent[] = [];

  constructor() {
    this.llmClient = new LLM();
  }
  public async handleUserInput(input: string): Promise<string> {
    const context = await this.enrichContext(input);
    const tasks = await this.parseTasks(context);
    for (const task of tasks) {
      const agent = await this.getOrCreateAgentForTask(task);
      this.agents.push(agent);
    }
    const solution = await this.coordinateAgents(context);
    return solution;
  }

  private async enrichContext(input: string): Promise<string> {
    const prompt = `Enrich the following user input with additional context:
  Input: ${input}`;
    const context = await this.llmClient.generateCompletion(prompt);
    return context;
  }

  private async parseTasks(context: string): Promise<Task[]> {
    const prompt = `Identify the tasks required to address the following context:
  Context: ${context}`;
    const tasksString = await this.llmClient.generateCompletion(prompt);
    const formatPrompt = `Given the following context, your goal is to answer with a JSON array containing the tasks described. YOU MUST ONLY ANSWER WITH A JSON ARRAY and respect the following interface :
    ''' typescript
    interface Task {
      name: string;
      description: string;
    }
    '''
    Do NOT start your answer by something like 'here is a json array...', or anything else.. ONLY put the JSON in your answer, no text or comments neither before or after the array.
    DO NOT start by quotes like '''json ot '''typescript or anything else. ONLY the raw text of the json array The name of an agent MUST be a single word, not a sentence, a, SINGLE word.

    Finally, you HAVE to give AT MOST 4 tasks, NOT MORE. So focus on the most important tasks.

  Context: ${tasksString}`;
    const formattedTasks = await this.llmClient.generateCompletion(formatPrompt);
    const first = formattedTasks.indexOf('[');
    const last = formattedTasks.lastIndexOf(']');
    const tasks: Task[] = JSON.parse(formattedTasks.substring(first, last + 1));
    return tasks;
  }

  private async getOrCreateAgentForTask(task: Task): Promise<Agent> {
    const existingAgent = this.agents.find(a => a.task.name === task.name);
    if (existingAgent) {
      return existingAgent;
    } else {
      const newAgent = new Agent(task, this.llmClient);
      return newAgent;
    }
  }

  private async coordinateAgents(context: string): Promise<string> {
    let solution = context;
    for (const agent of this.agents) {
      const agentResponse = await agent.performTask(solution);
      solution += `\nAgent ${agent.task.name}'s response:\n${agentResponse}`;
    }
    const prompt = `Synthesize a final solution based on the agent responses:
  Context: ${context}
  Agent Responses: ${solution}`;
    const finalSolution = await this.llmClient.generateCompletion(prompt);
    return finalSolution;
  }

}

const coordinator = new AgentCoordinator();
const userInput = 'I need help to write a basic cli rpg game, in NodeJS. I want you to provide a minimal code';
coordinator.handleUserInput(userInput)
  .then(solution => {
    console.log('Final solution:', solution);
  })
  .catch(error => {
    console.error('Error:', error);
  });