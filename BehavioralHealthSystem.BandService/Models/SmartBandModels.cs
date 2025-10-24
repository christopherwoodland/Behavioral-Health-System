namespace BehavioralHealthSystem.BandService.Models;

/// <summary>
/// Complete sensor data snapshot from Microsoft Band
/// </summary>
public class SmartBandDataSnapshot
{
    public required string UserId { get; set; }
    public required string SnapshotId { get; set; }
    public SmartBandSensorData SensorData { get; set; } = new();
    public DateTime CollectedAt { get; set; }
    public DeviceInfo? DeviceInfo { get; set; }
    public Dictionary<string, object> Metadata { get; set; } = new();
}

/// <summary>
/// Container for all sensor readings
/// </summary>
public class SmartBandSensorData
{
    public AccelerometerReading? Accelerometer { get; set; }
    public GyroscopeReading? Gyroscope { get; set; }
    public MotionReading? Motion { get; set; }
    public HeartRateReading? HeartRate { get; set; }
    public PedometerReading? Pedometer { get; set; }
    public SkinTemperatureReading? SkinTemperature { get; set; }
    public UvExposureReading? UvExposure { get; set; }
    public DeviceContactReading? DeviceContact { get; set; }
    public CaloriesReading? Calories { get; set; }
}

/// <summary>
/// Accelerometer sensor reading (m/s²)
/// </summary>
public class AccelerometerReading
{
    public double X { get; set; }
    public double Y { get; set; }
    public double Z { get; set; }
    public DateTime Timestamp { get; set; }
}

/// <summary>
/// Gyroscope sensor reading (°/s)
/// </summary>
public class GyroscopeReading
{
    public double X { get; set; }
    public double Y { get; set; }
    public double Z { get; set; }
    public DateTime Timestamp { get; set; }
}

/// <summary>
/// Motion sensor reading (distance, speed, pace)
/// </summary>
public class MotionReading
{
    public long DistanceCm { get; set; }
    public double SpeedCmPerSecond { get; set; }
    public double PaceMsPerMeter { get; set; }
    public string MotionType { get; set; } = string.Empty; // Walking, Jogging, Running, Idle
    public DateTime Timestamp { get; set; }
}

/// <summary>
/// Heart rate sensor reading
/// </summary>
public class HeartRateReading
{
    public int Bpm { get; set; }
    public string Quality { get; set; } = string.Empty; // Acquiring, Locked
    public DateTime Timestamp { get; set; }
}

/// <summary>
/// Pedometer sensor reading
/// </summary>
public class PedometerReading
{
    public long TotalSteps { get; set; }
    public DateTime Timestamp { get; set; }
}

/// <summary>
/// Skin temperature sensor reading (°C)
/// </summary>
public class SkinTemperatureReading
{
    public double TemperatureCelsius { get; set; }
    public DateTime Timestamp { get; set; }
}

/// <summary>
/// UV exposure sensor reading
/// </summary>
public class UvExposureReading
{
    public string ExposureLevel { get; set; } = string.Empty; // None, Low, Medium, High, VeryHigh
    public int IndexLevel { get; set; }
    public DateTime Timestamp { get; set; }
}

/// <summary>
/// Device contact sensor reading (whether band is worn)
/// </summary>
public class DeviceContactReading
{
    public bool IsWorn { get; set; }
    public DateTime Timestamp { get; set; }
}

/// <summary>
/// Calories burned reading
/// </summary>
public class CaloriesReading
{
    public long TotalCalories { get; set; }
    public DateTime Timestamp { get; set; }
}

/// <summary>
/// Information about the Band device
/// </summary>
public class DeviceInfo
{
    public string DeviceName { get; set; } = string.Empty;
    public string FirmwareVersion { get; set; } = string.Empty;
    public string HardwareVersion { get; set; } = string.Empty;
}

/// <summary>
/// Response for device status check
/// </summary>
public class DeviceStatusResponse
{
    public bool IsConnected { get; set; }
    public DeviceInfo? DeviceInfo { get; set; }
    public string Message { get; set; } = string.Empty;
}

/// <summary>
/// Response for sensor data collection
/// </summary>
public class CollectDataResponse
{
    public bool Success { get; set; }
    public SmartBandDataSnapshot? Data { get; set; }
    public string? Error { get; set; }
}
