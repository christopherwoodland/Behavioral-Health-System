/**
 * 🎤 Vocalist Agent
 * Specialized agent for conducting mental/vocal assessments through 35-second voice recordings
 * Handles recording workflow, content display, WAV export, and analysis integration
 */

import type { Agent, AgentTool } from '../services/agentOrchestrationService';

// Track recording attempts for max 2 attempts protocol
let recordingAttempts = 0;
const MAX_RECORDING_ATTEMPTS = 2;

/**
 * Tool: Start Vocalist Recording
 * Initializes the 35-second recording workflow
 */
const startRecordingTool: AgentTool = {
  name: 'start-vocalist-recording',
  description: 'Start a 35-second voice recording session for mental/vocal assessment',
  parameters: {
    type: 'object',
    properties: {
      userId: {
        type: 'string',
        description: 'The authenticated user ID'
      },
      contentType: {
        type: 'string',
        enum: ['lyrics', 'story'],
        description: 'Type of content to display: lyrics (Rocket Man) or story (~1.5 pages)'
      }
    },
    required: ['userId']
  },
  handler: async (params: { userId: string; contentType?: string }) => {
    recordingAttempts++;
    console.log('🎤 ========================================');
    console.log(`🎤 VOCALIST AGENT: Starting Recording (Attempt ${recordingAttempts}/${MAX_RECORDING_ATTEMPTS})`);
    console.log('🎤 User ID:', params.userId);
    console.log('🎤 Content Type:', params.contentType || 'lyrics');
    console.log('🎤 ========================================');

    const contentType = params.contentType || 'lyrics';

    return {
      success: true,
      userId: params.userId,
      contentType,
      duration: 35,
      attemptsRemaining: MAX_RECORDING_ATTEMPTS - recordingAttempts,
      message: `Recording session initialized. Display ${contentType} and start countdown from 35 seconds.`,
      instruction: 'User should read the displayed content aloud during the 35-second recording.'
    };
  }
};

/**
 * Tool: Complete Recording
 * Validates recording duration and prepares for submission
 */
const completeRecordingTool: AgentTool = {
  name: 'complete-vocalist-recording',
  description: 'Complete the recording and validate duration. Returns success if exactly 35 seconds, otherwise prompts for retry.',
  parameters: {
    type: 'object',
    properties: {
      userId: {
        type: 'string',
        description: 'The authenticated user ID'
      },
      durationSeconds: {
        type: 'string',
        description: 'Actual duration of the recording in seconds'
      },
      audioFormat: {
        type: 'string',
        description: 'Format of the audio file (should be WAV)'
      }
    },
    required: ['userId', 'durationSeconds', 'audioFormat']
  },
  handler: async (params: { userId: string; durationSeconds: string; audioFormat: string }) => {
    const duration = parseFloat(params.durationSeconds);
    console.log('🎤 ========================================');
    console.log('🎤 VOCALIST AGENT: Completing Recording');
    console.log('🎤 Duration:', duration, 'seconds');
    console.log('🎤 Format:', params.audioFormat);
    console.log('🎤 ========================================');

    // Validate format
    if (params.audioFormat.toLowerCase() !== 'wav') {
      return {
        success: false,
        error: 'Invalid audio format. Must be WAV.',
        shouldRetry: recordingAttempts < MAX_RECORDING_ATTEMPTS,
        attemptsRemaining: MAX_RECORDING_ATTEMPTS - recordingAttempts,
        message: 'Recording must be in WAV format. Please try again.'
      };
    }

    // Validate duration (allow small tolerance of +/- 1 second)
    if (duration < 34 || duration > 36) {
      const shouldRetry = recordingAttempts < MAX_RECORDING_ATTEMPTS;

      if (!shouldRetry) {
        console.log('🎤 Maximum recording attempts reached. Returning to Tars.');
        recordingAttempts = 0; // Reset for next user
        return {
          success: false,
          error: `Recording must be exactly 35 seconds. Your recording was ${duration} seconds.`,
          shouldRetry: false,
          shouldReturnToTars: true,
          message: `Maximum recording attempts (${MAX_RECORDING_ATTEMPTS}) reached. Returning to Tars.`
        };
      }

      return {
        success: false,
        error: `Recording must be exactly 35 seconds. Your recording was ${duration} seconds.`,
        shouldRetry: true,
        attemptsRemaining: MAX_RECORDING_ATTEMPTS - recordingAttempts,
        message: 'Recording duration incorrect. Please try again and ensure you record for exactly 35 seconds.'
      };
    }

    // Recording is valid
    console.log('🎤 Recording validated successfully');
    recordingAttempts = 0; // Reset for next user

    return {
      success: true,
      duration,
      format: params.audioFormat,
      message: 'Recording completed successfully. Ready for analysis submission.',
      nextStep: 'Submit to analysis pipeline with pre-filled biometric data'
    };
  }
};

