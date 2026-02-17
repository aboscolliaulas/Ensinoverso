
import { GoogleGenAI, Type } from "@google/genai";
import { LessonPlan, QuizQuestion } from "../types";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface ContentPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isQuotaError = error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED');
    if (isQuotaError && retries > 0) {
      console.warn(`Limite de cota atingido. Tentando novamente em ${delay}ms... (${retries} tentativas restantes)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

export const generateLessonPlanFromContent = async (
  subject: string, 
  grade: string, 
  topic: string, 
  contentPart: ContentPart
): Promise<Partial<LessonPlan>> => {
  return withRetry(async () => {
    const ai = getAI();
    const promptPart = {
      text: `Com base no material fornecido, crie um plano de aula para ${grade} sobre "${topic}" em ${subject}.
      
      REGRA CRÍTICA PARA O CAMPO "content": 
      Você deve extrair e transcrever o texto teórico do material RIGOROSAMENTE como ele aparece no original. 
      Mantenha a divisão exata de parágrafos, a pontuação, a estrutura e a ordem das ideias. 
      NÃO resuma, NÃO altere palavras. Transcreva o corpo de texto principal de forma literal.`
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: { parts: [contentPart, promptPart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            objectives: { type: Type.ARRAY, items: { type: Type.STRING } },
            content: { type: Type.STRING, description: "Transcrição INTEGRAL e fiel do texto original" },
            activities: { type: Type.ARRAY, items: { type: Type.STRING } },
            assessment: { type: Type.STRING }
          },
          required: ["title", "objectives", "content", "activities", "assessment"]
        }
      }
    });

    return JSON.parse(response.text);
  });
};

export const generateLessonQuestions = async (contentPart: ContentPart): Promise<QuizQuestion[]> => {
  return withRetry(async () => {
    const ai = getAI();
    const promptPart = {
      text: `Gere exatamente 10 questões de múltipla escolha baseadas no texto fornecido. 
      Cada questão deve ter 4 alternativas. Indique o índice da alternativa correta (0 a 3).`
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: [contentPart, promptPart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING }, minItems: 4, maxItems: 4 },
              correctAnswer: { type: Type.INTEGER }
            },
            required: ["question", "options", "correctAnswer"]
          }
        }
      }
    });

    return JSON.parse(response.text);
  });
};

export const generateQuiz = async (subject: string, grade: string, topic: string, count: number = 5): Promise<QuizQuestion[]> => {
  return withRetry(async () => {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Gere ${count} questões de múltipla escolha sobre "${topic}" para alunos de ${grade} em ${subject}. 4 alternativas por questão.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING }, minItems: 4, maxItems: 4 },
              correctAnswer: { type: Type.INTEGER }
            },
            required: ["question", "options", "correctAnswer"]
          }
        }
      }
    });

    return JSON.parse(response.text);
  });
};

export const generateVisualAid = async (prompt: string): Promise<string | undefined> => {
  return withRetry(async () => {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `Uma ilustração pedagógica: ${prompt}. Estilo educativo, limpo, alta qualidade.` }]
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    return undefined;
  });
};
