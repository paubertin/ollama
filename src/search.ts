import csv from 'csv-parser';
import { createReadStream } from 'fs';
import { createInterface } from 'readline/promises';
import {
  Document,
  storageContextFromDefaults,
  Ollama,
  OllamaEmbedding,
  Settings,
  VectorStoreIndex,
  VectorStoreBase,
  VectorStoreNoEmbedModel,
  BaseNode,
  Metadata,
  VectorStoreQuery,
  VectorStoreQueryResult,
  IEmbedModel,
  MetadataMode,
  VectorStoreQueryMode,
  MetadataFilters,
  TextNode,
  ChatMessage,
} from "llamaindex";
import weaviate, { Collection, FilterValue, Filters, WeaviateClient, WeaviateNonGenericObject } from 'weaviate-client';
import { metadataDictToNode, nodeToMetadata } from 'llamaindex/storage/vectorStore/utils';
import { add } from '@tensorflow/tfjs-node';
import { readFile } from 'fs/promises';

const communes = ['Lyon', 'Villeurbanne', 'Meyzieu', 'Saint-Priest', 'Vaulx-en-Velin', 'Vénissieux', 'Lyon 3e Arrondissement', 'Mions', 'Bron', 'Décines-Charpieu', 'Caluire-et-Cuire', 'Rillieux-la-Pape', 'Lyon 9e Arrondissement', 'Chassieu', 'Lyon 7e Arrondissement', 'Givors', 'Saint-Genis-Laval', 'Lyon 8e Arrondissement', 'Corbas', 'Lyon 5e Arrondissement', 'Lyon 2e Arrondissement', 'Lyon 1er Arrondissement', 'Feyzin', 'Jonage', 'Oullins', 'Sainte-Foy-lès-Lyon', "Saint-Didier-au-Mont-d'Or", 'Tassin-la-Demi-Lune', 'Francheville', 'Saint-Fons', 'Dardilly', 'Craponne', 'Lyon 4e Arrondissement', 'Écully', 'Lyon 6e Arrondissement', 'Saint-Genis-les-Ollières', "Saint-Cyr-au-Mont-d'Or", 'Neuville-sur-Saône', 'Quincieux', 'Irigny', 'Pierre-Bénite', 'La Tour-de-Salvagny', 'Genay', 'Montanay', 'Limonest', 'Charbonnières-les-Bains', 'Lissieu', "Couzon-au-Mont-d'Or", 'Vernaison', 'Grigny', 'Charly', "Saint-Germain-au-Mont-d'Or", "Collonges-au-Mont-d'Or", "Champagne-au-Mont-d'Or", "Poleymieux-au-Mont-d'Or", 'Solaize', 'Sathonay-Village', "Saint-Romain-au-Mont-d'Or", "Marcy-l'Étoile", 'Fontaines-Saint-Martin', 'Cailloux-sur-Fontaines', "Curis-au-Mont-d'Or", 'Sathonay-Camp', 'Fontaines-sur-Saône', 'Albigny-sur-Saône', 'Fleurieu-sur-Saône', 'La Mulatière', 'Rochetaillée-sur-Saône'];

const ollama = new Ollama({ model: "llama3", options: { temperature: 0 } });

Settings.llm = ollama;
Settings.embedModel = new OllamaEmbedding({ model: 'nomic-embed-text' });

interface Address {
  nom: string;
  commune?: string;
  // insee: string;
}

type Referentiel = Address[];

function textToVector(text: string) {
  const maxLen = 100;  // Taille maximale des vecteurs
  const vector: number[] = new Array(maxLen).fill(0);
  for (let i = 0; i < Math.min(text.length, maxLen); i++) {
    vector[i] = text.charCodeAt(i);
  }
  return vector;
}

