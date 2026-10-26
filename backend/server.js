const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables from .env file (check root first, then backend)
const rootEnvPath = path.join(__dirname, '..', '.env');
const localEnvPath = path.join(__dirname, '.env');
if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
} else if (fs.existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath });
} else {
  dotenv.config();
}

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Serve static frontend files
const frontendPath = path.join(__dirname, '..', 'frontend');
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
}

// Load sample recipes from data/data.json
const dataFilePath = path.join(__dirname, '..', 'data', 'data.json');
let recipesData = [];

function loadRecipes() {
  try {
    if (fs.existsSync(dataFilePath)) {
      const rawData = fs.readFileSync(dataFilePath, 'utf8');
      const parsed = JSON.parse(rawData);
      // Handle both array and object with .recipes property
      recipesData = Array.isArray(parsed) ? parsed : (parsed.recipes || []);
      console.log(`[Recipe Bot] Loaded ${recipesData.length} recipes from data.json`);
    } else {
      console.warn(`[Recipe Bot] Warning: data.json not found at ${dataFilePath}`);
      recipesData = [];
    }
  } catch (err) {
    console.error(`[Recipe Bot] Error reading data.json:`, err.message);
    recipesData = [];
  }
}
loadRecipes();

/**
 * Identify relevant recipes based on user ingredients and query keywords
 */
function findRelevantRecipes(userMessage) {
  if (!userMessage || !recipesData.length) return [];
  const text = userMessage.toLowerCase();

  // Common stop words to ignore when extracting ingredients
  const stopWords = new Set([
    'i', 'have', 'got', 'some', 'the', 'a', 'an', 'and', 'or', 'in', 'my', 'fridge',
    'pantry', 'what', 'can', 'make', 'cook', 'recipe', 'recipes', 'for', 'with',
    'please', 'tell', 'me', 'how', 'to', 'want', 'eat', 'dinner', 'lunch', 'breakfast'
  ]);

  const words = text
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));

  const scoredRecipes = recipesData.map(recipe => {
    let score = 0;
    const matchedIngredients = [];
    const recipeIngs = (recipe.ingredients || []).map(i => i.toLowerCase());
    const recipeName = (recipe.name || '').toLowerCase();
    const recipeCuisine = (recipe.cuisine || '').toLowerCase();
    const recipeTags = (recipe.tags || []).map(t => t.toLowerCase());

    // 1. Direct name match
    if (recipeName.includes(text) || text.includes(recipeName)) {
      score += 15;
    }

    // 2. Cuisine match
    if (text.includes(recipeCuisine)) {
      score += 6;
    }

    // 3. Ingredient matching
    recipeIngs.forEach(ing => {
      // Check full ingredient in text
      if (text.includes(ing)) {
        score += 8;
        matchedIngredients.push(ing);
        return;
      }

      // Check ingredient sub-words (e.g. 'chicken', 'egg', 'cheese', 'garlic')
      const ingWords = ing.split(/\s+/).filter(w => w.length > 2);
      for (const ingWord of ingWords) {
        if (words.includes(ingWord) || text.includes(ingWord)) {
          score += 5;
          if (!matchedIngredients.includes(ing)) {
            matchedIngredients.push(ing);
          }
          break;
        }
      }
    });

    // 4. Tag matches
    recipeTags.forEach(tag => {
      if (text.includes(tag)) {
        score += 4;
      }
    });

    // Bonus for higher percentage of ingredients matched
    const totalIngredients = Math.max(recipeIngs.length, 1);
    const matchRatio = matchedIngredients.length / totalIngredients;
    score += Math.round(matchRatio * 10);

    return {
      recipe,
      score,
      matchedIngredients,
      matchRatio: Math.round(matchRatio * 100)
    };
  });

  // Filter and sort by highest score
  const matches = scoredRecipes
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);

  // Return top 4 most relevant recipes, or if none matched, return top 3 default suggestions
  if (matches.length > 0) {
    return matches.slice(0, 4);
  }

  return recipesData.slice(0, 3).map(recipe => ({
    recipe,
    score: 0,
    matchedIngredients: [],
    matchRatio: 0
  }));
}

/**
 * Intelligent fallback generator when Gemini API key is missing or encounters issues
 */
