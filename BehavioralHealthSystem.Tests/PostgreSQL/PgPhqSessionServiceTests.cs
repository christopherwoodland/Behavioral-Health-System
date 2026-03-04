using BehavioralHealthSystem.Helpers.Data;
using BehavioralHealthSystem.Helpers.Models;
using BehavioralHealthSystem.Helpers.Services.PostgreSQL;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;

namespace BehavioralHealthSystem.Tests.PostgreSQL;

/// <summary>
/// Integration tests for PgPhqSessionService using EF Core InMemory provider
/// </summary>
[TestClass]
public class PgPhqSessionServiceTests
{
    private BhsDbContext _db = null!;
    private PgPhqSessionService _service = null!;
    private Mock<ILogger<PgPhqSessionService>> _mockLogger = null!;

    [TestInitialize]
    public void Setup()
    {
        var options = new DbContextOptionsBuilder<BhsDbContext>()
            .UseInMemoryDatabase(databaseName: $"BhsTest_PhqSession_{Guid.NewGuid()}")
            .Options;

        _db = new BhsDbContext(options);
        _mockLogger = new Mock<ILogger<PgPhqSessionService>>();
        _service = new PgPhqSessionService(_db, _mockLogger.Object);
    }

    [TestCleanup]
    public void Cleanup()
    {
        _db.Dispose();
    }

    #region SaveSessionAsync Tests

    [TestMethod]
    public async Task SaveSessionAsync_NewSession_ReturnsTrue()
    {
        // Arrange
        var session = CreateTestSession("user-1", "assess-1");

        // Act
        var result = await _service.SaveSessionAsync(session);

        // Assert
        Assert.IsTrue(result);
    }

    [TestMethod]
    public async Task SaveSessionAsync_NewSession_PersistsQuestions()
    {
        // Arrange
        var session = CreateTestSession("user-1", "assess-1");
        session.Questions = new List<PhqQuestionResponse>
        {
            new() { QuestionNumber = 1, QuestionText = "Q1", Answer = 2, Attempts = 1 },
            new() { QuestionNumber = 2, QuestionText = "Q2", Answer = 1, Attempts = 1 }
        };

        // Act
        await _service.SaveSessionAsync(session);

        // Assert
        var retrieved = await _service.GetSessionAsync("user-1", "assess-1");
        Assert.IsNotNull(retrieved);
        Assert.AreEqual(2, retrieved.Questions.Count);
    }

    [TestMethod]
    public async Task SaveSessionAsync_ExistingSession_ReplacesQuestions()
    {
        // Arrange — initial save with Q1 only
        var session1 = CreateTestSession("user-1", "assess-1");
        session1.Questions = new List<PhqQuestionResponse>
        {
            new() { QuestionNumber = 1, QuestionText = "Q1", Answer = 1, Attempts = 1 }
        };
        await _service.SaveSessionAsync(session1);

        // Act — update with Q1+Q2 (progressive save replaces all)
        var session2 = CreateTestSession("user-1", "assess-1");
        session2.Questions = new List<PhqQuestionResponse>
        {
            new() { QuestionNumber = 1, QuestionText = "Q1", Answer = 2, Attempts = 2 },
            new() { QuestionNumber = 2, QuestionText = "Q2", Answer = 3, Attempts = 1 }
        };
        await _service.SaveSessionAsync(session2);

        // Assert — should have 2 questions with updated answers
        var retrieved = await _service.GetSessionAsync("user-1", "assess-1");
        Assert.IsNotNull(retrieved);
        Assert.AreEqual(2, retrieved.Questions.Count);
        var q1 = retrieved.Questions.First(q => q.QuestionNumber == 1);
        Assert.AreEqual(2, q1.Answer);
        Assert.AreEqual(2, q1.Attempts);
    }

    [TestMethod]
    public async Task SaveSessionAsync_CompletedSession_PersistsScore()
    {
        // Arrange
        var session = CreateTestSession("user-1", "assess-1");
        session.IsCompleted = true;
        session.TotalScore = 18;
        session.Severity = "Moderate-Severe";
        session.CompletedAt = DateTime.UtcNow.ToString("O");

        // Act
        await _service.SaveSessionAsync(session);

        // Assert
        var retrieved = await _service.GetSessionAsync("user-1", "assess-1");
        Assert.IsNotNull(retrieved);
        Assert.IsTrue(retrieved.IsCompleted);
        Assert.AreEqual(18, retrieved.TotalScore);
        Assert.AreEqual("Moderate-Severe", retrieved.Severity);
    }

    [TestMethod]
    public async Task SaveSessionAsync_WithMetadata_PersistsMetadata()
    {
        // Arrange
        var session = CreateTestSession("user-1", "assess-1");
        session.Metadata = new PhqSessionMetadata
        {
            ConversationSessionId = "conv-123",
            UserAgent = "TestAgent/1.0",
            ClientTimezone = "America/New_York",
            Version = "2.0"
        };

        // Act
        await _service.SaveSessionAsync(session);

        // Assert
        var retrieved = await _service.GetSessionAsync("user-1", "assess-1");
        Assert.IsNotNull(retrieved?.Metadata);
        Assert.AreEqual("conv-123", retrieved.Metadata.ConversationSessionId);
    }

    #endregion

    #region GetSessionAsync Tests

    [TestMethod]
    public async Task GetSessionAsync_NotFound_ReturnsNull()
    {
        var result = await _service.GetSessionAsync("user-999", "assess-999");
        Assert.IsNull(result);
    }

    #endregion

    #region GetUserSessionsAsync Tests

    [TestMethod]
    public async Task GetUserSessionsAsync_MultiipleSessions_ReturnsAll()
    {
        // Arrange
        await _service.SaveSessionAsync(CreateTestSession("user-1", "assess-1"));
        await _service.SaveSessionAsync(CreateTestSession("user-1", "assess-2"));
        await _service.SaveSessionAsync(CreateTestSession("user-2", "assess-3"));

        // Act
        var results = await _service.GetUserSessionsAsync("user-1");

        // Assert
        Assert.AreEqual(2, results.Count);
    }

    [TestMethod]
    public async Task GetUserSessionsAsync_NoSessions_ReturnsEmpty()
    {
        var results = await _service.GetUserSessionsAsync("user-999");
        Assert.AreEqual(0, results.Count);
    }

    #endregion

    #region Helper Methods

    private static PhqSessionData CreateTestSession(string userId, string assessmentId)
    {
        return new PhqSessionData
        {
            UserId = userId,
            SessionId = $"session-{Guid.NewGuid():N}",
            AssessmentId = assessmentId,
            AssessmentType = "PHQ-9",
            CreatedAt = DateTime.UtcNow.ToString("O"),
            LastUpdated = DateTime.UtcNow.ToString("O"),
            Questions = new List<PhqQuestionResponse>()
        };
    }

    #endregion
}
