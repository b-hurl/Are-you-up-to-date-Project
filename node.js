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
const parser = new Parser();

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function checkOutboundIP() {
    try {
        const res = await axios.get('https://api.ipify.org?format=json', { 
            timeout: 5000 
        });
        console.log(`🌐 Outbound IP (via Tailscale Exit Node): ${res.data.ip}`);
    } catch (e) {
        console.warn(`⚠️ Could not verify outbound IP: ${e.message}`);
    }
}

async function runAutomation() {
    const date = new Date();
    const dateStr = date.toLocaleDateString('en-CA'); // Outputs "YYYY-MM-DD"
    
    // Ensure the output directory exists
    if (!fs.existsSync('./questions')) fs.mkdirSync('./questions');

    let queue = Object.keys(CONFIG);
    const generalRetryLimit = 3; // General retry limit for a category
    const categoryAttempts = {}; // Tracks general attempts for each category
    const _503attempts = {}; // Tracks 503 retries for each category
    const _503RetryLimit = 5; // Specific retry limit for 503 errors

    // Verify the system is actually routing through your home IP
    await checkOutboundIP();

    while (queue.length > 0) {
        const category = queue.shift();
        const filePath = `./questions/${dateStr}-${category}.json`;

        // Prevents redundant API calls if the file was already generated in a previous run
        if (fs.existsSync(filePath)) {
            console.log(`\n⏭️  Category: ${category.toUpperCase()} already exists for ${dateStr}. Skipping.`);
            continue;
        }

        const subreddits = CONFIG[category];
        let redditData = null;
        let lastError = null; // To store the last error encountered

        // Initialize/increment general attempt counter.
        // This counter is only incremented for a new "general" attempt, not for 503-specific retries.
        if ((_503attempts[category] || 0) === 0) {
            categoryAttempts[category] = (categoryAttempts[category] || 0) + 1;
        }

        // Check if general retry limit is reached
        if (categoryAttempts[category] > generalRetryLimit) {
            console.error(`⛔ Max general retries (${generalRetryLimit}) reached for ${category}. Skipping.`);
            // Reset 503 attempts for this category if we're giving up on it
            delete _503attempts[category];
            continue; // Move to the next category in the queue
        }

        console.log(`\n🚀 Category: ${category.toUpperCase()} (General Attempt ${categoryAttempts[category]}/${generalRetryLimit}, 503 Attempts: ${(_503attempts[category] || 0)})`);

        // Dynamic Model Selection: Use 'Pro' for retries to ensure JSON validity
        const modelName = categoryAttempts[category] > 1 ? "gemini-2.5-flash" : "gemini-2.5-flash-lite";
        const model = genAI.getGenerativeModel({ 
            model: modelName, 
            tools: [{ googleSearch: {} }]
        });

        let shouldRetryCategory = false; // Flag to indicate if the category needs to be re-queued for a 503 retry
        
        try {
            // --- Attempt to fetch Reddit data ---
            // This loop tries all subreddits for the category.
            // If all fail, and the last error was a 503, it will trigger a category-level 503 retry.
            // Other errors will fall through to general retry logic.

            // Reset 503 attempts for this category if this is a new general attempt
            if ((_503attempts[category] || 0) === 0) delete _503attempts[category];

            // Try subreddits individually to bypass "multi-sub" scrap-detection filters
            for (const sub of subreddits) {
                try {
                    const rssUrl = `https://www.reddit.com/r/${sub}/.rss`;
                    const response = await axios.get(rssUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                            'Accept': 'application/rss+xml, application/xml;q=0.9, */*;q=0.8',
                            'Cache-Control': 'no-cache'
                        },
                        timeout: 10000
                    });
                    
                    const feed = await parser.parseString(response.data);
                    if (feed.items && feed.items.length > 0) {
                        redditData = feed.items;
                        break; 
                    }
                } catch (e) {
                    lastError = e; // Store the error from the last subreddit attempt
                    console.warn(`   ⚠️ Subreddit r/${sub} failed (Error: ${e.code || e.message}).`);
                    await sleep(45000); // Short pause between individual sub attempts
                }
            }

            if (!redditData) { // If no redditData was obtained after trying all subreddits
                if (lastError && lastError.response?.status === 503) {
                    _503attempts[category] = (_503attempts[category] || 0) + 1;
                    if (_503attempts[category] <= _503RetryLimit) {
                        console.log(`🔄 All subreddits for ${category} failed with 503. Retrying category in 45s (503 attempt ${_503attempts[category]}/${_503RetryLimit})...`);
                        queue.unshift(category); // Add to front of queue to retry immediately
                        await sleep(45000);
                        shouldRetryCategory = true; // Flag to skip Gemini and re-process category
                    } else {
                        console.warn(`⚠️ Max 503 retries reached for ${category}. Falling back to general retry logic.`);
                        // Fall through to general error handling below
                    }
                } else {
                    // Other non-503 errors or no data
                    // Fall through to general error handling below
                }
            }
        } catch (error) { // Catch for errors that prevent iterating subreddits (e.g., initial axios call failure)
            lastError = error;
            if (error.response?.status === 503) {
                _503attempts[category] = (_503attempts[category] || 0) + 1;
                if (_503attempts[category] <= _503RetryLimit) {
                    console.log(`🔄 Reddit fetch for ${category} failed with 503. Retrying category in 45s (503 attempt ${_503attempts[category]}/${_503RetryLimit})...`);
                    queue.unshift(category); // Add to front of queue to retry immediately
                    await sleep(45000);
                    shouldRetryCategory = true; // Flag to skip Gemini and re-process category
                } else {
                    console.warn(`⚠️ Max 503 retries reached for ${category}. Falling back to general retry logic.`);
                    // Fall through to general error handling below
                }
            } else {
                // Fall through to general error handling below
            }
        }

        if (shouldRetryCategory) {
            continue; // Re-process the category immediately due to 503 retry
        }

        // If Reddit data is still null after all attempts (including 503 retries)
        if (!redditData) {
            console.error(`❌ Failed to fetch Reddit data for ${category} after all attempts.`);
            // Reset 503 attempts for this category as we're now moving to general retry or skipping
            delete _503attempts[category];

            // General retry logic for Reddit fetching failures (non-503, or 503 after max retries)
            if (categoryAttempts[category] < generalRetryLimit && (lastError?.response?.status === 403 || !lastError?.response || (lastError?.response?.status === 503 && (_503attempts[category] || 0) > _503RetryLimit))) {
                console.log(`🔄 Transient error (${lastError?.response?.status || 'Network'}) detected. Pushing ${category} back to queue.`);
                queue.push(category);
            } else if (categoryAttempts[category] >= generalRetryLimit) {
                console.error(`⛔ Max general retries reached for ${category}. Skipping.`);
            }
            if (lastError?.response?.status === 404) {
                console.error("   (Check if one of your subreddits is private or banned)");
            }
            console.log(`😴 Waiting 45 seconds to avoid rate limits...`);
            await sleep(45000);
            continue; // Move to next category in queue
        }

        // If we reached here, redditData is available, proceed with Gemini
        try {
            // Reset 503 attempts for this category as Reddit fetch was successful
            delete _503attempts[category];

            const newsPool = redditData
                .filter(item => {
                    const match = (item.content || "").match(/href="([^"]+)">\[link\]/);
                    const sourceUrl = match ? match[1] : item.link;
                    const isReddit = sourceUrl.includes('reddit.com');
                    const isOld = /years ago|anniversary|retro/i.test(item.title);
                    return !isReddit && !isOld;
                })
                .slice(0, 8)
                .map(item => {
                    // Reddit RSS embeds the external article URL in the HTML content as "[link]"
                    const match = (item.content || "").match(/href="([^"]+)">\[link\]/);
                    const sourceUrl = match ? match[1] : item.link;
                    return `Headline: ${item.title} | Source: ${sourceUrl}`;
                })
                .join("\n");

            if (!newsPool) {
                console.warn(`⚠️ No valid links found for ${category}. Skipping.`);
                continue;
            }

            // The "Triple-Lock" Prompt (Verify, Format, Fact-Check)
            const prompt = `Role: Professional Fact-Checker and Trivia Journalist
Today's Date: ${dateStr}
Target Category: ${category}

Instructions:
1. LEADS: Use the following Reddit context ONLY as a list of potential news leads.
2. VERIFICATION: For each lead, you MUST verify the facts via Google Search to ensure the event actually occurred on or around ${dateStr}.
3. NO REDDIT SOURCES: The "source" field in your JSON must be a legitimate news outlet (e.g., CBC, Reuters, BBC, IGN, etc.). Never use a reddit.com link as the source.
4. DISCARD OLD NEWS: If a link refers to a movie, game, or event older than 48 hours, discard it immediately. We only want "Today's News."
5. JSON ONLY: Return nothing but the JSON object.

Reddit Context (Leads Only):
${newsPool}

JSON Structure:
{
  "questions": [
    {
      "q": "Question text based on verified 2026 news?",
      "options": ["Correct Answer", "Wrong", "Wrong", "Wrong"],
      "a": 0,
      "correctText": "Correct Answer",
      "category": "${category.charAt(0).toUpperCase() + category.slice(1)}",
      "source": "https://verified-news-site.com/article-slug"
    }
  ]
}`;

            const result = await model.generateContent(prompt);
            let responseText = result.response.text();
            
            // Robust JSON extraction: find the first '{' and last '}'
            const firstBracket = responseText.indexOf('{');
            const lastBracket = responseText.lastIndexOf('}');

            if (firstBracket === -1 || lastBracket === -1) {
                throw new Error(`Invalid JSON structure received from AI: ${responseText.substring(0, 100)}...`);
            }

            responseText = responseText.substring(firstBracket, lastBracket + 1);
            
            // Validate JSON before saving
            let validated = JSON.parse(responseText); 

            // Manually inject category metadata to ensure frontend compatibility
            if (validated.questions && Array.isArray(validated.questions)) {
                validated.questions = validated.questions.map(q => ({ ...q, category: category.charAt(0).toUpperCase() + category.slice(1) }));
            }

            fs.writeFileSync(filePath, JSON.stringify(validated, null, 2));
            
            console.log(`✅ File Saved: ${filePath}`);

        } catch (error) {
            console.error(`❌ Failed ${category} during Gemini generation: ${error.message}`);
            // Reset 503 attempts for this category as Gemini failed
            delete _503attempts[category];

            // General retry logic for Gemini errors
            if (categoryAttempts[category] < generalRetryLimit) {
                console.log(`🔄 Error during Gemini generation. Pushing ${category} back to queue.`);
                queue.push(category);
            } else {
                console.error(`⛔ Max general retries reached for ${category}. Skipping.`);
            }
        }
        console.log(`😴 Waiting 15 seconds to avoid rate limits...`);
       await sleep(15000); 
    }
    console.log("\n✨ Daily Trivia Update Complete!");
}

runAutomation();