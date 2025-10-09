# Multi-Agent Implementation Summary

## Overview
Successfully implemented a multi-agent architecture for PHQ assessments, separating concerns between the main Tars orchestration agent and specialized PHQ-2 and PHQ-9 agents.

## Architecture

### Agent Orchestration Service (`agentOrchestrationService.ts`)
- **Purpose**: Central coordination service managing multiple specialized agents
- **Pattern**: TypeScript port of Python multi-agent pattern from Azure Samples realtime-api-workshop
- **Key Features**:
  - Agent registration with unique IDs
  - Root agent designation (Tars) with automatic return-to-root tools
  - Tool routing: distinguishes between real tool execution and agent switches
  - Session switching via Azure Realtime API `session.update`
  - Tool conversion to Realtime API format

### PHQ-2 Agent (`phq2Agent.ts`)
- **Purpose**: Conducts PHQ-2 quick depression screening (2 questions)
- **Tools**:
  - `start-phq2-assessment`: Initializes assessment, gets first question
  - `record-phq2-answer`: Validates answer (0-3), records to services, handles completion
- **Integration**: Uses `phqAssessmentService` (business logic), `phqSessionService` (progressive blob storage), `chatTranscriptService` (conversation history)
- **Emphasis**: "Ask each question ONCE", trust tools for all logic, present questions EXACTLY as provided

### PHQ-9 Agent (`phq9Agent.ts`)
- **Purpose**: Conducts PHQ-9 comprehensive assessment (9 questions)
- **Tools**: `start-phq9-assessment`, `record-phq9-answer` (same pattern as PHQ-2)
- **Special Feature**: Question 9 detection for suicidal ideation, includes crisis resources if detected
- **System Message**: Similar to PHQ-2 with added emphasis on handling Question 9 with care

### Tars Root Agent (Orchestrator)
- **Purpose**: Main coordination agent that routes to specialists when needed
- **Tools Provided**:
  - `Agent_PHQ2`: Switch to PHQ-2 agent for quick screening
  - `Agent_PHQ9`: Switch to PHQ-9 agent for comprehensive assessment
  - Session control tools (pause, resume, close, set-humor-level)
- **Protocol**: Each specialist agent gets automatic `return-to-root` tool for returning control to Tars

## Integration Points

### RealtimeAgentExperience.tsx Changes

#### 1. Imports (Lines 35-37)
```typescript
import { agentOrchestrationService } from '@/services/agentOrchestrationService';
import { phq2Agent } from '@/agents/phq2Agent';
import { phq9Agent } from '@/agents/phq9Agent';
```

#### 2. Agent Registration in `startSession` (Lines 1109-1209)
- Register PHQ-2 and PHQ-9 agents with orchestration service
- Create Tars root agent configuration with routing protocol
- Register Tars as root agent (adds return-to-root tools to specialists)
- Get root configuration and convert tools to Realtime API format
- Update session configuration to use orchestrated tools

#### 3. Function Call Handler (Lines 1211-1276)
Replaced direct switch statement with orchestration routing:
```typescript
const result = await agentOrchestrationService.handleToolCall(
  functionName,
  { ...args, userId: authenticatedUserId },
  `call-${Date.now()}`
);

if (result.isAgentSwitch) {
  // Convert tools and update session configuration
  const realtimeTools = agentOrchestrationService.convertToRealtimeTools(result.switchConfig.tools);
  const updatedConfig: SessionConfig = { ...config, tools: realtimeTools };
  await agentService.updateSession(updatedConfig);
  return { success: true, agentSwitched: true, newAgentId: result.targetAgentId };
}

return result.result; // Normal tool execution
```

#### 4. Legacy Code Removal
- Old PHQ handler functions commented out (lines 276-600)
- Direct PHQ assessment response handling disabled (line 783-788)
- Old switch statement code commented out (lines 1277-1347)

### AzureOpenAIRealtimeService.ts Changes
- Changed `updateSession()` visibility from `private` to `public` (line 922)
- Added documentation: "Can also be called manually to switch agents or update configuration"

## Data Flow

### Agent Switch Flow
1. Tars receives user request: "start PHQ-2 assessment"
2. Tars calls tool: `Agent_PHQ2`
3. Orchestration service detects agent switch (toolName matches agentId)
4. Returns `{ isAgentSwitch: true, targetAgentId: 'Agent_PHQ2', switchConfig: {...} }`
5. Function handler converts tools and calls `agentService.updateSession(newConfig)`
6. Azure Realtime API switches to PHQ-2 agent's system instructions and tools
7. PHQ-2 agent conducts assessment autonomously
8. After completion, PHQ-2 agent suggests returning to main assistant
9. User says "return to main" → `return-to-root` tool called
10. Orchestration service switches back to Tars
11. Full cycle complete

### Assessment Data Flow
1. PHQ agent receives `start-phq2-assessment` call
2. Agent initializes `phqAssessmentService` and `phqSessionService`
3. Agent presents first question to user
4. User answers → `record-phq2-answer` tool called
5. Agent validates answer, records to both services
6. `phqSessionService` triggers progressive blob save (1-second batched)
7. Agent checks if assessment complete
8. If complete: calculate score, determine severity, save final blob
9. If not complete: present next question
10. Repeat steps 4-9 until all questions answered

