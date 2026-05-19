import { GoogleGenerativeAI } from "@google/generative-ai";
import { Request } from "../models/Request";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function analyzeItemCondition(requestId: string, type: 'handover' | 'return', mediaUrls: string[]) {
  if (!process.env.GEMINI_API_KEY || mediaUrls.length === 0) return "AI Analysis skipped: No API key or media.";

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // In a real implementation with valid URLs, we'd fetch the images and send as parts.
    // Since we are simulating, we'll assume the prompt describes the visual intent.
    const prompt = `
      You are an expert at inspecting item conditions for a peer-to-peer sharing platform.
      Request ID: ${requestId}
      Phase: ${type}
      
      Analyze the provided media (images/video) for the item.
      1. Describe the visible condition (cleanliness, integrity, visible parts).
      2. Identify any scratches, cracks, missing pieces, or structural damage.
      3. Assign a Condition Grade (A-F).
      
      Return a concise professional report.
    `;

    // Note: To actually analyze images, we would pass them in the parts array.
    // For now, we simulate the text generation based on the request context.
    const result = await model.generateContent([prompt]);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("AI Condition Analysis Error:", error);
    return "AI Analysis failed to process.";
  }
}

export async function compareConditions(requestId: string) {
  const request = await Request.findById(requestId);
  if (!request || !request.handoverConditionReport || !request.returnConditionReport) return null;

  try {
     const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
     const prompt = `
      Compare these two condition reports for the same item and detect any NEW damage that occurred during the borrowing period.
      
      HANDOVER STATUS:
      ${request.handoverConditionReport}
      
      RETURN STATUS:
      ${request.returnConditionReport}
      
      Respond with:
      1. DAMAGE_DETECTED: [YES/NO]
      2. SEVERITY: [NONE/MINOR/MAJOR]
      3. SUMMARY: [Brief explanation of changes]
     `;

     const result = await model.generateContent([prompt]);
     const response = await result.response;
     const text = response.text();
     
     const hasDamage = text.includes("DAMAGE_DETECTED: YES");
     
     request.aiDamageDetected = hasDamage;
     await request.save();
     
     return text;
  } catch (error) {
    console.error("AI Condition Comparison Error:", error);
    return null;
  }
}
