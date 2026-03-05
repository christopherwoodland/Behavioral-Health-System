using BehavioralHealthSystem.Helpers.Data;
using BehavioralHealthSystem.Helpers.Models;
using BehavioralHealthSystem.Helpers.Services.PostgreSQL;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;

namespace BehavioralHealthSystem.Tests.PostgreSQL;

/// <summary>
/// Integration tests for PgSmartBandDataService using EF Core InMemory provider
/// </summary>
[TestClass]
public class PgSmartBandDataServiceTests
{
    private BhsDbContext _db = null!;
    private PgSmartBandDataService _service = null!;
    private Mock<ILogger<PgSmartBandDataService>> _mockLogger = null!;

    [TestInitialize]
    public void Setup()
    {
        var options = new DbContextOptionsBuilder<BhsDbContext>()
            .UseInMemoryDatabase(databaseName: $"BhsTest_SmartBand_{Guid.NewGuid()}")
            .Options;

        _db = new BhsDbContext(options);
        _mockLogger = new Mock<ILogger<PgSmartBandDataService>>();
        _service = new PgSmartBandDataService(_db, _mockLogger.Object);
    }

    [TestCleanup]
    public void Cleanup()
    {
        _db.Dispose();
    }

    #region SaveSnapshotAsync Tests

    [TestMethod]
    public async Task SaveSnapshotAsync_NewSnapshot_ReturnsTrue()
    {
        // Arrange
        var snapshot = CreateTestSnapshot("user-1");

        // Act
        var result = await _service.SaveSnapshotAsync(snapshot);

        // Assert
        Assert.IsTrue(result);
    }

    [TestMethod]
    public async Task SaveSnapshotAsync_WithSensorData_PersistsJsonColumns()
    {
        // Arrange
        var snapshot = CreateTestSnapshot("user-1");
        snapshot.DeviceInfo = new SmartBandDeviceInfo
        {
            FirmwareVersion = "3.1.0",
            HardwareVersion = "2.0",
            SerialNumber = "SB-12345"
        };
        snapshot.SensorData = new SmartBandSensorData
        {
            HeartRate = new SmartBandHeartRateData { Bpm = 72, Quality = "high", Timestamp = DateTime.UtcNow.ToString("O") },
            Accelerometer = new SmartBandAccelerometerData { X = 0.1, Y = 0.2, Z = 9.8, Timestamp = DateTime.UtcNow.ToString("O") }
        };
        snapshot.SnapshotMetadata = new SmartBandMetadata
        {
            Source = "e2e-test",
            CollectionDurationMs = 5000
        };

        // Act
        await _service.SaveSnapshotAsync(snapshot);

        // Assert
        var retrieved = await _service.GetSnapshotAsync(snapshot.Id);
        Assert.IsNotNull(retrieved);

        // Verify JSONB columns are roundtripped correctly
        Assert.IsNotNull(retrieved.DeviceInfoJson);
        Assert.IsNotNull(retrieved.SensorDataJson);
        Assert.IsNotNull(retrieved.MetadataJson);
    }

    [TestMethod]
    public async Task SaveSnapshotAsync_MultipleSnapshots_AppendOnly()
    {
        // Act — save 3 snapshots for same user
        await _service.SaveSnapshotAsync(CreateTestSnapshot("user-1"));
        await _service.SaveSnapshotAsync(CreateTestSnapshot("user-1"));
        await _service.SaveSnapshotAsync(CreateTestSnapshot("user-1"));

        // Assert — all 3 should exist
        var results = await _service.GetUserSnapshotsAsync("user-1");
        Assert.AreEqual(3, results.Count);
    }

    #endregion

    #region GetUserSnapshotsAsync Tests

    [TestMethod]
    public async Task GetUserSnapshotsAsync_MultipleUsers_FiltersCorrectly()
    {
        // Arrange
        await _service.SaveSnapshotAsync(CreateTestSnapshot("user-1"));
        await _service.SaveSnapshotAsync(CreateTestSnapshot("user-1"));
        await _service.SaveSnapshotAsync(CreateTestSnapshot("user-2"));

        // Act
        var results = await _service.GetUserSnapshotsAsync("user-1");

        // Assert
        Assert.AreEqual(2, results.Count);
        Assert.IsTrue(results.All(s => s.UserId == "user-1"));
    }

    [TestMethod]
    public async Task GetUserSnapshotsAsync_WithLimit_RespectsLimit()
    {
        // Arrange
        for (int i = 0; i < 5; i++)
            await _service.SaveSnapshotAsync(CreateTestSnapshot("user-1"));

        // Act
        var results = await _service.GetUserSnapshotsAsync("user-1", limit: 3);

        // Assert
        Assert.AreEqual(3, results.Count);
    }

    [TestMethod]
    public async Task GetUserSnapshotsAsync_NoData_ReturnsEmpty()
    {
        var results = await _service.GetUserSnapshotsAsync("user-999");
        Assert.AreEqual(0, results.Count);
    }

    #endregion

    #region GetSnapshotAsync Tests

    [TestMethod]
    public async Task GetSnapshotAsync_Exists_ReturnsSnapshot()
    {
        // Arrange
        var snapshot = CreateTestSnapshot("user-1");
        await _service.SaveSnapshotAsync(snapshot);

        // Act
        var result = await _service.GetSnapshotAsync(snapshot.Id);

        // Assert
        Assert.IsNotNull(result);
        Assert.AreEqual("user-1", result.UserId);
    }

    [TestMethod]
    public async Task GetSnapshotAsync_NotFound_ReturnsNull()
    {
        var result = await _service.GetSnapshotAsync(99999);
        Assert.IsNull(result);
    }

    #endregion

    #region Helper Methods

    private static SmartBandDataSnapshot CreateTestSnapshot(string userId)
    {
        return new SmartBandDataSnapshot
        {
            UserId = userId,
            SnapshotId = $"snap-{Guid.NewGuid():N}",
            CollectedAt = DateTime.UtcNow.ToString("O"),
            SavedAt = DateTime.UtcNow
        };
    }

    #endregion
}