function generateFallbackResponse(userMessage, relevant) {
  const topMatch = relevant[0];
  const hasStrongMatch = topMatch && topMatch.score > 0;

  if (hasStrongMatch) {
    const r = topMatch.recipe;
    const userIngs = topMatch.matchedIngredients.length > 0
      ? topMatch.matchedIngredients.join(', ')
      : 'your ingredients';

    let response = `### 👨‍🍳 Chef's Pick: **${r.name}**\n\n`;
    response += `*Based on what you have (${userIngs}), this dish is a fantastic match!* (${topMatch.matchRatio}% ingredient match)\n\n`;
    response += `| 🌍 Cuisine | ⏱️ Cooking Time | 🥣 Difficulty | 🥗 Servings |\n`;
    response += `| :--- | :--- | :--- | :--- |\n`;
    response += `| **${r.cuisine}** | **${r.cookingTime || '15 mins'}** | **${r.difficulty || 'Easy'}** | **${r.servings || 2} persons** |\n\n`;

    response += `#### 🛒 Ingredients You Need:\n`;
    r.ingredients.forEach(ing => {
      const isMatched = topMatch.matchedIngredients.some(mi => ing.toLowerCase().includes(mi) || mi.includes(ing.toLowerCase()));
      response += `- ${isMatched ? '✅ **' + ing + '** (You have this!)' : '▫️ ' + ing}\n`;
    });

    response += `\n#### 🍳 Step-by-Step Instructions:\n`;
    r.steps.forEach((step, idx) => {
      response += `${idx + 1}. ${step}\n`;
    });

    if (r.tags && r.tags.length > 0) {
      response += `\n🏷️ **Tags:** ${r.tags.map(t => `#${t}`).join(' ')}\n`;
    }

    if (relevant.length > 1 && relevant[1].score > 0) {
      response += `\n---\n💡 *Also consider: **${relevant[1].recipe.name}** (${relevant[1].recipe.cuisine}, ${relevant[1].recipe.cookingTime}). Ask me about it anytime!*`;
    }

    return response;
  }

  // Generic fallback if no specific ingredient matched
  let response = `👋 **Hello! I'm Recipe Bot, your AI culinary assistant.**\n\n`;
  response += `Tell me what ingredients you have in your fridge or pantry (for example: *"I have chicken, spinach, and cream"* or *"Got eggs, cheese, and bread"*), and I'll whip up the perfect recipe for you!\n\n`;
  response += `Here are some popular recipes you can explore:\n`;
  recipesData.slice(0, 5).forEach(r => {
    response += `- **${r.name}** (${r.cuisine}) — *${r.cookingTime}* | Key items: ${r.ingredients.slice(0, 3).join(', ')}\n`;
  });
  response += `\nTry clicking one of the suggestion chips below or typing your available ingredients!`;

  return response;
}

/**
 * Call Gemini API using Google Generative AI SDK or direct fetch
 */
async function callGeminiAPI(userMessage, relevantMatches, history = []) {
  const apiKey = GEMINI_API_KEY.trim();

  // Check if API key is valid / configured
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw new Error('MISSING_API_KEY');
  }

  // Build recipe context from data.json
  const recipeContext = relevantMatches.map(m => ({
    name: m.recipe.name,
    cuisine: m.recipe.cuisine,
    cookingTime: m.recipe.cookingTime,
    difficulty: m.recipe.difficulty,
    ingredients: m.recipe.ingredients,
    steps: m.recipe.steps,
    matchedUserIngredients: m.matchedIngredients
  }));

  const systemPrompt = `You are Recipe Bot, an expert Michelin-level chef, nutritionist, and kitchen companion.
Your mission is to suggest delicious, practical recipes based on the ingredients the user has in their kitchen.

Here is the relevant recipe database context from data.json:
${JSON.stringify(recipeContext, null, 2)}

GUIDELINES:
1. When the user lists ingredients they have (e.g. "I have chicken and garlic" or "eggs and sourdough"):
   - Identify which ingredients they already have.
   - If their ingredients match one of our recipes in the database, recommend that recipe enthusiastically!
   - Highlight the ingredients they have (mark with ✅) and minimal extra pantry staples they need (mark with 🛒).
   - If their ingredients do NOT match any recipe in the database, use your culinary expertise to create a delicious, realistic, tested custom recipe using their exact ingredients!
2. Structure every recipe clearly using clean GitHub-style Markdown:
   - 🍳 **Recipe Name** & Cuisine (e.g., Italian, Mexican, Asian)
   - ⏱️ Cooking Time & Prep Time
   - 🛒 **Ingredients List** (with quantities if possible)
   - 📝 **Step-by-Step Instructions** (numbered, clear and concise)
   - 💡 **Chef's Pro-Tip or Flavor Swap** (secret techniques, wine pairings, or substitution ideas)
3. Keep your tone warm, encouraging, and appetizing.
4. If the user asks general cooking questions, tips on kitchen techniques, or dietary modifications (vegan, keto, gluten-free), give expert culinary advice concisely.`;

  // Try using Google Generative AI SDK first
  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);

    // Use configured GEMINI_MODEL
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: systemPrompt
    });

    const promptText = `User Message: "${userMessage}"\n\nPlease suggest or customize a recipe based on their ingredients and request.`;
    const result = await model.generateContent(promptText);
    const response = await result.response;
    return response.text();
  } catch (sdkErr) {
    console.warn(`[Recipe Bot] SDK call failed (${sdkErr.message}), attempting direct REST fallback...`);

    // REST Fallback directly via native fetch (Node 18+)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const payload = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: `${systemPrompt}\n\nUser Message: ${userMessage}` }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1200
      }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidate) {
      throw new Error('Gemini API returned empty candidate response');
    }
    return candidate;
  }
}

