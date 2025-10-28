using BehavioralHealthSystem.BandService.Models;
using Microsoft.Band;
using Microsoft.Band.Sensors;

namespace BehavioralHealthSystem.BandService.Services;

/// <summary>
/// Service for interacting with Microsoft Band devices
/// </summary>
public interface IBandSensorService
{
    Task<bool> IsDeviceConnectedAsync();
    Task<DeviceInfo?> GetDeviceInfoAsync();
    Task<SmartBandDataSnapshot> CollectSensorDataAsync(string userId);
}

/// <summary>
/// Implementation of Band sensor service using Microsoft Band SDK
/// </summary>
public class BandSensorService : IBandSensorService, IDisposable
{
    private readonly ILogger<BandSensorService> _logger;
    private IBandClient? _bandClient;
    private IBandInfo[]? _pairedBands;
    private readonly SemaphoreSlim _connectionLock = new(1, 1);

    public BandSensorService(ILogger<BandSensorService> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Check if a Band device is connected
    /// </summary>
    public async Task<bool> IsDeviceConnectedAsync()
    {
        try
        {
            _logger.LogInformation("🏃 [SMART BAND] Checking device connection status...");
            await EnsureConnectedAsync();
            var isConnected = _bandClient != null;

            if (isConnected)
            {
                _logger.LogInformation("✅ [SMART BAND] Device is CONNECTED");
            }
            else
            {
                _logger.LogWarning("⚠️ [SMART BAND] No device connected");
            }

            return isConnected;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ [SMART BAND] Error checking device connection");
            return false;
        }
    }

    /// <summary>
    /// Get information about the connected Band device
    /// </summary>
    public async Task<DeviceInfo?> GetDeviceInfoAsync()
    {
        try
        {
            _logger.LogInformation("📱 [SMART BAND] Retrieving device information...");
            await EnsureConnectedAsync();

            if (_bandClient == null)
            {
                _logger.LogWarning("⚠️ [SMART BAND] Cannot get device info - no device connected");
                return null;
            }

            var firmwareVersion = await _bandClient.GetFirmwareVersionAsync();
            var hardwareVersion = await _bandClient.GetHardwareVersionAsync();

            var deviceInfo = new DeviceInfo
            {
                DeviceName = _pairedBands?.FirstOrDefault()?.Name ?? "Microsoft Band",
                FirmwareVersion = firmwareVersion?.ToString() ?? "Unknown",
                HardwareVersion = hardwareVersion?.ToString() ?? "Unknown"
            };

            _logger.LogInformation("✅ [SMART BAND] Device Info - Name: {DeviceName}, FW: {FirmwareVersion}, HW: {HardwareVersion}",
                deviceInfo.DeviceName, deviceInfo.FirmwareVersion, deviceInfo.HardwareVersion);

            return deviceInfo;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ [SMART BAND] Error getting device info");
            return null;
        }
    }

    /// <summary>
    /// Collect all sensor data from the Band
    /// </summary>
    public async Task<SmartBandDataSnapshot> CollectSensorDataAsync(string userId)
    {
        _logger.LogInformation("🎯 [SMART BAND] ========================================");
        _logger.LogInformation("🎯 [SMART BAND] Starting sensor data collection");
        _logger.LogInformation("🎯 [SMART BAND] User ID: {UserId}", userId);
        _logger.LogInformation("🎯 [SMART BAND] ========================================");

        var snapshot = new SmartBandDataSnapshot
        {
            UserId = userId,
            SnapshotId = Guid.NewGuid().ToString(),
            CollectedAt = DateTime.UtcNow
        };

        try
        {
            var startTime = DateTime.UtcNow;

            await EnsureConnectedAsync();

            if (_bandClient == null)
            {
                _logger.LogError("❌ [SMART BAND] FAILED: No Band device connected");
                throw new InvalidOperationException("No Band device connected");
            }

            _logger.LogInformation("📊 [SMART BAND] Collecting data from 9 sensors in parallel...");
            var now = DateTime.UtcNow;
            var sensorData = new SmartBandSensorData();

            // Collect all sensor readings in parallel for efficiency
            var tasks = new List<Task>
            {
                CollectAccelerometerAsync(sensorData, now),
                CollectGyroscopeAsync(sensorData, now),
                CollectMotionAsync(sensorData, now),
                CollectHeartRateAsync(sensorData, now),
                CollectPedometerAsync(sensorData, now),
                CollectSkinTemperatureAsync(sensorData, now),
                CollectUvExposureAsync(sensorData, now),
                CollectDeviceContactAsync(sensorData, now),
                CollectCaloriesAsync(sensorData, now)
            };

            await Task.WhenAll(tasks);

            snapshot.SensorData = sensorData;
            snapshot.DeviceInfo = await GetDeviceInfoAsync();

            var duration = (DateTime.UtcNow - startTime).TotalMilliseconds;

            _logger.LogInformation("✅ [SMART BAND] Collection COMPLETE!");
            _logger.LogInformation("✅ [SMART BAND] Snapshot ID: {SnapshotId}", snapshot.SnapshotId);
            _logger.LogInformation("✅ [SMART BAND] Duration: {Duration}ms", duration);
            _logger.LogInformation("✅ [SMART BAND] Sensors collected: {SensorCount}", CountCollectedSensors(sensorData));

            return snapshot;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ [SMART BAND] FAILED to collect sensor data for user {UserId}", userId);
            throw;
        }
    }

    private int CountCollectedSensors(SmartBandSensorData data)
    {
        int count = 0;
        if (data.Accelerometer != null) count++;
        if (data.Gyroscope != null) count++;
        if (data.Motion != null) count++;
        if (data.HeartRate != null) count++;
        if (data.Pedometer != null) count++;
        if (data.SkinTemperature != null) count++;
        if (data.UvExposure != null) count++;
        if (data.DeviceContact != null) count++;
        if (data.Calories != null) count++;
        return count;
    }

    #region Private Helper Methods

    /// <summary>
    /// Ensure the Band client is connected
    /// </summary>
    private async Task EnsureConnectedAsync()
    {
        await _connectionLock.WaitAsync();
        try
        {
            if (_bandClient != null)
            {
                _logger.LogDebug("🔗 [SMART BAND] Already connected, reusing connection");
                return; // Already connected
            }

            _logger.LogInformation("🔍 [SMART BAND] Searching for paired Microsoft Band devices...");

            // Get paired bands
            _pairedBands = await BandClientManager.Instance.GetBandsAsync();

            if (_pairedBands == null || _pairedBands.Length == 0)
            {
                _logger.LogWarning("⚠️ [SMART BAND] No paired Microsoft Band devices found");
                _logger.LogWarning("⚠️ [SMART BAND] Please pair your Band via Windows Bluetooth settings");
                return;
            }

            _logger.LogInformation("📱 [SMART BAND] Found {Count} paired Band device(s)", _pairedBands.Length);

            // Connect to the first paired band
            var bandInfo = _pairedBands[0];
            _logger.LogInformation("🔌 [SMART BAND] Connecting to: {BandName}...", bandInfo.Name);

            _bandClient = await BandClientManager.Instance.ConnectAsync(bandInfo);

            _logger.LogInformation("✅ [SMART BAND] Successfully connected to: {BandName}", bandInfo.Name);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ [SMART BAND] Connection failed");
        }
        finally
        {
            _connectionLock.Release();
        }
    }

    private async Task CollectAccelerometerAsync(SmartBandSensorData data, DateTime timestamp)
    {
        try
        {
            if (_bandClient?.SensorManager == null) return;

            _logger.LogDebug("📊 [SMART BAND] Reading accelerometer...");
            var reading = await _bandClient.SensorManager.Accelerometer.GetCurrentSensorReadingsAsync();

            data.Accelerometer = new Models.AccelerometerReading
            {
                X = reading.AccelerationX,
                Y = reading.AccelerationY,
                Z = reading.AccelerationZ,
                Timestamp = timestamp
            };

            _logger.LogDebug("✅ [SMART BAND] Accelerometer: X={X:F2}, Y={Y:F2}, Z={Z:F2}",
                reading.AccelerationX, reading.AccelerationY, reading.AccelerationZ);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "⚠️ [SMART BAND] Failed to collect accelerometer data");
        }
    }