async function parseCSV(fileName: string = 'adresses') {
  return new Promise<Referentiel>((resolve, reject) => {
    const referentiel: Referentiel = [];
    createReadStream(`./data/${fileName}.csv`)
      .pipe(csv({
        // headers: [ 'nom', 'insee', 'commune' ],
        separator: ';',
      }))
      .on('data', (row) => {
        referentiel.push(row);
      })
      .on('end', () => {
        console.log('CSV processed');
        resolve(referentiel);
      })
      .on('error', (err) => reject(err));
  })
}

async function populate() {
  const referentiel = await parseCSV();

  const documents: Document[] = [];
  referentiel.forEach((row, id) => {
    const doc = new Document({ text: `{"nom": "${row.nom}", "commune": "${row.commune}"}`, id_: `${id}` });
    // const doc = new Document({ text: `{"nom": "${row.nom}"}`, id_: `${id}` });
    documents.push(doc);
  });

  const store = new WeaviateVectorStore({ collectionName: 'Address', weaviateOptions: {
    httpHost: 'localhost',
    httpPort: 8080,
    grpcHost: 'localhost',
    grpcPort: 50051,
  } });

  await store.init();

  const storageContext = await storageContextFromDefaults({
    persistDir: "./storage",
    vectorStore: store,
  });

  const index = await VectorStoreIndex.fromDocuments(documents, { vectorStores: { TEXT: store }, logProgress: true,  });
}

class WeaviateVectorStore extends VectorStoreBase implements VectorStoreNoEmbedModel {
  public storesText: boolean = true;
  public flatMetadata: boolean = true;

  public textKey: string;

  private weaviateClient!: WeaviateClient;
  private collection: Collection | null = null;
  private collectionName: string;

  public constructor (init: { collectionName: string, textKey?: string; weaviateOptions: { 
    /** The hostname of the HTTP/1.1 server */
    httpHost?: string;
    /** An additional path of the HTTP/1.1 server, e.g. `http://proxy.net/weaviate` */
    httpPath?: string;
    /** The port of the HTTP/1.1 server */
    httpPort?: number;
    /** Whether to use a secure connection to the HTTP/1.1 server */
    httpSecure?: boolean;
    /** The hostname of the HTTP/2 server */
    grpcHost?: string;
    /** The port of the HTTP/2 server */
    grpcPort?: number;
    /** Whether to use a secure connection to the HTTP/2 server */
    grpcSecure?: boolean; } } & Partial<IEmbedModel>) {
    super(init.embedModel)
    this.collectionName = init.collectionName;
    this.textKey = init.textKey ?? 'text';
  }

  public async init () {
    this.weaviateClient = await weaviate.connectToLocal({
      httpHost: 'localhost',
      httpPort: 8080,
      grpcHost: 'localhost',
      grpcPort: 50051,
    });
    const exists = await this._classSchemaExists(this.collectionName);
    console.log('exists', exists);
    if (!exists) {
      await this._createDefaultSchema(this.collectionName);
    }
  }

  private async _classSchemaExists (collectionName: string): Promise<boolean> {
    const collections = await this.weaviateClient.collections.listAll();
    const found = collections.find((c) => c.name === this.collectionName);
    return found !== undefined;
    // return this.weaviateClient.collections.exists(collectionName);
  }

  private async _createDefaultSchema (collectionName: string) {
    try {
      return await this.weaviateClient.collections.createFromSchema({
        class: collectionName,
        description: `Class from ${collectionName}`,
        properties: [
          {
            dataType: [ 'text' ],
            description: 'Text property',
            name: 'text',
          },
          {
            dataType: [ 'text' ],
            description: 'The ref_doc_id of the Node',
            name: 'ref_doc_id',
          },
          {
            dataType: [ 'text' ],
            description: 'node_info (in JSON)',
            name: 'node_info',
          },
          {
            dataType: [ 'text' ],
            description: 'The relationships of the node (in JSON)',
            name: 'relationships',
          },
        ],
      });
    }
    catch (err: unknown) {
      console.error(err);
    }
  }

