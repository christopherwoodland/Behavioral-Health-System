import { test, expect } from '@playwright/test';

/**
 * E2E tests for the PostgreSQL storage backend functionality.
 *
 * These tests validate that the application works correctly when
 * STORAGE_BACKEND=PostgreSQL is configured. They test the full
 * request/response cycle through the UI → API → PostgreSQL path.
 *
 * Prerequisites:
 *   - Docker Compose running with STORAGE_BACKEND=PostgreSQL
 *   - API (port 7071) and Web (port 5173) services running
 *   - PostgreSQL (port 5432) running and healthy
 *
 * Run with: npx playwright test e2e/postgres-storage.spec.ts
 */

const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:7071/api';

test.describe('PostgreSQL Storage Backend — API Integration', () => {

  test.describe('Health Check', () => {
    test('API health endpoint responds OK', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/health`);
      expect(response.ok()).toBeTruthy();
    });
  });

  test.describe('Chat Transcript Storage', () => {
    const testUserId = `e2e-user-${Date.now()}`;
    const testSessionId = `e2e-session-${Date.now()}`;

    test('should save a new chat transcript', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/SaveChatTranscript`, {
        data: {
          transcriptData: {
            userId: testUserId,
            sessionId: testSessionId,
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            isActive: true,
            messages: [
              {
                id: 'msg-e2e-1',
                role: 'user',
                content: 'Hello from Playwright e2e test',
                timestamp: new Date().toISOString()
              },
              {
                id: 'msg-e2e-2',
                role: 'assistant',
                content: 'Hello! How can I help you today?',
                timestamp: new Date().toISOString()
              }
            ]
          },
          metadata: {
            saveTimestamp: new Date().toISOString(),
            messageCount: 2,
            sessionActive: true
          },
          containerName: 'chat-transcripts'
        }
      });

      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      expect(body.success).toBeTruthy();
      expect(body.sessionId).toBe(testSessionId);
    });

    test('should merge messages on duplicate save', async ({ request }) => {
      const mergeUserId = `e2e-merge-${Date.now()}`;
      const mergeSessionId = `e2e-merge-session-${Date.now()}`;

      // First save
      await request.post(`${API_BASE_URL}/SaveChatTranscript`, {
        data: {
          transcriptData: {
            userId: mergeUserId,
            sessionId: mergeSessionId,
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            isActive: true,
            messages: [
              { id: 'merge-msg-1', role: 'user', content: 'First message', timestamp: new Date().toISOString() }
            ]
          },
          containerName: 'chat-transcripts'
        }
      });

      // Second save with duplicate + new message
      const response = await request.post(`${API_BASE_URL}/SaveChatTranscript`, {
        data: {
          transcriptData: {
            userId: mergeUserId,
            sessionId: mergeSessionId,
            lastUpdated: new Date().toISOString(),
            isActive: true,
            messages: [
              { id: 'merge-msg-1', role: 'user', content: 'First message', timestamp: new Date().toISOString() },
              { id: 'merge-msg-2', role: 'assistant', content: 'Second message', timestamp: new Date().toISOString() }
            ]
          },
          containerName: 'chat-transcripts'
        }
      });

      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      expect(body.success).toBeTruthy();
      // Message count should be 2 (merged, not 3)
      expect(body.messageCount).toBe(2);
    });

    test('should reject transcript with missing userId', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/SaveChatTranscript`, {
        data: {
          transcriptData: {
            userId: '',
            sessionId: 'session-1',
            messages: []
          },
          containerName: 'chat-transcripts'
        }
      });

      expect(response.status()).toBe(400);
    });

    test('should reject transcript with missing sessionId', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/SaveChatTranscript`, {
        data: {
          transcriptData: {
            userId: 'user-1',
            sessionId: '',
            messages: []
          },
          containerName: 'chat-transcripts'
        }
      });

      expect(response.status()).toBe(400);
    });
  });

  test.describe('PHQ Assessment Storage', () => {
    test('should save a PHQ-9 assessment', async ({ request }) => {
      const testUserId = `e2e-phq-user-${Date.now()}`;
      const assessmentId = `e2e-phq9-${Date.now()}`;

      const response = await request.post(`${API_BASE_URL}/SavePhqAssessment`, {
        data: {
          assessmentData: {
            assessmentId: assessmentId,
            userId: testUserId,
            assessmentType: 'PHQ-9',
            startTime: new Date().toISOString(),
            isCompleted: true,
            completedTime: new Date().toISOString(),
            totalScore: 12,
            severity: 'Moderate',
            interpretation: 'Moderate depression symptoms detected',
            recommendations: ['Consider professional evaluation', 'Monitor symptoms'],
            questions: Array.from({ length: 9 }, (_, i) => ({
              questionNumber: i + 1,
              questionText: `PHQ-9 Question ${i + 1}`,
              answer: Math.floor(Math.random() * 4),
              attempts: 1,
              skipped: false,
              timestamp: new Date().toISOString()
            }))
          },
          containerName: 'phq'
        }
      });

      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      expect(body.success).toBeTruthy();
    });

    test('should save a PHQ-2 assessment', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/SavePhqAssessment`, {
        data: {
          assessmentData: {
            assessmentId: `e2e-phq2-${Date.now()}`,
            userId: `e2e-user-${Date.now()}`,
            assessmentType: 'PHQ-2',
            startTime: new Date().toISOString(),
            isCompleted: true,
            totalScore: 3,
            questions: [
              { questionNumber: 1, questionText: 'Little interest?', answer: 2, attempts: 1, skipped: false },
              { questionNumber: 2, questionText: 'Feeling down?', answer: 1, attempts: 1, skipped: false }
            ]
          },
          containerName: 'phq'
        }
      });

      expect(response.ok()).toBeTruthy();
    });

    test('should reject assessment with invalid type', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/SavePhqAssessment`, {
        data: {
          assessmentData: {
            assessmentId: `e2e-invalid-${Date.now()}`,
            userId: `e2e-user-${Date.now()}`,
            assessmentType: 'PHQ-99', // invalid
            startTime: new Date().toISOString(),
            questions: []
          },
          containerName: 'phq'
        }
      });

      expect(response.status()).toBe(400);
    });
  });

  test.describe('PHQ Progress Storage', () => {
    test('should save PHQ progress', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/SavePhqProgress`, {
        data: {
          progressData: {
            userId: `e2e-progress-user-${Date.now()}`,
            assessmentId: `e2e-progress-${Date.now()}`,
            assessmentType: 'PHQ-9',
            startedAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            isCompleted: false,
            totalQuestions: 9,
            answeredQuestions: [
              { questionNumber: 1, questionText: 'Q1', answer: 2, answeredAt: new Date().toISOString() },
              { questionNumber: 2, questionText: 'Q2', answer: 1, answeredAt: new Date().toISOString() }
            ]
          },
          containerName: 'phq'
        }
      });

      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      expect(body.success).toBeTruthy();
    });
  });

  test.describe('PHQ Session Storage', () => {
    test('should save PHQ session (progressive)', async ({ request }) => {
      const testUserId = `e2e-session-user-${Date.now()}`;
      const assessmentId = `e2e-session-phq-${Date.now()}`;

      const response = await request.post(`${API_BASE_URL}/SavePhqSession`, {
        data: {
          sessionData: {
            userId: testUserId,
            sessionId: `session-${Date.now()}`,
            assessmentId: assessmentId,
            assessmentType: 'PHQ-9',
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            isCompleted: false,
            questions: [
              { questionNumber: 1, questionText: 'Q1', answer: 2, attempts: 1, skipped: false }
            ]
          },
          containerName: 'phq-sessions'
        }
      });

      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      expect(body.success).toBeTruthy();
    });
  });

  test.describe('Smart Band Data Storage', () => {
    test('should save smart band snapshot', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/SaveSmartBandData`, {
        data: {
          userId: `e2e-band-user-${Date.now()}`,
          snapshotId: `snap-${Date.now()}`,
          collectedAt: new Date().toISOString(),
          deviceInfo: {
            firmwareVersion: '3.1.0',
            hardwareVersion: '2.0',
            serialNumber: 'E2E-TEST-001'
          },
          sensorData: {
            heartRate: { bpm: 72, quality: 'high', timestamp: new Date().toISOString() },
            accelerometer: { x: 0.1, y: 9.8, z: -0.2, timestamp: new Date().toISOString() }
          },
          metadata: {
            sdkVersion: '1.0.0',
            collectionMethod: 'e2e-test'
          }
        }
      });

      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      expect(body.success).toBeTruthy();
    });
  });
});

