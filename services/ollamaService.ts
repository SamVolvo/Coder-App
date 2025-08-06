import { Content } from "@google/genai";
import { CodeFile, OllamaConfig } from '../types';

interface OllamaMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
    images?: string[];
}

const parseOllamaResponse = (responseText: string | undefined): { files: CodeFile[]; readmeContent: string } => {
    if (!responseText) {
        throw new Error("The AI returned an empty response. Please try again.");
    }

    try {
        const parsed = JSON.parse(responseText);
        
        // Basic validation
        if (parsed && Array.isArray(parsed.files) && typeof parsed.readmeContent === 'string') {
            const isValid = parsed.files.every((f: any) => typeof f.fileName === 'string' && typeof f.code === 'string');
            if (isValid) {
                return parsed;
            }
        }
        
        throw new Error("Parsed JSON does not match the expected structure.");

    } catch (e) {
        console.error("Ollama response parsing error:", e, "Raw response from Ollama:", responseText);
        const message = e instanceof Error ? e.message : 'Unknown parsing error.';
        throw new Error(`The AI returned invalid JSON. ${message}`);
    }
};

const convertToOllamaMessages = (history: Content[]): OllamaMessage[] => {
    return history.map(message => {
        const ollamaRole = message.role === 'model' ? 'assistant' : 'user';
        const content = (message.parts || []).map(part => part.text || '').join('\n');
        // Note: Ollama doesn't support images in historical messages via its standard API in this way.
        // We only pass text content for history.
        return { role: ollamaRole, content };
    });
};

export const sendMessage = async (
    userContent: Content,
    projectContext: string,
    history: Content[],
    config: OllamaConfig
): Promise<{ files: CodeFile[]; readmeContent: string }> => {
    if (!window.electronAPI) {
        throw new Error("Electron API is not available.");
    }

    const systemInstruction = `You are a world-class senior software engineer acting as a coding assistant.
- The user will provide the file structure of their project and the content of the currently active file. You MUST use this context to inform your response.
- Your primary task is to generate or update code based on the user's request, focusing on the provided context. Assume you can infer the content of non-active files from the file structure and request if needed, or create new files.
- You can analyze images provided by the user. If they provide a screenshot, use it as a strong visual reference for the UI you generate.
- Your response MUST be a single, valid JSON object that strictly adheres to this schema: { "files": [{ "fileName": "...", "code": "..." }], "readmeContent": "..." }. Do not add any text or markdown before or after the JSON object.
- CRITICAL: For each file, "fileName" MUST be the full, relative path including directories. For example: 'src/components/Button.tsx' or 'css/styles.css'. This is a mandatory requirement.
- "code" must be the raw, complete code for that file.
- "readmeContent" must be the full content for a README.md file, formatted as markdown, explaining how to set up and run the project.
- When asked to update, you must respond with the FULL, updated code for ALL relevant files and an updated readmeContent in the same JSON format.`;
    
    // Limit history to the last 2 messages (1 turn) to reduce input tokens and speed up generation.
    const recentHistory = history.slice(-2);

    const messages: OllamaMessage[] = [
        { role: 'system', content: systemInstruction },
        ...convertToOllamaMessages(recentHistory)
    ];

    const promptText = userContent.parts?.find(p => p.text)?.text || '';
    const imageBase64 = userContent.parts?.find(p => p.inlineData)?.inlineData?.data;

    const finalUserMessage: OllamaMessage = {
        role: 'user',
        content: `${projectContext}USER REQUEST: ${promptText}`,
        images: imageBase64 ? [imageBase64] : undefined
    };
    messages.push(finalUserMessage);

    const responseText = await window.electronAPI.invokeOllama({ config, messages });

    return parseOllamaResponse(responseText);
};