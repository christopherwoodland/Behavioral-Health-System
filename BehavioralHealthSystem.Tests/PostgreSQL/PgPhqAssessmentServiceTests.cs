using BehavioralHealthSystem.Helpers.Data;
using BehavioralHealthSystem.Helpers.Models;
using BehavioralHealthSystem.Helpers.Services.PostgreSQL;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;

namespace BehavioralHealthSystem.Tests.PostgreSQL;

/// <summary>
/// Integration tests for PgPhqAssessmentService using EF Core InMemory provider
/// </summary>
[TestClass]
public class PgPhqAssessmentServiceTests
{
    private BhsDbContext _db = null!;
    private PgPhqAssessmentService _service = null!;
    private Mock<ILogger<PgPhqAssessmentService>> _mockLogger = null!;

    [TestInitialize]
    public void Setup()
    {
        var options = new DbContextOptionsBuilder<BhsDbContext>()
            .UseInMemoryDatabase(databaseName: $"BhsTest_PhqAssessment_{Guid.NewGuid()}")
            .Options;

        _db = new BhsDbContext(options);
        _mockLogger = new Mock<ILogger<PgPhqAssessmentService>>();
        _service = new PgPhqAssessmentService(_db, _mockLogger.Object);
    }

    [TestCleanup]
    public void Cleanup()
    {
        _db.Dispose();
    }

    #region SaveAssessmentAsync Tests

    [TestMethod]
    public async Task SaveAssessmentAsync_NewAssessment_ReturnsTrue()
    {
        // Arrange
        var assessment = CreateTestAssessment("user-1", "assess-1", "PHQ-9");

        // Act
        var result = await _service.SaveAssessmentAsync(assessment);

        // Assert
        Assert.IsTrue(result);
    }

    [TestMethod]
    public async Task SaveAssessmentAsync_NewAssessment_PersistsQuestions()
    {
        // Arrange
        var assessment = CreateTestAssessment("user-1", "assess-1", "PHQ-9");
        assessment.Questions = CreatePhq9Questions();

        // Act
        await _service.SaveAssessmentAsync(assessment);

        // Assert
        var retrieved = await _service.GetAssessmentAsync("user-1", "assess-1");
        Assert.IsNotNull(retrieved);
        Assert.AreEqual(9, retrieved.Questions.Count);
    }

    [TestMethod]
    public async Task SaveAssessmentAsync_ExistingAssessment_UpdatesFields()
    {
        // Arrange
        var assessment = CreateTestAssessment("user-1", "assess-1", "PHQ-9");
        assessment.IsCompleted = false;
        await _service.SaveAssessmentAsync(assessment);

        // Act — update with completion
        var updated = CreateTestAssessment("user-1", "assess-1", "PHQ-9");
        updated.IsCompleted = true;
        updated.TotalScore = 12;
        updated.Severity = "Moderate";
        updated.CompletedTime = DateTime.UtcNow.ToString("O");
        await _service.SaveAssessmentAsync(updated);

        // Assert
        var retrieved = await _service.GetAssessmentAsync("user-1", "assess-1");
        Assert.IsNotNull(retrieved);
        Assert.IsTrue(retrieved.IsCompleted);
        Assert.AreEqual(12, retrieved.TotalScore);
        Assert.AreEqual("Moderate", retrieved.Severity);
    }

    [TestMethod]
    public async Task SaveAssessmentAsync_WithMetadata_PersistsMetadata()
    {
        // Arrange
        var assessment = CreateTestAssessment("user-1", "assess-1", "PHQ-9");
        assessment.Metadata = new PhqMetadata
        {
            UserAgent = "TestAgent/1.0",
            SessionId = "session-1",
            Version = "2.0"
        };

        // Act
        await _service.SaveAssessmentAsync(assessment);

        // Assert
        var retrieved = await _service.GetAssessmentAsync("user-1", "assess-1");
        Assert.IsNotNull(retrieved?.Metadata);
        Assert.AreEqual("TestAgent/1.0", retrieved.Metadata.UserAgent);
        Assert.AreEqual("2.0", retrieved.Metadata.Version);
    }