  public async getCollection(): Promise<Collection> {
    if (!(await this._classSchemaExists(this.collectionName))) {
      await this._createDefaultSchema(this.collectionName);
    }
    return this.weaviateClient.collections.get(this.collectionName);
  }

  client() {
    return this.weaviateClient;
  }

  public async add(nodes: BaseNode<Metadata>[]): Promise<string[]> {
    if (!nodes || nodes.length === 0) {
      return [];
    }
    const collection = await this.getCollection();
    await collection.data.insertMany(nodes.map((node) => {
      const metadata = nodeToMetadata(node, true, this.textKey, this.flatMetadata);
      metadata[this.textKey] = node.getContent(MetadataMode.NONE);
      return {
        id: node.id_,
        properties: metadata,
        vector: node.getEmbedding(),
      };
    }));
    return nodes.map((node) => node.id_);
  }

  delete(refDocId: string, deleteOptions?: any): Promise<void> {
    throw new Error('Method not implemented.');
  }

  private async _toWeaviateFilters (standardFilters: MetadataFilters) {
    const collection = await this.getCollection();
    const filtersList: FilterValue[] = [];
    const condition = collection;
    if (standardFilters.filters.length) {
      for (const filter of standardFilters.filters) {
      }
      throw new Error('TO DO');
    }
    return Filters.and(...filtersList);
  }

  public async query(query: VectorStoreQuery): Promise<VectorStoreQueryResult> {
    // console.log('query', query);
    // if (!query.queryStr) throw new Error('No query string');
    const collection = await this.getCollection();
    let filters: FilterValue | undefined = undefined;
    let alpha: number | undefined;
    if (query.docIds) {
      filters = collection.filter.byProperty('doc_id').containsAny(query.docIds);
    }

    const vector = query.queryEmbedding;
    let similarityKey = 'distance';
    if (query.mode === VectorStoreQueryMode.DEFAULT) {
      console.log('Using vector search');
      if (vector) {
        alpha = 1;
      }
    }
    else if (query.mode === VectorStoreQueryMode.HYBRID) {
      console.log(`Using hybrid search with alpha ${query.alpha}`);
      similarityKey = 'score';
      if (vector && query.queryStr) {
        alpha = query.alpha;
      }
    }

    if (query.filters) {
      filters = await this._toWeaviateFilters(query.filters);
    }
    const limit = query.similarityTopK;
    console.log(`Using limit of ${limit}`);

    const queryResult = await collection.query.hybrid(query.queryStr!, {
      vector,
      alpha,
      limit,
      filters,
      returnMetadata: [ 'distance', 'score' ],
      returnProperties: (await collection.config.get()).properties.map((p) => p.name),
      includeVector: true,
    });

    const entries = queryResult.objects;

    // console.log('ENTRIES', entries);

    const similarities: number[] =[];
    const nodes: BaseNode[] = [];
    const ids: string[] = [];

    for (let i = 0; i < entries.length; ++i) {
      const entry = entries[i];
      if (i < query.similarityTopK) {
        similarities.push(this._getNodeSimilarity(entry, similarityKey));
        nodes.push(this._toNode(entry, this.textKey));
        ids.push(nodes[nodes.length - 1].id_);
      }
      else {
        break;
      }
    }

    const vectorStoreQueryResult: VectorStoreQueryResult = {
      nodes,
      ids,
      similarities,
    };

    // console.log('RESULT', vectorStoreQueryResult);
    vectorStoreQueryResult.nodes?.map((n) => console.log((n as TextNode).text));
    return vectorStoreQueryResult;
  }

  private _toNode (entry: WeaviateNonGenericObject, textKey: string = 'text') {
    const node = metadataDictToNode(entry.properties);
    node.setContent(entry.properties[textKey]);
    node.embedding = entry.vectors['default'] ?? undefined;
    return node;
  }

  private _getNodeSimilarity (entry: WeaviateNonGenericObject, similarityKey: string = 'distance') {
    const distance: number | undefined = entry.metadata?.[similarityKey];
    if (distance === undefined) {
      return 1;
    }
    return 1 - distance;
  }
  
}

