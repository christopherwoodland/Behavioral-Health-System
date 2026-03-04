using BehavioralHealthSystem.Helpers.Data;
using BehavioralHealthSystem.Helpers.Services.PostgreSQL;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;

namespace BehavioralHealthSystem.Tests.PostgreSQL;

/// <summary>
/// Integration tests for PgSessionStorageService using EF Core InMemory provider
/// </summary>
[TestClass]
public class PgSessionStorageServiceTests
{
    private BhsDbContext _db = null!;
    private PgSessionStorageService _service = null!;
    private Mock<ILogger<PgSessionStorageService>> _mockLogger = null!;

    [TestInitialize]
    public void Setup()
    {
        var options = new DbContextOptionsBuilder<BhsDbContext>()
            .UseInMemoryDatabase(databaseName: $"BhsTest_SessionStorage_{Guid.NewGuid()}")
            .Options;

        _db = new BhsDbContext(options);
        _mockLogger = new Mock<ILogger<PgSessionStorageService>>();
        _service = new PgSessionStorageService(_db, _mockLogger.Object);
    }

    [TestCleanup]
    public void Cleanup()
    {
        _db.Dispose();
    }

    #region SaveSessionDataAsync Tests

    [TestMethod]
    public async Task SaveSessionDataAsync_NewSession_ReturnsTrue()
    {
        // Arrange
        var session = CreateTestSession("session-1", "user-1");

        // Act
        var result = await _service.SaveSessionDataAsync(session);

        // Assert
        Assert.IsTrue(result);
    }

    [TestMethod]
    public async Task SaveSessionDataAsync_NewSession_PersistsToDb()
    {
        // Arrange
        var session = CreateTestSession("session-1", "user-1");

        // Act
        await _service.SaveSessionDataAsync(session);

        // Assert
        var retrieved = await _service.GetSessionDataAsync("session-1");
        Assert.IsNotNull(retrieved);
        Assert.AreEqual("user-1", retrieved.UserId);
        Assert.AreEqual("session-1", retrieved.SessionId);
    }

    [TestMethod]
    public async Task SaveSessionDataAsync_ExistingSession_Updates()
    {
        // Arrange
        var session = CreateTestSession("session-1", "user-1");
        session.Status = "active";
        await _service.SaveSessionDataAsync(session);

        // Act — update status
        session.Status = "completed";
        await _service.SaveSessionDataAsync(session);

        // Assert
        var retrieved = await _service.GetSessionDataAsync("session-1");
        Assert.AreEqual("completed", retrieved?.Status);
    }

    [TestMethod]
    public async Task SaveSessionDataAsync_SetsUpdatedAt()
    {
        // Arrange
        var session = CreateTestSession("session-1", "user-1");
        session.UpdatedAt = "";

        // Act
        await _service.SaveSessionDataAsync(session);

        // Assert
        var retrieved = await _service.GetSessionDataAsync("session-1");
        Assert.IsFalse(string.IsNullOrWhiteSpace(retrieved?.UpdatedAt));
    }

    #endregion

    #region GetSessionDataAsync Tests

    [TestMethod]
    public async Task GetSessionDataAsync_NotFound_ReturnsNull()
    {
        var result = await _service.GetSessionDataAsync("session-999");
        Assert.IsNull(result);
    }

    #endregion

    #region GetUserSessionsAsync Tests

    [TestMethod]
    public async Task GetUserSessionsAsync_MultipleUsers_FiltersCorrectly()
    {
        // Arrange
        await _service.SaveSessionDataAsync(CreateTestSession("session-1", "user-1"));
        await _service.SaveSessionDataAsync(CreateTestSession("session-2", "user-1"));
        await _service.SaveSessionDataAsync(CreateTestSession("session-3", "user-2"));

        // Act
        var results = await _service.GetUserSessionsAsync("user-1");

        // Assert
        Assert.AreEqual(2, results.Count);
        Assert.IsTrue(results.All(s => s.UserId == "user-1"));
    }

    [TestMethod]
    public async Task GetUserSessionsAsync_NoSessions_ReturnsEmpty()
    {
        var results = await _service.GetUserSessionsAsync("user-999");
        Assert.AreEqual(0, results.Count);
    }

    #endregion

    #region GetAllSessionsAsync Tests

    [TestMethod]
    public async Task GetAllSessionsAsync_ReturnsAllSessions()
    {
        // Arrange
        await _service.SaveSessionDataAsync(CreateTestSession("session-1", "user-1"));
        await _service.SaveSessionDataAsync(CreateTestSession("session-2", "user-2"));
        await _service.SaveSessionDataAsync(CreateTestSession("session-3", "user-3"));

        // Act
        var results = await _service.GetAllSessionsAsync();

        // Assert
        Assert.AreEqual(3, results.Count);
    }

    #endregion

    #region DeleteSessionDataAsync Tests

    [TestMethod]
    public async Task DeleteSessionDataAsync_Exists_DeletesAndReturnsTrue()
    {
        // Arrange
        await _service.SaveSessionDataAsync(CreateTestSession("session-1", "user-1"));

        // Act
        var result = await _service.DeleteSessionDataAsync("session-1");

        // Assert
        Assert.IsTrue(result);
        var deleted = await _service.GetSessionDataAsync("session-1");
        Assert.IsNull(deleted);
    }

    [TestMethod]
    public async Task DeleteSessionDataAsync_NotFound_ReturnsFalse()
    {
        var result = await _service.DeleteSessionDataAsync("session-999");
        Assert.IsFalse(result);
    }

    #endregion

    #region UpdateSessionDataAsync Tests

    [TestMethod]
    public async Task UpdateSessionDataAsync_DelegatesToSave_ReturnsTrue()
    {
        // Arrange
        var session = CreateTestSession("session-1", "user-1");
        await _service.SaveSessionDataAsync(session);

        // Act
        session.Status = "completed";
        var result = await _service.UpdateSessionDataAsync(session);

        // Assert
        Assert.IsTrue(result);
        var retrieved = await _service.GetSessionDataAsync("session-1");
        Assert.AreEqual("completed", retrieved?.Status);
    }

    #endregion

    #region Helper Methods

    private static SessionData CreateTestSession(string sessionId, string userId)
    {
        return new SessionData
        {
            SessionId = sessionId,
            UserId = userId,
            CreatedAt = DateTime.UtcNow.ToString("O"),
            UpdatedAt = DateTime.UtcNow.ToString("O"),
            Status = "active"
        };
    }

    #endregion
}