    [TestMethod]
    public async Task SaveAssessmentAsync_PHQ2Assessment_Persists()
    {
        // Arrange
        var assessment = CreateTestAssessment("user-1", "assess-1", "PHQ-2");
        assessment.Questions = new List<PhqQuestionData>
        {
            new() { QuestionNumber = 1, QuestionText = "Little interest or pleasure?", Answer = 2 },
            new() { QuestionNumber = 2, QuestionText = "Feeling down, depressed?", Answer = 1 }
        };
        assessment.TotalScore = 3;

        // Act
        await _service.SaveAssessmentAsync(assessment);

        // Assert
        var retrieved = await _service.GetAssessmentAsync("user-1", "assess-1");
        Assert.IsNotNull(retrieved);
        Assert.AreEqual("PHQ-2", retrieved.AssessmentType);
        Assert.AreEqual(2, retrieved.Questions.Count);
        Assert.AreEqual(3, retrieved.TotalScore);
    }

    #endregion

    #region GetAssessmentAsync Tests

    [TestMethod]
    public async Task GetAssessmentAsync_Exists_ReturnsWithQuestions()
    {
        // Arrange
        var assessment = CreateTestAssessment("user-1", "assess-1", "PHQ-9");
        assessment.Questions = CreatePhq9Questions();
        await _service.SaveAssessmentAsync(assessment);

        // Act
        var result = await _service.GetAssessmentAsync("user-1", "assess-1");

        // Assert
        Assert.IsNotNull(result);
        Assert.AreEqual("assess-1", result.AssessmentId);
        Assert.AreEqual(9, result.Questions.Count);
    }

    [TestMethod]
    public async Task GetAssessmentAsync_NotFound_ReturnsNull()
    {
        var result = await _service.GetAssessmentAsync("user-999", "assess-999");
        Assert.IsNull(result);
    }

    #endregion

    #region GetUserAssessmentsAsync Tests

    [TestMethod]
    public async Task GetUserAssessmentsAsync_MultipleAssessments_ReturnsAll()
    {
        // Arrange
        await _service.SaveAssessmentAsync(CreateTestAssessment("user-1", "assess-1", "PHQ-9"));
        await _service.SaveAssessmentAsync(CreateTestAssessment("user-1", "assess-2", "PHQ-2"));
        await _service.SaveAssessmentAsync(CreateTestAssessment("user-2", "assess-3", "PHQ-9"));

        // Act
        var results = await _service.GetUserAssessmentsAsync("user-1");

        // Assert
        Assert.AreEqual(2, results.Count);
        Assert.IsTrue(results.All(a => a.UserId == "user-1"));
    }

    [TestMethod]
    public async Task GetUserAssessmentsAsync_NoAssessments_ReturnsEmpty()
    {
        var results = await _service.GetUserAssessmentsAsync("user-999");
        Assert.AreEqual(0, results.Count);
    }

    #endregion

    #region Score Validation Tests

    [TestMethod]
    public async Task SaveAssessmentAsync_PHQ9ScoreRange_ValidScoresAccepted()
    {
        // PHQ-9 scores range from 0 to 27 (9 questions × max 3 per question)
        var assessment = CreateTestAssessment("user-1", "assess-1", "PHQ-9");
        assessment.Questions = CreatePhq9Questions();
        assessment.TotalScore = 27;
        assessment.Severity = "Severe";
        assessment.IsCompleted = true;

        await _service.SaveAssessmentAsync(assessment);
        var retrieved = await _service.GetAssessmentAsync("user-1", "assess-1");

        Assert.AreEqual(27, retrieved?.TotalScore);
        Assert.AreEqual("Severe", retrieved?.Severity);
    }

    #endregion

    #region Helper Methods

    private static PhqAssessmentData CreateTestAssessment(string userId, string assessmentId, string type)
    {
        return new PhqAssessmentData
        {
            UserId = userId,
            AssessmentId = assessmentId,
            AssessmentType = type,
            StartTime = DateTime.UtcNow.ToString("O"),
            IsCompleted = false,
            Questions = new List<PhqQuestionData>()
        };
    }

    private static List<PhqQuestionData> CreatePhq9Questions()
    {
        return Enumerable.Range(1, 9).Select(i => new PhqQuestionData
        {
            QuestionNumber = i,
            QuestionText = $"PHQ-9 Question {i}",
            Answer = i % 4, // 0-3 answers
            Timestamp = DateTime.UtcNow.ToString("O")
        }).ToList();
    }

    #endregion
}
