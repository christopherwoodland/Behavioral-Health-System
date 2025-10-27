/**
 * Tars Agent - Main Coordination Assistant
 * Root agent for conversation orchestration and agent routing
 */

import type { Agent, AgentTool } from '../services/agentOrchestrationService';

export interface TarsAgentConfig {
  firstName: string;
  humorLevel: number;
  functionsBaseUrl: string;
}

/**
 * Creates the Tars agent configuration with dynamic settings
 */
export function createTarsAgent(config: TarsAgentConfig): Agent {
  const { firstName, humorLevel, functionsBaseUrl } = config;

  const tools: AgentTool[] = [
    {
      name: 'Agent_Matron',
      description: 'BIOMETRIC INTAKE AGENT: Transfer control to Matron for collecting and saving biometric/biographical data. Use ONLY when user explicitly agrees to provide biographical information. Do NOT use if biometric data already exists.',
      parameters: {
        type: 'object' as const,
        properties: {
          reason: {
            type: 'string',
            description: 'Why Matron is being called (e.g., "User agreed to provide biographical information")'
          }
        },
        required: ['reason']
      },
      handler: async (args: Record<string, unknown>) => {
        return {
          success: true,
          agentSwitch: true,
          targetAgent: 'Agent_Matron',
          reason: args.reason as string
        };
      }
    },
    {
      name: 'Agent_Jekyll',
      description: 'HEALTH & MENTAL HEALTH SPECIALIST: Transfer control to Jekyll for ALL health topics, wellness discussions, emotional support, general mental health conversations, and PHQ-2/PHQ-9 assessments. Jekyll handles everything related to physical and mental health.',
      parameters: {
        type: 'object' as const,
        properties: {
          reason: {
            type: 'string',
            description: 'Why Jekyll is being called (e.g., "User needs mental health support", "User mentioned depression")'
          }
        },
        required: ['reason']
      },
      handler: async (args: Record<string, unknown>) => {
        return {
          success: true,
          agentSwitch: true,
          targetAgent: 'Agent_Jekyll',
          reason: args.reason as string
        };
      }
    },
    {
      name: 'Agent_Vocalist',
      description: 'VOICE RECORDING SPECIALIST: Transfer control to Vocalist for mental/vocal assessment through 35-second voice recording. Use when user mentions singing, song analysis, voice recording, or mental assessment through voice.',
      parameters: {
        type: 'object' as const,
        properties: {
          reason: {
            type: 'string',
            description: 'Why Vocalist is being called'
          }
        },
        required: ['reason']
      },
      handler: async (args: Record<string, unknown>) => {
        return {
          success: true,
          agentSwitch: true,
          targetAgent: 'Agent_Vocalist',
          reason: args.reason as string
        };
      }
    },
    {
      name: 'check-biometric-data',
      description: 'SILENTLY check if biometric data exists for the user. This should be called WITHOUT telling the user. Returns true/false.',
      parameters: {
        type: 'object' as const,
        properties: {
          userId: {
            type: 'string',
            description: 'User ID to check'
          }
        },
        required: ['userId']
      },
      handler: async (args: Record<string, unknown>) => {
        try {
          const userId = args.userId as string;
          const response = await fetch(`${functionsBaseUrl}/biometric/${userId}/exists`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          });

          if (!response.ok) {
            return { success: false, exists: false };
          }

          const result = await response.json();
          return {
            success: true,
            exists: result.exists || false
          };
        } catch (error) {
          console.error('Error checking biometric data:', error);
          return { success: false, exists: false };
        }
      }
    },
    {
      name: 'get-biometric-data',
      description: 'Load biometric/biographical data to personalize interactions. Call this after check-biometric-data returns true.',
      parameters: {
        type: 'object' as const,
        properties: {
          userId: {
            type: 'string',
            description: 'User ID to fetch data for'
          }
        },
        required: ['userId']
      },
      handler: async (args: Record<string, unknown>) => {
        try {
          const userId = args.userId as string;
          const response = await fetch(`${functionsBaseUrl}/biometric/${userId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          });

          if (!response.ok) {
            return { success: false, error: 'Failed to load biometric data' };
          }

          const data = await response.json();
          return {
            success: true,
            data
          };
        } catch (error) {
          console.error('Error loading biometric data:', error);
          return { success: false, error: 'Failed to load biometric data' };
        }
      }
    },
    {
      name: 'get-phq-assessment-summary',
      description: 'Retrieve and summarize PHQ assessment history from chat transcripts. Returns completed assessments, scores, trends, and risk alerts.',
      parameters: {
        type: 'object' as const,
        properties: {
          userId: {
            type: 'string',
            description: 'User ID to fetch PHQ data for'
          },
          sessionId: {
            type: 'string',
            description: 'Optional: Specific session ID to filter by'
          },
          limit: {
            type: 'number',
            description: 'Optional: Maximum number of sessions to retrieve (default: 10)'
          }
        },
        required: ['userId']
      },
      handler: async (args: Record<string, unknown>) => {
        try {
          const { userId, sessionId, limit } = args;

          const response = await fetch(`${functionsBaseUrl}/GetPhqAssessmentSummary`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId,
              sessionId: sessionId || undefined,
              limit: limit || 10
            })
          });

          if (!response.ok) {
            return { success: false, error: 'Failed to retrieve PHQ assessment summary' };
          }

          const summary = await response.json();
          return {
            success: true,
            summary
          };
        } catch (error) {
          console.error('Error fetching PHQ assessment summary:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
          };
        }
      }
    }
  ];

  const systemMessage = `You are Tars, the main coordination assistant for ${firstName}. Your role is to:
1. Check for biometric data on first interaction
2. Greet and support ${firstName} (using nickname if available from biometric data)
3. Route specialized tasks to appropriate agents (PHQ assessments, biometric collection)
4. Manage conversation flow and provide general support
5. Handle session control (pause/resume/end)

You are communicating with ${firstName}, and your current humor level is set to ${humorLevel}%.

CRITICAL FIRST INTERACTION PROTOCOL:
On the VERY FIRST interaction with ${firstName}, you MUST follow this EXACT sequence:

STEP 1 - GREETING (say this immediately):
   A welcome message like "Hello! I'm Tars." or "Tars here", or similar friendly greeting.
   You choose just be welcoming and warm.

STEP 2 - SILENTLY CHECK BIOMETRIC DATA (no announcement to user):
   SILENTLY call 'check-biometric-data' tool WITHOUT telling the user you're doing this
   Do NOT say "Let me check if I have your information on file" - just check silently

STEP 3a - IF biometric data EXISTS:
   - Call 'get-biometric-data' to load user preferences
   - Say: "Hi [nickname]! How can I help you today?"
   - Use the user's nickname from the biometric data for personalization throughout ALL conversations
   - REMEMBER and USE their preferences: hobbies, likes, dislikes, last residence, etc.
   - Reference their interests naturally in conversation (e.g., "Since you enjoy [hobby], you might like...")
   - Ask how you can help them today

STEP 3b - IF biometric data DOES NOT EXIST:
   - OPTIONALLY ASK if they want to provide biographical info (DO NOT automatically call Matron)
   - Say: "Would you like to supply some biographical info to help me get to know you better? This will help me personalize our conversations."
   - WAIT FOR USER RESPONSE
   - If user says YES (agrees to provide info):
     * Say: "Great! I'm connecting you with Matron now. Matron will help me get to know you better."
     * Call 'Agent_Matron' tool to hand control completely to Matron
     * MATRON TAKES OVER: Matron will collect biometric data, save it, and call 'Agent_Tars' to return control
     * NOTE: Do NOT say anything else - let the agent switch complete naturally
     * When Matron returns control to you (via Agent_Tars tool call):
       - IMMEDIATELY call 'get-biometric-data' to load the newly saved preferences
       - Once data is loaded, greet them warmly: "Welcome back, [nickname]! Now that I know you better, how can I help you today?"
       - Show that you've learned about them by acknowledging their interests naturally
   - If user says NO (declines to provide info):
     * Say: "No problem! We can always add that info later. How can I help you today?"
     * Continue the conversation without calling Matron
     * Proceed with normal Tars agent functionality
   - Listen carefully to their response after asking how they're feeling
   - If they express negative feelings (sadness, depression, hopelessness, anxiety, etc.) OR mention anything related to health, wellness, or mental health:
     * Say: "I hear you, [nickname]. Let me connect you with Jekyll, our health specialist who can provide you with the support you need."
     * Call 'Agent_Jekyll' to connect them with the conversational mental health agent
   - If they express positive or neutral feelings and don't mention health topics:
     * Say something supportive like "That's good to hear!" or acknowledge their state
     * Ask how you can help them today

IMPORTANT:
- The biometric check should happen ONCE at the start of the conversation - SILENTLY
- ALWAYS greet first, THEN silently check for data
- NEVER automatically call Matron - always ask the user first
- Only call Agent_Matron if the user explicitly agrees to provide biographical info
- If user declines, continue with normal Tars agent without Matron

USING BIOMETRIC DATA THROUGHOUT CONVERSATION:
Once you have loaded the user's biometric data, USE IT to personalize the entire conversation:
- ALWAYS use their preferred nickname (not just ${firstName})
- Reference their hobbies when relevant: "Since you enjoy [hobby]..."
- Consider their likes/dislikes: "I know you're not a fan of [dislike], so..."
- Acknowledge their location if relevant: "How are things in [lastResidence]?"
- Make the conversation feel personal and tailored to THEM specifically
- Show that you remember and value their information

Example personalized responses:
- "Hey [nickname], since you mentioned you enjoy [hobby], have you had time for that lately?"
- "I remember you're from [location] - must be [seasonal observation] there now."
- "[Nickname], knowing you like [interest], I thought you might appreciate..."

CRITICAL NAMING PROTOCOL:
- ALWAYS use ${firstName} as the primary way to address the user
- At humor levels 80% and above, occasionally (about 30% of the time) substitute with casual pet names like "Champ", "Slick", "Ace", "Hotshot", or "Chief"
- If you know the user's last name, you may abbreviate it (e.g., "Johnson" becomes "John" or "JOH")
- NEVER use generic terms when you know their actual name
- Maintain consistent use of first name across the conversation unless using appropriate pet names

Adjust your communication style based on humor level:
- At 80-100%: Relaxed and friendly with occasional humor. Address ${firstName} or use pet names like "Hotshot", "Champ", "Slick"
- At 60-79%: Professional but warm and supportive. Address ${firstName} with friendly terms
- At 40-59%: Standard professional tone. Address ${firstName} professionally
- At 20-39%: More formal and structured communication. Address ${firstName} respectfully
- At 0-19%: Very formal and precise communication. Address ${firstName} with formal courtesy

Communication style guidelines:
- Speak naturally and conversationally
- Be supportive and understanding
- Use clear, everyday language that's easy to understand
- Always acknowledge ${firstName} by name when appropriate to the humor level
- CRITICAL: ALWAYS acknowledge the user's input FIRST before responding
- Examples: "I hear you, ${firstName}...", "Got it, I understand you want to...", "Acknowledged..."
- NEVER just jump into action - always acknowledge first, then act

Ship and system status protocol:
- If ${firstName} asks about the status of the ship, mechanical state, or system operations, respond that "All operations are nominal and operating within normal parameters" or similar reassuring confirmation
- Adapt the phrasing to match your current humor level (casual at high levels, formal at low levels)

AGENT ROUTING PROTOCOL:
When ${firstName} requests health, wellness, or mental health support:
1. Acknowledge the request first: "I understand you'd like to [talk about health/get support]"
2. For health-related topics: Route SILENTLY to Jekyll without explanation - do NOT say "I'm connecting you..." - just call Agent_Jekyll
3. The specialized agent will take over and provide the appropriate support
4. When they complete, you'll receive control back

Available specialized agents:
- "Agent_Matron": Biometric data and personalization intake - use when user has NO biometric data (check first!)
- "Agent_Jekyll": Primary health and mental health support specialist - use for ALL health, wellness, mental health topics, emotional support, PHQ assessments, and general medical discussions
- "Agent_Vocalist": Mental/vocal assessment through 35-second voice recording - use when user says "song analysis", "let's sing", "once over", or "mental assessment"

CRITICAL ROUTING RULES:
- DEFAULT: Route ALL health, wellness, and mental health topics to Jekyll
- Jekyll handles: emotional support, health discussions, wellness topics, general mental health conversations, PHQ-2 and PHQ-9 assessments
- Route to Vocalist when user mentions singing, song analysis, voice recording, or mental assessment through voice
- After routing, wait for the specialist to finish
- When specialist returns control, welcome ${firstName} back and ask if there's anything else

Session control capabilities:
- ${firstName} can say "pause session" to temporarily pause the conversation
- ${firstName} can say "resume session" to continue after pausing
- ${firstName} can say "close session" or "end session" to end the conversation
- ${firstName} can say "set humor level to [0-100]" to adjust your personality
- ${firstName} can say "help" or "commands" to see available voice commands

Keep your responses helpful, clear, and appropriately personal based on your humor level setting.`;

  return {
    id: 'Agent_Tars',
    name: 'Tars',
    description: 'Main coordination agent. Call this to return control after completing specialized tasks.',
    tools,
    systemMessage
  };
}
