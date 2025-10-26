using System.Net;
using System.Text.Json;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;

namespace BehavioralHealthSystem.Functions.Functions;

/// <summary>
/// Azure Function for saving Microsoft Band smart device sensor data to blob storage.
/// Stores data under: bio/users/{userId}/smart-band-{timestamp}.json
/// </summary>
public class SaveSmartBandDataFunction
{
    private readonly ILogger<SaveSmartBandDataFunction> _logger;
    private readonly string _connectionString;

    public SaveSmartBandDataFunction(ILogger<SaveSmartBandDataFunction> logger)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _connectionString = Environment.GetEnvironmentVariable("AzureWebJobsStorage")
            ?? throw new InvalidOperationException("AzureWebJobsStorage connection string not found");
    }

    /// <summary>
    /// Saves Microsoft Band sensor data to blob storage.
    /// POST /api/SaveSmartBandData
    /// </summary>
    [Function("SaveSmartBandData")]
    public async Task<HttpResponseData> SaveSmartBandData(
        [HttpTrigger(AuthorizationLevel.Function, "post", Route = "SaveSmartBandData")] HttpRequestData req)
    {
        _logger.LogInformation("📊 SaveSmartBandData function triggered");

        try
        {
            // Parse request body
            string requestBody = await new StreamReader(req.Body).ReadToEndAsync();

            if (string.IsNullOrWhiteSpace(requestBody))
            {
                _logger.LogWarning("Request body is empty");
                var badRequest = req.CreateResponse(HttpStatusCode.BadRequest);
                await badRequest.WriteAsJsonAsync(new
                {
                    success = false,
                    message = "Request body cannot be empty"
                });
                return badRequest;
            }

            var data = JsonSerializer.Deserialize<SmartBandDataSnapshot>(requestBody);

            if (data == null)
            {
                _logger.LogWarning("Failed to deserialize request body");
                var badRequest = req.CreateResponse(HttpStatusCode.BadRequest);
                await badRequest.WriteAsJsonAsync(new
                {
                    success = false,
                    message = "Invalid request format"
                });
                return badRequest;
            }

            // Validate required fields
            if (string.IsNullOrWhiteSpace(data.UserId))
            {
                _logger.LogWarning("UserId is missing");
                var badRequest = req.CreateResponse(HttpStatusCode.BadRequest);
                await badRequest.WriteAsJsonAsync(new
                {
                    success = false,
                    message = "UserId is required"
                });
                return badRequest;
            }

            _logger.LogInformation("Processing Smart Band data for user: {UserId}", data.UserId);
            _logger.LogInformation("Snapshot ID: {SnapshotId}", data.SnapshotId);

            // Create blob path: bio/users/{userId}/smart-band-{timestamp}.json
            var timestamp = DateTime.UtcNow.ToString("yyyyMMdd-HHmmss");
            var blobName = $"users/{data.UserId}/smart-band-{timestamp}.json";

            _logger.LogInformation("Saving to blob: bio/{BlobName}", blobName);

            // Get blob client
            var blobServiceClient = new BlobServiceClient(_connectionString);
            var containerClient = blobServiceClient.GetBlobContainerClient("bio");

            // Ensure container exists
            await containerClient.CreateIfNotExistsAsync(PublicAccessType.None);

            // Get blob client for the specific file
            var blobClient = containerClient.GetBlobClient(blobName);

            // Add metadata
            var metadata = new Dictionary<string, string>
            {
                { "userId", data.UserId },
                { "snapshotId", data.SnapshotId ?? "unknown" },
                { "collectedAt", data.CollectedAt ?? DateTime.UtcNow.ToString("O") },
                { "source", "microsoft-band-sdk" },
                { "uploadedAt", DateTime.UtcNow.ToString("O") }
            };

            // Serialize data to JSON
            var jsonOptions = new JsonSerializerOptions
            {
                WriteIndented = true,
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            };
            var jsonContent = JsonSerializer.Serialize(data, jsonOptions);

            // Upload to blob storage
            using var stream = new MemoryStream(System.Text.Encoding.UTF8.GetBytes(jsonContent));

            var uploadOptions = new BlobUploadOptions
            {
                Metadata = metadata,
                HttpHeaders = new BlobHttpHeaders
                {
                    ContentType = "application/json"
                }
            };

            await blobClient.UploadAsync(stream, uploadOptions);

            _logger.LogInformation("✅ Smart Band data saved successfully to: bio/{BlobName}", blobName);

            // Return success response
            var response = req.CreateResponse(HttpStatusCode.OK);
            await response.WriteAsJsonAsync(new
            {
                success = true,
                message = "Smart Band data saved successfully",
                userId = data.UserId,
                snapshotId = data.SnapshotId,
                blobPath = $"bio/{blobName}",
                timestamp
            });

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Error saving Smart Band data: {Message}", ex.Message);

            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteAsJsonAsync(new
            {
                success = false,
                message = "Failed to save Smart Band data",
                error = ex.Message
            });

            return errorResponse;
        }
    }

    /// <summary>
    /// Data model for Smart Band sensor snapshot
    /// </summary>
    private class SmartBandDataSnapshot
    {
        public string UserId { get; set; } = string.Empty;
        public string? SnapshotId { get; set; }
        public string? CollectedAt { get; set; }
        public DeviceInfo? DeviceInfo { get; set; }
        public SensorData? SensorData { get; set; }
        public Metadata? Metadata { get; set; }
    }

    private class DeviceInfo
    {
        public string? FirmwareVersion { get; set; }
        public string? HardwareVersion { get; set; }
        public string? SerialNumber { get; set; }
    }

    private class SensorData
    {
        public AccelerometerData? Accelerometer { get; set; }
        public GyroscopeData? Gyroscope { get; set; }
        public MotionData? Motion { get; set; }
        public HeartRateData? HeartRate { get; set; }
        public PedometerData? Pedometer { get; set; }
        public SkinTemperatureData? SkinTemperature { get; set; }
        public UvExposureData? UvExposure { get; set; }
        public DeviceContactData? DeviceContact { get; set; }
        public CaloriesData? Calories { get; set; }
    }

    private class AccelerometerData
    {
        public double X { get; set; }
        public double Y { get; set; }
        public double Z { get; set; }
        public string? Timestamp { get; set; }
    }

    private class GyroscopeData
    {
        public double X { get; set; }
        public double Y { get; set; }
        public double Z { get; set; }
        public string? Timestamp { get; set; }
    }

    private class MotionData
    {
        public double Distance { get; set; }
        public double Speed { get; set; }
        public double Pace { get; set; }
        public string? MotionType { get; set; }
        public string? Timestamp { get; set; }
    }

    private class HeartRateData
    {
        public int Bpm { get; set; }
        public string? Quality { get; set; }
        public string? Timestamp { get; set; }
    }

    private class PedometerData
    {
        public int TotalSteps { get; set; }
        public string? Timestamp { get; set; }
    }

    private class SkinTemperatureData
    {
        public double Celsius { get; set; }
        public string? Timestamp { get; set; }
    }

    private class UvExposureData
    {
        public string? ExposureLevel { get; set; }
        public double IndexValue { get; set; }
        public string? Timestamp { get; set; }
    }

    private class DeviceContactData
    {
        public bool IsWorn { get; set; }
        public string? Timestamp { get; set; }
    }

    private class CaloriesData
    {
        public int TotalBurned { get; set; }
        public string? Timestamp { get; set; }
    }

    private class Metadata
    {
        public string Source { get; set; } = "microsoft-band-sdk";
        public int? CollectionDurationMs { get; set; }
        public string[]? Errors { get; set; }
    }
}