async function client() {

  const client = await weaviate.connectToLocal({
    httpHost: 'localhost',
    httpPort: 8080,
    grpcHost: 'localhost',
    grpcPort: 50051,
  }
  )

  console.log(client);

  const isLive = await client.isLive();
  console.log('isLive ?', isLive);

  const collections = await client.collections.listAll();
  const c = await client.collections.get('tyjty');
  console.log('collections', collections);

}

async function query() {

  const storageContext = await storageContextFromDefaults({
    persistDir: "./storage",
  });

  const store = new WeaviateVectorStore({ collectionName: 'Address', weaviateOptions: {
    httpHost: 'localhost',
    httpPort: 8080,
    grpcHost: 'localhost',
    grpcPort: 50051,
  } });

  await store.init();

  // const index = await VectorStoreIndex.init({
  //   storageContext,
  // });

  const index = await VectorStoreIndex.fromVectorStore(store);

  const queryEngine = index.asQueryEngine({ similarityTopK: 10});

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  while (true) {
    const query = await rl.question('[User] ');

    const { response, sourceNodes } = await queryEngine.query({
      query: `Based on this user query: ${query}, find the best match in your known data.
Answer with the exact line corresponding to the data you have in your context. ONLY THIS LINE, NO COMMENT OR EXPLANATIONS`
      //       query: `Based on this user query (which corresponds to an address, a way): ${query}, find and anwser in which city (commune) it is located.
      // If the user query does not correspond exactly to a known entry in your context, just answer 'I CANNOT ANSWER'.`
    });

    // Output response with sources
    let output = response;
    try {
      output = JSON.parse(output);
    }
    catch (err: unknown) { }
    console.log('Result:', output);
    console.log(sourceNodes?.map((s) => s.score));
    console.log();
  }
}

