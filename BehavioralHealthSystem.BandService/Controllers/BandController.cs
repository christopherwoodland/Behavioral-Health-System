using BehavioralHealthSystem.BandService.Models;
using BehavioralHealthSystem.BandService.Services;
using Microsoft.AspNetCore.Mvc;

namespace BehavioralHealthSystem.BandService.Controllers;

/// <summary>
/// REST API controller for Microsoft Band sensor data
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class BandController : ControllerBase
{
    private readonly IBandSensorService _bandService;
    private readonly ILogger<BandController> _logger;

    public BandController(IBandSensorService bandService, ILogger<BandController> logger)
    {
        _bandService = bandService;
        _logger = logger;
    }

    /// <summary>
    /// Health check endpoint
    /// </summary>
    [HttpGet("health")]
    public IActionResult Health()
    {
        return Ok(new { status = "healthy", service = "Microsoft Band Service", timestamp = DateTime.UtcNow });
    }

    /// <summary>
    /// Check if a Band device is connected
    /// </summary>
    [HttpGet("status")]
    public async Task<ActionResult<DeviceStatusResponse>> GetDeviceStatus()
    {
        try
        {
            _logger.LogInformation("🔍 [SMART BAND API] GET /api/band/status - Checking device status");

            var isConnected = await _bandService.IsDeviceConnectedAsync();

            if (!isConnected)
            {
                _logger.LogWarning("⚠️ [SMART BAND API] No device connected");
                return Ok(new DeviceStatusResponse
                {
                    IsConnected = false,
                    Message = "No Microsoft Band device connected"
                });
            }

            var deviceInfo = await _bandService.GetDeviceInfoAsync();

            _logger.LogInformation("✅ [SMART BAND API] Device connected: {DeviceName}", deviceInfo?.DeviceName ?? "Unknown");

            return Ok(new DeviceStatusResponse
            {
                IsConnected = true,
                DeviceInfo = deviceInfo,
                Message = "Microsoft Band connected successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ [SMART BAND API] Error checking device status");

            return StatusCode(500, new DeviceStatusResponse
            {
                IsConnected = false,
                Message = $"Error checking device status: {ex.Message}"
            });
        }
    }

    /// <summary>
    /// Collect sensor data from the connected Band device
    /// </summary>
    [HttpPost("collect")]
    public async Task<ActionResult<CollectDataResponse>> CollectSensorData([FromBody] CollectDataRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request?.UserId))
            {
                _logger.LogWarning("⚠️ [SMART BAND API] POST /api/band/collect - Missing userId");
                return BadRequest(new CollectDataResponse
                {
                    Success = false,
                    Error = "UserId is required"
                });
            }

            _logger.LogInformation("🎯 [SMART BAND API] POST /api/band/collect - User: {UserId}", request.UserId);

            var isConnected = await _bandService.IsDeviceConnectedAsync();

            if (!isConnected)
            {
                _logger.LogWarning("⚠️ [SMART BAND API] Collection failed - no device connected");
                return Ok(new CollectDataResponse
                {
                    Success = false,
                    Error = "No Microsoft Band device connected"
                });
            }

            var snapshot = await _bandService.CollectSensorDataAsync(request.UserId);

            _logger.LogInformation("✅ [SMART BAND API] Collection successful - Snapshot ID: {SnapshotId}", snapshot.SnapshotId);

            return Ok(new CollectDataResponse
            {
                Success = true,
                Data = snapshot
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ [SMART BAND API] Error collecting sensor data for user: {UserId}", request?.UserId);

            return Ok(new CollectDataResponse
            {
                Success = false,
                Error = $"Failed to collect sensor data: {ex.Message}"
            });
        }
    }

    /// <summary>
    /// Get device information
    /// </summary>
    [HttpGet("device-info")]
    public async Task<ActionResult<DeviceInfo>> GetDeviceInfo()
    {
        try
        {
            var deviceInfo = await _bandService.GetDeviceInfoAsync();

            if (deviceInfo == null)
            {
                return NotFound(new { message = "No device connected or unable to retrieve device info" });
            }

            return Ok(deviceInfo);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting device info");
            return StatusCode(500, new { error = ex.Message });
        }
    }
}

/// <summary>
/// Request model for collecting sensor data
/// </summary>
public class CollectDataRequest
{
    public required string UserId { get; set; }
}
