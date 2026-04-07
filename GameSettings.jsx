const MenuButton = ({ onClick, isSelected, isDisabled, title, description, isSmall }) => {
    const baseClasses = `w-full transition-all text-left border-2 ${isSmall ? 'p-4 rounded-2xl' : 'p-5 rounded-2xl'}`;
    const stateClasses = isDisabled
        ? 'bg-slate-900/50 border-slate-800 opacity-30 cursor-not-allowed grayscale'
        : isSelected
            ? 'selected border-primary-400 bg-primary-600/40 shadow-lg shadow-primary-500/20'
            : 'bg-slate-700/50 border-slate-600 hover:border-primary-500 hover:animate-[selection-pulse_2s_infinite_ease-in-out]';

    return (
        <button onClick={onClick} disabled={isDisabled} className={`${baseClasses} ${stateClasses}`}>
            <span className={`block font-bold capitalize leading-tight ${isSmall ? 'text-sm mb-1' : 'text-lg'}`}>
                {title}
            </span>
            {description && (
                <span className={isSmall ? 'text-[9px] text-slate-500 uppercase tracking-tighter font-black block' : 'text-sm text-slate-400'}>
                    {description}
                </span>
            )}
        </button>
    );
};

const MenuView = ({ title, children, footer, onBack, backLabel }) => (
    <>
        <h2 className="text-2xl font-black mb-6 text-center text-white">{title}</h2>
        {children}
        {footer && (
            <div className="border-t border-slate-700 pt-4">
                <p className="text-center text-slate-500 text-[10px] uppercase tracking-widest font-bold">{footer}</p>
            </div>
        )}
        {onBack && (
            <button 
                onClick={onBack} 
                className="mt-4 text-primary-400 hover:text-white font-bold transition-colors flex items-center gap-2 mx-auto uppercase tracking-widest text-[10px]"
            >
                <span>←</span> {backLabel}
            </button>
        )}
    </>
);

