using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BehavioralHealthSystem.Helpers.Models;

/// <summary>
/// Represents a single Smart Band sensor data snapshot
/// </summary>
public class SmartBandDataSnapshot
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int Id { get; set; }

    [Required]
    [MaxLength(128)]
    public string UserId { get; set; } = string.Empty;

    [MaxLength(128)]
    public string? SnapshotId { get; set; }

    public string? CollectedAt { get; set; }

    /// <summary>
    /// Device info stored as JSON column
    /// </summary>
    [Column(TypeName = "jsonb")]
    public string? DeviceInfoJson { get; set; }

    [NotMapped]
    public SmartBandDeviceInfo? DeviceInfo
    {
        get => string.IsNullOrEmpty(DeviceInfoJson)
            ? null
            : JsonSerializer.Deserialize<SmartBandDeviceInfo>(DeviceInfoJson);
        set => DeviceInfoJson = value == null ? null : JsonSerializer.Serialize(value);
    }

    /// <summary>
    /// Sensor data stored as JSON column (complex nested structure)
    /// </summary>
    [Column(TypeName = "jsonb")]
    public string? SensorDataJson { get; set; }

    [NotMapped]
    public SmartBandSensorData? SensorData
    {
        get => string.IsNullOrEmpty(SensorDataJson)
            ? null
            : JsonSerializer.Deserialize<SmartBandSensorData>(SensorDataJson);
        set => SensorDataJson = value == null ? null : JsonSerializer.Serialize(value);
    }

    /// <summary>
    /// Metadata stored as JSON column
    /// </summary>
    [Column(TypeName = "jsonb")]
    public string? MetadataJson { get; set; }

    [NotMapped]
    public SmartBandMetadata? SnapshotMetadata
    {
        get => string.IsNullOrEmpty(MetadataJson)
            ? null
            : JsonSerializer.Deserialize<SmartBandMetadata>(MetadataJson);
        set => MetadataJson = value == null ? null : JsonSerializer.Serialize(value);
    }

    /// <summary>
    /// Timestamp of when this was saved to the database
    /// </summary>
    public DateTime SavedAt { get; set; } = DateTime.UtcNow;
}

// ==================== Value Objects (stored as JSON) ====================

public class SmartBandDeviceInfo
{
    public string? FirmwareVersion { get; set; }
    public string? HardwareVersion { get; set; }
    public string? SerialNumber { get; set; }
}

public class SmartBandSensorData
{
    public SmartBandAccelerometerData? Accelerometer { get; set; }
    public SmartBandGyroscopeData? Gyroscope { get; set; }
    public SmartBandMotionData? Motion { get; set; }
    public SmartBandHeartRateData? HeartRate { get; set; }
    public SmartBandPedometerData? Pedometer { get; set; }
    public SmartBandSkinTemperatureData? SkinTemperature { get; set; }
    public SmartBandUvExposureData? UvExposure { get; set; }
    public SmartBandDeviceContactData? DeviceContact { get; set; }
    public SmartBandCaloriesData? Calories { get; set; }
}

public class SmartBandAccelerometerData
{
    public double X { get; set; }
    public double Y { get; set; }
    public double Z { get; set; }
    public string? Timestamp { get; set; }
}

public class SmartBandGyroscopeData
{
    public double X { get; set; }
    public double Y { get; set; }
    public double Z { get; set; }
    public string? Timestamp { get; set; }
}

public class SmartBandMotionData
{
    public double Distance { get; set; }
    public double Speed { get; set; }
    public double Pace { get; set; }
    public string? MotionType { get; set; }
    public string? Timestamp { get; set; }
}

public class SmartBandHeartRateData
{
    public int Bpm { get; set; }
    public string? Quality { get; set; }
    public string? Timestamp { get; set; }
}

public class SmartBandPedometerData
{
    public int TotalSteps { get; set; }
    public string? Timestamp { get; set; }
}

public class SmartBandSkinTemperatureData
{
    public double Celsius { get; set; }
    public string? Timestamp { get; set; }
}

public class SmartBandUvExposureData
{
    public string? ExposureLevel { get; set; }
    public double IndexValue { get; set; }
    public string? Timestamp { get; set; }
}

public class SmartBandDeviceContactData
{
    public bool IsWorn { get; set; }
    public string? Timestamp { get; set; }
}

public class SmartBandCaloriesData
{
    public int TotalBurned { get; set; }
    public string? Timestamp { get; set; }
}

public class SmartBandMetadata
{
    public string Source { get; set; } = "microsoft-band-sdk";
    public int? CollectionDurationMs { get; set; }
    public string[]? Errors { get; set; }
}