test.describe('PostgreSQL Storage Backend — UI Flows', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Dashboard loads with navigation links', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Behavioral Health System' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Upload & Analyze/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /View Sessions/ })).toBeVisible();
  });

  test('Upload page loads and shows file input area', async ({ page }) => {
    await page.getByRole('link', { name: /Upload & Analyze/ }).click();
    await expect(page).toHaveURL('/upload');
    await expect(page.getByRole('heading', { name: 'Upload & Analyze' })).toBeVisible();
  });

  test('Sessions page loads and displays session list area', async ({ page }) => {
    await page.getByRole('link', { name: /Sessions/ }).click();
    await expect(page).toHaveURL('/sessions');
    await expect(page.getByRole('heading', { name: 'Sessions' })).toBeVisible();
  });

  test('Predictions page loads', async ({ page }) => {
    await page.getByRole('link', { name: /My Predictions/ }).click();
    await expect(page).toHaveURL('/predictions');
  });

  test('Health check page is accessible', async ({ page }) => {
    await page.getByRole('link', { name: /System Health/ }).click();
    await expect(page).toHaveURL('/health');
  });

  test('User ID is displayed on dashboard', async ({ page }) => {
    await expect(page.getByText('Your User ID')).toBeVisible();
    const userIdElement = page.locator('code').first();
    await expect(userIdElement).toBeVisible();
    const userIdText = await userIdElement.textContent();
    // Should be a UUID
    expect(userIdText).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });
});

test.describe('PostgreSQL Storage Backend — API Validation', () => {

  test('SaveChatTranscript rejects empty body', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/SaveChatTranscript`, {
      data: {}
    });
    expect(response.status()).toBe(400);
  });

  test('SavePhqAssessment rejects missing assessmentId', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/SavePhqAssessment`, {
      data: {
        assessmentData: {
          assessmentId: '',
          userId: 'user-1',
          assessmentType: 'PHQ-9',
          startTime: new Date().toISOString(),
          questions: []
        }
      }
    });
    expect(response.status()).toBe(400);
  });

  test('SaveSmartBandData rejects missing userId', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/SaveSmartBandData`, {
      data: {
        userId: '',
        snapshotId: 'snap-1',
        sensorData: {}
      }
    });
    expect(response.status()).toBe(400);
  });

  test('SavePhqProgress rejects missing userId', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/SavePhqProgress`, {
      data: {
        progressData: {
          userId: '',
          assessmentId: 'assess-1',
          assessmentType: 'PHQ-9',
          totalQuestions: 9,
          answeredQuestions: []
        }
      }
    });
    expect(response.status()).toBe(400);
  });
});
