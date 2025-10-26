/**
 * Smart Band Data Service
 * Handles collecting sensor data from Microsoft Band devices
 * Based on Microsoft Band SDK: https://github.com/mattleibow/Microsoft-Band-SDK-Bindings
 */

export interface SmartBandSensorData {
  // Accelerometer data
  accelerometer?: {
    x: number; // m/s²
    y: number; // m/s²
    z: number; // m/s²
    timestamp: string;
  };

  // Gyroscope data
  gyroscope?: {
    x: number; // °/s
    y: number; // °/s
    z: number; // °/s
    timestamp: string;
  };

  // Distance/Speed/Pace
  motion?: {
    distance: number; // cm (cumulative)
    speed: number; // cm/s
    pace: number; // ms/m
    motionType: 'idle' | 'walking' | 'jogging' | 'running' | 'unknown';
    timestamp: string;
  };

  // Heart rate
  heartRate?: {
    bpm: number; // beats per minute
    quality: 'acquiring' | 'locked' | 'poor';
    timestamp: string;
  };

  // Pedometer
  pedometer?: {
    totalSteps: number; // cumulative since last reset
    timestamp: string;
  };

  // Skin temperature
  skinTemperature?: {
    celsius: number;
    timestamp: string;
  };

  // UV exposure
  uvExposure?: {
    exposureLevel: 'none' | 'low' | 'medium' | 'high' | 'veryHigh';
    indexValue: number;
    timestamp: string;
  };

  // Device contact
  deviceContact?: {
    isWorn: boolean;
    timestamp: string;
  };

  // Calories
  calories?: {
    totalBurned: number; // cumulative since factory reset
    timestamp: string;
  };
}

export interface SmartBandDataSnapshot {
  userId: string;
  snapshotId: string;
  collectedAt: string;
  deviceInfo?: {
    firmwareVersion?: string;
    hardwareVersion?: string;
    serialNumber?: string;
  };
  sensorData: SmartBandSensorData;
  metadata: {
    source: 'microsoft-band-sdk';
    collectionDurationMs?: number;
    errors?: string[];
  };
}

class SmartBandDataService {
  private isEnabled: boolean;
  private isCollecting: boolean = false;

  constructor() {
    // Check if smart band feature is enabled via environment variable
    this.isEnabled = import.meta.env.VITE_ENABLE_SMART_BAND === 'true';
  }

