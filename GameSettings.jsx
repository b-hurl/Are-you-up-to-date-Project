const GameSettings = ({ currentConfig, onUpdate, playedModes = [] }) => {
    const { useState, useEffect } = React;
    const [gameMode, setGameMode] = useState(currentConfig?.gameMode || null); // 'solo' or 'multiplayer'
    const [soloSubMode, setSoloSubMode] = useState(currentConfig?.soloSubMode || null); // 'gauntlet' or 'categories'
    const [gauntletMode, setGauntletMode] = useState(currentConfig?.gauntletMode || null); // 'casual' or 'professional'
    const [selectedCategory, setSelectedCategory] = useState(currentConfig?.activeSelection || null); // Specific category

    const CATEGORIES = ["technology", "science", "sports", "gaming", "entertainment", "books", "health", "business", "world", "canada", "usa"];

    // Reset sub-modes if gameMode changes
    useEffect(() => {
        // Only update internal state if currentConfig is different from current internal state
        if (currentConfig?.gameMode !== gameMode ||
            currentConfig?.soloSubMode !== soloSubMode ||
            currentConfig?.gauntletMode !== gauntletMode ||
            currentConfig?.activeSelection !== selectedCategory) {
            
            setGameMode(currentConfig?.gameMode || null);
            setSoloSubMode(currentConfig?.soloSubMode || null);
            setGauntletMode(currentConfig?.gauntletMode || null);
            setSelectedCategory(currentConfig?.activeSelection || null);
        }
    }, [currentConfig]);

    const handleGameModeSelection = (mode) => {
        setGameMode(mode);
        setSoloSubMode(null); // Reset sub-mode when main mode changes
        setGauntletMode(null);
        setSelectedCategory(null);
        if (mode === 'multiplayer') {
            onUpdate({ gameMode: mode }); // Immediately update for multiplayer
        }
    };

    const handleSoloSubModeSelection = (subMode) => {
        setSoloSubMode(subMode);
        setGauntletMode(null);
        setSelectedCategory(null);
    };

    const handleGauntletModeSelection = (mode) => {
        setGauntletMode(mode);
        onUpdate({
            gameMode: 'solo',
            soloSubMode: 'gauntlet',
            gauntletMode: mode,
            activeSelection: mode // For gauntlet, activeSelection is casual/professional
        });
    };

    const handleCategorySelection = (category) => {
        setSelectedCategory(category);
        onUpdate({
            gameMode: 'solo',
            soloSubMode: 'categories',
            activeSelection: category
        });
    };

    const renderMainMenu = () => (
        <>
            <h2 className="text-2xl font-bold mb-6 text-center">Are You Up To Date?</h2>
            <div className="grid grid-cols-1 gap-4 mb-8">
                <button
                    onClick={() => handleGameModeSelection('solo')}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                        gameMode === 'solo' && !soloSubMode // Highlight if solo is selected but sub-menu not yet
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                >
                    <span className="block font-bold text-lg">Solo Play</span>
                    <span className="text-sm text-gray-600">Test your knowledge against the clock.</span>
                </button>

                <button
                    onClick={() => handleGameModeSelection('multiplayer')}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                        gameMode === 'multiplayer'
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                >
                    <span className="block font-bold text-lg">Play Against Friends</span>
                    <span className="text-sm text-gray-600">Challenge your friends and see who's more up to date.</span>
                </button>
            </div>
            <div className="border-t pt-4">
                <p className="text-center text-gray-500 text-sm italic">Each round consists of 5 questions from your chosen category.</p>
            </div>
        </>
    );

    const renderSoloSubMenu = () => (
        <>
            <h2 className="text-2xl font-bold mb-6 text-center">Solo Play</h2>
            <div className="grid grid-cols-1 gap-4 mb-8">
                <button
                    onClick={() => handleSoloSubModeSelection('gauntlet')}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                        soloSubMode === 'gauntlet'
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                >
                    <span className="block font-bold text-lg">Gauntlet</span>
                    <span className="text-sm text-gray-600">10 questions: Casual or Professional mix.</span>
                </button>

                <button
                    onClick={() => handleSoloSubModeSelection('categories')}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                        soloSubMode === 'categories'
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                >
                    <span className="block font-bold text-lg">Categories</span>
                    <span className="text-sm text-gray-600">5 questions from a specific topic.</span>
                </button>
            </div>
            <button onClick={() => handleGameModeSelection(null)} className="mt-4 text-blue-600 hover:underline">Back to Main Menu</button>
        </>
    );

    const renderGauntletOptions = () => (
        <>
            <h2 className="text-2xl font-bold mb-6 text-center">Gauntlet Mode</h2>
            <div className="grid grid-cols-1 gap-4 mb-8">
                <button
                    onClick={() => handleGauntletModeSelection('casual')}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                        gauntletMode === 'casual'
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                >
                    <span className="block font-bold text-lg">Casual Gauntlet</span>
                    <span className="text-sm text-gray-600">10 questions from entertainment, sports, etc.</span>
                </button>

                <button
                    onClick={() => handleGauntletModeSelection('professional')}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                        gauntletMode === 'professional'
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                >
                    <span className="block font-bold text-lg">Professional Gauntlet</span>
                    <span className="text-sm text-gray-600">10 questions from economy, politics, tech, etc.</span>
                </button>
            </div>
            <button onClick={() => handleSoloSubModeSelection(null)} className="mt-4 text-blue-600 hover:underline">Back to Solo Play</button>
        </>
    );

    const renderCategoryOptions = () => (
        <>
            <h2 className="text-2xl font-bold mb-6 text-center">Select a Category</h2>
            <div className="grid grid-cols-2 gap-3 mb-8 max-h-80 overflow-y-auto p-1">
                {CATEGORIES.map(category => {
                    const isPlayed = playedModes.includes(category);
                    return (
                        <button
                            key={category}
                            disabled={isPlayed}
                            onClick={() => handleCategorySelection(category)}
                            className={`p-3 rounded-lg border-2 transition-all text-left ${
                                isPlayed 
                                ? 'bg-gray-100 border-gray-200 opacity-50 cursor-not-allowed'
                                : selectedCategory === category
                                    ? 'border-blue-600 bg-blue-50'
                                    : 'border-gray-200 hover:border-blue-300'
                            }`}
                        >
                            <span className="block font-bold text-sm capitalize">{category}</span>
                            <span className="text-[10px] text-gray-500">{isPlayed ? 'Completed' : '5 Questions'}</span>
                        </button>
                    );
                })}
            </div>
            <button onClick={() => handleSoloSubModeSelection(null)} className="mt-4 text-blue-600 hover:underline">Back to Solo Play</button>
        </>
    );

    return (
        <div className="p-8 bg-white rounded-xl shadow-lg max-w-md mx-auto">
            {!gameMode && renderMainMenu()}
            {gameMode === 'solo' && !soloSubMode && renderSoloSubMenu()}
            {gameMode === 'solo' && soloSubMode === 'gauntlet' && !gauntletMode && renderGauntletOptions()}
            {gameMode === 'solo' && soloSubMode === 'categories' && renderCategoryOptions()}
        </div>
    );
};

// Attach to window for global access in index.html
window.GameSettings = GameSettings;