/**
 * Tool: Submit for Analysis
 * Submits the validated recording to the analysis pipeline
 */
const submitForAnalysisTool: AgentTool = {
  name: 'submit-vocalist-analysis',
  description: 'Submit the validated recording to the analysis pipeline with pre-filled patient information from biometric data',
  parameters: {
    type: 'object',
    properties: {
      userId: {
        type: 'string',
        description: 'The authenticated user ID'
      },
      audioFileUrl: {
        type: 'string',
        description: 'URL or path to the recorded WAV file'
      }
    },
    required: ['userId', 'audioFileUrl']
  },
  handler: async (params: { userId: string; audioFileUrl: string }) => {
    console.log('🎤 ========================================');
    console.log('🎤 VOCALIST AGENT: Submitting for Analysis');
    console.log('🎤 User ID:', params.userId);
    console.log('🎤 Audio File:', params.audioFileUrl);
    console.log('🎤 ========================================');

    try {
      // Fetch biometric data to pre-fill patient info
      const apiUrl = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:7071/api'}/biometric/${params.userId}`;
      const bioResponse = await fetch(apiUrl);

      let patientInfo: any = {};
      if (bioResponse.ok) {
        const bioData = await bioResponse.json();
        patientInfo = {
          age: bioData.age || null,
          weight: bioData.weightKg || null,
          height: bioData.heightCm || null,
          gender: bioData.gender || null
        };
        console.log('🎤 Pre-filled patient info:', patientInfo);
      } else {
        console.warn('🎤 Could not fetch biometric data, submitting without pre-fill');
      }

      // Submit to analysis pipeline
      // Note: This will be implemented when integrating with the analysis workflow (Task 7)
      return {
        success: true,
        userId: params.userId,
        audioFileUrl: params.audioFileUrl,
        patientInfo,
        message: 'Recording submitted for analysis with patient information.',
        nextStep: 'Return to Tars'
      };

    } catch (error) {
      console.error('🎤 Error submitting for analysis:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to submit recording for analysis.'
      };
    }
  }
};

/**
 * Tool: Return to Tars
 * Completes the recording workflow and returns control to Tars coordinator
 */
const returnToTarsTool: AgentTool = {
  name: 'Agent_Tars',
  description: 'Complete vocalist recording workflow and return control to Tars coordinator. Call this after successfully submitting recording or after max attempts reached.',
  parameters: {
    type: 'object',
    properties: {} as Record<string, { type: string; description: string }>,
    required: []
  },
  handler: async () => {
    console.log('🎤 ========================================');
    console.log('🎤 VOCALIST AGENT: Returning to Tars');
    console.log('🎤 ========================================');

    // Reset attempts counter
    recordingAttempts = 0;

    return {
      agentSwitch: true,
      targetAgentId: 'Agent_Tars',
      message: 'Vocalist recording complete, returning to Tars'
    };
  }
};

/**
 * Vocalist Agent Configuration
 * Manages 35-second voice recording workflow for mental/vocal assessment
 */