  /**
   * Check if smart band feature is enabled
   */
  isFeatureEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Check if a Microsoft Band device is currently connected
   * Calls the local Windows Service REST API
   */
  async isDeviceConnected(): Promise<boolean> {
    if (!this.isEnabled) {
      return false;
    }

    try {
      console.log('🏃 Checking for Microsoft Band device via local service...');

      // Call the local Band Service REST API
      const bandServiceUrl = import.meta.env.VITE_BAND_SERVICE_URL || 'http://localhost:8765';
      const response = await fetch(`${bandServiceUrl}/api/band/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.warn('⚠️ Band service not responding:', response.status);
        return false;
      }

      const result = await response.json();
      console.log('📱 Device status:', result.isConnected ? 'Connected' : 'Not connected');

      return result.isConnected || false;
    } catch (error) {
      console.error('❌ Error checking Band device connection:', error);
      console.log('💡 Make sure the Band Service is running (BehavioralHealthSystem.BandService)');
      return false;
    }
  }

  /**
   * Collect sensor data snapshot from Microsoft Band
   * This is a silent operation that doesn't notify the user
   */
  async collectDataSnapshot(userId: string): Promise<SmartBandDataSnapshot | null> {
    if (!this.isEnabled) {
      console.log('⚠️ Smart Band feature is disabled');
      return null;
    }

    if (this.isCollecting) {
      console.log('⚠️ Already collecting Smart Band data');
      return null;
    }

    try {
      this.isCollecting = true;
      const startTime = Date.now();

      console.log('🏃 Starting silent Smart Band data collection...');

      // Check device connection
      const isConnected = await this.isDeviceConnected();
      if (!isConnected) {
        console.log('⚠️ No Microsoft Band device connected');
        return null;
      }

      // Collect sensor data from local Band Service
      const snapshot = await this.collectAllSensors(userId);

      if (!snapshot) {
        console.log('⚠️ Failed to collect sensor data');
        return null;
      }

      const duration = Date.now() - startTime;

      // Add collection duration to metadata
      snapshot.metadata.collectionDurationMs = duration;

      console.log('✅ Smart Band data collection complete');
      console.log(`📊 Collection duration: ${duration}ms`);

      return snapshot;
    } catch (error) {
      console.error('❌ Error collecting Smart Band data:', error);

      // Return snapshot with error info
      return {
        userId,
        snapshotId: `error-${Date.now()}`,
        collectedAt: new Date().toISOString(),
        sensorData: {},
        metadata: {
          source: 'microsoft-band-sdk',
          errors: [error instanceof Error ? error.message : 'Unknown error']
        }
      };
    } finally {
      this.isCollecting = false;
    }
  }

  /**
   * Collect data from all available sensors via local Band Service API
   */
  private async collectAllSensors(userId: string): Promise<SmartBandDataSnapshot | null> {
    try {
      console.log('📊 Collecting sensor data from Band Service...');

      // Call the local Band Service REST API to collect data
      const bandServiceUrl = import.meta.env.VITE_BAND_SERVICE_URL || 'http://localhost:8765';
      const response = await fetch(`${bandServiceUrl}/api/band/collect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId })
      });

      if (!response.ok) {
        throw new Error(`Band service error: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to collect sensor data');
      }

      // Map the Band Service response to our format
      const snapshot: SmartBandDataSnapshot = {
        userId: result.data.userId,
        snapshotId: result.data.snapshotId,
        collectedAt: result.data.collectedAt,
        deviceInfo: result.data.deviceInfo,
        sensorData: this.mapSensorData(result.data.sensorData),
        metadata: {
          source: 'microsoft-band-sdk',
          ...result.data.metadata
        }
      };

      console.log('✅ Sensor data collected successfully');
      return snapshot;

    } catch (error) {
      console.error('❌ Error collecting sensor data:', error);
      throw error;
    }
  }

  /**
   * Map Band Service sensor data format to our frontend format
   */
  private mapSensorData(bandData: any): SmartBandSensorData {
    const sensorData: SmartBandSensorData = {};

    if (bandData.accelerometer) {
      sensorData.accelerometer = {
        x: bandData.accelerometer.x,
        y: bandData.accelerometer.y,
        z: bandData.accelerometer.z,
        timestamp: bandData.accelerometer.timestamp
      };
    }

    if (bandData.gyroscope) {
      sensorData.gyroscope = {
        x: bandData.gyroscope.x,
        y: bandData.gyroscope.y,
        z: bandData.gyroscope.z,
        timestamp: bandData.gyroscope.timestamp
      };
    }

    if (bandData.motion) {
      sensorData.motion = {
        distance: bandData.motion.distanceCm,
        speed: bandData.motion.speedCmPerSecond,
        pace: bandData.motion.paceMsPerMeter,
        motionType: bandData.motion.motionType?.toLowerCase() || 'unknown',
        timestamp: bandData.motion.timestamp
      };
    }

    if (bandData.heartRate) {
      sensorData.heartRate = {
        bpm: bandData.heartRate.bpm,
        quality: bandData.heartRate.quality?.toLowerCase() || 'poor',
        timestamp: bandData.heartRate.timestamp
      };
    }

    if (bandData.pedometer) {
      sensorData.pedometer = {
        totalSteps: bandData.pedometer.totalSteps,
        timestamp: bandData.pedometer.timestamp
      };
    }

    if (bandData.skinTemperature) {
      sensorData.skinTemperature = {
        celsius: bandData.skinTemperature.temperatureCelsius,
        timestamp: bandData.skinTemperature.timestamp
      };
    }

    if (bandData.uvExposure) {
      sensorData.uvExposure = {
        exposureLevel: bandData.uvExposure.exposureLevel?.toLowerCase() || 'none',
        indexValue: bandData.uvExposure.indexLevel,
        timestamp: bandData.uvExposure.timestamp
      };
    }

    if (bandData.deviceContact) {
      sensorData.deviceContact = {
        isWorn: bandData.deviceContact.isWorn,
        timestamp: bandData.deviceContact.timestamp
      };
    }

    if (bandData.calories) {
      sensorData.calories = {
        totalBurned: bandData.calories.totalCalories,
        timestamp: bandData.calories.timestamp
      };
    }

    return sensorData;
  }

  /**
   * Save collected snapshot to Azure Functions backend
   */
  async saveSnapshot(snapshot: SmartBandDataSnapshot): Promise<boolean> {
    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:7071/api';
      const endpoint = `${apiBaseUrl}/SaveSmartBandData`;

      console.log('💾 Saving Smart Band data to:', endpoint);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(snapshot)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to save Smart Band data: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Smart Band data saved successfully:', result);

      return true;
    } catch (error) {
      console.error('❌ Error saving Smart Band data:', error);
      return false;
    }
  }

  /**
   * Collect and save Smart Band data in one operation
   * This is the main method that Jekyll will call
   */
  async collectAndSave(userId: string): Promise<{
    success: boolean;
    snapshot?: SmartBandDataSnapshot;
    error?: string;
  }> {
    if (!this.isEnabled) {
      return {
        success: false,
        error: 'Smart Band feature is not enabled'
      };
    }

    try {
      console.log('🏃 Collecting Smart Band data for user:', userId);

      // Collect snapshot
      const snapshot = await this.collectDataSnapshot(userId);

      if (!snapshot) {
        return {
          success: false,
          error: 'No device connected or data collection failed'
        };
      }

      // Save to blob storage via Azure Function
      const saved = await this.saveSnapshot(snapshot);

      if (!saved) {
        return {
          success: false,
          snapshot,
          error: 'Failed to save data to storage'
        };
      }

      return {
        success: true,
        snapshot
      };
    } catch (error) {
      console.error('Error in collectAndSave:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Export singleton instance
export const smartBandDataService = new SmartBandDataService();
export default smartBandDataService;
