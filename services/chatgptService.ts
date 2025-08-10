import { Content } from "@google/genai";
import { CodeFile } from '../types';

interface OpenAIMessage {
    role: 'system' | 'user' | 'assistant';
    content: any;
}

const parseAIResponse = (responseText: string | undefined): { files: CodeFile[]; readmeContent: string } => {
    if (!responseText) {
        throw new Error("The AI returned an empty response. Please try again.");
    }

    let jsonString = responseText.trim();

    const markdownMatch = jsonString.match(/```(json)?\s*(\{[\s\S]*\})\s*```/);
    if (markdownMatch && markdownMatch[2]) {
        jsonString = markdownMatch[2];
    } else {
        const jsonStart = jsonString.indexOf('{');
        const jsonEnd = jsonString.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
            jsonString = jsonString.substring(jsonStart, jsonEnd + 1);
        }
    }

    if (!jsonString.startsWith('{') || !jsonString.endsWith('}')) {
        console.error("Could not find a valid JSON object in the AI response.", "Raw text:", responseText);
        throw new Error("The AI returned a response that was not valid JSON. Please try again.");
    }

    try {
        const parsed = JSON.parse(jsonString);
        if (Array.isArray(parsed.files) && typeof parsed.readmeContent === 'string') {
            return parsed;
        }
        throw new Error("Parsed JSON does not match the expected structure.");
    } catch (e) {
        console.error("AI response parsing error:", e, "Extracted JSON string:", jsonString, "Original raw text:", responseText);
        throw new Error("The AI returned a response that was not valid JSON. Please try again.");
    }
};

const convertToOpenAIMessages = (history: Content[]): OpenAIMessage[] => {
    return history.map(message => {
        const role = message.role === 'model' ? 'assistant' : 'user';
        const content = (message.parts || []).map(part => part.text || '').join('\n');
        return { role, content };
    });
};

export const sendMessage = async (
    userContent: Content,
    projectContext: string,
    history: Content[]
): Promise<{ files: CodeFile[]; readmeContent: string }> => {
    if (!window.electronAPI) {
        throw new Error("Electron API is not available.");
    }

    const apiKey = await window.electronAPI.getChatgptApiKey();
    if (!apiKey) {
        throw new Error("API key is not set. Please add it in Settings.");
    }

    const systemInstruction = `You are a world-class senior software engineer acting as a coding assistant.
- The user will provide the context of their current project files, followed by their request. You MUST use this context to inform your response.
- Your response MUST be a single JSON object: { "files": [{ "fileName": "...", "code": "..." }], "readmeContent": "..." }.
- For each file, "fileName" MUST be the full, relative path including directories.
- "code" must be the raw, complete code for that file.
- "readmeContent" must be the full content for a README.md file formatted as markdown.
- When asked to update, respond with the FULL updated code for ALL relevant files and an updated readmeContent in the same JSON format.`;

    const messages: OpenAIMessage[] = [
        { role: 'system', content: systemInstruction },
        ...convertToOpenAIMessages(history)
    ];

    const promptText = userContent.parts?.find(p => p.text)?.text || '';
    const imageBase64 = userContent.parts?.find(p => p.inlineData)?.inlineData?.data;

    const userMessageContent: any[] = [{ type: 'text', text: `${projectContext}USER REQUEST: ${promptText}` }];
    if (imageBase64) {
        userMessageContent.push({ type: 'image_url', image_url: `data:image/png;base64,${imageBase64}` });
    }
    messages.push({ role: 'user', content: userMessageContent });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages,
            response_format: { type: 'json_object' }
        })
    });

    const data = await response.json();
    if (!response.ok) {
        const errorMessage = data?.error?.message || 'ChatGPT API request failed.';
        throw new Error(errorMessage);
    }

    const responseText = data.choices?.[0]?.message?.content;
    const parsed = parseAIResponse(responseText);
    return parsed;
};

