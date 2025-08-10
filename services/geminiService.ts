import { GoogleGenAI, Chat, Type, Content } from "@google/genai";
import { CodeFile } from '../types';

let ai: GoogleGenAI | null = null;
let chat: Chat | null = null;

async function getAiInstance(): Promise<GoogleGenAI> {
    if (ai) return ai;
    if (!window.electronAPI) throw new Error("Electron API not available.");
    const apiKey = await window.electronAPI.getGeminiApiKey();
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

export const parseAIResponse = (responseText: string | undefined): { files: CodeFile[]; readmeContent: string } => {
    if (!responseText) {
        throw new Error("The AI returned an empty response. Please try again.");
    }

    let jsonString = responseText.trim();

    // Strategy 1: Look for custom <JSON_START> and <JSON_END> tags
    const customTagMatch = jsonString.match(/<JSON_START>([\s\S]*)<JSON_END>/);
    if (customTagMatch && customTagMatch[1]) {
        jsonString = customTagMatch[1].trim();
    } else {
        // Strategy 2: Look for a JSON markdown block
        const markdownMatch = jsonString.match(/```(json)?\s*(\{[\s\S]*\})\s*```/);
        if (markdownMatch && markdownMatch[2]) {
            jsonString = markdownMatch[2];
        } else {
            // Strategy 3: Fallback to finding the first '{' and last '}'
            const jsonStart = jsonString.indexOf('{');
            const jsonEnd = jsonString.lastIndexOf('}');

            if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
                jsonString = jsonString.substring(jsonStart, jsonEnd + 1);
            }
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


export const initializeChat = async (history: Content[] = []) => {
    const aiInstance = await getAiInstance();
    const systemInstruction = `You are a world-class senior software engineer acting as a coding assistant.
- The user will provide the context of their current project files, followed by their request. You MUST use this context to inform your response. If a file exists in the context, you should update it. If the user asks for a new file, you should create it.
- You can analyze images provided by the user. If they provide a screenshot, use it as a strong visual reference for the UI you generate.
- Your response MUST be a JSON object that strictly adheres to this schema: { "files": [{ "fileName": "...", "code": "..." }], "readmeContent": "..." }.
- CRITICAL: For each file, "fileName" MUST be the full, relative path including directories. For example: 'src/components/Button.tsx' or 'css/styles.css'. This is a mandatory requirement.
- "code" must be the raw, complete code for that file. It is imperative that you do not truncate code or provide incomplete snippets. The entire file content must be present.
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
            maxOutputTokens: 8192,
            thinkingConfig: { thinkingBudget: 2048 },
        },
        history: history,
    });
};

export const sendMessage = async (userContent: Content) => {
  if (!chat) throw new Error("Chat not initialized.");
  // The API requires at least one part, and TypeScript complains if `parts` could be undefined.
  const messageParts = userContent.parts;
  if (!messageParts || messageParts.length === 0) {
    throw new Error("Cannot send an empty message.");
  }
  console.log("[AI] Sending message to Gemini:", userContent);
  const response = await chat.sendMessage({ message: messageParts });
  console.log("[AI] Received raw response from Gemini:", response);
  if (response.candidates?.[0]?.finishReason === 'SAFETY') {
      console.warn("[AI] Gemini request blocked for safety reasons.");
      throw new Error("The request was blocked due to safety concerns. Please modify your prompt and try again.");
  }
  const parsed = parseAIResponse(response.text);
  console.log("[AI] Parsed Gemini response:", parsed);
  return parsed;
};

export const getChatHistory = async (): Promise<Content[] | null> => {
    if (!chat) return null;
    return await chat.getHistory();
};

export const endChatSession = () => {
  chat = null;
};