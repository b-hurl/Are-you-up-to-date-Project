const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');
const fs = require('fs');
const Parser = require('rss-parser');
const dir = './questions';

if (!fs.existsSync(dir)){
    fs.mkdirSync(dir);
}

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

// Initialize RSS Parser with a custom User-Agent
const parser = new Parser({
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DailyTriviaBot/1.0' }
});

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY, { apiVersion: "v1beta" });

async function runAutomation() {
    // Initialize model with the Search Tool to prevent hallucinations
    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash", 
        tools: [{ googleSearch: {} }] 
    });

    const date = new Date();
    const dateStr = date.toLocaleDateString('en-CA'); // Outputs "YYYY-MM-DD"
    
    // Ensure the output directory exists
    if (!fs.existsSync('./questions')) fs.mkdirSync('./questions');

    let queue = Object.keys(CONFIG);
    const retryLimit = 3;
    const attempts = {};

    while (queue.length > 0) {
        const category = queue.shift();
        const subreddits = CONFIG[category];
        attempts[category] = (attempts[category] || 0) + 1;

        console.log(`\n🚀 Category: ${category.toUpperCase()} (Attempt ${attempts[category]}/${retryLimit})`);
        
        try {
            let redditData = null;

            // Try subreddits individually to bypass "multi-sub" scrap-detection filters
            for (const sub of subreddits) {
                try {
                    const rssUrl = `https://www.reddit.com/r/${sub}/.rss`;
                    const feed = await parser.parseURL(rssUrl);
                    
                    if (feed.items && feed.items.length > 0) {
                        redditData = feed.items;
                        break; 
                    }
                } catch (e) {
                    console.warn(`   ⚠️ Subreddit r/${sub} failed (Status: ${e.response?.status || 'Network Error'}).`);
                    await sleep(3000); // Short pause between individual sub attempts
                }
            }

            if (!redditData) throw new Error("Could not fetch data from any subreddits in this category.");

            const newsPool = redditData
                .slice(0, 8)
                .map(item => `Headline: ${item.title} | Source: ${item.link}`)
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
            const validated = JSON.parse(responseText); 

            const filePath = `./questions/${dateStr}-${category}.json`;
            fs.writeFileSync(filePath, JSON.stringify(validated, null, 2));
            
            console.log(`✅ File Saved: ${filePath}`);

        } catch (error) {
            console.error(`❌ Failed ${category}: ${error.message}`);

            // Handle 403 (Forbidden), 503 (Service Unavailable), or general fetch/network failures by retrying
            if (attempts[category] < retryLimit && (error.response?.status === 503 || error.response?.status === 403 || !error.response)) {
                console.log(`🔄 Transient error (${error.response?.status || 'Network'}) detected.`);
                if (error.response?.status === 403) {
                    const extraWait = Math.floor(Math.random() * 60000) + 60000; // Wait 1-2 minutes on 403
                    console.log(`⚠️ 403 Forbidden: Reddit IP throttle. Cool-down: ${extraWait/1000}s...`);
                    await sleep(extraWait); 
                }
                queue.push(category);
            }

            if (error.response?.status === 404) {
                console.error("   (Check if one of your subreddits is private or banned)");
            }
        }
        console.log(`😴 Waiting 15 seconds to avoid rate limits...`);
       await sleep(15000); 
    }
    console.log("\n✨ Daily Trivia Update Complete!");
}

runAutomation();