async function generateVoirie () {
  const voirie = JSON.parse((await readFile('./data/voirie.json')).toString());
  const collectionName = 'Voirie';

  const typeVoies: string[] = [
    'Allée',
    'Allées',
    'Avenue',
    'Berge',
    'Boulevard',
    'Carrefour',
    'Chemin',
    'Chemin Rural',
    'Cité',
    'Clos',
    'Côte',
    'Cour',
    'Cours',
    'Esplanade',
    'Impasse',
    'Jardin',
    'Montée',
    'Parc',
    'Parking',
    'Parvis',
    'Passage',
    'Passerelle',
    'Place',
    'Pont',
    'Promenade',
    'Quai',
    'Rond-Point',
    'Route',
    'Route Départementale',
    'Route Nationale',
    'Rue',
    'Ruelle',
    'Sentier',
    'Square',
    'Venelle',
    'Viaduc',
    'Voie',
    'Voie Communale'
  ];

  const weaviateClient = await weaviate.connectToLocal({
    httpHost: 'localhost',
    httpPort: 8080,
    grpcHost: 'localhost',
    grpcPort: 50051,
  });

  const exists = await weaviateClient.collections.exists(collectionName);
  if (!exists) {
    await weaviateClient.collections.createFromSchema({
      class: collectionName,
      description: `Class from ${collectionName}`,
      properties: [
        {
          name: 'geometry',
          dataType: [ 'object' ],
          nestedProperties: [
            {
              dataType: [ 'text' ],
              name: 'type',
            },
            {
              dataType: [ 'text' ],
              name: 'coordinates',
            }
          ],
        },
        {
          name: 'name',
          dataType: [ 'text' ],
        },
        {
          name: 'shortName',
          dataType: [ 'text' ],
        },
        {
          name: 'type',
          dataType: [ 'text' ],
        },
        {
          name: 'insee',
          dataType: [ 'text' ],
        },
        {
          name: 'commune',
          dataType: [ 'text' ],
        },
        {
          name: 'gid',
          dataType: [ 'int' ],
        }
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
  const objects = voirie.features.map((feature) => {
    const nom = feature.properties.nom?.trim() ?? '';
    const commune = feature.properties.commune?.trim() ?? '';
    let typeVoie = '';
    for (const type of typeVoies) {
      if (nom.toLowerCase().startsWith(type.toLowerCase() + ' ')) {
        typeVoie = type;
        break;
      }
    }
    const obj = {
      // id: address.id,
      properties: {
        name: feature.properties.nom,
        shortName: nom.substring(typeVoie ? typeVoie.length + 1 : 0).trim(),
        type: typeVoie,
        insee: feature.properties.insee,
        commune: commune,
        gid: feature.properties.gid,
        geometry: {
          type: feature.geometry.type,
          coordinates: JSON.stringify(feature.geometry.coordinates),
        },
      },
    };
    return obj;
  });
  console.log('OBJECTS', objects);
  // await collection.data.insert(objects[0]);
  // const obj = await collection.query.fetchObjects();
  // console.log('in db', obj);
  await collection.data.insertMany(objects);
  
}

async function generateWeaviateContent () {
  const referentiel = await parseCSV('adresses');

  const typeVoies: string[] = [
    'Allée',
    'Allées',
    'Avenue',
    'Berge',
    'Boulevard',
    'Carrefour',
    'Chemin',
    'Chemin Rural',
    'Cité',
    'Clos',
    'Côte',
    'Cour',
    'Cours',
    'Esplanade',
    'Impasse',
    'Jardin',
    'Montée',
    'Parc',
    'Parking',
    'Parvis',
    'Passage',
    'Passerelle',
    'Place',
    'Pont',
    'Promenade',
    'Quai',
    'Rond-Point',
    'Route',
    'Route Départementale',
    'Route Nationale',
    'Rue',
    'Ruelle',
    'Sentier',
    'Square',
    'Venelle',
    'Viaduc',
    'Voie',
    'Voie Communale'
  ];

  const adresses = referentiel.map((line, idx) => {
    const nom = line.nom.trim();
    const commune = line.commune?.trim() ?? '';
    let typeVoie = '';
    for (const type of typeVoies) {
      if (nom.toLowerCase().startsWith(type.toLowerCase())) {
        typeVoie = type;
        break;
      }
    }
    return {
      id: `${idx}`,
      typeVoie,
      fullText: `${nom} ${commune}`,
      voie: nom.substring(typeVoie ? typeVoie.length + 1 : 0).trim(),
      commune: commune ?? '',
    };
  });

  const weaviateClient = await weaviate.connectToLocal({
    httpHost: 'localhost',
    httpPort: 8080,
    grpcHost: 'localhost',
    grpcPort: 50051,
  });
  const collectionName = 'Rues';
  const exists = await weaviateClient.collections.exists(collectionName);
  if (!exists) {
    await weaviateClient.collections.createFromSchema({
      class: collectionName,
      description: `Class from ${collectionName}`,
      properties: [
        {
          name: 'fullText',
          dataType: [ 'text' ],
        },
        {
          name: 'typeVoie',
          dataType: [ 'text' ],
        },
        {
          name: 'voie',
          dataType: [ 'text' ],
        },
        {
          name: 'commune',
          dataType: [ 'text' ],
        }
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
  const objects = adresses.map((address) => {
    const obj = {
      // id: address.id,
      properties: {
        fullText: address.fullText,
        typeVoie: address.typeVoie,
        voie: address.voie,
        commune: address.commune,
      },
    };
    return obj;
  });
  console.log('OBJECTS', objects);
  // await collection.data.insert(objects[0]);
  // const obj = await collection.query.fetchObjects();
  // console.log('in db', obj);
  await collection.data.insertMany(objects);
}

async function queryStore (postProcess: boolean = false) {

  const weaviateClient = await weaviate.connectToLocal({
    httpHost: 'localhost',
    httpPort: 8080,
    grpcHost: 'localhost',
    grpcPort: 50051,
  });
  const collectionName = 'Voirie';
  const collection = weaviateClient.collections.get<{
    name: string;
    shortName: string;
    type: string;
    insee: string;
    commune: string;
    gid: number;
    geometry: {
      type: string;
      coordinates: string;
    }
  }>(collectionName);

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  while (true) {
    const query = await rl.question('[User] ');

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Tu vas recevoir un input utilisateur, qui peut contenir une adresse.
Ton but est d'identifier la partie adresse dans cela. L'adresse peut être uniquement l'indication de voirie (rue, boulevard, place, etc...), ou bien la voirie + une commune.
Tu dois répondre uniquement sous format JSON de la sorte : 
'''
{
"fullText": "la partie contenant l'adresse",
"voie": "la partie voirie de l'adresse",
"commune": "la partie commune de l'adresse, peut être null si non trouvée"
}
'''

TU DOIS OBLIGATOIREMENT, SI TU SPECIFIES UNE COMMUNE, LA SELECTIONNER PARMI LA LISTE SUIVANTE :
${communes.join(' / ')}

Ainsi, si tu identifies comme commune "Lyon 6", tu dois prendre la valeur "Lyon 6e Arrondissement".
Si tu identifies comme commune "Neuville", tu dois prendre la valeur "Neuville-sur-Saône".

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

Dernier point, tu DOIS obligatoirement répondre uniquement par le JSON que je t'ai décrit. Aucun autre commentaire, pas de quotes en plus, UNIQUEMENT le JSON.
`
      },
      {
        role: 'user',
        content: query,
      }
    ];

    console.log('MESSAGES', messages);

    const parts = await ollama.chat({
      messages,
    });

    console.log('ADDRESS', parts.message.content);
    const parsed = JSON.parse((parts.message.content as string).trim());

    const communeFound: string | undefined = parsed.commune;
    const fullText: string = parsed.fullText;
    const voie: string = parsed.voie;

    const filters = communeFound ? collection.filter.byProperty('commune').equal(communeFound) : undefined;

    const response = await collection.query.hybrid(voie, {
      alpha: 1,
      returnMetadata: [ 'distance', 'score' ],
      queryProperties: [ 'name' ],
      
      limit: 5,
      filters,
    });

    const entries = response.objects;
    console.log('Result', entries.map((o) => {
      return {
        properties: {
          ...o.properties,
          geometry: {
            type: o.properties.geometry.type,
            coordinates: JSON.parse(o.properties.geometry.coordinates),
          },
        },
        score: o.metadata?.score };
    }));
    console.log();

    console.log('BEST RAW MATCH', entries[0]);


    if (postProcess) {
      const ollamaAnswer = await ollama.chat({
        messages: [
          {
            role: 'system',
            content: `Given a user query, your task is to find the best RELEVANT match amongst these propositions:
            
  '''json
  ${JSON.stringify(entries.map((e) => e.properties))}
  '''

  ANWER ONLY WITH THE INDEX OF THE ENTRY YOU CHOOSE TO KEEP + AN EXPLANATION COMMENT, IN A JSON WAY.

  Example of answer: '{ "index": 1, "explain": "This entry was kept because ....." }'

  NOTHING MORE, NO OTHER COMMENT.

  `
          },
          {
            role: 'user',
            content: query,
          }
        ],
      });

      console.log('[OLLAMA]', ollamaAnswer.message);
      try {
        const json = JSON.parse(ollamaAnswer.message.content as string);
        // console.log('ollama answer', json);
        const index = json.index;

        const bestMatch = entries[index];

        if (bestMatch) {
          console.log();
          console.log('BEST MATCH', bestMatch.properties);
        }
      }
      catch (err: unknown) {
        console.error(err);
      }
      console.log();
    }
  }
}

// void populate();

// void query();

// void generateWeaviateContent();
void queryStore();

// void generateVoirie();
