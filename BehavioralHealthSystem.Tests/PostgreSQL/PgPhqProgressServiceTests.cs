using BehavioralHealthSystem.Helpers.Data;
using BehavioralHealthSystem.Helpers.Models;
using BehavioralHealthSystem.Helpers.Services.PostgreSQL;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;

namespace BehavioralHealthSystem.Tests.PostgreSQL;

/// <summary>
/// Integration tests for PgPhqProgressService using EF Core InMemory provider
/// </summary>
[TestClass]
public class PgPhqProgressServiceTests
{
    private BhsDbContext _db = null!;
    private PgPhqProgressService _service = null!;
    private Mock<ILogger<PgPhqProgressService>> _mockLogger = null!;

    [TestInitialize]
    public void Setup()
    {
        var options = new DbContextOptionsBuilder<BhsDbContext>()
            .UseInMemoryDatabase(databaseName: $"BhsTest_PhqProgress_{Guid.NewGuid()}")
            .Options;

        _db = new BhsDbContext(options);
        _mockLogger = new Mock<ILogger<PgPhqProgressService>>();
        _service = new PgPhqProgressService(_db, _mockLogger.Object);
    }

    [TestCleanup]
    public void Cleanup()
    {
        _db.Dispose();
    }

    #region SaveProgressAsync Tests

    [TestMethod]
    public async Task SaveProgressAsync_NewProgress_CreatesSuccessfully()
    {
        // Arrange
        var progress = CreateTestProgress("user-1", "assess-1");

        // Act
        var result = await _service.SaveProgressAsync(progress);

        // Assert
        Assert.IsNotNull(result);
        Assert.AreEqual("user-1", result.UserId);
        Assert.AreEqual("assess-1", result.AssessmentId);
    }

    [TestMethod]
    public async Task SaveProgressAsync_ExistingProgress_MergesAnsweredQuestions()
    {
        // Arrange — save with 2 answered questions
        var progress1 = CreateTestProgress("user-1", "assess-1");
        progress1.AnsweredQuestions = new List<PhqAnsweredQuestion>
        {
            new() { QuestionNumber = 1, QuestionText = "Q1", Answer = 2, AnsweredAt = DateTime.UtcNow.ToString("O") },
            new() { QuestionNumber = 2, QuestionText = "Q2", Answer = 1, AnsweredAt = DateTime.UtcNow.ToString("O") }
        };
        await _service.SaveProgressAsync(progress1);

        // Act — save with 1 updated + 1 new question
        var progress2 = CreateTestProgress("user-1", "assess-1");
        progress2.AnsweredQuestions = new List<PhqAnsweredQuestion>
        {
            new() { QuestionNumber = 2, QuestionText = "Q2", Answer = 3, AnsweredAt = DateTime.UtcNow.ToString("O") }, // update
            new() { QuestionNumber = 3, QuestionText = "Q3", Answer = 0, AnsweredAt = DateTime.UtcNow.ToString("O") }  // new
        };
        var result = await _service.SaveProgressAsync(progress2);

        // Assert — 3 total questions, Q2 updated to answer=3
        Assert.AreEqual(3, result.AnsweredQuestions.Count);
        var q2 = result.AnsweredQuestions.First(q => q.QuestionNumber == 2);
        Assert.AreEqual(3, q2.Answer);
    }

    [TestMethod]
    public async Task SaveProgressAsync_Completed_SetsCompletionFields()
    {
        // Arrange
        var progress = CreateTestProgress("user-1", "assess-1");
        progress.IsCompleted = true;
        progress.TotalScore = 15;
        progress.Severity = "Moderate-Severe";
        progress.CompletedAt = DateTime.UtcNow.ToString("O");

        // Act
        var result = await _service.SaveProgressAsync(progress);

        // Assert
        Assert.IsTrue(result.IsCompleted);
        Assert.AreEqual(15, result.TotalScore);
        Assert.AreEqual("Moderate-Severe", result.Severity);
    }

    #endregion

    #region GetProgressAsync Tests

    [TestMethod]
    public async Task GetProgressAsync_Exists_ReturnsWithQuestions()
    {
        // Arrange
        var progress = CreateTestProgress("user-1", "assess-1");
        progress.AnsweredQuestions = new List<PhqAnsweredQuestion>
        {
            new() { QuestionNumber = 1, QuestionText = "Q1", Answer = 2, AnsweredAt = DateTime.UtcNow.ToString("O") }
        };
        await _service.SaveProgressAsync(progress);

        // Act
        var result = await _service.GetProgressAsync("user-1", "assess-1");

        // Assert
        Assert.IsNotNull(result);
        Assert.AreEqual(1, result.AnsweredQuestions.Count);
    }

    [TestMethod]
    public async Task GetProgressAsync_NotFound_ReturnsNull()
    {
        var result = await _service.GetProgressAsync("user-999", "assess-999");
        Assert.IsNull(result);
    }

    #endregion

    #region GetUserProgressAsync Tests

    [TestMethod]
    public async Task GetUserProgressAsync_MultipleRecords_ReturnsAll()
    {
        // Arrange
        await _service.SaveProgressAsync(CreateTestProgress("user-1", "assess-1"));
        await _service.SaveProgressAsync(CreateTestProgress("user-1", "assess-2"));
        await _service.SaveProgressAsync(CreateTestProgress("user-2", "assess-3"));

        // Act
        var results = await _service.GetUserProgressAsync("user-1");

        // Assert
        Assert.AreEqual(2, results.Count);
        Assert.IsTrue(results.All(p => p.UserId == "user-1"));
    }

    #endregion

    #region Helper Methods

    private static PhqProgressData CreateTestProgress(string userId, string assessmentId)
    {
        return new PhqProgressData
        {
            UserId = userId,
            AssessmentId = assessmentId,
            AssessmentType = "PHQ-9",
            StartedAt = DateTime.UtcNow.ToString("O"),
            LastUpdated = DateTime.UtcNow.ToString("O"),
            TotalQuestions = 9,
            AnsweredQuestions = new List<PhqAnsweredQuestion>()
        };
    }

    #endregion
}