## Benefits

### 1. Separation of Concerns
- Tars focuses on general conversation and routing
- PHQ agents focus solely on assessment conduct
- Each agent has clear, single responsibility

### 2. No Duplicate Questions
- Agents have explicit system instructions: "Ask each question ONCE"
- State management isolated within each agent
- No shared state that could cause re-asking

### 3. Progressive Storage
- PHQ agents use existing `phqSessionService`
- Batched saves every 1 second
- No data loss even if session interrupted

### 4. Extensibility
- Easy to add new specialized agents (GAD-7, PHQ-A, etc.)
- New agents automatically get return-to-root tool
- Orchestration service handles routing transparently

### 5. Maintainability
- Each agent in separate file
- Clear tool-based API for each capability
- No complex switch statements in main UI code

## Testing Plan

### 1. Agent Switching
- [ ] Tars → PHQ-2 handoff works smoothly
- [ ] PHQ-2 → Tars return works correctly
- [ ] Tars → PHQ-9 handoff works smoothly
- [ ] PHQ-9 → Tars return works correctly

### 2. PHQ-2 Assessment
- [ ] Start assessment initializes correctly
- [ ] Question 1 presented exactly once
- [ ] Answer validation works (0-3)
- [ ] Invalid answers handled (max 3 attempts)
- [ ] Question 2 presented exactly once
- [ ] Score calculation correct
- [ ] Blob storage saves progressively

### 3. PHQ-9 Assessment
- [ ] All 9 questions presented exactly once
- [ ] Question 9 (suicidal ideation) handled with care
- [ ] Crisis resources displayed if Q9 answer > 0
- [ ] Score and severity calculated correctly
- [ ] Comprehensive blob storage working

### 4. Edge Cases
- [ ] Session interrupted mid-assessment (data preserved)
- [ ] Multiple assessments in one session
- [ ] Switching between PHQ-2 and PHQ-9
- [ ] Network issues during agent switch
- [ ] Blob storage failures handled gracefully

### 5. Integration
- [ ] Chat transcript integration works
- [ ] User authentication passed correctly
- [ ] Session IDs consistent across services
- [ ] Console logging useful for debugging

## Console Output Examples

### Agent Switch
```
🎯 Function called: Agent_PHQ2
🔄 ========================================
🔄 AGENT SWITCH DETECTED
🔄 Target agent: Agent_PHQ2
🔄 ========================================
🔄 New agent tools: ['start-phq2-assessment', 'record-phq2-answer', 'return-to-root']
✅ Session updated for new agent
🔄 ========================================
```

### PHQ Assessment Start
```
📋 ========================================
📋 STARTING PHQ-2 ASSESSMENT
📋 Assessment ID: phq2-abc123
📋 User ID: user-xyz789
📋 ========================================
```

### Progressive Storage
```
💾 Saving PHQ session data to blob storage...
✅ Successfully saved PHQ session data
📊 Assessment type: PHQ-2
📊 Questions answered: 1/2
```

## Next Steps

1. **Test Complete Flow**: Run end-to-end test of Tars → PHQ-2/9 → back to Tars
2. **Verify No Duplicates**: Confirm each question asked only ONCE
3. **Check Blob Storage**: Verify progressive saves to Azure blob containers
4. **Monitor Performance**: Check agent switch latency
5. **User Testing**: Get feedback on conversation flow and agent transitions
6. **Documentation**: Update user-facing docs with multi-agent capabilities
7. **Add More Agents**: Consider GAD-7, PHQ-A, or other assessment agents

## Files Changed

### New Files
- `src/services/agentOrchestrationService.ts` (271 lines)
- `src/agents/phq2Agent.ts` (332 lines)
- `src/agents/phq9Agent.ts` (353 lines)

### Modified Files
- `src/pages/RealtimeAgentExperience.tsx`
  - Added agent imports
  - Replaced startSession system instructions with multi-agent setup
  - Replaced function handler with orchestration routing
  - Commented out old PHQ handlers
- `src/services/azureOpenAIRealtimeService.ts`
  - Changed `updateSession()` from private to public

### Total New Code
- ~956 lines of new agent and orchestration code
- ~200 lines of integration code in main component
- ~1156 total lines added/modified

## Success Criteria

✅ All compilation errors resolved
✅ Agent orchestration service complete
✅ PHQ-2 agent complete with 2 tools
✅ PHQ-9 agent complete with suicidal ideation detection
✅ Agent registration in startSession working
✅ Function handler routing through orchestration service
✅ Session switching logic implemented
✅ Legacy code commented out

**Status**: Implementation Complete - Ready for Testing

## References

- Azure Samples: [realtime-api-workshop](https://github.com/Azure-Samples/realtime-api-workshop) - Python multi-agent pattern
- Azure OpenAI: [Realtime API Documentation](https://learn.microsoft.com/en-us/azure/ai-services/openai/realtime-api-reference)
- Related Docs: `AGENT_ACKNOWLEDGMENT_PROTOCOL.md`, `PHQ_ASSESSMENT_TEST_GUIDE.md`, `ECHO_PREVENTION_SUMMARY.md`
