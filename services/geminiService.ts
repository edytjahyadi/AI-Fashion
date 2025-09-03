import { GoogleGenAI, Modality, Part } from "@google/genai";

const fileToGenerativePart = (dataUrl: string): Part => {
    const match = dataUrl.match(/^data:(image\/.*?);base64,(.*)$/);
    if (!match) {
        throw new Error("Invalid data URL format. Please use a different image.");
    }
    const [, mimeType, base64Data] = match;

    return {
        inlineData: {
            mimeType,
            data: base64Data,
        },
    };
};

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const model = 'gemini-2.5-flash-image-preview';

/**
 * Creates a virtual try-on image with a specific pose.
 * @param modelImage Data URL of an image showing a person.
 * @param clothingImage Data URL of an image of a clothing item.
 * @param poseDescription Text description for the new model pose.
 * @returns A promise that resolves to the data URL of the generated image.
 */
export const createVirtualTryOnImage = async (
    modelImage: string,
    clothingImage: string,
    poseDescription: string
): Promise<string> => {
    try {
        const modelImagePart = fileToGenerativePart(modelImage);
        const clothingImagePart = fileToGenerativePart(clothingImage);
        
        const textPromptPart = {
            text: `Your task is to conduct a virtual fashion photoshoot.
1. First, identify the gender of the model in the first image (male or female).
2. Analyze the clothing item in the second image. Determine if it's a top (shirt, blouse, t-shirt) or a full outfit.
3. Dress the model in the clothing.
   - If the clothing item is a top and the model is male, apply the top and automatically add matching, fashionable men's trousers.
   - If the clothing item is a top and the model is female, apply the top and automatically add a matching, fashionable women's skirt or trousers, whichever best complements the top's style.
   - If the clothing item is already a full set (e.g., a dress, jumpsuit, suit), apply it as is.
4. Reposition the dressed model into a new pose described as: "${poseDescription}". Ensure the pose looks natural, professional, and is appropriate for the identified gender (typically masculine poses for men, elegant feminine poses for women).
5. Place the posed model against a consistent background: "a bright, clean, modern photo studio with soft professional lighting".
6. The final output must be a single, high-quality, photorealistic image with a 3:4 aspect ratio (portrait). There should be no text, artifacts, or unwanted elements.`
        };

        const response = await ai.models.generateContent({
            model,
            contents: {
                parts: [modelImagePart, clothingImagePart, textPromptPart],
            },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });

        const imagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

        if (imagePart?.inlineData) {
            const { data, mimeType } = imagePart.inlineData;
            return `data:${mimeType};base64,${data}`;
        } else {
            const textResponse = response.text?.trim() || "No text response.";
            console.error("API did not return an image. Text response:", textResponse);
            throw new Error(`The AI could not generate an image. Your request might be unsuitable. AI Response: "${textResponse}"`);
        }

    } catch (error) {
        console.error('Error creating image:', error);
        if (error instanceof Error) {
            throw new Error(`Failed to contact AI service: ${error.message}`);
        }
        throw new Error('An unknown error occurred during image generation.');
    }
};