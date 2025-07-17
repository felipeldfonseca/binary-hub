"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCSVHeaders = exports.checkTradeRules = exports.generateTradeCoach = exports.generateInsight = void 0;
const openai_1 = __importDefault(require("openai"));
const firebase_functions_1 = require("firebase-functions");
// Initialize OpenAI client
const openai = new openai_1.default({
    apiKey: (0, firebase_functions_1.config)().openai.apikey,
});
// InsightGenerator - Weekly analysis
async function generateInsight(data) {
    var _a, _b;
    try {
        const systemPrompt = `Você é um analista de performance de trading de opções binárias especializado em identificar padrões e fornecer insights acionáveis. Analise dados de trading e forneça recomendações práticas para melhorar performance.

DISCLAIMER: Isto não é recomendação de investimento.`;
        const userPrompt = JSON.stringify({
            uid: data.uid,
            kpi: {
                winRate: data.kpi.winRate,
                avgStake: data.kpi.avgStake,
                lossStreak: data.kpi.lossStreak
            },
            ruleBrokenMost: data.ruleBrokenMost || 'Nenhuma regra quebrada identificada'
        });
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            temperature: 0.4,
            max_tokens: 400,
            top_p: 1.0,
            messages: [
                { role: 'system', content: systemPrompt },
                {
                    role: 'user',
                    content: `Analise os dados de trading abaixo e forneça um insight em JSON com chaves "insight", "kpi", "acao". Máximo 120 palavras no campo "insight".\n\n${userPrompt}`
                }
            ]
        });
        const content = (_b = (_a = response.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content;
        if (!content) {
            throw new Error('Empty response from OpenAI');
        }
        // Parse JSON response
        const parsed = JSON.parse(content);
        // Validate response structure
        if (!parsed.insight || !parsed.kpi || !parsed.acao) {
            throw new Error('Invalid response structure from OpenAI');
        }
        firebase_functions_1.logger.info('Insight generated successfully', { uid: data.uid });
        return parsed;
    }
    catch (error) {
        firebase_functions_1.logger.error('Error generating insight:', error);
        // Fallback response
        return {
            insight: `Sua taxa de vitória atual é ${data.kpi.winRate}%. ${data.kpi.lossStreak > 3 ? 'Considere revisar sua estratégia após sequências de perdas.' : 'Continue mantendo a disciplina.'}`,
            kpi: {
                winRate: data.kpi.winRate,
                lossStreak: data.kpi.lossStreak
            },
            acao: 'Mantenha o foco na gestão de risco e siga suas regras de trading.'
        };
    }
}
exports.generateInsight = generateInsight;
// TradeCoach - Motivational coaching
async function generateTradeCoach(data) {
    var _a, _b;
    try {
        const systemPrompt = `Você é um coach motivacional especializado em disciplina de trading. Forneça suporte emocional e motivação para traders que enfrentam desafios.

DISCLAIMER: Isto não é recomendação de investimento.`;
        const userPrompt = `Nome: ${data.firstName}
Situação: ${data.situation}`;
        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            temperature: 0.7,
            max_tokens: 250,
            top_p: 1.0,
            messages: [
                { role: 'system', content: systemPrompt },
                {
                    role: 'user',
                    content: `Forneça motivação em 2 parágrafos curtos e inclua uma citação famosa sobre disciplina.\n\n${userPrompt}`
                }
            ]
        });
        const content = (_b = (_a = response.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content;
        if (!content) {
            throw new Error('Empty response from OpenAI');
        }
        // Extract quote from response (assuming it's in the format "Quote" - Author)
        const quoteMatch = content.match(/"([^"]+)"\s*[-–]\s*([^.]+)/);
        const quote = quoteMatch ? `"${quoteMatch[1]}" - ${quoteMatch[2]}` : '"A disciplina é a ponte entre objetivos e realizações." - Jim Rohn';
        const message = content.replace((quoteMatch === null || quoteMatch === void 0 ? void 0 : quoteMatch[0]) || '', '').trim();
        return {
            message: message || content,
            quote
        };
    }
    catch (error) {
        firebase_functions_1.logger.error('Error generating trade coach response:', error);
        return {
            message: `Olá ${data.firstName}! Lembre-se que perdas fazem parte do processo de aprendizado. O importante é manter a disciplina e seguir seu plano de trading. Cada desafio é uma oportunidade de crescimento.`,
            quote: '"A disciplina é a ponte entre objetivos e realizações." - Jim Rohn'
        };
    }
}
exports.generateTradeCoach = generateTradeCoach;
// RuleChecker - Validate trades against rules
async function checkTradeRules(data) {
    var _a, _b;
    try {
        const systemPrompt = `Você avalia se um trade viola regras pré-definidas de trading. Analise cada regra e determine se foi violada.

DISCLAIMER: Isto não é recomendação de investimento.`;
        const userPrompt = `Trade: ${JSON.stringify(data.trade)}
Rules: ${JSON.stringify(data.rules)}`;
        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            temperature: 0.2,
            max_tokens: 150,
            top_p: 1.0,
            messages: [
                { role: 'system', content: systemPrompt },
                {
                    role: 'user',
                    content: `Retorne JSON com chave "violations" array contendo objetos com "rule", "violated" (boolean) e "reason" (se violada).\n\n${userPrompt}`
                }
            ]
        });
        const content = (_b = (_a = response.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content;
        if (!content) {
            throw new Error('Empty response from OpenAI');
        }
        const parsed = JSON.parse(content);
        return parsed;
    }
    catch (error) {
        firebase_functions_1.logger.error('Error checking trade rules:', error);
        return {
            violations: data.rules.map(rule => ({
                rule,
                violated: false,
                reason: 'Erro na análise automática'
            }))
        };
    }
}
exports.checkTradeRules = checkTradeRules;
// CSVValidator - Validate CSV headers
async function validateCSVHeaders(data) {
    var _a, _b;
    try {
        const systemPrompt = `Você confere cabeçalho de CSV do Ebinex. Compare cabeçalhos recebidos com os esperados e identifique colunas faltantes ou extras.

DISCLAIMER: Isto não é recomendação de investimento.`;
        const userPrompt = `Cabeçalho recebido: ${JSON.stringify(data.receivedHeaders)}
Cabeçalho esperado: ${JSON.stringify(data.expectedHeaders)}`;
        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            temperature: 0.0,
            max_tokens: 120,
            top_p: 1.0,
            messages: [
                { role: 'system', content: systemPrompt },
                {
                    role: 'user',
                    content: `Liste colunas faltantes ou extras em JSON com chaves "missingColumns", "extraColumns", "isValid".\n\n${userPrompt}`
                }
            ]
        });
        const content = (_b = (_a = response.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content;
        if (!content) {
            throw new Error('Empty response from OpenAI');
        }
        const parsed = JSON.parse(content);
        return parsed;
    }
    catch (error) {
        firebase_functions_1.logger.error('Error validating CSV headers:', error);
        const missingColumns = data.expectedHeaders.filter(h => !data.receivedHeaders.includes(h));
        const extraColumns = data.receivedHeaders.filter(h => !data.expectedHeaders.includes(h));
        return {
            missingColumns,
            extraColumns,
            isValid: missingColumns.length === 0 && extraColumns.length === 0
        };
    }
}
exports.validateCSVHeaders = validateCSVHeaders;
//# sourceMappingURL=openai.js.map