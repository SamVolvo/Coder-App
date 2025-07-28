
import { GoogleGenAI, Chat, Type, GenerateContentResponse, Content } from "@google/genai";
import { CodeFile } from '../types';

let ai: GoogleGenAI | null = null;
let chat: Chat | null = null;

async function getAiInstance(): Promise<GoogleGenAI> {
    if (ai) return ai;
    if (!window.electronAPI) throw new Error("Electron API not available.");
    const apiKey = await window.electronAPI.getApiKey();
    if (!apiKey) throw new Error("API key is not set. Please add it in Settings.");
    ai = new GoogleGenAI({ apiKey });
    return ai;
}

const fileSchema = {
    type: Type.OBJECT,
    properties: {
        fileName: {
            type: Type.STRING,
            description: "The full path of the file, including directories if necessary (e.g., 'src/components/Button.tsx')."
        },
        code: {
            type: Type.STRING,
            description: "The complete, raw code for this file. Do not include any markdown formatting."
        }
    },
    required: ["fileName", "code"],
};

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    files: {
        type: Type.ARRAY,
        description: "An array of file objects that make up the project.",
        items: fileSchema,
    },
    readmeContent: {
      type: Type.STRING,
      description: "The content for a README.md file. This should be a helpful guide for the user on how to run this project, including dependencies to install, commands to run, or prerequisites. Format this as a markdown string."
    },
  },
  required: ["files", "readmeContent"],
};

const parseAIResponse = (response: GenerateContentResponse): { files: CodeFile[]; readmeContent: string } => {
    const text = response.text;
    if (!text) {
        const candidate = response.candidates?.[0];
        if (candidate?.finishReason === 'SAFETY') {
            throw new Error("The request was blocked due to safety concerns. Please modify your prompt and try again.");
        }
        throw new Error("The AI returned an empty response. Please try again.");
    }
    try {
        const cleanedJsonString = text.trim().replace(/^```json\s*|```$/g, '');
        const parsed = JSON.parse(cleanedJsonString);
        if (Array.isArray(parsed.files) && typeof parsed.readmeContent === 'string') {
            return parsed;
        }
        throw new Error("Response schema mismatch.");
    } catch (e) {
        console.error("AI response parsing error:", e, "Raw text:", text);
        throw new Error("The AI returned a response that was not valid JSON. Please try again.");
    }
};

export const initializeChat = async (history: Content[] = []) => {
    const aiInstance = await getAiInstance();
    const systemInstruction = `You are a world-class senior software engineer acting as a coding assistant.
- Your response MUST be a JSON object that strictly adheres to this schema: { "files": [{ "fileName": "...", "code": "..." }], "readmeContent": "..." }.
- CRITICAL: For each file, "fileName" MUST be the full, relative path including directories. For example: 'src/components/Button.tsx' or 'css/styles.css'. This is a mandatory requirement.
- "code" must be the raw, complete code for that file.
- "readmeContent" must be the full content for a README.md file, formatted as markdown, explaining how to set up and run the project.
- When asked to update, you must respond with the FULL, updated code for ALL relevant files and an updated readmeContent in the same JSON format.`;

    chat = aiInstance.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema,
            temperature: 0.2,
            topP: 0.8,
            topK: 40,
        },
        history: history,
    });
};

export const sendMessage = async (prompt: string) => {
  if (!chat) throw new Error("Chat not initialized.");
  const response = await chat.sendMessage({ message: prompt });
  return parseAIResponse(response);
};

export const getChatHistory = async (): Promise<Content[] | null> => {
    if (!chat) return null;
    return await chat.getHistory();
};

export const endChatSession = () => {
  chat = null;
};
