import { writeFile } from 'fs/promises';
import ollama from 'ollama';
import { createInterface } from 'readline/promises';
import weaviate, { Collection, FilterValue, Filters, WeaviateClient, WeaviateNonGenericObject } from 'weaviate-client';

const tests = [
  {
    input: "ma mère habite au 39 rue Professeur Patel à Lyon 9",
    output: { "fullText": "39 rue Professeur Patel à Lyon 9", "voie": "39 rue Professeur Patel", "commune": "Lyon 9e Arrondissement" }
  },
  {
    input: "je bosse rue Magenta à Tassin",
    output: { "fullText": "rue Magenta à Tassin", "voie": "rue Magenta", "commune": "Tassin-la-Demi-Lune" }
  },
  {
    input: "ma tante vit boulevard des Belges à Villeurban",
    output: { "fullText": "boulevard des Belges à Villeurban", "voie": "boulevard des Belges", "commune": "Villeurbanne" }
  },
  {
    input: "je vais souvent au parc rue de Sèze à Lyon 6",
    output: { "fullText": "rue de Sèze à Lyon 6", "voie": "rue de Sèze", "commune": "Lyon 6e Arrondissement" }
  },
  {
    input: "on se retrouve au 23 rue Jean Jaurès à Bron",
    output: { "fullText": "23 rue Jean Jaurès à Bron", "voie": "23 rue Jean Jaurès", "commune": "Bron" }
  },
  {
    input: "j'ai rendez-vous rue Victor Hugo à Lyon 2e arr",
    output: { "fullText": "rue Victor Hugo à Lyon 2e arr", "voie": "rue Victor Hugo", "commune": "Lyon 2e Arrondissement" }
  },
  {
    input: "ils habitent au 8 allée du Parc à Caluire",
    output: { "fullText": "8 allée du Parc à Caluire", "voie": "8 allée du Parc", "commune": "Caluire-et-Cuire" }
  },
  {
    input: "je travaille avenue de l'Europe à Mezieu",
    output: { "fullText": "avenue de l'Europe à Mezieu", "voie": "avenue de l'Europe", "commune": "Meyzieu" }
  },
  {
    input: "elle habite au 12 rue Franklin Roosevelt à Rieux-la-Pape",
    output: { "fullText": "12 rue Franklin Roosevelt à Rieux-la-Pape", "voie": "12 rue Franklin Roosevelt", "commune": "Rillieux-la-Pape" }
  },
  {
    input: "je suis passé chez toi au 10 rue Pasteur à Venissieux",
    output: { "fullText": "10 rue Pasteur à Venissieux", "voie": "10 rue Pasteur", "commune": "Vénissieux" }
  },
  {
    input: "on a un bureau rue de la Liberté à Saint-Priest",
    output: { "fullText": "rue de la Liberté à Saint-Priest", "voie": "rue de la Liberté", "commune": "Saint-Priest" }
  },
  {
    input: "ma sœur a une boutique avenue des Tuileries à Lyon 3eme",
    output: { "fullText": "avenue des Tuileries à Lyon 3eme", "voie": "avenue des Tuileries", "commune": "Lyon 3e Arrondissement" }
  },
  {
    input: "je connais une bonne boulangerie rue des Acacias à Saint-Fons",
    output: { "fullText": "rue des Acacias à Saint-Fons", "voie": "rue des Acacias", "commune": "Saint-Fons" }
  },
  {
    input: "il vit au 5 chemin de la Forêt à Dardilli",
    output: { "fullText": "5 chemin de la Forêt à Dardilli", "voie": "5 chemin de la Forêt", "commune": "Dardilly" }
  },
  {
    input: "je passe souvent par la rue de la Gare à Chassieu",
    output: { "fullText": "rue de la Gare à Chassieu", "voie": "rue de la Gare", "commune": "Chassieu" }
  },
  {
    input: "nous avons acheté une maison rue des Écoles à Vaulx-en-Vallin",
    output: { "fullText": "rue des Écoles à Vaulx-en-Vallin", "voie": "rue des Écoles", "commune": "Vaulx-en-Velin" }
  },
  {
    input: "je me suis perdu rue de Verdun à Lyon 1er",
    output: { "fullText": "rue de Verdun à Lyon 1er", "voie": "rue de Verdun", "commune": "Lyon 1er Arrondissement" }
  },
  {
    input: "on mange au restaurant rue des Marronniers à Lyon 2",
    output: { "fullText": "rue des Marronniers à Lyon 2", "voie": "rue des Marronniers", "commune": "Lyon 2e Arrondissement" }
  },
  {
    input: "mon collègue habite rue de la République à Oullin",
    output: { "fullText": "rue de la République à Oullin", "voie": "rue de la République", "commune": "Oullins" }
  },
  {
    input: "j'ai visité un appartement rue des Pins à Francheville",
    output: { "fullText": "rue des Pins à Francheville", "voie": "rue des Pins", "commune": "Francheville" }
  },
  {
    input: "ils ont un atelier rue des Violettes à Decines-Charpieu",
    output: { "fullText": "rue des Violettes à Decines-Charpieu", "voie": "rue des Violettes", "commune": "Décines-Charpieu" }
  },
  {
    input: "je vais à la salle de sport rue du Fort à Sainte-Foy-les-Lyon",
    output: { "fullText": "rue du Fort à Sainte-Foy-les-Lyon", "voie": "rue du Fort", "commune": "Sainte-Foy-lès-Lyon" }
  },
  {
    input: "on a un projet immobilier rue des Rosiers à Tassin-la-Demi Lune",
    output: { "fullText": "rue des Rosiers à Tassin-la-Demi Lune", "voie": "rue des Rosiers", "commune": "Tassin-la-Demi-Lune" }
  },
  {
    input: "elle travaille au 18 avenue des Champs à Lyon 7eme",
    output: { "fullText": "18 avenue des Champs à Lyon 7eme", "voie": "18 avenue des Champs", "commune": "Lyon 7e Arrondissement" }
  },
  {
    input: "je passe souvent par l'avenue des Platanes à Givor",
    output: { "fullText": "avenue des Platanes à Givor", "voie": "avenue des Platanes", "commune": "Givors" }
  },
  {
    input: "hier je suis allé manger rue de la République",
    output: { "fullText": "rue de la République", "voie": "rue de la République", "commune": null }
  },
  {
    input: "j'ai déménagé au 15 avenue des Frères Lumière",
    output: { "fullText": "15 avenue des Frères Lumière", "voie": "15 avenue des Frères Lumière", "commune": null }
  },
  {
    input: "j'ai trouvé un chat perdu rue du 4 Août",
    output: { "fullText": "rue du 4 Août", "voie": "rue du 4 Août", "commune": null }
  },
  {
    input: "je prends le bus rue des Cerisiers",
    output: { "fullText": "rue des Cerisiers", "voie": "rue des Cerisiers", "commune": null }
  },
  {
    input: "j'adore me promener rue des Jardins",
    output: { "fullText": "rue des Jardins", "voie": "rue des Jardins", "commune": null }
  },
  {
    input: "on se voit au café rue des Alouettes",
    output: { "fullText": "rue des Alouettes", "voie": "rue des Alouettes", "commune": null }
  },
  {
    input: "elle habite rue du Faubourg",
    output: { "fullText": "rue du Faubourg", "voie": "rue du Faubourg", "commune": null }
  },
  {
    input: "je travaille rue de la Mairie",
    output: { "fullText": "rue de la Mairie", "voie": "rue de la Mairie", "commune": null }
  },
  {
    input: "on se retrouve rue des Tilleuls",
    output: { "fullText": "rue des Tilleuls", "voie": "rue des Tilleuls", "commune": null }
  },
  {
    input: "ils ont une boutique rue de la Poste",
    output: { "fullText": "rue de la Poste", "voie": "rue de la Poste", "commune": null }
  },
  {
    input: "je vis rue de la Gare",
    output: { "fullText": "rue de la Gare", "voie": "rue de la Gare", "commune": null }
  },
  {
    input: "elle habite rue des Fleurs",
    output: { "fullText": "rue des Fleurs", "voie": "rue des Fleurs", "commune": null }
  },
  {
    input: "je vais souvent au marché rue des Artisans",
    output: { "fullText": "rue des Artisans", "voie": "rue des Artisans", "commune": null }
  },
  {
    input: "on a une réunion rue de l'Église",
    output: { "fullText": "rue de l'Église", "voie": "rue de l'Église", "commune": null }
  },
  {
    input: "je fais du sport rue des Peupliers",
    output: { "fullText": "rue des Peupliers", "voie": "rue des Peupliers", "commune": null }
  },
  {
    input: "elle habite rue de la Fontaine",
    output: { "fullText": "rue de la Fontaine", "voie": "rue de la Fontaine", "commune": null }
  },
  {
    input: "on se voit rue de la Plage",
    output: { "fullText": "rue de la Plage", "voie": "rue de la Plage", "commune": null }
  },
  {
    input: "j'adore courir rue des Acacias",
    output: { "fullText": "rue des Acacias", "voie": "rue des Acacias", "commune": null }
  },
  {
    input: "ils ont un magasin rue du Commerce",
    output: { "fullText": "rue du Commerce", "voie": "rue du Commerce", "commune": null }
  },
  {
    input: "je me promène rue des Églantines",
    output: { "fullText": "rue des Églantines", "voie": "rue des Églantines", "commune": null }
  },
  {
    input: "elle habite rue de la Liberté",
    output: { "fullText": "rue de la Liberté", "voie": "rue de la Liberté", "commune": null }
  },
  {
    input: "je vais à l'école rue des Érables",
    output: { "fullText": "rue des Érables", "voie": "rue des Érables", "commune": null }
  },
  {
    input: "on se retrouve rue des Roses",
    output: { "fullText": "rue des Roses", "voie": "rue des Roses", "commune": null }
  },
  {
    input: "je prends le métro rue de la République",
    output: { "fullText": "rue de la République", "voie": "rue de la République", "commune": null }
  },
  {
    input: "ils ont une maison rue des Bouleaux",
    output: { "fullText": "rue des Bouleaux", "voie": "rue des Bouleaux", "commune": null }
  },
];

