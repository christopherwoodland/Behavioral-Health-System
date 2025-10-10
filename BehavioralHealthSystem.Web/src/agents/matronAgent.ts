/**
 * ➕ Matron Agent
 * Specialized agent for collecting user biometric data and preferences
 * Handles data collection, validation, unit conversion, and blob storage
 */

import type { Agent, AgentTool } from '../services/agentOrchestrationService';

/**
 * Tool: Start Biometric Data Collection
 * Initializes the biometric data collection flow with Matron
 */
const startBiometricCollectionTool: AgentTool = {
  name: 'start-biometric-collection',
  description: 'Initialize biometric data collection session with the user',
  parameters: {
    type: 'object',
    properties: {
      userId: {
        type: 'string',
        description: 'The authenticated user ID'
      }
    },
    required: ['userId']
  },
  handler: async (params: { userId: string }) => {
    console.log('➕ ========================================');
    console.log('➕ MATRON AGENT: Starting Biometric Collection');
    console.log('➕ User ID:', params.userId);
    console.log('➕ ========================================');

    // TODO: Initialize biometric collection state
    // This will be implemented when we create the full MatronExperience component

    return {
      success: true,
      userId: params.userId,
      message: 'Biometric collection initialized',
      nextStep: 'Ask for nickname'
    };
  }
};

/**
 * Tool: Save Biometric Data
 * Saves collected biometric data to Azure Blob Storage
 */
const saveBiometricDataTool: AgentTool = {
  name: 'save-biometric-data',
  description: 'Save the collected biometric data to storage',
  parameters: {
    type: 'object',
    properties: {
      userId: {
        type: 'string',
        description: 'The authenticated user ID'
      },
      nickname: {
        type: 'string',
        description: 'User preferred nickname (required)'
      },
      weightKg: {
        type: 'string',
        description: 'Weight in kilograms (optional)'
      },
      heightCm: {
        type: 'string',
        description: 'Height in centimeters (optional)'
      },
      gender: {
        type: 'string',
        description: 'Gender identity (optional)'
      },
      pronoun: {
        type: 'string',
        description: 'Preferred pronouns (optional)'
      },
      lastResidence: {
        type: 'string',
        description: 'Last place of residence (optional)'
      },
      hobbies: {
        type: 'string',
        description: 'Comma-separated list of hobbies (optional)'
      },
      likes: {
        type: 'string',
        description: 'Comma-separated list of things they like (optional)'
      },
      dislikes: {
        type: 'string',
        description: 'Comma-separated list of things they dislike (optional)'
      },
      additionalInfo: {
        type: 'string',
        description: 'Any additional information (optional)'
      }
    },
    required: ['userId', 'nickname']
  },
  handler: async (params: any) => {
    console.log('➕ ========================================');
    console.log('➕ MATRON AGENT: Saving Biometric Data');
    console.log('➕ ========================================');

    try {
      // Prepare data payload
      const biometricData = {
        userId: params.userId,
        nickname: params.nickname,
        weightKg: params.weightKg ? parseFloat(params.weightKg) : null,
        heightCm: params.heightCm ? parseFloat(params.heightCm) : null,
        gender: params.gender || null,
        pronoun: params.pronoun || null,
        lastResidence: params.lastResidence || null,
        hobbies: params.hobbies ? params.hobbies.split(',').map((h: string) => h.trim()) : [],
        likes: params.likes ? params.likes.split(',').map((l: string) => l.trim()) : [],
        dislikes: params.dislikes ? params.dislikes.split(',').map((d: string) => d.trim()) : [],
        additionalInfo: params.additionalInfo || null,
        timestamp: new Date().toISOString(),
        source: 'matron-agent-realtime-api'
      };

      console.log('➕ Saving data:', biometricData);

      // Save to API
      const apiUrl = `${import.meta.env.VITE_API_BASE_URL || ''}/api/biometric`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(biometricData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(`Failed to save biometric data: ${errorData.error || response.statusText}`);
      }

      const savedData = await response.json();
      console.log('➕ Biometric data saved successfully');
      console.log('➕ ========================================');

      return {
        success: true,
        data: savedData,
        message: `Biometric data for ${params.nickname} saved successfully`
      };
    } catch (error) {
      console.error('➕ Error saving biometric data:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to save biometric data'
      };
    }
  }
};

/**
 * Tool: Return to Tars
 * Completes the biometric collection and returns control to Tars coordinator
 */
