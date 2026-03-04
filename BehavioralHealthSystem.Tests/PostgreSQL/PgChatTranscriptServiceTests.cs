using BehavioralHealthSystem.Helpers.Data;
using BehavioralHealthSystem.Helpers.Models;
using BehavioralHealthSystem.Helpers.Services.PostgreSQL;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;

namespace BehavioralHealthSystem.Tests.PostgreSQL;

/// <summary>
/// Integration tests for PgChatTranscriptService using EF Core InMemory provider
/// </summary>
[TestClass]
public class PgChatTranscriptServiceTests
{
    private BhsDbContext _db = null!;
    private PgChatTranscriptService _service = null!;
    private Mock<ILogger<PgChatTranscriptService>> _mockLogger = null!;

    [TestInitialize]
    public void Setup()
    {
        var options = new DbContextOptionsBuilder<BhsDbContext>()
            .UseInMemoryDatabase(databaseName: $"BhsTest_ChatTranscript_{Guid.NewGuid()}")
            .Options;

        _db = new BhsDbContext(options);
        _mockLogger = new Mock<ILogger<PgChatTranscriptService>>();
        _service = new PgChatTranscriptService(_db, _mockLogger.Object);
    }

    [TestCleanup]
    public void Cleanup()
    {
        _db.Dispose();
    }

    #region SaveTranscriptAsync Tests

    [TestMethod]
    public async Task SaveTranscriptAsync_NewTranscript_CreatesSuccessfully()
    {
        // Arrange
        var transcript = CreateTestTranscript("user-1", "session-1");

        // Act
        var result = await _service.SaveTranscriptAsync(transcript);

        // Assert
        Assert.IsNotNull(result);
        Assert.AreEqual("user-1", result.UserId);
        Assert.AreEqual("session-1", result.SessionId);
        Assert.IsTrue(result.Id > 0);
        Assert.IsTrue(result.IsActive);
    }

    [TestMethod]
    public async Task SaveTranscriptAsync_NewTranscript_SetsCreatedAtIfMissing()
    {
        // Arrange
        var transcript = CreateTestTranscript("user-1", "session-1");
        transcript.CreatedAt = "";

        // Act
        var result = await _service.SaveTranscriptAsync(transcript);

        // Assert
        Assert.IsFalse(string.IsNullOrWhiteSpace(result.CreatedAt));
    }

    [TestMethod]
    public async Task SaveTranscriptAsync_DuplicateSession_MergesMessages()
    {
        // Arrange — save initial transcript with 2 messages
        var transcript1 = CreateTestTranscript("user-1", "session-1");
        transcript1.Messages = new List<ChatMessageData>
        {
            CreateMessage("msg-1", "user", "Hello"),
            CreateMessage("msg-2", "assistant", "Hi there!")
        };
        await _service.SaveTranscriptAsync(transcript1);

        // Act — save second transcript with 1 new + 1 duplicate message
        var transcript2 = CreateTestTranscript("user-1", "session-1");
        transcript2.Messages = new List<ChatMessageData>
        {
            CreateMessage("msg-2", "assistant", "Hi there!"), // duplicate
            CreateMessage("msg-3", "user", "How are you?")    // new
        };
        var result = await _service.SaveTranscriptAsync(transcript2);

        // Assert — should have 3 unique messages
        Assert.AreEqual(3, result.Messages.Count);
        Assert.IsTrue(result.Messages.Any(m => m.Id == "msg-1"));
        Assert.IsTrue(result.Messages.Any(m => m.Id == "msg-2"));
        Assert.IsTrue(result.Messages.Any(m => m.Id == "msg-3"));
    }

    [TestMethod]
    public async Task SaveTranscriptAsync_SessionEnded_SetsSessionEndedAt()
    {
        // Arrange — create an active session
        var transcript = CreateTestTranscript("user-1", "session-1");
        await _service.SaveTranscriptAsync(transcript);

        // Act — save with IsActive=false
        var endTranscript = CreateTestTranscript("user-1", "session-1");
        endTranscript.IsActive = false;
        var result = await _service.SaveTranscriptAsync(endTranscript);

        // Assert
        Assert.IsFalse(result.IsActive);
        Assert.IsFalse(string.IsNullOrEmpty(result.SessionEndedAt));
    }

    [TestMethod]
    public async Task SaveTranscriptAsync_WithMetadata_PersistsMetadata()
    {
        // Arrange
        var transcript = CreateTestTranscript("user-1", "session-1");
        transcript.Metadata = new ChatSessionMetadata
        {
            UserAgent = "TestAgent/1.0",
            ClientTimezone = "UTC",
            Platform = "Windows"
        };

        // Act
        var result = await _service.SaveTranscriptAsync(transcript);

        // Assert
        var retrieved = await _service.GetTranscriptAsync("user-1", "session-1");
        Assert.IsNotNull(retrieved?.Metadata);
        Assert.AreEqual("TestAgent/1.0", retrieved.Metadata.UserAgent);
        Assert.AreEqual("UTC", retrieved.Metadata.ClientTimezone);
    }