const communes = ['Lyon', 'Villeurbanne', 'Meyzieu', 'Saint-Priest', 'Vaulx-en-Velin', 'Vénissieux', 'Lyon 3e Arrondissement', 'Mions', 'Bron', 'Décines-Charpieu', 'Caluire-et-Cuire', 'Rillieux-la-Pape', 'Lyon 9e Arrondissement', 'Chassieu', 'Lyon 7e Arrondissement', 'Givors', 'Saint-Genis-Laval', 'Lyon 8e Arrondissement', 'Corbas', 'Lyon 5e Arrondissement', 'Lyon 2e Arrondissement', 'Lyon 1er Arrondissement', 'Feyzin', 'Jonage', 'Oullins', 'Sainte-Foy-lès-Lyon', "Saint-Didier-au-Mont-d'Or", 'Tassin-la-Demi-Lune', 'Francheville', 'Saint-Fons', 'Dardilly', 'Craponne', 'Lyon 4e Arrondissement', 'Écully', 'Lyon 6e Arrondissement', 'Saint-Genis-les-Ollières', "Saint-Cyr-au-Mont-d'Or", 'Neuville-sur-Saône', 'Quincieux', 'Irigny', 'Pierre-Bénite', 'La Tour-de-Salvagny', 'Genay', 'Montanay', 'Limonest', 'Charbonnières-les-Bains', 'Lissieu', "Couzon-au-Mont-d'Or", 'Vernaison', 'Grigny', 'Charly', "Saint-Germain-au-Mont-d'Or", "Collonges-au-Mont-d'Or", "Champagne-au-Mont-d'Or", "Poleymieux-au-Mont-d'Or", 'Solaize', 'Sathonay-Village', "Saint-Romain-au-Mont-d'Or", "Marcy-l'Étoile", 'Fontaines-Saint-Martin', 'Cailloux-sur-Fontaines', "Curis-au-Mont-d'Or", 'Sathonay-Camp', 'Fontaines-sur-Saône', 'Albigny-sur-Saône', 'Fleurieu-sur-Saône', 'La Mulatière', 'Rochetaillée-sur-Saône'];

