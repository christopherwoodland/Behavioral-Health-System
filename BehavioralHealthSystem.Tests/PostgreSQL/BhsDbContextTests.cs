using BehavioralHealthSystem.Helpers.Data;
using BehavioralHealthSystem.Helpers.Models;
using BehavioralHealthSystem.Helpers.Services.PostgreSQL;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;

namespace BehavioralHealthSystem.Tests.PostgreSQL;

/// <summary>
/// Integration tests for BhsDbContext — verifies schema configuration,
/// entity relationships, and JSONB column roundtrips
/// </summary>
[TestClass]
public class BhsDbContextTests
{
    private BhsDbContext _db = null!;

    [TestInitialize]
    public void Setup()
    {
        var options = new DbContextOptionsBuilder<BhsDbContext>()
            .UseInMemoryDatabase(databaseName: $"BhsTest_DbContext_{Guid.NewGuid()}")
            .Options;

        _db = new BhsDbContext(options);
    }

    [TestCleanup]
    public void Cleanup()
    {
        _db.Dispose();
    }

    #region DbContext Initialization Tests

    [TestMethod]
    public void DbContext_AllDbSets_AreNotNull()
    {
        Assert.IsNotNull(_db.ChatTranscripts);
        Assert.IsNotNull(_db.ChatMessages);
        Assert.IsNotNull(_db.ChatSessionMetadata);
        Assert.IsNotNull(_db.PhqAssessments);
        Assert.IsNotNull(_db.PhqQuestions);
        Assert.IsNotNull(_db.PhqMetadata);
        Assert.IsNotNull(_db.PhqProgress);
        Assert.IsNotNull(_db.PhqAnsweredQuestions);
        Assert.IsNotNull(_db.PhqProgressMetadata);
        Assert.IsNotNull(_db.PhqSessions);
        Assert.IsNotNull(_db.PhqQuestionResponses);
        Assert.IsNotNull(_db.PhqSessionMetadata);
        Assert.IsNotNull(_db.SmartBandSnapshots);
        Assert.IsNotNull(_db.AudioMetadata);
        Assert.IsNotNull(_db.Sessions);
        Assert.IsNotNull(_db.FileGroups);
        Assert.IsNotNull(_db.UserBiometricData);
        Assert.IsNotNull(_db.ExtendedAssessmentJobs);
    }

    #endregion

    #region Chat Transcript Relationships Tests

    [TestMethod]
    public async Task ChatTranscript_CascadeDeleteMessages_RemovesAllChildren()
    {
        // Arrange
        var transcript = new ChatTranscriptData
        {
            UserId = "user-1",
            SessionId = "session-cascade-test",
            CreatedAt = DateTime.UtcNow.ToString("O"),
            LastUpdated = DateTime.UtcNow.ToString("O"),
            Messages = new List<ChatMessageData>
            {
                new() { Id = "msg-1", Role = "user", Content = "Hello", Timestamp = DateTime.UtcNow.ToString("O") },
                new() { Id = "msg-2", Role = "assistant", Content = "Hi!", Timestamp = DateTime.UtcNow.ToString("O") }
            },
            Metadata = new ChatSessionMetadata { UserAgent = "Test", Platform = "Windows" }
        };
        _db.ChatTranscripts.Add(transcript);
        await _db.SaveChangesAsync();

        var transcriptId = transcript.Id;

        // Act — delete the parent
        _db.ChatTranscripts.Remove(transcript);
        await _db.SaveChangesAsync();

        // Assert — children should be cascade-deleted
        var messages = await _db.ChatMessages.Where(m => m.ChatTranscriptDataId == transcriptId).ToListAsync();
        var metadata = await _db.ChatSessionMetadata.Where(m => m.ChatTranscriptDataId == transcriptId).ToListAsync();
        Assert.AreEqual(0, messages.Count);
        Assert.AreEqual(0, metadata.Count);
    }

    #endregion

    #region PHQ Assessment Relationships Tests

    [TestMethod]
    public async Task PhqAssessment_WithQuestions_PersistsRelationship()
    {
        // Arrange
        var assessment = new PhqAssessmentData
        {
            UserId = "user-1",
            AssessmentId = "assess-rel-test",
            AssessmentType = "PHQ-9",
            StartTime = DateTime.UtcNow.ToString("O"),
            Questions = new List<PhqQuestionData>
            {
                new() { QuestionNumber = 1, QuestionText = "Q1", Answer = 2 },
                new() { QuestionNumber = 2, QuestionText = "Q2", Answer = 1 }
            }
        };
        _db.PhqAssessments.Add(assessment);
        await _db.SaveChangesAsync();

        // Act
        var retrieved = await _db.PhqAssessments
            .Include(a => a.Questions)
            .FirstAsync(a => a.AssessmentId == "assess-rel-test");

        // Assert
        Assert.AreEqual(2, retrieved.Questions.Count);
        Assert.IsTrue(retrieved.Questions.All(q => q.PhqAssessmentDataId == retrieved.Id));
    }

