// Types for the Behavioral Health System

export interface AgentMessage {
  agentName: string;
  content: string;
  timestamp: string;
  confidence?: number;
  suggestedActions?: string[];
  audioUrl?: string;
  transcription?: string;
}

export interface UserMessage {
  content: string;
  timestamp: string;
  audioData?: string;
  transcription?: string;
  metadata?: {
    speechConfidence?: number;
    voiceActivityLevel?: number;
    processingTime?: number;
    emotions?: string[];
    riskLevel?: 'low' | 'medium' | 'high' | 'crisis';
  };
}

export interface SessionStatus {
  sessionId: string;
  currentAgent: string;
  status: 'initializing' | 'active' | 'handoff' | 'crisis' | 'complete' | 'error';
  timestamp: string;
  participants: string[];
  duration?: number;
  messageCount?: number;
  riskAssessment?: {
    level: 'low' | 'medium' | 'high' | 'crisis';
    indicators: string[];
    lastUpdated: string;
  };
}

export interface AgentHandoffNotification {
  fromAgent: string;
  toAgent: string;
  reason: string;
  timestamp: string;
  userContext?: any;
  riskLevel?: 'low' | 'medium' | 'high' | 'crisis';
}

export interface AgentTypingNotification {
  agentName: string;
  isTyping: boolean;
  timestamp: string;
}

export interface BehavioralHealthAssessment {
  sessionId: string;
  timestamp: string;
  riskLevel: 'low' | 'medium' | 'high' | 'crisis';
  indicators: {
    type: 'anxiety' | 'depression' | 'substance' | 'suicide' | 'self-harm' | 'mood' | 'behavioral';
    severity: number; // 1-10
    evidence: string[];
  }[];
  recommendations: string[];
  nextActions: {
    immediate: string[];
    followUp: string[];
    resources: string[];
  };
}

export interface VoiceActivityData {
  timestamp: string;
  amplitude: number;
  frequency: number;
  confidence: number;
  emotions?: {
    emotion: string;
    confidence: number;
  }[];
}

export interface SpeechRecognitionResult {
  text: string;
  confidence: number;
  timestamp: string;
  wordTimings?: {
    word: string;
    start: number;
    end: number;
    confidence: number;
  }[];
  alternatives?: {
    text: string;
    confidence: number;
  }[];
}

export interface TextToSpeechRequest {
  text: string;
  voice: string;
  speed: number;
  pitch: number;
  volume: number;
  emotions?: {
    emotion: string;
    intensity: number;
  }[];
}

export interface AudioConfig {
  sampleRate: number;
  channels: number;
  bitDepth: number;
  format: 'PCM16' | 'MP3' | 'WAV' | 'OGG';
  codec?: string;
}

export interface AvatarConfig {
  avatarId: string;
  appearance: {
    gender: 'male' | 'female' | 'neutral';
    age: 'young' | 'middle' | 'senior';
    ethnicity: string;
    style: 'professional' | 'casual' | 'clinical';
  };
  animations: {
    idle: string;
    speaking: string;
    listening: string;
    thinking: string;
  };
  voice: {
    name: string;
    speed: number;
    pitch: number;
    emotions: string[];
  };
}