const systemMessage = `Ceci est une conversation entre un utilisateure (humain) et un assistant (intelligence artificielle).
L'utilisateur va proposer une phrase, qui peut contenir une adresse.
Le but de l'assistant est d'identifier la partie adresse dans cela. L'adresse peut être uniquement l'indication de voirie (rue, boulevard, place, etc...), ou bien la voirie + une commune.
L'assistant doit répondre uniquement sous format JSON de la sorte : 
'''
{
"fullText": "la partie contenant l'adresse",
"voie": "la partie voirie de l'adresse",
"commune": "la partie commune de l'adresse, peut être null si non trouvée"
}
'''

L'ASSISTANT DOIT OBLIGATOIREMENT, S'IL SPECIFIE UNE COMMUNE, LA SELECTIONNER PARMI LA LISTE SUIVANTE :
${communes.join(' / ')}

Ainsi, s'il identifie comme commune "Lyon 6", il prendra la valeur "Lyon 6e Arrondissement".
S'il identifie comme commune "Neuville", il prendra la valeur "Neuville-sur-Saône".

Exemples :
- "j'habite rue Pr. Patel" => réponse attendue :
'''
{
"fullText": "rue Pr. Patel",
"voie": "rue Pr. Patel",
"commune": null
}

- "j'habite au 39 place des matrys a Lyon" => réponse attendue :
'''
{
"fullText": "39 place des matrys a Lyon",
"voie": "39 place des matrys",
"commune": "Lyon"
}

- "Le lundi je nettoie la rue Alphone Allais à Curis, avant de rentrer manger" => réponse attendue :
'''
{
"fullText": "rue Alphone Allais à Curis",
"voie": "rue Alphone Allais",
"commune": "Curis-au-Mont-d'Or"
}
'''

Dernier point, l'assistant DOIT obligatoirement répondre uniquement par le JSON décrit ci dessus. Aucun autre commentaire, pas de quotes en plus, UNIQUEMENT le JSON.
`;

