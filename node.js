const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');
const fs = require('fs');

// --- 1. CONFIGURATION: ADD CATEGORIES & SUBS HERE ---
const CONFIG = {
    'technology': ['technology', 'tech', 'futurology'],
    'science': ['science', 'space', 'nature'],
    'sports': ['sports', 'nba', 'nfl', 'nhl'],
    'gaming': ['games', 'pcgaming', 'nintendo'],
    'entertainment': ['movies', 'television', 'music'],
    'books': ['books', 'literature'],
    'health': ['health', 'fitness', 'nutrition'],
    'business': ['business', 'finance', 'economics'],
    'world': ['worldnews', 'news', 'geopolitics'],
    'canada': ['canada', 'canadapolitics', 'canadanews'],
    'usa': ['news', 'politics']

};
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function runAutomation() {
    // Initialize model with the Search Tool to prevent hallucinations
    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash", 
        tools: [{ googleSearch: {} }] 
    });

   // NEW (Local - matches your actual clock)
const date = new Date();
const dateStr = date.toLocaleDateString('en-CA'); // Outputs "2026-04-06"
    
    // Ensure the output directory exists
    if (!fs.existsSync('./questions')) fs.mkdirSync('./questions');

    for (const [category, subreddits] of Object.entries(CONFIG)) {
        console.log(`\n🚀 Category: ${category.toUpperCase()}`);
        
        try {
            // Fetch Hot Reddit Posts
            const multiSub = subreddits.join('+');
            const redditUrl = `https://www.reddit.com/r/${multiSub}/hot.json?limit=12`;
            
            const redditRes = await axios.get(redditUrl, {
                headers: { 'User-Agent': 'v1:TriviaBot:1.0 (by /u/YourUsername)' }
            });

            // Extract External Links (ignoring ads/stickies/videos)
            const newsPool = redditRes.data.data.children
                .filter(p => !p.data.is_self && !p.data.over_18 && !p.data.is_video)
                .slice(0, 8)
                .map(p => `Headline: ${p.data.title} | Source: ${p.data.url}`)
                .join("\n");

            if (!newsPool) {
                console.warn(`⚠️ No valid links found for ${category}. Skipping.`);
                continue;
            }

            // The "Triple-Lock" Prompt (Verify, Format, Fact-Check)
            const prompt = `Today is ${dateStr}.Generate 5 trivia questions for "${category}".
            1. Use Google Search to verify the facts in these headlines and that the news is from today's date.
            2. If a headline is rumor or opinion, ignore it.
            3. Return ONLY a valid JSON object.
            
            Context from Reddit:
            ${newsPool}

            Required JSON Structure:
            {
              "questions": [
                {
                  "q": "Question text here?",
                  "options": ["Correct", "Wrong", "Wrong", "Wrong"],
                  "a": 0,
                  "correctText": "Correct",
                  "source": "URL to the news story"
                }
              ]
            }`;

            const result = await model.generateContent(prompt);
            let responseText = result.response.text();
            
            // Clean AI formatting (remove markdown blocks)
            responseText = responseText.replace(/```json|```/g, "").trim();
            
            // Validate JSON before saving
            JSON.parse(responseText); 

            const filePath = `./questions/${dateStr}-${category}.json`;
            fs.writeFileSync(`./questions/${dateStr}-${category}.json`, JSON.stringify(validated, null, 2));
            
            console.log(`✅ File Saved: ${filePath}`);

        } catch (error) {
            console.error(`❌ Failed ${category}: ${error.message}`);
            if (error.response?.status === 404) {
                console.error("   (Check if one of your subreddits is private or banned)");
            }
        }
        console.log(`😴 Waiting 15 seconds to avoid rate limits...`);
       await sleep(15000); 
        }
    }
    console.log("\n✨ Daily Trivia Update Complete!");


runAutomation();