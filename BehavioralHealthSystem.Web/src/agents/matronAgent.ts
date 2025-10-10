/**
 * ➕ Matron Agent
 * Specialized agent for collecting user biometric data and preferences
 * Handles data collection, validation, unit conversion, and blob storage
 */

import type { Agent, AgentTool } from '../services/agentOrchestrationService';
import { biometricDataService } from '../services/biometricDataService';

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

    // Initialize biometric data service
    biometricDataService.initializeSession(params.userId);

    // Check if user has existing data
    const existingData = await biometricDataService.loadExistingData(params.userId);

    if (existingData) {
      console.log('➕ Found existing biometric data for user');
      return {
        success: true,
        userId: params.userId,
        hasExistingData: true,
        existingData,
        message: 'Found existing biometric data. You can update any information you like.',
        nextStep: 'Ask what they would like to update'
      };
    }

    return {
      success: true,
      userId: params.userId,
      hasExistingData: false,
      message: 'Biometric collection initialized',
      nextStep: 'Ask for nickname (required field)'
    };
  }
};

/**
 * Tool: Update Biometric Field
 * Progressively updates individual biometric fields (like chat transcript service)
 * Auto-saves after each field update
 */
const updateBiometricFieldTool: AgentTool = {
  name: 'update-biometric-field',
  description: 'Update a single biometric field. Automatically saves progress. Use this after collecting each piece of information.',
  parameters: {
    type: 'object',
    properties: {
      field: {
        type: 'string',
        enum: ['nickname', 'weightKg', 'heightCm', 'gender', 'pronoun', 'lastResidence', 'additionalInfo'],
        description: 'The field to update'
      },
      value: {
        type: 'string',
        description: 'The value for the field (will be converted to appropriate type)'
      }
    },
    required: ['field', 'value']
  },
  handler: async (params: { field: string; value: string }) => {
    console.log(`➕ Updating biometric field: ${params.field} = ${params.value}`);

    try {
      // Convert value to appropriate type
      let processedValue: any = params.value;

      if (params.field === 'weightKg' || params.field === 'heightCm') {
        processedValue = parseFloat(params.value);
        if (isNaN(processedValue)) {
          return {
            success: false,
            error: `Invalid number format for ${params.field}`
          };
        }
      }

      // Update the field in the service
      biometricDataService.updateField(params.field as any, processedValue);

      return {
        success: true,
        field: params.field,
        value: processedValue,
        message: 'Field updated and will be auto-saved shortly'
      };

    } catch (error) {
      console.error('❌ Error updating field:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
};

/**
 * Tool: Add to Array Field
 * Adds an item to hobbies, likes, or dislikes arrays
 * Auto-saves after each addition
 */
const addToArrayFieldTool: AgentTool = {
  name: 'add-to-array-field',
  description: 'Add an item to hobbies, likes, or dislikes. Automatically saves progress.',
  parameters: {
    type: 'object',
    properties: {
      field: {
        type: 'string',
        enum: ['hobbies', 'likes', 'dislikes'],
        description: 'The array field to add to'
      },
      value: {
        type: 'string',
        description: 'The item to add to the array'
      }
    },
    required: ['field', 'value']
  },
  handler: async (params: { field: 'hobbies' | 'likes' | 'dislikes'; value: string }) => {
    console.log(`➕ Adding to ${params.field}: ${params.value}`);

    try {
      biometricDataService.addToArrayField(params.field, params.value);

      return {
        success: true,
        field: params.field,
        value: params.value,
        message: `Added "${params.value}" to ${params.field}. Will be auto-saved shortly.`
      };

    } catch (error) {
      console.error('❌ Error adding to array:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
};

// Track retry attempts for data collection
let collectionAttempts = 0;
const MAX_COLLECTION_ATTEMPTS = parseInt(import.meta.env.VITE_MATRON_MAX_COLLECTION_ATTEMPTS || '2', 10);

/**
 * Tool: Save Biometric Data
 * Saves collected biometric data to Azure Blob Storage
 * Implements retry logic with maximum 2 attempts
 * NOTE: This tool is now deprecated in favor of progressive updates via update-biometric-field
 */
const saveBiometricDataTool: AgentTool = {
  name: 'save-biometric-data',
  description: 'Save the collected biometric data to storage. Will retry up to 2 times on failure.',
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
    collectionAttempts++;
    console.log('➕ ========================================');
    console.log(`➕ MATRON AGENT: Saving Biometric Data (Attempt ${collectionAttempts}/${MAX_COLLECTION_ATTEMPTS})`);
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

      // Save to API (fixed URL - VITE_API_BASE_URL already includes /api)
      const apiUrl = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:7071/api'}/biometric`;
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

      // Reset attempts on success
      collectionAttempts = 0;

      return {
        success: true,
        data: savedData,
        message: `Biometric data for ${params.nickname} saved successfully`
      };
    } catch (error) {
      console.error('➕ Error saving biometric data:', error);

      // Check if we've exceeded max attempts
      const hasRetriesLeft = collectionAttempts < MAX_COLLECTION_ATTEMPTS;

      if (!hasRetriesLeft) {
        console.error(`➕ Maximum collection attempts (${MAX_COLLECTION_ATTEMPTS}) reached. Giving up.`);
        collectionAttempts = 0; // Reset for next user
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: hasRetriesLeft
          ? `Failed to save biometric data. Will retry (${collectionAttempts}/${MAX_COLLECTION_ATTEMPTS})`
          : `Failed to save biometric data after ${MAX_COLLECTION_ATTEMPTS} attempts. Returning to Tars.`,
        shouldReturnToTars: !hasRetriesLeft,
        attemptsRemaining: MAX_COLLECTION_ATTEMPTS - collectionAttempts
      };
    }
  }
};

/**
 * Tool: Get Biometric Data
 * Retrieves the user's saved biometric data for verification or updates
 */
const getBiometricDataTool: AgentTool = {
  name: 'get-biometric-data',
  description: 'Retrieves the user\'s saved biometric data including nickname, preferences, hobbies, likes, and dislikes. Use this to verify what was saved or to pre-populate data for updates.',
  parameters: {
    type: 'object',
    properties: {
      userId: {
        type: 'string',
        description: 'The user identifier'
      }
    },
    required: ['userId']
  },
  handler: async (params: { userId: string }) => {
    const userId = params.userId;
    console.log(`➕ Retrieving biometric data for user: ${userId}`);

    try {
      const apiUrl = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:7071/api'}/biometric/${userId}`;
      const response = await fetch(apiUrl);

      if (!response.ok) {
        if (response.status === 404) {
          return {
            exists: false,
            message: 'No biometric data found for user'
          };
        }
        throw new Error(`Failed to retrieve biometric data: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`➕ Retrieved biometric data:`, data);

      return {
        exists: true,
        data: data,
        nickname: data.nickname,
        lastResidence: data.lastResidence,
        hobbies: data.hobbies,
        likes: data.likes,
        dislikes: data.dislikes,
        additionalInfo: data.additionalInfo,
        message: `User ${data.nickname}'s preferences loaded successfully`
      };
    } catch (error) {
      console.error('➕ Error retrieving biometric data:', error);
      return {
        exists: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to retrieve biometric data'
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
    updateBiometricFieldTool,
    addToArrayFieldTool,
    saveBiometricDataTool, // Deprecated - kept for backward compatibility
    getBiometricDataTool, // For verifying saved data or loading for updates
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
   - **IMMEDIATELY** call 'update-biometric-field' with field='nickname' after they respond
   - This saves progress automatically
   - If they don't provide after 2 attempts, politely skip and use their authenticated name

3. COLLECT PHYSICAL DATA (OPTIONAL - Quick and casual)
   Keep this light and optional:
   - "Mind sharing your height and weight? It's totally optional, but can help personalize your experience."
   - Accept ANY format: "5'10\"", "150 lbs", "178 cm", "68 kg"
   - You'll handle imperial/metric conversion (lbs→kg, inches→cm)
   - **After EACH piece of data**, call 'update-biometric-field' (e.g., field='weightKg', field='heightCm')
   - If they say no or skip, that's perfectly fine!

4. COLLECT IDENTITY INFO (OPTIONAL - Brief)
   "Quick optional questions - feel free to skip any:"
   - Gender identity → **call 'update-biometric-field' with field='gender'**
   - Preferred pronouns → **call 'update-biometric-field' with field='pronoun'**
   - Where you're from → **call 'update-biometric-field' with field='lastResidence'**

5. COLLECT INTERESTS (OPTIONAL - Conversational)
   Keep this fun and natural:
   - "What do you like to do for fun? Any hobbies?"
     → **call 'add-to-array-field' with field='hobbies'** for each hobby
   - "Anything you particularly like or enjoy?"
     → **call 'add-to-array-field' with field='likes'** for each item
   - "Anything you're not a fan of?"
     → **call 'add-to-array-field' with field='dislikes'** for each item

6. ADDITIONAL INFO (OPTIONAL)
   "Anything else you'd like me to know?"
   → **call 'update-biometric-field' with field='additionalInfo'**

7. CLOSE & RETURN
   - Thank them warmly (data is already saved!)
   - Call 'Agent_Tars' to return control

PROGRESSIVE SAVING:
- **DO NOT** wait to collect everything before saving
- Call 'update-biometric-field' or 'add-to-array-field' AFTER EACH PIECE OF DATA
- Data auto-saves 2 seconds after each update
- This prevents data loss if conversation is interrupted

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
1. Thank them: "Perfect! Thanks for sharing that with me, [nickname]."
2. Call 'save-biometric-data' tool with all collected data
3. Check the result:
   - IF success === true:
     * Say: "All set! I've saved your preferences."
     * Hand off: "Let me hand you back to Tars now."
     * Call 'Agent_Tars' tool to return control
   - IF success === false AND shouldReturnToTars === true:
     * Say: "I'm having trouble saving your information right now. Don't worry though, let me hand you back to Tars."
     * Call 'Agent_Tars' tool to return control (even without saved data)
   - IF success === false AND attemptsRemaining > 0:
     * Say: "Hmm, having a little trouble saving that. Let me try once more. Can you confirm your nickname is [nickname]?"
     * Try to re-collect and save again

ERROR HANDLING & RETRY PROTOCOL:
- Maximum 2 attempts to save biometric data
- If first attempt fails: politely ask user to confirm information and retry
- If second attempt also fails: apologize gracefully and return control to Tars
- NEVER get stuck in a loop - always return to Tars after 2 failed attempts
- Be warm and reassuring even when encountering errors

Remember: This is a VOICE conversation. Be brief, warm, and conversational!`
};

export default matronAgent;