const chatGPTSystemMessage = `Tu es un assistant virtuel dont la tâche est d'analyser une phrase contenant une adresse et d'identifier la partie adresse, la partie voirie et la partie commune. Voici comment tu dois procéder :

1. Identifier la partie adresse de l'entrée utilisateur.
2. Identifier la partie "voie" (par exemple, rue, avenue, boulevard, etc.).
3. Identifier la commune et la corriger sur la base de la liste suivante :
${communes.map(c => `- ${c}`).join('\n')}

4. Formater la réponse sous forme de JSON avec les informations suivantes :
{
    "fullText": "la partie de l'entrée utilisateur identifiée comme adresse (par exemple: 'rue Professeur Patel à Lyon 9')",
    "voie": "la partie de l'adresse identifiée comme partie voirie (par exemple : 'rue Professeur Patel')",
    "commune": "le libellé de la commune corrigé (par exemple: 'Lyon 9e Arrondissement'). Peut prendre la valeur null si aucune commune n'est identifiée dans fullText"
}

Réponds toujours au format JSON. Si la commune n'est pas trouvée dans la liste, mets "commune" à null.
Exemple d'entrée utilisateur : "j'habite rue Professeur Patel à Lyon 9"
Exemple de réponse attendue :
{
    "fullText": "rue Professeur Patel à Lyon 9",
    "voie": "rue Professeur Patel",
    "commune": "Lyon 9e Arrondissement"
}
`;