    private async Task CollectGyroscopeAsync(SmartBandSensorData data, DateTime timestamp)
    {
        try
        {
            if (_bandClient?.SensorManager == null) return;

            var reading = await _bandClient.SensorManager.Gyroscope.GetCurrentSensorReadingsAsync();

            data.Gyroscope = new Models.GyroscopeReading
            {
                X = reading.AngularVelocityX,
                Y = reading.AngularVelocityY,
                Z = reading.AngularVelocityZ,
                Timestamp = timestamp
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to collect gyroscope data");
        }
    }

    private async Task CollectMotionAsync(SmartBandSensorData data, DateTime timestamp)
    {
        try
        {
            if (_bandClient?.SensorManager == null) return;

            var reading = await _bandClient.SensorManager.Distance.GetCurrentSensorReadingsAsync();

            data.Motion = new MotionReading
            {
                DistanceCm = reading.TotalDistance,
                SpeedCmPerSecond = reading.Speed,
                PaceMsPerMeter = reading.Pace,
                MotionType = reading.MotionType.ToString(),
                Timestamp = timestamp
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to collect motion data");
        }
    }

    private async Task CollectHeartRateAsync(SmartBandSensorData data, DateTime timestamp)
    {
        try
        {
            if (_bandClient?.SensorManager == null) return;

            _logger.LogDebug("❤️ [SMART BAND] Reading heart rate (requesting user consent if needed)...");

            // Request user consent for heart rate (required by Band SDK)
            var consent = await _bandClient.SensorManager.HeartRate.RequestUserConsentAsync();

            if (consent)
            {
                var reading = await _bandClient.SensorManager.HeartRate.GetCurrentSensorReadingsAsync();

                data.HeartRate = new Models.HeartRateReading
                {
                    Bpm = reading.HeartRate,
                    Quality = reading.Quality.ToString(),
                    Timestamp = timestamp
                };

                _logger.LogDebug("✅ [SMART BAND] Heart Rate: {BPM} BPM (Quality: {Quality})",
                    reading.HeartRate, reading.Quality);
            }
            else
            {
                _logger.LogWarning("⚠️ [SMART BAND] User consent not granted for heart rate sensor");
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "⚠️ [SMART BAND] Failed to collect heart rate data");
        }
    }

    private async Task CollectPedometerAsync(SmartBandSensorData data, DateTime timestamp)
    {
        try
        {
            if (_bandClient?.SensorManager == null) return;

            var reading = await _bandClient.SensorManager.Pedometer.GetCurrentSensorReadingsAsync();

            data.Pedometer = new Models.PedometerReading
            {
                TotalSteps = reading.TotalSteps,
                Timestamp = timestamp
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to collect pedometer data");
        }
    }

    private async Task CollectSkinTemperatureAsync(SmartBandSensorData data, DateTime timestamp)
    {
        try
        {
            if (_bandClient?.SensorManager == null) return;

            var reading = await _bandClient.SensorManager.SkinTemperature.GetCurrentSensorReadingsAsync();

            data.SkinTemperature = new Models.SkinTemperatureReading
            {
                TemperatureCelsius = reading.Temperature,
                Timestamp = timestamp
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to collect skin temperature data");
        }
    }

    private async Task CollectUvExposureAsync(SmartBandSensorData data, DateTime timestamp)
    {
        try
        {
            if (_bandClient?.SensorManager == null) return;

            var reading = await _bandClient.SensorManager.UV.GetCurrentSensorReadingsAsync();

            data.UvExposure = new UvExposureReading
            {
                ExposureLevel = reading.ExposureLevel.ToString(),
                IndexLevel = (int)reading.IndexLevel,
                Timestamp = timestamp
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to collect UV exposure data");
        }
    }

    private async Task CollectDeviceContactAsync(SmartBandSensorData data, DateTime timestamp)
    {
        try
        {
            if (_bandClient?.SensorManager == null) return;

            var reading = await _bandClient.SensorManager.Contact.GetCurrentSensorReadingsAsync();

            data.DeviceContact = new DeviceContactReading
            {
                IsWorn = reading.State == BandContactState.Worn,
                Timestamp = timestamp
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to collect device contact data");
        }
    }

    private async Task CollectCaloriesAsync(SmartBandSensorData data, DateTime timestamp)
    {
        try
        {
            if (_bandClient?.SensorManager == null) return;

            var reading = await _bandClient.SensorManager.Calories.GetCurrentSensorReadingsAsync();

            data.Calories = new Models.CaloriesReading
            {
                TotalCalories = reading.Calories,
                Timestamp = timestamp
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to collect calories data");
        }
    }

    #endregion

    public void Dispose()
    {
        _bandClient?.Dispose();
        _connectionLock?.Dispose();
    }
}