    #endregion

    #region GetTranscriptAsync Tests

    [TestMethod]
    public async Task GetTranscriptAsync_Exists_ReturnsWithMessages()
    {
        // Arrange
        var transcript = CreateTestTranscript("user-1", "session-1");
        transcript.Messages = new List<ChatMessageData>
        {
            CreateMessage("msg-1", "user", "Hello"),
            CreateMessage("msg-2", "assistant", "Hi!")
        };
        await _service.SaveTranscriptAsync(transcript);

        // Act
        var result = await _service.GetTranscriptAsync("user-1", "session-1");

        // Assert
        Assert.IsNotNull(result);
        Assert.AreEqual(2, result.Messages.Count);
    }

    [TestMethod]
    public async Task GetTranscriptAsync_NotFound_ReturnsNull()
    {
        // Act
        var result = await _service.GetTranscriptAsync("user-999", "session-999");

        // Assert
        Assert.IsNull(result);
    }

    [TestMethod]
    public async Task GetTranscriptAsync_WrongUser_ReturnsNull()
    {
        // Arrange
        await _service.SaveTranscriptAsync(CreateTestTranscript("user-1", "session-1"));

        // Act
        var result = await _service.GetTranscriptAsync("user-2", "session-1");

        // Assert
        Assert.IsNull(result);
    }

    #endregion

    #region GetUserTranscriptsAsync Tests

    [TestMethod]
    public async Task GetUserTranscriptsAsync_MultipleTranscripts_ReturnsAll()
    {
        // Arrange
        await _service.SaveTranscriptAsync(CreateTestTranscript("user-1", "session-1"));
        await _service.SaveTranscriptAsync(CreateTestTranscript("user-1", "session-2"));
        await _service.SaveTranscriptAsync(CreateTestTranscript("user-1", "session-3"));
        await _service.SaveTranscriptAsync(CreateTestTranscript("user-2", "session-4"));

        // Act
        var results = await _service.GetUserTranscriptsAsync("user-1");

        // Assert
        Assert.AreEqual(3, results.Count);
        Assert.IsTrue(results.All(t => t.UserId == "user-1"));
    }

    [TestMethod]
    public async Task GetUserTranscriptsAsync_WithLimit_RespectsLimit()
    {
        // Arrange
        await _service.SaveTranscriptAsync(CreateTestTranscript("user-1", "session-1"));
        await _service.SaveTranscriptAsync(CreateTestTranscript("user-1", "session-2"));
        await _service.SaveTranscriptAsync(CreateTestTranscript("user-1", "session-3"));

        // Act
        var results = await _service.GetUserTranscriptsAsync("user-1", limit: 2);

        // Assert
        Assert.AreEqual(2, results.Count);
    }

    [TestMethod]
    public async Task GetUserTranscriptsAsync_NoTranscripts_ReturnsEmptyList()
    {
        // Act
        var results = await _service.GetUserTranscriptsAsync("user-999");

        // Assert
        Assert.AreEqual(0, results.Count);
    }

    #endregion

    #region DeleteTranscriptAsync Tests

    [TestMethod]
    public async Task DeleteTranscriptAsync_Exists_DeletesAndReturnsTrue()
    {
        // Arrange
        await _service.SaveTranscriptAsync(CreateTestTranscript("user-1", "session-1"));

        // Act
        var result = await _service.DeleteTranscriptAsync("user-1", "session-1");

        // Assert
        Assert.IsTrue(result);
        var deleted = await _service.GetTranscriptAsync("user-1", "session-1");
        Assert.IsNull(deleted);
    }

    [TestMethod]
    public async Task DeleteTranscriptAsync_NotFound_ReturnsFalse()
    {
        // Act
        var result = await _service.DeleteTranscriptAsync("user-999", "session-999");

        // Assert
        Assert.IsFalse(result);
    }

    #endregion

    #region Helper Methods

    private static ChatTranscriptData CreateTestTranscript(string userId, string sessionId)
    {
        return new ChatTranscriptData
        {
            UserId = userId,
            SessionId = sessionId,
            CreatedAt = DateTime.UtcNow.ToString("O"),
            LastUpdated = DateTime.UtcNow.ToString("O"),
            IsActive = true,
            Messages = new List<ChatMessageData>
            {
                CreateMessage($"msg-{Guid.NewGuid():N}", "user", "Test message")
            }
        };
    }

    private static ChatMessageData CreateMessage(string id, string role, string content)
    {
        return new ChatMessageData
        {
            Id = id,
            Role = role,
            Content = content,
            Timestamp = DateTime.UtcNow.ToString("O")
        };
    }

    #endregion
}