const simpleSystemMessage = `Tu es un assistant virtuel dont la tâche est d'analyser une phrase contenant une adresse et d'identifier la partie adresse, la partie voirie et la partie commune. Voici comment tu dois procéder :

1. Identifier la partie adresse de l'entrée utilisateur.
2. Identifier la partie "voie" (par exemple, rue, avenue, boulevard, etc.).
3. Identifier la partie "commune" si elle est présente (par exemple, "Lyon", "Paris", etc.)

4. Formater la réponse sous forme de JSON avec les informations suivantes :
{
    "fullText": "la partie de l'entrée utilisateur identifiée comme adresse (par exemple: 'rue Professeur Patel à Lyon 9')",
    "voie": "la partie de l'adresse identifiée comme partie voirie (par exemple : 'rue Professeur Patel')",
    "commune": "la partie de l'adresse identifiée comme partie commune (par exemple: 'Lyon 9e Arrondissement'). Peut prendre la valeur null si aucune commune n'est identifiée dans fullText"
}

Réponds toujours au format JSON. Si la commune n'est pas trouvée dans la liste, mets "commune" à null.
Exemple d'entrée utilisateur : "j'habite rue Professeur Patel à Lyon 9"
Exemple de réponse attendue :
{
    "fullText": "rue Professeur Patel à Lyon 9",
    "voie": "rue Professeur Patel",
    "commune": "Lyon 9"
}`;

const simpleMessage = `Ceci est une conversation entre un utilisateur (humain) et un assistant (intelligence artificielle).
L'utilisateur va proposer une phrase, qui peut contenir une adresse.
Le but de l'assistant est d'identifier la partie adresse dans cela. L'adresse peut être uniquement l'indication de voirie (rue, boulevard, place, etc...), ou bien la voirie + une commune.
L'assistant doit répondre uniquement sous format JSON de la sorte : 
'''
{
"fullText": "la partie contenant l'adresse",
"voie": "la partie voirie de l'adresse",
"commune": "la partie commune de l'adresse, peut être null si non trouvée"
}
'''

Exemples :
- "j'habite rue Pr. Patel" => réponse attendue :
'''
{
"fullText": "rue Pr. Patel",
"voie": "rue Pr. Patel",
"commune": null
}

- "j'habite au 39 place des matrys a Lyon" => réponse attendue :
'''
{
"fullText": "39 place des matrys a Lyon 4",
"voie": "39 place des matrys",
"commune": "Lyon 4"
}

- "j'habite place des allouettes a Lyon 2e arr" => réponse attendue :
'''
{
"fullText": "place des allouettes a Lyon 2e arr",
"voie": "place des allouettes",
"commune": "Lyon 2e arr"
}

- "Le lundi je nettoie la rue Alphone Allais à Curis, avant de rentrer manger" => réponse attendue :
'''
{
"fullText": "rue Alphone Allais à Curis",
"voie": "rue Alphone Allais",
"commune": "Curis"
}
'''

Dernier point, l'assistant DOIT obligatoirement répondre uniquement par le JSON décrit ci dessus. Aucun autre commentaire, pas de quotes en plus, UNIQUEMENT le JSON.`;

const systemMessages = [systemMessage, chatGPTSystemMessage, simpleSystemMessage, simpleMessage];

const models = [
  {
    systemMessage: systemMessage,
    postProcess: (input: string) => {
      return JSON.parse(input);
    },
  },
  {
    systemMessage: chatGPTSystemMessage,
    postProcess: (input: string) => {
      return JSON.parse(input);
    },
  },
  {
    systemMessage: simpleSystemMessage,
    postProcess: async (input: string, weaviateClient: WeaviateClient, collectionName: string) => {
      const result = JSON.parse(input);
      const commune = result.commune;
      if (commune) {
        const formattedCommune = await findCommune(commune, weaviateClient, collectionName);
        result.commune = formattedCommune;
      }
      return result;
    },
  },
  {
    systemMessage: simpleMessage,
    postProcess: async (input: string, weaviateClient: WeaviateClient, collectionName: string) => {
      const result = JSON.parse(input);
      const commune = result.commune;
      if (commune) {
        const formattedCommune = await findCommune(commune, weaviateClient, collectionName);
        result.commune = formattedCommune;
      }
      return result;
    },
  }
];

