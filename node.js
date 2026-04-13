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

// Calculate edit distance between two strings (standard algorithm)
function levenshteinDistance(s1, s2) {
    const track = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));
    for (let i = 0; i <= s1.length; i += 1) track[0][i] = i;
    for (let j = 0; j <= s2.length; j += 1) track[j][0] = j;
    for (let j = 1; j <= s2.length; j += 1) {
        for (let i = 1; i <= s1.length; i += 1) {
            const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
            track[j][i] = Math.min(
                track[j][i - 1] + 1, // deletion
                track[j - 1][i] + 1, // insertion
                track[j - 1][i - 1] + indicator, // substitution
            );
        }
    }
    return track[s2.length][s1.length];
}

function getLevenshteinSimilarity(s1, s2) {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    if (longer.length === 0) return 1.0;
    return (longer.length - levenshteinDistance(longer, shorter)) / longer.length;
}

async function isUrlLive(url) {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) return false;
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    };
    try {
        // Try HEAD request first (faster, no body download)
        await axios.head(url, { headers, timeout: 5000 });
        return true;
    } catch (e) {
        try {
            // Fallback to GET if HEAD is rejected (common on some news sites)
            await axios.get(url, { headers, timeout: 8000, maxContentLength: 5000 });
            return true;
        } catch (err) {
            return false;
        }
    }
}

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

    let successfulCategories = [];
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
            try {
                const existingData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                const questions = existingData.questions || [];
                
                // Verify count, format, AND live status for existing files
                let allHaveSources = Array.isArray(questions) && questions.length >= 5;
                if (allHaveSources) {
                    for (const q of questions) {
                        if (!(await isUrlLive(q.source))) {
                            allHaveSources = false;
                            break;
                        }
                    }
                }

                if (allHaveSources) {
                    console.log(`\n⏭️  Category: ${category.toUpperCase()} exists and is valid. Skipping.`);
                    successfulCategories.push(category);
                    continue;
                } else {
                    console.log(`\n⚠️  Existing file for ${category} is invalid (count or missing URLs). Re-generating...`);
                }
            } catch (e) {
                console.log(`\n⚠️  Existing file for ${category} is corrupt. Re-generating...`);
            }
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
            const prompt = `CRITICAL CLOCK: ${dateStr} (Current System Time)
TARGET CATEGORY: ${category}

ACT AS: A Breaking News Editor on a 24-hour cycle. 

TASK: Generate exactly 5 trivia questions based EXCLUSIVELY on news events that occurred between 24 hours ago and right now.

### THE "HARD STOP" RULES:
1. DATE ENFORCEMENT: If an event occurred on April 12th or earlier, DISCARD IT. We only want news from the last 24 hours of ${dateStr}.
2. SOURCE VERIFICATION: You MUST use Google Search to confirm the headline is currently "Breaking" or "Live" as of ${dateStr}. 
3. LINK PURITY: The "source" field must be the direct, non-Reddit URL (CBC, Reuters, etc.). If the lead only provides a Reddit link, use Search to find the original article.
4. NO OPINION: Delete any leads involving editorials, "top 10" lists, or movie reviews. Only hard, factual events.
5. EXACT COUNT: Return exactly 5 questions. No preamble.

### REDDIT LEADS (Filter these for today's date only):
${newsPool}

### OUTPUT FORMAT (JSON ONLY):
{
  "questions": [
    {
      "q": "Question text based on a ${dateStr} event?",
      "options": ["Correct Answer", "Wrong", "Wrong", "Wrong"],
      "a": 0,
      "correctText": "Correct Answer",
      "category": "${category}",
      "source": "https://verified-news-site.com/breaking-story-link"
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

            let validQuestions = [];
            let rejectedQuestions = []; // Track questions that failed validation to avoid repeats
            let rawPool = Array.isArray(validated.questions) ? validated.questions : [];

            // Helper to check if a new question is about an event already in the list
            const isDuplicateEvent = async (newQ, existingQs, currentCategory) => {
                if (existingQs.length === 0) return false;
                
                const strictCategories = ['sports', 'politics', 'usa', 'canada'];
                const isStrict = strictCategories.includes(currentCategory.toLowerCase());

                const cleanString = (s) => s.toLowerCase().replace(/[^\w\s]/g, '').trim();
                const cleanedNew = cleanString(newQ);

                const clean = (text) => text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 3);
                const newWords = new Set(clean(newQ));

                for (const existing of existingQs) {
                    const cleanedExisting = cleanString(existing.q);
                    
                    // 1. Levenshtein Check (Great for minor edits/typos)
                    const levSimilarity = getLevenshteinSimilarity(cleanedNew, cleanedExisting);
                    if (levSimilarity > (isStrict ? 0.75 : 0.85)) return true;

                    // 2. Keyword Check (Great for rephrasing with same facts)
                    const threshold = isStrict ? 0.45 : 0.6;
                    const existingWords = clean(existing.q);
                    const overlap = existingWords.filter(w => newWords.has(w)).length;
                    if (overlap / Math.max(existingWords.length, 1) > threshold) return true;
                }

                // Semantic check: Ask Gemini if the events are the same
                const checkPrompt = `Are these two trivia questions about the same news event?
                Q1: "${newQ}"
                Q2: "${existingQs[existingQs.length - 1].q}"
                Answer ONLY 'YES' or 'NO'.`;
                try {
                    const res = await model.generateContent(checkPrompt);
                    return res.response.text().toUpperCase().includes("YES");
                } catch (e) { return false; }
            };

            // Helper to process and validate a single question
            const validateAndRepair = async (q, existingQuestions, currentCategory) => {
                if (!q.q || !q.options || q.a === undefined) return null;
                
                // Check if this event is already covered
                if (await isDuplicateEvent(q.q, existingQuestions, currentCategory)) {
                    console.warn(`   🚫 Duplicate event detected for: "${q.q.substring(0, 40)}..."`);
                    rejectedQuestions.push(q.q);
                    return null;
                }
                
                let source = q.source;
                const hasValidSource = source && typeof source === 'string' && source.trim().startsWith('http');
                
                if (!hasValidSource) {
                    console.log(`🔍 Source missing/invalid for: "${q.q.substring(0, 40)}...". Recovering...`);
                    try {
                        const searchPrompt = `Find the primary news article source URL (not Reddit) for this event from ${dateStr}: "${q.q}". Return ONLY the raw URL.`;
                        const searchResult = await model.generateContent(searchPrompt);
                        source = searchResult.response.text().trim().replace(/[`\s]/g, "");
                    } catch (e) { return null; }
                }

                // Verify if the link is actually reachable (200 OK)
                if (await isUrlLive(source)) {
                    q.source = source;
                    q.category = category.charAt(0).toUpperCase() + category.slice(1);
                    return q;
                }
                console.warn(`   ❌ Link dead for: "${q.q.substring(0, 40)}..." (${source})`);
                rejectedQuestions.push(q.q); // Add to blacklist
                return null;
            };

            // Step 1: Process initial batch from the first AI response
            for (const q of rawPool) {
                const validQ = await validateAndRepair(q, validQuestions, category);
                if (validQ) {
                    validQuestions.push(validQ);
                    if (validQuestions.length >= 5) break;
                }
            }

            // Step 2: Replacement Loop - Request more if we are below the 5-question limit
            let replacementRetries = 0;
            while (validQuestions.length < 5 && replacementRetries < 2) {
                replacementRetries++;
                const needed = 5 - validQuestions.length;
                console.log(`⚠️ Only ${validQuestions.length}/5 questions valid. Requesting ${needed} replacements...`);
                
                try {
                    const retryPrompt = `I need ${needed} more UNIQUE trivia questions for the category "${category}" from news on ${dateStr}.
                    
                    CRITICAL: Do NOT repeat the following topics. They were either already accepted or had dead/invalid source links:
                    - ALREADY ACCEPTED: ${validQuestions.map(v => v.q).join(" | ")}
                    - REJECTED (DEAD LINKS): ${rejectedQuestions.join(" | ")}
                    
                    Please find entirely NEW headlines from ${dateStr} for this category. 
                    Ensure the "source" is a direct news URL (not Reddit) and is functional.
                    Follow the same JSON format as before.`;
                    
                    const retryResult = await model.generateContent(retryPrompt);
                    const retryText = retryResult.response.text();
                    const retryData = JSON.parse(retryText.match(/\{[\s\S]*\}/)?.[0] || "{}");
                    const newQuestions = Array.isArray(retryData.questions) ? retryData.questions : [];

                    for (const q of newQuestions) {
                        try {
                            const validQ = await validateAndRepair(q, validQuestions, category);
                            if (validQ) {
                                validQuestions.push(validQ);
                                if (validQuestions.length >= 5) break;
                            }
                        } catch (e) {}
                    }
                } catch (e) { console.error("Replacement fetch failed", e); }
            }

            // Step 3: Finalize if we hit the limit
            if (validQuestions.length >= 5) {
                const finalData = { questions: validQuestions.slice(0, 5) };
                fs.writeFileSync(filePath, JSON.stringify(finalData, null, 2));
                successfulCategories.push(category);
                console.log(`✅ Category ${category} finalized with 5 valid questions.`);
            } else {
                console.error(`❌ Category ${category} failed: Could only find ${validQuestions.length} valid questions.`);
            }

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

    // Generate the Daily Manifest to optimize frontend probing
    const manifestPath = `./questions/${dateStr}-manifest.json`;
    fs.writeFileSync(manifestPath, JSON.stringify(successfulCategories));

    console.log("\n✨ Daily Trivia Update Complete!");
}

runAutomation();