    #endregion

    #region JSONB Column Roundtrip Tests

    [TestMethod]
    public async Task SmartBandSnapshot_JsonbDeviceInfo_Roundtrips()
    {
        // Arrange
        var snapshot = new SmartBandDataSnapshot
        {
            UserId = "user-1",
            SnapshotId = "snap-json-test",
            CollectedAt = DateTime.UtcNow.ToString("O"),
            SavedAt = DateTime.UtcNow
        };
        snapshot.DeviceInfo = new SmartBandDeviceInfo
        {
            FirmwareVersion = "3.1.0",
            HardwareVersion = "2.0.1",
            SerialNumber = "SB-JSONB-TEST"
        };
        _db.SmartBandSnapshots.Add(snapshot);
        await _db.SaveChangesAsync();

        // Act — re-read from DB
        var retrieved = await _db.SmartBandSnapshots.FindAsync(snapshot.Id);

        // Assert — JSONB column roundtrips through NotMapped property
        Assert.IsNotNull(retrieved?.DeviceInfoJson);
        var deviceInfo = retrieved.DeviceInfo;
        Assert.IsNotNull(deviceInfo);
        Assert.AreEqual("3.1.0", deviceInfo.FirmwareVersion);
        Assert.AreEqual("SB-JSONB-TEST", deviceInfo.SerialNumber);
    }

    [TestMethod]
    public async Task SmartBandSnapshot_JsonbSensorData_RoundtripsNestedObjects()
    {
        // Arrange
        var snapshot = new SmartBandDataSnapshot
        {
            UserId = "user-1",
            SnapshotId = "snap-sensor-test",
            CollectedAt = DateTime.UtcNow.ToString("O"),
            SavedAt = DateTime.UtcNow
        };
        snapshot.SensorData = new SmartBandSensorData
        {
            HeartRate = new SmartBandHeartRateData { Bpm = 72, Quality = "high" },
            Accelerometer = new SmartBandAccelerometerData { X = 0.1, Y = 9.8, Z = -0.2 }
        };
        _db.SmartBandSnapshots.Add(snapshot);
        await _db.SaveChangesAsync();

        // Act
        var retrieved = await _db.SmartBandSnapshots.FindAsync(snapshot.Id);

        // Assert
        Assert.IsNotNull(retrieved?.SensorData);
        Assert.AreEqual(72, retrieved.SensorData.HeartRate?.Bpm);
        Assert.AreEqual("high", retrieved.SensorData.HeartRate?.Quality);
        Assert.AreEqual(0.1, retrieved.SensorData.Accelerometer?.X ?? 0.0, 0.001);
    }

    [TestMethod]
    public async Task ChatMessage_JsonbAdditionalData_Roundtrips()
    {
        // Arrange
        var transcript = new ChatTranscriptData
        {
            UserId = "user-1",
            SessionId = "session-jsonb-msg",
            CreatedAt = DateTime.UtcNow.ToString("O"),
            LastUpdated = DateTime.UtcNow.ToString("O"),
            Messages = new List<ChatMessageData>
            {
                new()
                {
                    Id = "msg-jsonb",
                    Role = "assistant",
                    Content = "Test",
                    Timestamp = DateTime.UtcNow.ToString("O")
                }
            }
        };
        // Set AdditionalData via the NotMapped property
        transcript.Messages[0].AdditionalData = new Dictionary<string, object>
        {
            { "assessmentType", "PHQ-9" },
            { "score", 12 }
        };
        _db.ChatTranscripts.Add(transcript);
        await _db.SaveChangesAsync();

        // Act
        var retrieved = await _db.ChatMessages
            .FirstAsync(m => m.Id == "msg-jsonb");

        // Assert
        Assert.IsNotNull(retrieved.AdditionalDataJson);
        Assert.IsTrue(retrieved.AdditionalDataJson.Contains("PHQ-9"));
    }

    #endregion

    #region AudioMetadata Tests

    [TestMethod]
    public async Task AudioMetadata_PersistsAllFields()
    {
        // Arrange
        var metadata = new AudioMetadata
        {
            UserId = "user-1",
            SessionId = "session-1",
            OriginalFileName = "test.wav",
            BlobPath = "audio-uploads/users/user-1/test.wav",
            BlobUrl = "https://storage.blob.core.windows.net/audio-uploads/users/user-1/test.wav",
            ContentType = "audio/wav",
            FileSizeBytes = 2048000,
            Source = "file-upload",
            UploadedAt = DateTime.UtcNow
        };
        _db.AudioMetadata.Add(metadata);
        await _db.SaveChangesAsync();

        // Act
        var retrieved = await _db.AudioMetadata.FindAsync(metadata.Id);

        // Assert
        Assert.IsNotNull(retrieved);
        Assert.AreEqual("test.wav", retrieved.OriginalFileName);
        Assert.AreEqual("audio/wav", retrieved.ContentType);
        Assert.AreEqual(2048000, retrieved.FileSizeBytes);
    }

    #endregion
}
