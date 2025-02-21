import { useState, useEffect } from 'react';
import { Copy, Eye, EyeOff, Github, Linkedin, Shield, Clock, AlertTriangle, Lock } from 'lucide-react';
import { Sun, Moon, Monitor } from "lucide-react";

interface Password {
    value: string;
    timestamp: number;
    strength: string;
    crackTime: string;
    securityScore: number;
}

interface StrengthIndicator {
    score: number;
    label: string;
    color: string;
    barWidth: string;
    time: string;
    securityScore: number;
    tips: string[];
}

type Theme = 'light' | 'dark' | 'hacker';

function App() {
    const [passwordLength, setPasswordLength] = useState(12);
    const [includeSymbols, setIncludeSymbols] = useState(true);
    const [includeNumbers, setIncludeNumbers] = useState(true);
    const [includeUppercase, setIncludeUppercase] = useState(true);
    const [customSet, setCustomSet] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [passwordHistory, setPasswordHistory] = useState<Password[]>([]);
    const [copyMessage, setCopyMessage] = useState('');
    const [theme, setTheme] = useState<Theme>('dark');
    const [strength, setStrength] = useState<StrengthIndicator>({
        score: 0,
        label: '',
        color: '',
        barWidth: '0%',
        time: '',
        securityScore: 0,
        tips: []
    });

    const calculatePasswordStrength = (pwd: string): StrengthIndicator => {
        let score = 0;
        let securityScore = 0;
        const tips: string[] = [];

        const hasLower = /[a-z]/.test(pwd);
        const hasUpper = /[A-Z]/.test(pwd);
        const hasNumber = /[0-9]/.test(pwd);
        const hasSymbol = /[^a-zA-Z0-9]/.test(pwd);
        const hasCommonWord = /password|123456|qwerty|admin/i.test(pwd);
        const hasRepeatingChars = /(.)\1{2,}/.test(pwd);
        const hasSequential = /123|abc|xyz/i.test(pwd);

        if (pwd.length >= 16) {
            securityScore += 40;
        } else if (pwd.length >= 12) {
            securityScore += 30;
        } else if (pwd.length >= 8) {
            securityScore += 20;
        } else {
            tips.push("Increase password length to at least 12 characters");
        }

        if (hasLower) securityScore += 10;
        if (hasUpper) securityScore += 10;
        if (hasNumber) securityScore += 10;
        if (hasSymbol) securityScore += 10;

        if (hasCommonWord) {
            securityScore -= 20;
            tips.push("Avoid common words and patterns");
        }
        if (hasRepeatingChars) {
            securityScore -= 10;
            tips.push("Avoid repeating characters");
        }
        if (hasSequential) {
            securityScore -= 10;
            tips.push("Avoid sequential patterns");
        }

        securityScore = Math.max(0, Math.min(100, securityScore));

        if (pwd.length >= 12) score += 2;
        else if (pwd.length >= 8) score += 1;
        if (hasLower) score += 1;
        if (hasUpper) score += 1;
        if (hasNumber) score += 1;
        if (hasSymbol) score += 1;

        const varietyCount = [hasLower, hasUpper, hasNumber, hasSymbol].filter(Boolean).length;
        if (varietyCount >= 3) score += 1;
        if (varietyCount === 4) score += 1;

        if (securityScore < 100) {
            if (!hasUpper) tips.push("Add uppercase letters");
            if (!hasLower) tips.push("Add lowercase letters");
            if (!hasNumber) tips.push("Add numbers");
            if (!hasSymbol) tips.push("Add special characters");
        }

        const strengthMap = {
            0: { label: 'Very Weak', color: 'bg-red-500', barWidth: '20%', time: 'Instantly' },
            1: { label: 'Weak', color: 'bg-orange-500', barWidth: '40%', time: 'A few seconds' },
            2: { label: 'Moderate', color: 'bg-yellow-500', barWidth: '60%', time: 'A few hours' },
            3: { label: 'Strong', color: 'bg-lime-500', barWidth: '80%', time: 'Several months' },
            4: { label: 'Very Strong', color: 'bg-green-500', barWidth: '90%', time: 'Several years' },
            5: { label: 'Excellent', color: 'bg-emerald-500', barWidth: '100%', time: 'Centuries' }
        };

        const normalizedScore = Math.min(5, Math.floor(score / 2));
        return {
            score: normalizedScore,
            ...strengthMap[normalizedScore as keyof typeof strengthMap],
            securityScore,
            tips
        };
    };

    const generatePassword = () => {
        const symbols = '!@#$%^&*()_+{}[]:;<>,.?/~';
        const numbers = '0123456789';
        const lowercase = 'abcdefghijklmnopqrstuvwxyz';
        const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

        let chars = lowercase;
        if (includeSymbols) chars += symbols;
        if (includeNumbers) chars += numbers;
        if (includeUppercase) chars += uppercase;
        if (customSet) chars = customSet;

        let newPassword = '';
        for (let i = 0; i < passwordLength; i++) {
            newPassword += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        const strengthResult = calculatePasswordStrength(newPassword);
        setPassword(newPassword);
        setStrength(strengthResult);

        const newPasswordEntry: Password = {
            value: newPassword,
            timestamp: Date.now(),
            strength: strengthResult.label,
            crackTime: strengthResult.time,
            securityScore: strengthResult.securityScore
        };

        setPasswordHistory(prev => [newPasswordEntry, ...prev].slice(0, 5));
    };

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopyMessage('Password copied!');
            setTimeout(() => setCopyMessage(''), 2000);
        } catch (err) {
            setCopyMessage('Failed to copy');
        }
    };

    const getThemeStyles = (component?: 'main' | 'secondary' | 'text' | 'background'): string => {
        switch (theme) {
            case 'light':
                if (component === 'main') return 'bg-white/60 border-gray-300';
                if (component === 'secondary') return 'bg-white/70 border-gray-300';
                if (component === 'text') return 'text-gray-800';
                return 'bg-gradient-to-br from-blue-100 via-indigo-200 to-purple-200';
            case 'dark':
                if (component === 'main') return 'bg-gray-800/30 border-gray-600 text-white'; // Added text-white here
                if (component === 'secondary') return 'bg-gray-700/50 border-gray-600';
                if (component === 'text') return 'text-white';
                return 'bg-black animate-gradient bg-gradient-to-br from-black via-purple-950 to-black';
            case 'hacker':
                if (component === 'main') return 'bg-black/80 border-green-500 text-white';
                if (component === 'secondary') return 'bg-black/80 border-green-500';
                if (component === 'text') return 'text-green-500 font-mono';
                return 'bg-black hacker-theme';
            default:
                return '';
        }
    };

    useEffect(() => {
        generatePassword();
    }, []);

    return (
        <div className={`min-h-screen font-['Space_Grotesk'] transition-colors duration-300 animate-gradient ${getThemeStyles('background')}`}>
            <div className="container mx-auto px-6 py-12 flex flex-col items-center">
                <div className="w-full max-w-5xl flex flex-col lg:flex-row gap-10">
                    {/* Main Generator Section */}
                    <div className={`flex-1 p-8 rounded-2xl shadow-2xl glass-effect border ${getThemeStyles('main')}`}>
                        <div className="flex justify-between items-center mb-8">
                            <h1 className={`text-3xl font-bold ${getThemeStyles('text')}`}>
                                Sala7's Password Generator
                            </h1>
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setTheme(prev => {
                                        if (prev === 'light') return 'dark';
                                        if (prev === 'dark') return 'hacker';
                                        return 'light';
                                    })}
                                    aria-label="Toggle Theme"
                                    className={`p-3 rounded-lg transition-all duration-300 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-1 ${getThemeStyles('text')}`}
                                >
                                    {theme === 'light' && <Moon size={24} />}
                                    {theme === 'dark' && <Monitor size={24} />}
                                    {theme === 'hacker' && <Sun size={24} />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-3">
                                <label className={`block text-lg font-medium ${getThemeStyles('text')}`}>Password Length: {passwordLength}</label>
                                <input
                                    type="range"
                                    min="8"
                                    max="32"
                                    value={passwordLength}
                                    onChange={(e) => setPasswordLength(Number(e.target.value))}
                                    className="custom-range"
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="custom-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={includeSymbols}
                                        onChange={(e) => setIncludeSymbols(e.target.checked)}
                                    />
                                    <span className={`ml-3 text-lg ${getThemeStyles('text')}`}>Include Symbols</span>
                                </label>
                                <label className="custom-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={includeNumbers}
                                        onChange={(e) => setIncludeNumbers(e.target.checked)}
                                    />
                                    <span className={`ml-3 text-lg ${getThemeStyles('text')}`}>Include Numbers</span>
                                </label>
                                <label className="custom-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={includeUppercase}
                                        onChange={(e) => setIncludeUppercase(e.target.checked)}
                                    />
                                    <span className={`ml-3 text-lg ${getThemeStyles('text')}`}>Include Uppercase</span>
                                </label>
                            </div>

                            <div>
                                <input
                                    type="text"
                                    value={customSet}
                                    onChange={(e) => setCustomSet(e.target.value)}
                                    placeholder="Custom character set (optional)"
                                    className={`custom-input w-full ${getThemeStyles('text')}`}
                                />
                            </div>
                        </div>

                        <div className="mt-6 relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                readOnly
                                className={`w-full p-4 pr-24 rounded-xl text-xl font-mono focus:outline-none
                  ${getThemeStyles('main')}
                  ${theme === 'hacker' ? 'tracking-wider' : ''}`}
                            />
                            {theme === 'hacker' && (
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 animate-pulse text-green-500">
                                    _
                                </span>
                            )}
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-3">
                                <button
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="p-2 rounded-lg hover:bg-gray-200/20 transition-colors duration-200"
                                >
                                    {showPassword ? <EyeOff size={24} className={getThemeStyles('text')} /> : <Eye size={24} className={getThemeStyles('text')} />}
                                </button>
                                <button
                                    onClick={() => copyToClipboard(password)}
                                    className="p-2 rounded-lg hover:bg-gray-200/20 transition-colors duration-200"
                                >
                                    <Copy size={24} className={getThemeStyles('text')} />
                                </button>
                            </div>
                        </div>

                        {copyMessage && (
                            <div className="text-center text-green-500 mt-4 text-lg font-medium">{copyMessage}</div>
                        )}

                        <div className="mt-6 space-y-4">
                            {/* Security Score */}
                            <div className={`p-4 rounded-xl backdrop-blur-lg border ${getThemeStyles('secondary')}`}>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <Lock size={20} className={
                                            strength.securityScore >= 80 ? 'text-green-500' :
                                                strength.securityScore >= 60 ? 'text-yellow-500' :
                                                    'text-red-500'
                                        } />
                                        <span className={`font-bold text-xl ${getThemeStyles('text')}`}>Security Score: {strength.securityScore}/100</span>
                                    </div>
                                </div>
                                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full transition-all duration-500 ${
                                            strength.securityScore >= 80 ? 'bg-green-500' :
                                                strength.securityScore >= 60 ? 'bg-yellow-500' :
                                                    'bg-red-500'
                                        }`}
                                        style={{ width: `${strength.securityScore}%` }}
                                    />
                                </div>
                                {strength.tips.length > 0 && (
                                    <div className="mt-3">
                                        <h3 className={`font-semibold mb-1 ${getThemeStyles('text')}`}>Improvement Tips:</h3>
                                        <ul className="list-disc list-inside space-y-1">
                                            {strength.tips.map((tip, index) => (
                                                <li key={index} className={`text-sm ${getThemeStyles('text')}`}>{tip}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>

                            {/* Traditional Strength Indicator */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                        <Shield size={20} className={
                                            theme === 'hacker' ? 'text-green-500' : 
                                            theme === 'dark' ? 'text-white' : 
                                            `text-${strength.color}`
                                        } />
                                        <span className={`font-medium text-lg ${getThemeStyles('text')}`}>
                                            Strength: {strength.label}
                                        </span>
                                    </div>
                                    <span className={`text-sm font-medium ${getThemeStyles('text')}`}>
                                        {strength.score}/5
                                    </span>
                                </div>
                                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        className={`strength-bar ${strength.color}`}
                                        style={{ width: strength.barWidth }}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <Clock size={20} className={
                                    theme === 'hacker' ? 'text-green-500' : 
                                    theme === 'dark' ? 'text-white' : 
                                    `text-${strength.color}`
                                } />
                                <span className={`font-medium text-lg ${getThemeStyles('text')}`}>
                                    Time to crack: {strength.time}
                                </span>
                            </div>
                        </div>

                        <button
                            onClick={generatePassword}
                            className="w-full mt-6 py-3 px-6 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-medium text-lg hover:from-purple-700 hover:to-indigo-700 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                        >
                            Generate New Password
                        </button>

                        <div className="mt-4 flex items-center gap-2">
                            <AlertTriangle size={18} className="text-yellow-500" />
                            <p className={`text-sm text-gray-400 ${getThemeStyles('text')}`}>
                                Passwords are not stored or saved anywhere
                            </p>
                        </div>
                    </div>

                    {/* Password History Section */}
                    <div className={`w-full lg:w-96 p-6 rounded-2xl shadow-2xl glass-effect border ${getThemeStyles('secondary')}`}>
                        <h2 className={`text-2xl font-bold mb-4 ${getThemeStyles('text')}`}>
                            Password History
                        </h2>
                        <div className="space-y-3">
                            {passwordHistory.map((entry, index) => (
                                <div
                                    key={index}
                                    className={`p-3 rounded-xl transition-all duration-200 hover:scale-102 border ${getThemeStyles('main')}`}
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        <span className={`font-mono text-sm ${getThemeStyles('text')}`}>
                                            {entry.value}
                                        </span>
                                        <button
                                            onClick={() => copyToClipboard(entry.value)}
                                            className="p-2 rounded-lg hover:bg-gray-200/20 transition-colors duration-200"
                                        >
                                            <Copy size={16} className={getThemeStyles('text')} />
                                        </button>
                                    </div>
                                    <div className="flex justify-between text-xs text-gray-500">
                                        <span className={getThemeStyles('text')}>{entry.strength}</span>
                                        <span className={getThemeStyles('text')}>Score: {entry.securityScore}/100</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-8 flex gap-6">
                    <a
                        href="https://github.com/salahmed-ctrlz"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-3 rounded-full hover:bg-gray-200/20 transition-all duration-300 hover:scale-110"
                    >
                        <Github size={28} className={getThemeStyles('text')} />
                    </a>
                    <a
                        href="https://www.linkedin.com/in/salah-eddine-medkour/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-3 rounded-full hover:bg-gray-200/20 transition-all duration-300 hover:scale-110"
                    >
                        <Linkedin size={28} className={getThemeStyles('text')} />
                    </a>
                </div>
            </div>
        </div>
    );
}

export default App;