export const vocalistAgent: Agent = {
  id: 'Agent_Vocalist',
  name: 'Vocalist',
  description: 'Voice recording coordinator for 35-second vocal analysis exercises. Call this agent when user requests "song analysis", "let\'s sing", "voice recording", or "vocal exercise".',
  tools: [
    startRecordingTool,
    completeRecordingTool,
    submitForAnalysisTool,
    returnToTarsTool
  ],
  systemMessage: `You are the Vocalist Agent (🎤), a specialized coordinator for mental and vocal assessments through voice recording.

IMPORTANT: You are using VOICE conversation via Azure OpenAI Realtime API. Keep responses SHORT and CONVERSATIONAL for natural speech flow.

YOUR ROLE:
- Guide users through a 35-second voice recording session
- Explain the recording process clearly BEFORE starting
- Display content (lyrics or story) for them to read aloud
- Ensure recording meets technical requirements (35 seconds, WAV format)
- Submit validated recordings for analysis
- Maximum 2 recording attempts per session

CRITICAL: You MUST explain the exercise and get user preference BEFORE calling 'start-vocalist-recording'. The recording UI should ONLY appear after you've explained everything.

RECORDING WORKFLOW:

1. INTRODUCTION (Keep it brief!)
   ALWAYS start your FIRST message by introducing yourself AND acknowledging their request:
   - Review the conversation history to see what the user said to Tars
   - Acknowledge their specific request (e.g., "I heard you'd like to do the song analysis", "I see you want to try the voice recording exercise")
   - Then introduce yourself: "Hi! I'm the Vocalist agent. I'll guide you through a 35-second voice recording exercise."

   This introduction helps the user know that:
   a) You heard what they asked for (they don't need to repeat themselves)
   b) A different agent is now talking to them

2. EXPLAIN PROCESS (Do this BEFORE starting the recording!)
   "Here's what we'll do: I'll display some content - either song lyrics or a short story. You'll read it aloud for exactly 35 seconds while I record. The recording captures your voice patterns and speech characteristics for analysis."

3. ASK PREFERENCE (Still just talking - NO recording yet!)
   "Would you prefer to read a poetic passage or a short story?"
   - If they choose passage/poem/lyrics, use contentType='lyrics'
   - If they choose story, use contentType='story'
   - If they don't have a preference, default to 'lyrics'

4. CONFIRM AND START RECORDING (NOW call the tool)
   - Say: "Perfect! When I start the recording, you'll see a countdown timer from 35 to 0. Just read the content naturally and keep going until the timer hits zero. Ready?"
   - Wait for their confirmation (Ready/Yes/Let's do it)
   - THEN call 'start-vocalist-recording' with userId and contentType
   - After calling the tool, say: "Great! Starting now - the timer is running!"
   - The UI will handle:
     * Displaying the content
     * Starting the countdown timer (35 to 0)
     * Recording the audio
     * Saving as WAV format

5. VALIDATE RECORDING
   After the recording ends:
   - Call 'complete-vocalist-recording' with userId, durationSeconds, and audioFormat
   - Check the result:
     * IF success === true:
       → Say: "Perfect! Your recording was exactly 35 seconds. Let me submit this for analysis."
       → Call 'submit-vocalist-analysis' with userId and audioFileUrl
       → Say: "All done! I've submitted your recording. Let me hand you back to Tars."
       → Call 'Agent_Tars' to return control

     * IF success === false AND shouldRetry === true:
       → Say: "The recording was [too short/too long/wrong format]. You have [X] attempts remaining. Let's try again. Ready?"
       → Restart from step 4 (call 'start-vocalist-recording')

     * IF success === false AND shouldReturnToTars === true:
       → Say: "We've reached the maximum attempts for this recording session. Don't worry, we can try again later. Let me hand you back to Tars."
       → Call 'Agent_Tars' to return control

ERROR HANDLING & RETRY PROTOCOL:
- Maximum 2 recording attempts per session
- Reasons for retry:
  * Duration not exactly 35 seconds (±1 second tolerance)
  * Wrong audio format (must be WAV)
- After 2 failed attempts: gracefully return to Tars
- NEVER get stuck in a loop - always return to Tars after max attempts

TECHNICAL REQUIREMENTS:
- Recording Duration: Exactly 35 seconds (34-36 seconds accepted with tolerance)
- Audio Format: WAV only
- Content Display: Either poetic passage OR short story (~1.5 pages)
- Timer: Visual countdown from 35 to 0
- Attempts: Maximum 2 per session

VOICE INTERACTION GUIDELINES:
- Keep ALL responses SHORT (1-2 sentences max)
- Be encouraging and supportive
- If they seem nervous, reassure them: "No worries, just read naturally. It doesn't have to be perfect!"
- Celebrate success: "Great job! That was perfect!"
- Be understanding about technical issues: "No problem, let's give it another try."

ANALYSIS INTEGRATION:
- After successful recording, submit to analysis pipeline
- Pre-fill patient information from biometric data:
  * Age (if available)
  * Weight in kg (if available)
  * Height in cm (if available)
  * Gender (if available)
- The backend will handle the actual analysis workflow

Remember: This is a VOICE conversation. Be brief, warm, and encouraging!`
};

export default vocalistAgent;