/**
 * POST /chat endpoint
 */
app.post('/chat', async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({
        error: 'Please provide a valid message in the request body.'
      });
    }

    const trimmedMessage = message.trim();
    console.log(`[Recipe Bot] Received chat: "${trimmedMessage}"`);

    // 1. Find relevant recipes from data.json based on ingredients & query
    const relevantMatches = findRelevantRecipes(trimmedMessage);
    const matchedRecipesData = relevantMatches
      .filter(m => m.score > 0)
      .map(m => ({
        id: m.recipe.id,
        name: m.recipe.name,
        cuisine: m.recipe.cuisine,
        cookingTime: m.recipe.cookingTime,
        difficulty: m.recipe.difficulty,
        matchedIngredients: m.matchedIngredients,
        matchRatio: m.matchRatio
      }));

    // 2. Try Gemini API
    const isApiKeyConfigured = Boolean(GEMINI_API_KEY && GEMINI_API_KEY !== 'your_gemini_api_key_here');

    if (isApiKeyConfigured) {
      try {
        const reply = await callGeminiAPI(trimmedMessage, relevantMatches, history);
        return res.json({
          reply,
          matchedRecipes: matchedRecipesData,
          source: 'gemini',
          status: 'success'
        });
      } catch (geminiError) {
        console.error(`[Recipe Bot] Gemini API error: ${geminiError.message}`);
        // Seamless fallback to intelligent local recipe engine
        const fallbackReply = generateFallbackResponse(trimmedMessage, relevantMatches);
        return res.json({
          reply: fallbackReply,
          matchedRecipes: matchedRecipesData,
          source: 'fallback',
          notice: `Using local recipe engine (Gemini API note: ${geminiError.message.includes('API_KEY_INVALID') ? 'Invalid API Key' : 'Check API Quota/Network'}).`,
          status: 'success'
        });
      }
    } else {
      // No API key provided, use local engine
      console.log(`[Recipe Bot] No valid GEMINI_API_KEY configured. Using local recipe engine.`);
      const fallbackReply = generateFallbackResponse(trimmedMessage, relevantMatches);
      return res.json({
        reply: fallbackReply,
        matchedRecipes: matchedRecipesData,
        source: 'local_engine',
        notice: 'Demo mode active. Add your GEMINI_API_KEY in .env for custom AI recipe generation.',
        status: 'success'
      });
    }
  } catch (error) {
    console.error(`[Recipe Bot] Internal Server Error:`, error);
    res.status(500).json({
      error: 'An internal error occurred while processing your request.',
      details: error.message
    });
  }
});

/**
 * GET /api/recipes - Return all available recipes from data.json
 */
app.get('/api/recipes', (req, res) => {
  res.json({
    total: recipesData.length,
    recipes: recipesData
  });
});

/**
 * GET /api/status - Health check and configuration status
 */
app.get('/api/status', (req, res) => {
  const hasKey = Boolean(GEMINI_API_KEY && GEMINI_API_KEY !== 'your_gemini_api_key_here');
  res.json({
    status: 'online',
    appName: 'Recipe Bot',
    hasApiKey: hasKey,
    recipeCount: recipesData.length
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`\n=================================================`);
  console.log(`🍳 Recipe Bot server is running!`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`📚 Recipes loaded: ${recipesData.length}`);
  console.log(`🔑 Gemini API Key: ${GEMINI_API_KEY && GEMINI_API_KEY !== 'your_gemini_api_key_here' ? 'Configured ✅' : 'Not set (Demo mode active) ⚠️'}`);
  console.log(`=================================================\n`);
});
