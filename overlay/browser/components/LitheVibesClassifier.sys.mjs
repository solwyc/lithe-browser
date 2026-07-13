/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { createEngine } from "chrome://global/content/ml/EngineProcess.sys.mjs";

export const VIBES_MODEL = Object.freeze({
  id: "Xenova/bge-small-en-v1.5",
  // Gecko requires a semantic version for its local cache key. The packaged
  // files are nevertheless pinned to conversionRevision and checksummed.
  revision: "1.5.0",
  conversionRevision: "ea104dacec62c0de699686887e3f920caeb4f3e3",
  originalRevision: "5c38ec7c405ec4b44b94cc5a9bb96e735b38267a",
  root: "chrome://browser/content/lithe-vibes-models/",
  license: "MIT",
});

const DEFINITIONS = [
  ["visual-art", "Visual art", "painting, drawing, sculpture, galleries, and fine art"],
  ["photography", "Photography", "photographs, cameras, photo essays, and image making"],
  ["graphic-design", "Graphic design", "typography, illustration, branding, posters, and visual communication"],
  ["architecture", "Architecture", "buildings, architects, interiors, and built environments"],
  ["fashion", "Fashion", "clothing, style, textiles, designers, and fashion history"],
  ["crafts", "Crafts", "handmade work, fiber arts, ceramics, woodworking, and craft techniques"],
  ["animation", "Animation", "animated film, motion design, stop motion, and animation art"],
  ["comics", "Comics", "comic books, webcomics, sequential art, and cartooning"],
  ["literature", "Literature", "novels, essays, literary criticism, authors, and reading"],
  ["poetry", "Poetry", "poems, poets, spoken word, and poetic forms"],
  ["film", "Film", "cinema, movies, filmmakers, criticism, and film history"],
  ["television", "Television", "TV series, broadcasting, reviews, and television history"],
  ["theater", "Theater", "plays, stage performance, playwrights, and dramatic arts"],
  ["dance", "Dance", "choreography, dancers, movement, and dance performance"],
  ["music", "Music", "musicians, albums, songs, instruments, and music culture"],
  ["music-discovery", "Music discovery", "new artists, unusual genres, playlists, and independent music"],
  ["podcasts", "Podcasts", "spoken audio programs, interviews, stories, and podcast discovery"],
  ["museums", "Museums", "museum collections, exhibitions, galleries, and curatorial work"],
  ["cultural-heritage", "Cultural heritage", "traditions, monuments, preservation, and shared cultural memory"],
  ["creative-writing", "Creative writing", "fiction writing, storytelling, prompts, and writing craft"],
  ["astronomy", "Astronomy", "stars, planets, telescopes, galaxies, and observing the night sky"],
  ["space", "Space", "spaceflight, NASA, rockets, astronauts, missions, and the cosmos"],
  ["physics", "Physics", "matter, energy, quantum science, relativity, and physical research"],
  ["chemistry", "Chemistry", "molecules, reactions, elements, materials, and chemical science"],
  ["biology", "Biology", "living organisms, evolution, genetics, cells, and life science"],
  ["medicine", "Medicine", "health research, clinical science, treatments, and medical knowledge"],
  ["neuroscience", "Neuroscience", "brains, cognition, neurons, perception, and neural research"],
  ["psychology", "Psychology", "behavior, emotion, cognition, personality, and psychological research"],
  ["environment", "Environment", "ecosystems, conservation, pollution, and environmental science"],
  ["climate", "Climate", "climate science, global warming, carbon, and climate solutions"],
  ["geology", "Geology", "rocks, minerals, volcanoes, earthquakes, and earth science"],
  ["paleontology", "Paleontology", "fossils, dinosaurs, ancient life, and prehistoric worlds"],
  ["ocean", "Ocean", "marine science, seas, underwater life, and ocean exploration"],
  ["weather", "Weather", "forecasts, storms, meteorology, atmosphere, and weather maps"],
  ["mathematics", "Mathematics", "numbers, geometry, algebra, proofs, and mathematical ideas"],
  ["statistics", "Statistics", "probability, statistical reasoning, inference, and quantitative analysis"],
  ["engineering", "Engineering", "machines, structures, systems, invention, and applied design"],
  ["robotics", "Robotics", "robots, automation, autonomous machines, and robot building"],
  ["electronics", "Electronics", "circuits, components, microcontrollers, and electronic projects"],
  ["maker-projects", "Maker projects", "hands-on builds, fabrication, 3D printing, and maker culture"],
  ["programming", "Programming", "software development, code, algorithms, and developer practice"],
  ["web-development", "Web development", "HTML, CSS, JavaScript, web apps, and web standards"],
  ["open-source", "Open source", "free software, public code, community projects, and software freedom"],
  ["cybersecurity", "Cybersecurity", "computer security, vulnerabilities, malware, and defensive research"],
  ["privacy", "Privacy", "digital privacy, surveillance, anonymity, tracking, and data rights"],
  ["artificial-intelligence", "Artificial intelligence", "machine learning, neural networks, models, and AI research"],
  ["data-science", "Data science", "data analysis, datasets, machine learning, and analytical tools"],
  ["operating-systems", "Operating systems", "Windows, Linux, Unix, kernels, and system software"],
  ["hardware", "Computer hardware", "processors, memory, PCs, components, and computer building"],
  ["retro-computing", "Retro computing", "vintage computers, old software, emulation, and computing history"],
  ["gadgets", "Gadgets", "consumer technology, devices, accessories, and product experiments"],
  ["startups", "Startups", "new companies, founders, entrepreneurship, and technology business"],
  ["internet-culture", "Internet culture", "online communities, memes, digital folklore, and web culture"],
  ["digital-art", "Digital art", "computer art, generative art, creative coding, and digital media"],
  ["game-development", "Game development", "game design, engines, level design, and making video games"],
  ["history", "History", "historical events, people, eras, primary sources, and historical research"],
  ["ancient-history", "Ancient history", "ancient civilizations, classical worlds, and early societies"],
  ["military-history", "Military history", "warfare, battles, strategy, armed forces, and conflict history"],
  ["archaeology", "Archaeology", "excavations, artifacts, ancient sites, and material history"],
  ["philosophy", "Philosophy", "philosophers, metaphysics, knowledge, reason, and ideas"],
  ["ethics", "Ethics", "morality, applied ethics, dilemmas, values, and responsible choices"],
  ["religion", "Religion", "faiths, religious studies, spiritual traditions, and theology"],
  ["mythology", "Mythology", "myths, legends, folklore, gods, and traditional stories"],
  ["languages", "Languages", "language learning, vocabulary, grammar, and multilingual resources"],
  ["linguistics", "Linguistics", "language science, phonetics, etymology, syntax, and semantics"],
  ["education", "Education", "teaching, schools, learning methods, and educational resources"],
  ["tutorials", "Tutorials", "how-to guides, step-by-step lessons, explanations, and practical instruction"],
  ["reference", "Reference", "encyclopedias, factual resources, dictionaries, and research tools"],
  ["books", "Books", "book discovery, reviews, publishing, reading lists, and authors"],
  ["libraries", "Libraries", "library collections, librarianship, catalogs, and public knowledge"],
  ["archives", "Archives", "digitized collections, historical documents, records, and preservation"],
  ["journalism", "Journalism", "reporting, news analysis, investigations, and independent media"],
  ["politics", "Politics", "government, elections, public policy, political movements, and civic life"],
  ["economics", "Economics", "markets, economic policy, labor, trade, and economic research"],
  ["law", "Law", "legal systems, courts, rights, legislation, and legal analysis"],
  ["sociology", "Sociology", "society, social structures, communities, and social research"],
  ["anthropology", "Anthropology", "human cultures, societies, ethnography, and human development"],
  ["geography", "Geography", "places, regions, landscapes, countries, and spatial knowledge"],
  ["maps", "Maps", "cartography, atlases, geographic data, and interactive mapping"],
  ["world-cultures", "World cultures", "cultures, customs, everyday life, and global perspectives"],
  ["travel", "Travel", "destinations, journeys, travel writing, and seeing the world"],
  ["local-travel", "Local travel", "nearby places, day trips, regional guides, and local exploration"],
  ["nature", "Nature", "natural landscapes, plants, habitats, and the outdoors"],
  ["wildlife", "Wildlife", "animals, birds, insects, habitats, and wildlife observation"],
  ["hiking", "Hiking", "trails, walking routes, trekking, and outdoor exploration"],
  ["camping", "Camping", "campsites, backpacking, wilderness skills, and outdoor living"],
  ["cycling", "Cycling", "bicycles, bike routes, touring, and cycling culture"],
  ["running", "Running", "jogging, races, training, and running routes"],
  ["fitness", "Fitness", "exercise, strength, mobility, workouts, and physical training"],
  ["wellness", "Wellness", "healthy habits, rest, wellbeing, and everyday health"],
  ["mindfulness", "Mindfulness", "meditation, reflection, calm, attention, and contemplative practice"],
  ["food", "Food", "cuisines, restaurants, ingredients, food history, and eating culture"],
  ["cooking", "Cooking", "recipes, kitchen techniques, chefs, and home cooking"],
  ["baking", "Baking", "bread, pastry, desserts, ovens, and baking techniques"],
  ["coffee", "Coffee", "coffee beans, brewing, cafes, roasters, and coffee culture"],
  ["gardening", "Gardening", "plants, gardens, growing food, horticulture, and landscaping"],
  ["sustainability", "Sustainability", "low-waste living, renewable resources, repair, and sustainable design"],
  ["home-design", "Home design", "interiors, furniture, organization, and living spaces"],
  ["diy", "DIY", "do-it-yourself repairs, home projects, tools, and practical making"],
  ["urbanism", "Urbanism", "cities, public space, transit, planning, and walkable communities"],
  ["interactive", "Interactive experiences", "creative interactive websites, web experiments, and playful interfaces"],
  ["games", "Games", "video games, browser games, tabletop games, and playful experiences"],
  ["puzzles", "Puzzles", "logic puzzles, word games, riddles, and brain teasers"],
  ["trivia", "Trivia", "quizzes, surprising facts, knowledge games, and questions"],
  ["simulations", "Simulations", "interactive models, virtual systems, sandboxes, and scientific simulations"],
  ["data-visualization", "Data visualization", "interactive charts, information graphics, and visualized data"],
  ["virtual-tours", "Virtual tours", "digital visits, panoramic places, museums, and remote exploration"],
  ["live-cams", "Live cameras", "public webcams, wildlife cameras, city views, and live scenes"],
  ["radio", "Radio", "live radio, stations, broadcasts, and global audio"],
  ["video", "Video", "online video, short films, documentaries, and visual media"],
  ["humor", "Humor", "comedy, satire, jokes, funny writing, and amusing websites"],
  ["weird-web", "Weird web", "strange, whimsical, surprising, niche, and unusual websites"],
  ["nostalgia", "Nostalgia", "retro memories, old media, past decades, and cultural time capsules"],
  ["relaxing", "Relaxing", "calming, slow, cozy, low-stress, and peaceful experiences"],
  ["ambient", "Ambient", "background sound, atmospheric visuals, soundscapes, and gentle focus"],
  ["social", "Social", "communities, forums, people, conversation, and shared interests"],
  ["personal-finance", "Personal finance", "saving, budgeting, investing, money skills, and financial planning"],
  ["careers", "Careers", "jobs, professions, workplace skills, and career development"],
  ["productivity", "Productivity", "organization, focus, workflows, planning, and useful tools"],
  ["relationships", "Relationships", "friendship, communication, dating, family, and social connection"],
  ["parenting", "Parenting", "children, families, caregiving, and parenting resources"],
  ["pets", "Pets", "dogs, cats, companion animals, pet care, and animal stories"],
  ["cars", "Cars", "automobiles, driving, vehicle engineering, and car culture"],
  ["aviation", "Aviation", "aircraft, flying, pilots, airports, and flight history"],
  ["trains", "Trains", "railways, transit, locomotives, routes, and rail history"],
  ["sports", "Sports", "athletics, teams, competitions, outdoor sports, and sports culture"],
  ["esports", "Esports", "competitive gaming, tournaments, teams, and esports culture"],
  ["collecting", "Collecting", "collections, antiques, memorabilia, hobbies, and rare objects"],
  ["shopping", "Shopping", "products, stores, buying guides, independent makers, and marketplaces"],
  ["deals", "Deals", "discounts, price comparisons, bargains, sales, and saving money"],
];

