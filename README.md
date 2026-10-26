# 🍳 Recipe Bot — AI Culinary & Recipe Assistant

**Recipe Bot** is a modern, full-stack chatbot web application that helps you discover, customize, and cook delicious meals based on the ingredients you already have in your kitchen. Powered by the **Google Gemini API** and an Express backend, it matches ingredients from a curated recipe database and creates intelligent culinary advice, substitution ideas, and step-by-step cooking guides.

---

## ✨ Features

- **🥫 Smart Pantry & Ingredient Matching**: Tell Recipe Bot what you have (e.g. *"I have chicken, spinach, and garlic"*), and it recommends dishes with exact ingredient matches and pantry staples needed.
- **🤖 Powered by Gemini API**: Connects to Google's Gemini models for custom chef recommendations, dietary modifications (keto, vegan, gluten-free), flavor pairings, and technique tips.
- **🛡️ Built-in Offline / Demo Mode**: Works immediately out of the box even before adding your Gemini API key, using an intelligent local recipe matching engine.
- **🎨 Premium Responsive UI**:
  - Distinct user and bot message bubbles with Markdown formatting (tables, lists, bold highlights).
  - Animated typing indicator with cooking whisk dots.
  - Interactive quick suggestion chips for popular meals.
  - Slide-out **Recipe Book Drawer** to browse all recipes and click "Cook This".
  - Sleek **Dark / Light mode** toggle with persistent local storage.
  - Subtle sound chimes on send/receive using the Web Audio API.
  - Voice speech-to-text dictation for hands-free kitchen cooking!
- **📖 Curated Recipe Database (`data/data.json`)**: Contains recipes across Italian, Mexican, Asian, Indian, Mediterranean, and American cuisines with cooking times, steps, and ingredients.

---

## 📁 Project Structure

```text
recipe-bot/
├── .env                  # Environment variables (GEMINI_API_KEY placeholder)
├── .env.example          # Template for environment variables
├── package.json          # Root npm configuration and quick start scripts
├── README.md             # Setup guide and documentation
│
├── backend/              # Node.js + Express backend
│   ├── package.json      # Backend dependencies
│   └── server.js         # Express server with POST /chat and ingredient matching
│
├── data/
│   └── data.json         # Curated recipes (name, ingredients, steps, cookingTime, cuisine)
│
└── frontend/             # Frontend chat interface
    ├── index.html        # HTML structure, suggestion chips, and recipe drawer
    ├── style.css         # Modern culinary design system, themes, and animations
    └── app.js            # Chat UI logic, Markdown parser, speech input, and sound
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: Version 18.0.0 or higher ([Download Node.js](https://nodejs.org/))
- **npm**: Comes bundled with Node.js
- *(Optional)* A **Google Gemini API Key** from [Google AI Studio](https://aistudio.google.com/)

---

### Step 1: Install Dependencies

Open your terminal in the project root directory and run:

```bash
npm install
```

> *Tip: You can also install directly inside the `backend` folder:*
> ```bash
> cd backend
> npm install
> ```

---

### Step 2: Configure Environment Variables

Open the `.env` file in the root directory (or create one by copying `.env.example`):

```env
# Get your free key at: https://aistudio.google.com/
GEMINI_API_KEY=your_gemini_api_key_here

# Server Port (optional, defaults to 3000)
PORT=3000
```

> **Note**: If you don't have a Gemini API key right now, you can leave it as `your_gemini_api_key_here`. Recipe Bot will automatically run in **Demo Mode**, utilizing the local matching engine to suggest recipes from `data/data.json`!

---

### Step 3: Start the Application

Start the Express server:

```bash
npm start
```

Or run directly with Node:

```bash
node backend/server.js
```

You should see:

```text
=================================================
🍳 Recipe Bot server is running!
🌐 URL: http://localhost:3000
📚 Recipes loaded: 12
🔑 Gemini API Key: Configured ✅ (or Demo Mode)
=================================================
```

---

### Step 4: Open in Your Browser

Navigate to:

```text
http://localhost:3000
```

You will see the Recipe Bot chat interface ready to help you cook!

---

## 💡 How to Use Recipe Bot

1. **Enter Your Ingredients**:
   - Type whatever you have in your fridge or pantry:
     - *"I have eggs, cheese, and bread"*
     - *"What can I make with chicken, garlic, and spinach?"*
     - *"I have salmon, rice, soy sauce, and cucumber"*
2. **Use Quick Suggestion Chips**:
   - Click any chip at the top of the chat (e.g. `🍗 Chicken, garlic & spinach`, `⏱️ 15-min quick dinner`, `🥑 Avocado & poached egg`).
3. **Explore the Recipe Book**:
   - Click the **Recipes (12)** button in the top navigation bar to open the slide-out drawer, search recipes, and click **Cook This Recipe**.
4. **Hands-free Cooking with Voice**:
   - Click the microphone icon in the input box to dictate your ingredients while your hands are busy in the kitchen.

---

## 🔌 API Endpoints

### 1. `POST /chat`
Sends the user's message and chat history to the bot. The backend matches relevant recipes from `data/data.json`, constructs a system prompt with recipe context, and calls the Gemini API (or returns a smart local response).

- **Request Body**:
  ```json
  {
    "message": "I have chicken and garlic, what can I cook?",
    "history": []
  }
  ```
- **Response**:
  ```json
  {
    "reply": "### 👨‍🍳 Chef's Pick: Creamy Tuscan Garlic Butter Chicken...",
    "matchedRecipes": [
      {
        "id": "rec-001",
        "name": "Creamy Tuscan Garlic Butter Chicken",
        "cuisine": "Italian",
        "cookingTime": "20 mins",
        "matchedIngredients": ["chicken breast", "garlic"],
        "matchRatio": 60
      }
    ],
    "source": "gemini",
    "status": "success"
  }
  ```

### 2. `GET /api/recipes`
Returns the entire list of sample recipes from `data/data.json`.

### 3. `GET /api/status`
Returns server health and Gemini configuration status.

---

## 🛠️ Customizing Sample Recipes

You can add or modify dishes in `data/data.json`. Each recipe follows this clean schema:

```json
{
  "id": "rec-013",
  "name": "Your Custom Dish",
  "cuisine": "Italian",
  "cookingTime": "25 mins",
  "prepTime": "10 mins",
  "difficulty": "Easy",
  "servings": 2,
  "ingredients": [
    "ingredient 1",
    "ingredient 2"
  ],
  "steps": [
    "Step 1 instruction",
    "Step 2 instruction"
  ],
  "tags": ["quick", "dinner"]
}
```

The backend automatically reloads or incorporates recipes upon server restart.

---

## 📄 License
ISC License — Free to use, modify, and learn from.
