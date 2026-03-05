using BehavioralHealthSystem.Helpers.Data;
using BehavioralHealthSystem.Helpers.Models;
using BehavioralHealthSystem.Helpers.Services.PostgreSQL;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;

namespace BehavioralHealthSystem.Tests.PostgreSQL;

/// <summary>
/// Integration tests for PgAudioMetadataService using EF Core InMemory provider
/// </summary>
[TestClass]
public class PgAudioMetadataServiceTests
{
    private BhsDbContext _db = null!;
    private PgAudioMetadataService _service = null!;
    private Mock<ILogger<PgAudioMetadataService>> _mockLogger = null!;

    [TestInitialize]
    public void Setup()
    {
        var options = new DbContextOptionsBuilder<BhsDbContext>()
            .UseInMemoryDatabase(databaseName: $"BhsTest_AudioMetadata_{Guid.NewGuid()}")
            .Options;

        _db = new BhsDbContext(options);
        _mockLogger = new Mock<ILogger<PgAudioMetadataService>>();
        _service = new PgAudioMetadataService(_db, _mockLogger.Object);
    }

    [TestCleanup]
    public void Cleanup()
    {
        _db.Dispose();
    }

    #region SaveMetadataAsync Tests

    [TestMethod]
    public async Task SaveMetadataAsync_NewMetadata_ReturnsTrue()
    {
        // Arrange
        var metadata = CreateTestMetadata("user-1", "session-1");

        // Act
        var result = await _service.SaveMetadataAsync(metadata);

        // Assert
        Assert.IsTrue(result);
    }

    [TestMethod]
    public async Task SaveMetadataAsync_PersistsAllFields()
    {
        // Arrange
        var metadata = new AudioMetadata
        {
            UserId = "user-1",
            SessionId = "session-1",
            OriginalFileName = "recording.wav",
            BlobPath = "audio-uploads/users/user-1/session-session-1-20260303.wav",
            BlobUrl = "https://storage.blob.core.windows.net/audio-uploads/users/user-1/session-session-1-20260303.wav",
            ContentType = "audio/wav",
            FileSizeBytes = 1024000,
            Source = "microphone",
            UploadedAt = DateTime.UtcNow
        };

        // Act
        await _service.SaveMetadataAsync(metadata);

        // Assert
        var results = await _service.GetSessionAudioMetadataAsync("user-1", "session-1");
        Assert.AreEqual(1, results.Count);
        var saved = results.First();
        Assert.AreEqual("recording.wav", saved.OriginalFileName);
        Assert.AreEqual("audio/wav", saved.ContentType);
        Assert.AreEqual(1024000, saved.FileSizeBytes);
        Assert.AreEqual("microphone", saved.Source);
    }

    [TestMethod]
    public async Task SaveMetadataAsync_MultipleUploads_AllPersisted()
    {
        // Arrange & Act — user uploads 3 audio files in the same session
        await _service.SaveMetadataAsync(CreateTestMetadata("user-1", "session-1", "file1.wav"));
        await _service.SaveMetadataAsync(CreateTestMetadata("user-1", "session-1", "file2.wav"));
        await _service.SaveMetadataAsync(CreateTestMetadata("user-1", "session-1", "file3.wav"));

        // Assert
        var results = await _service.GetSessionAudioMetadataAsync("user-1", "session-1");
        Assert.AreEqual(3, results.Count);
    }

    #endregion

    #region GetUserAudioMetadataAsync Tests

    [TestMethod]
    public async Task GetUserAudioMetadataAsync_MultipleSessions_ReturnsAll()
    {
        // Arrange
        await _service.SaveMetadataAsync(CreateTestMetadata("user-1", "session-1"));
        await _service.SaveMetadataAsync(CreateTestMetadata("user-1", "session-2"));
        await _service.SaveMetadataAsync(CreateTestMetadata("user-2", "session-3"));

        // Act
        var results = await _service.GetUserAudioMetadataAsync("user-1");

        // Assert
        Assert.AreEqual(2, results.Count);
        Assert.IsTrue(results.All(m => m.UserId == "user-1"));
    }

    [TestMethod]
    public async Task GetUserAudioMetadataAsync_NoData_ReturnsEmpty()
    {
        var results = await _service.GetUserAudioMetadataAsync("user-999");
        Assert.AreEqual(0, results.Count);
    }

    #endregion

    #region GetSessionAudioMetadataAsync Tests

    [TestMethod]
    public async Task GetSessionAudioMetadataAsync_FiltersBySession()
    {
        // Arrange
        await _service.SaveMetadataAsync(CreateTestMetadata("user-1", "session-1"));
        await _service.SaveMetadataAsync(CreateTestMetadata("user-1", "session-1"));
        await _service.SaveMetadataAsync(CreateTestMetadata("user-1", "session-2"));

        // Act
        var results = await _service.GetSessionAudioMetadataAsync("user-1", "session-1");

        // Assert
        Assert.AreEqual(2, results.Count);
        Assert.IsTrue(results.All(m => m.SessionId == "session-1"));
    }

    [TestMethod]
    public async Task GetSessionAudioMetadataAsync_WrongUser_ReturnsEmpty()
    {
        // Arrange
        await _service.SaveMetadataAsync(CreateTestMetadata("user-1", "session-1"));

        // Act
        var results = await _service.GetSessionAudioMetadataAsync("user-2", "session-1");

        // Assert
        Assert.AreEqual(0, results.Count);
    }

    #endregion

    #region Helper Methods

    private static AudioMetadata CreateTestMetadata(string userId, string sessionId, string? fileName = null)
    {
        fileName ??= $"recording-{Guid.NewGuid():N}.wav";
        return new AudioMetadata
        {
            UserId = userId,
            SessionId = sessionId,
            OriginalFileName = fileName,
            BlobPath = $"audio-uploads/users/{userId}/{fileName}",
            ContentType = "audio/wav",
            FileSizeBytes = 512000,
            UploadedAt = DateTime.UtcNow
        };
    }

    #endregion
}