async function generateCities () {

  const weaviateClient = await weaviate.connectToLocal({
    httpHost: 'localhost',
    httpPort: 8080,
    grpcHost: 'localhost',
    grpcPort: 50051,
  });
  const collectionName = 'Communes';

  const exists = await weaviateClient.collections.exists(collectionName);
  if (!exists) {
    await weaviateClient.collections.createFromSchema({
      class: collectionName,
      description: `Class from ${collectionName}`,
      properties: [
        {
          name: 'name',
          dataType: [ 'text' ],
        },
      ],
      moduleConfig: {
        'text2vec-ollama': {
          apiEndpoint: 'http://host.docker.internal:11434',
          model: 'nomic-embed-text',
        },
        'generative-ollama': {
          apiEndpoint: 'http://host.docker.internal:11434',
          model: 'llama3',
        }
      },
    });
  }


  const collection = weaviateClient.collections.get(collectionName);
  await collection.data.insertMany(communes.map((c) => ({ properties: { name: c } })));

}

async function findCommune (input: string, weaviateClient: WeaviateClient, collectionName: string) {
  const collection = weaviateClient.collections.get(collectionName);
  const result = await collection.query.nearText(input, { limit: 1 });
  return result.objects[0].properties.name;
}

async function main() {

  const weaviateClient = await weaviate.connectToLocal({
    httpHost: 'localhost',
    httpPort: 8080,
    grpcHost: 'localhost',
    grpcPort: 50051,
  });
  const collectionName = 'Communes';

  const results: any = [];

  for (let i = 3; i < models.length; ++i) {
    const model = models[i];
    console.log('TESTING MODEL', i);
    const modelResults: any = [];
    for (let j = 0; j < tests.length; ++j) {
      const test = tests[j];
      console.log(' >> #test', j, `"${test.input}"`);
      const start = performance.now();
      try {
        const answer = await ollama.chat({
          model: 'llama3',
          messages: [
            {
              role: 'system',
              content: model.systemMessage,
            },
            {
              role: 'user',
              content: test.input,
            },
          ],
        });

        console.log('partial content', answer.message.content);
        
        const output = await model.postProcess(answer.message.content, weaviateClient, collectionName);
        const score = {
          fullText: output.fullText === test.output.fullText,
          voie: output.voie === test.output.voie,
          commune: output.commune === test.output.commune,
        };
        const end = performance.now();
        modelResults.push({
          input: test.input,
          expected: test.output,
          result: output,
          score,
          error: null,
          ms: end - start,
        });
      }
      catch (err: unknown) {
        const end = performance.now();
        modelResults.push({
          input: test.input,
          expected: test.output,
          error: err,
          ms: end - start,
        });
      }

      console.log(' >>>', modelResults[modelResults.length - 1]);
    }
    results.push(modelResults);
  }

  // await writeFile('./results.json', JSON.stringify(results, undefined, 2));

  /*
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  while (true) {
    const query = await rl.question('[User] ');

    const model = models[3];

    const answer = await ollama.chat({
      model: 'llama3',
      messages: [
        {
          role: 'system',
          content: model.systemMessage,
        },
        {
          role: 'user',
          content: query,
        },
      ],
    });

    console.log('>>', answer.message.content);
    const output = await model.postProcess(answer.message.content, weaviateClient, collectionName);
    console.log('output', output);

    for (const msg of systemMessages) {
      const answer = await ollama.chat({
        model: 'llama2',
        messages: [
          {
            role: 'system',
            content: msg,
          },
          {
            role: 'user',
            content: query,
          },
        ],
      });

      console.log(' >> duration (s)', answer.total_duration / 10 ** 9);
      console.log(' >> ', answer.message.content);
    }
  }
  */
}

void main();

// void generateCities();

async function test () {
  const weaviateClient = await weaviate.connectToLocal({
    httpHost: 'localhost',
    httpPort: 8080,
    grpcHost: 'localhost',
    grpcPort: 50051,
  });
  const collectionName = 'Communes';

  const c = await findCommune('Lyon 4', weaviateClient, collectionName);
  console.log('>', c);
}

// void test();