const GameSettings = ({ currentConfig, onUpdate, playedModes = [], availableCategories = null }) => {
    const { useState, useEffect } = React;
    const [config, setConfig] = useState({
        gameMode: currentConfig?.gameMode || null,
        soloSubMode: currentConfig?.soloSubMode || null,
        multiSubMode: currentConfig?.multiSubMode || null,
        gauntletMode: currentConfig?.gauntletMode || null,
        activeSelection: currentConfig?.activeSelection || null
    });

    const CATEGORIES = ["technology", "science", "sports", "gaming", "entertainment", "books", "health", "business", "world", "canada", "usa"];

    // Reset sub-modes if gameMode changes
    useEffect(() => {
        setConfig({
            gameMode: currentConfig?.gameMode || null,
            soloSubMode: currentConfig?.soloSubMode || null,
            multiSubMode: currentConfig?.multiSubMode || null,
            gauntletMode: currentConfig?.gauntletMode || null,
            activeSelection: currentConfig?.activeSelection || null
        });
    }, [currentConfig]);

    const handleGameModeSelection = (mode) => {
        setConfig({
            gameMode: mode,
            soloSubMode: null,
            multiSubMode: null,
            gauntletMode: null,
            activeSelection: null
        });
    };

    const handleSoloSubModeSelection = (subMode) => {
        setConfig(prev => ({
            ...prev,
            soloSubMode: subMode,
            gauntletMode: null,
            activeSelection: null
        }));
    };

    const handleMultiSubModeSelection = (subMode) => {
        setConfig(prev => ({
            ...prev,
            multiSubMode: subMode,
            gauntletMode: null,
            activeSelection: null
        }));
    };

    const handleGauntletModeSelection = (mode) => {
        const isSolo = config.gameMode === 'solo';
        setConfig(prev => ({
            ...prev,
            gauntletMode: mode,
            activeSelection: mode
        }));
        onUpdate({
            gameMode: config.gameMode,
            [isSolo ? 'soloSubMode' : 'multiSubMode']: 'gauntlet',
            gauntletMode: mode,
            activeSelection: mode // For gauntlet, activeSelection is casual/professional
        });
    };

    const handleCategorySelection = (category) => {
        const isSolo = config.gameMode === 'solo';
        setConfig(prev => ({
            ...prev,
            activeSelection: category
        }));
        onUpdate({
            gameMode: config.gameMode,
            [isSolo ? 'soloSubMode' : 'categories']: 'categories',
            activeSelection: category
        });
    };


    const renderMainMenu = () => (
        <MenuView title="Are You Up To Date?" footer="Each round consists of 5 questions.">
            <div className="grid grid-cols-1 gap-4 mb-8">
                <MenuButton
                    onClick={() => handleGameModeSelection('solo')}
                    isSelected={config.gameMode === 'solo' && !config.soloSubMode}
                    title="Solo Play"
                    description="Test your knowledge against the clock."
                />

                <MenuButton
                    onClick={() => handleGameModeSelection('multiplayer')}
                    isSelected={config.gameMode === 'multiplayer'}
                    title="Play Against Friends"
                    description="Challenge your friends and see who's more up to date."
                />
            </div>
        </MenuView>
    );

    const renderMultiSubMenu = () => (
        <MenuView title="Multiplayer" onBack={() => handleGameModeSelection(null)} backLabel="Back to Main Menu">
            <div className="grid grid-cols-1 gap-4 mb-8">
                <MenuButton
                    onClick={() => handleMultiSubModeSelection('gauntlet')}
                    isSelected={config.multiSubMode === 'gauntlet'}
                    title="Gauntlet"
                    description="10 questions: Compete on the group leaderboard."
                />

                <MenuButton
                    onClick={() => handleMultiSubModeSelection('categories')}
                    isSelected={config.multiSubMode === 'categories'}
                    title="Categories"
                    description="5 questions: 1v1 challenge mode."
                />
            </div>
        </MenuView>
    );

    const renderSoloSubMenu = () => (
        <MenuView title="Solo Play" onBack={() => handleGameModeSelection(null)} backLabel="Back to Main Menu">
            <div className="grid grid-cols-1 gap-4 mb-8">
                <MenuButton
                    onClick={() => handleSoloSubModeSelection('gauntlet')}
                    isSelected={config.soloSubMode === 'gauntlet'}
                    title="Gauntlet"
                    description="10 questions: Casual or Professional mix."
                />

                <MenuButton
                    onClick={() => handleSoloSubModeSelection('categories')}
                    isSelected={config.soloSubMode === 'categories'}
                    title="Categories"
                    description="5 questions from a specific topic."
                />
            </div>
        </MenuView>
    );

    const renderGauntletOptions = () => (
        <MenuView title="Gauntlet Mode" onBack={() => config.gameMode === 'solo' ? handleSoloSubModeSelection(null) : handleMultiSubModeSelection(null)} backLabel={config.gameMode === 'solo' ? "Back to Solo Play" : "Back to Multiplayer"}>
            <div className="grid grid-cols-1 gap-4 mb-8">
                <MenuButton
                    onClick={() => handleGauntletModeSelection('casual')}
                    isSelected={config.gauntletMode === 'casual'}
                    title="Casual Gauntlet"
                    description="10 questions from entertainment, sports, etc."
                />

                <MenuButton
                    onClick={() => handleGauntletModeSelection('professional')}
                    isSelected={config.gauntletMode === 'professional'}
                    title="Professional Gauntlet"
                    description="10 questions from economy, politics, tech, etc."
                />
            </div>
        </MenuView>
    );

    const renderCategoryOptions = () => (
        <MenuView title="Select a Category" onBack={() => config.gameMode === 'solo' ? handleSoloSubModeSelection(null) : handleMultiSubModeSelection(null)} backLabel={config.gameMode === 'solo' ? "Back to Solo Play" : "Back to Multiplayer"}>
            <div className="grid grid-cols-2 gap-3 mb-8 max-h-80 overflow-y-auto p-1 custom-scrollbar">
                {CATEGORIES.filter(cat =>
                    // Only show category if it has questions available today
                    // or if the data hasn't loaded (or failed to load) yet (null)
                    availableCategories === null || availableCategories.includes(cat)
                ).map(category => {
                    const isPlayed = playedModes.includes(category);
                    return (
                        <MenuButton
                            key={category}
                            onClick={() => handleCategorySelection(category)}
                            isSelected={config.activeSelection === category}
                            isDisabled={isPlayed}
                            isSmall={true}
                            title={category}
                            description={isPlayed ? 'Completed' : '5 Daily Questions'}
                        />
                    );
                })}
            </div>
        </MenuView>
    );

    const renderActiveView = () => {
        if (!config.gameMode) return renderMainMenu();
        if (config.gameMode === 'solo') {
            if (!config.soloSubMode) return renderSoloSubMenu();
            if (config.soloSubMode === 'gauntlet' && !config.gauntletMode) return renderGauntletOptions();
            if (config.soloSubMode === 'categories') return renderCategoryOptions();
        } else if (config.gameMode === 'multiplayer') {
            if (!config.multiSubMode) return renderMultiSubMenu();
            if (config.multiSubMode === 'gauntlet' && !config.gauntletMode) return renderGauntletOptions();
            if (config.multiSubMode === 'categories') return renderCategoryOptions();
        }
        return null;
    };

    return (
        <div className="p-8 bg-slate-800 rounded-3xl shadow-2xl border border-slate-700 max-w-md mx-auto">
            {renderActiveView()}
        </div>
    );
};

// Attach to window for global access in index.html
window.GameSettings = GameSettings;