export const VIBES_CATEGORIES = Object.freeze(
  DEFINITIONS.map(([id, label, description]) =>
    Object.freeze({ id, label, description })
  )
);

if (VIBES_CATEGORIES.length !== 130) {
  throw new Error(`Lithe Vibes requires exactly 130 categories; found ${VIBES_CATEGORIES.length}`);
}

let gCategoryEmbeddings = null;

function vectorMagnitude(vector) {
  return Math.sqrt(vector.reduce((total, value) => total + value * value, 0));
}

function cosineSimilarity(left, right) {
  if (!left?.length || left.length !== right?.length) {
    return -1;
  }
  let dot = 0;
  for (let i = 0; i < left.length; i++) {
    dot += left[i] * right[i];
  }
  return dot / Math.max(1e-9, vectorMagnitude(left) * vectorMagnitude(right));
}

export function rankCategoryEmbeddings(
  pageEmbedding,
  categoryEmbeddings,
  limit = 7
) {
  if (!Array.isArray(pageEmbedding) || !Array.isArray(categoryEmbeddings)) {
    return [];
  }
  return VIBES_CATEGORIES.map((category, index) => ({
    id: category.id,
    label: category.label,
    score: cosineSimilarity(pageEmbedding, categoryEmbeddings[index]),
  }))
    .filter(result => Number.isFinite(result.score))
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

function categoryKeywords(category) {
  return `${category.id.replaceAll("-", " ")} ${category.label} ${category.description}`
    .toLowerCase()
    .match(/[a-z][a-z0-9]{2,}/g)
    .filter(word => word.length >= 4);
}

export function classifyVibesTextLexically(text, limit = 7) {
  const haystack = ` ${String(text).toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
  return VIBES_CATEGORIES.map(category => {
    const words = new Set(categoryKeywords(category));
    let hits = 0;
    for (const word of words) {
      if (haystack.includes(` ${word} `)) {
        hits++;
      }
    }
    return {
      id: category.id,
      label: category.label,
      score: hits / Math.max(4, Math.sqrt(words.size) * 2),
    };
  })
    .filter(result => result.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

function categoryPrompt(category) {
  return `A website about ${category.label.toLowerCase()}: ${category.description}.`;
}

function compactText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 6000);
}

export async function classifyVibesTexts(texts, { limit = 7 } = {}) {
  const documents = texts.slice(0, 4).map(compactText);
  if (!documents.length) {
    return [];
  }

  let engine;
  try {
    engine = await createEngine({
      engineId: "lithe-vibes-classifier",
      taskName: "feature-extraction",
      modelId: VIBES_MODEL.id,
      modelRevision: VIBES_MODEL.revision,
      modelHubRootUrl: VIBES_MODEL.root,
      modelHubUrlTemplate: "{model}/{revision}",
      dtype: "q8",
      // Gecko already ships its native ONNX runtime on supported desktop
      // builds. It is faster and avoids a runtime download from Remote Settings.
      backend: "onnx-native",
      device: "cpu",
      numThreads: 2,
      executionPriority: "LOW",
      timeoutMS: 120000,
    });

    const includeCategories = !gCategoryEmbeddings;
    const inputs = includeCategories
      ? [...VIBES_CATEGORIES.map(categoryPrompt), ...documents]
      : documents;
    const embeddings = await engine.run({
      args: [inputs],
      options: { pooling: "mean", normalize: true },
    });

    if (!Array.isArray(embeddings)) {
      throw new Error("The local embedding model returned an unexpected result");
    }
    if (includeCategories) {
      gCategoryEmbeddings = embeddings.slice(0, VIBES_CATEGORIES.length);
    }
    const documentEmbeddings = includeCategories
      ? embeddings.slice(VIBES_CATEGORIES.length)
      : embeddings;
    if (documentEmbeddings.length !== documents.length) {
      throw new Error("The local embedding model returned the wrong batch size");
    }

    return documentEmbeddings.map((embedding, index) => ({
      tags: rankCategoryEmbeddings(embedding, gCategoryEmbeddings, limit),
      source: "bge-small-en-v1.5",
      textLength: documents[index].length,
    }));
  } catch (error) {
    console.error("Lithe Vibes local classification fell back to keywords", error);
    return documents.map(document => ({
      tags: classifyVibesTextLexically(document, limit),
      source: "local-keywords",
      fallbackReason: String(error),
      textLength: document.length,
    }));
  } finally {
    try {
      await engine?.terminate();
    } catch (error) {
      console.error("Lithe Vibes could not release its inference engine", error);
    }
  }
}

export function clearVibesClassifierCacheForTests() {
  gCategoryEmbeddings = null;
}