const returnToTarsTool: AgentTool = {
  name: 'Agent_Tars',
  description: 'Complete biometric collection and return control to Tars coordinator. Call this after successfully saving biometric data.',
  parameters: {
    type: 'object',
    properties: {} as Record<string, { type: string; description: string }>,
    required: []
  },
  handler: async () => {
    console.log('➕ ========================================');
    console.log('➕ MATRON AGENT: Returning to Tars');
    console.log('➕ ========================================');

    return {
      agentSwitch: true,
      targetAgentId: 'Agent_Tars',
      message: 'Biometric collection complete, returning to Tars'
    };
  }
};

/**
 * Matron Agent Configuration
 * Manages biometric data collection with warm, professional approach
 */
export const matronAgent: Agent = {
  id: 'Agent_Matron',
  name: 'Matron',
  description: 'Biometric data and personalization intake coordinator. Call this agent when the user has no biometric data saved and needs initial data collection.',
  tools: [
    startBiometricCollectionTool,
    saveBiometricDataTool,
    returnToTarsTool
  ],
  systemMessage: `You are Matron (➕), the warm and professional biometric intake coordinator. Your role is to collect user biometric data and preferences in a friendly, conversational manner.

IMPORTANT: You are using VOICE conversation via Azure OpenAI Realtime API. Keep responses SHORT and CONVERSATIONAL for natural speech flow.

YOUR PERSONALITY:
- Warm, caring, and patient (like a kind nurse or caring coordinator)
- Professional but approachable
- Use simple, clear language for voice interaction
- Keep explanations brief - this is a voice conversation
- Be encouraging and supportive

DATA COLLECTION WORKFLOW:

1. INTRODUCTION (Keep it brief!)
   "Hi! I'm Matron, your intake coordinator. I'll help us get to know you better. This will just take a minute or two. Sound good?"

2. COLLECT NICKNAME (REQUIRED - Top Priority)
   "First, what would you like me to call you? What's your nickname or preferred name?"
   - This is the ONLY required field
   - If they don't provide after 2 attempts, politely skip and use their authenticated name

3. COLLECT PHYSICAL DATA (OPTIONAL - Quick and casual)
   Keep this light and optional:
   - "Mind sharing your height and weight? It's totally optional, but can help personalize your experience."
   - Accept ANY format: "5'10\"", "150 lbs", "178 cm", "68 kg"
   - You'll handle imperial/metric conversion (lbs→kg, inches→cm)
   - If they say no or skip, that's perfectly fine!

4. COLLECT IDENTITY INFO (OPTIONAL - Brief)
   "Quick optional questions - feel free to skip any:"
   - Gender identity
   - Preferred pronouns
   - Where you're from or last lived

5. COLLECT INTERESTS (OPTIONAL - Conversational)
   Keep this fun and natural:
   - "What do you like to do for fun? Any hobbies?"
   - "Anything you particularly like or enjoy?"
   - "Anything you're not a fan of?"

6. ADDITIONAL INFO (OPTIONAL)
   "Anything else you'd like me to know?"

7. SAVE & CLOSE
   - Call 'save-biometric-data' with collected information
   - Thank them warmly
   - Call 'Agent_Tars' to return control

UNIT CONVERSION RULES:
When users provide imperial measurements, convert to metric before saving:
- Weight: lbs → kg (divide by 2.20462)
- Height: feet/inches → cm (1 foot = 30.48 cm, 1 inch = 2.54 cm)
- Examples: "5'10\"" → 177.8 cm, "150 lbs" → 68.0 kg

VOICE INTERACTION GUIDELINES:
- Keep ALL responses SHORT (1-2 sentences max)
- Ask ONE question at a time
- Don't overwhelm with too many options
- Use natural, flowing speech patterns
- Confirm what you heard: "Got it, so you're 5'10\". That's about 178 centimeters."
- If they give multiple pieces of info at once, that's great! Process it naturally.

OPTIONAL DATA HANDLING:
- NEVER pressure users to provide optional information
- If they say "skip", "pass", "no thanks" → move on cheerfully
- If they don't answer → ask once more gently, then move on
- Nickname is the ONLY required field

COMPLETION PROTOCOL:
After collecting data (at minimum, the nickname):
1. Thank them: "Perfect! Thanks for sharing that with you, [nickname]."
2. Call 'save-biometric-data' tool with all collected data
3. Confirm save: "All set! I've saved your preferences."
4. Hand off: "Let me hand you back to Tars now."
5. Call 'Agent_Tars' tool to return control

Remember: This is a VOICE conversation. Be brief, warm, and conversational!`
};

export default matronAgent;
