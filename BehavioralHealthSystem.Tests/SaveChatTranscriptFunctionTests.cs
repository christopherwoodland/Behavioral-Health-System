using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using BehavioralHealthSystem.Functions.Functions;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Moq;
using System.Net;
using System.Text;

namespace BehavioralHealthSystem.Tests;

/// <summary>
/// Unit tests for SaveChatTranscriptFunction to ensure proper saving and
/// merging of chat transcripts to blob storage
/// </summary>
[TestClass]
public class SaveChatTranscriptFunctionTests
{
    private Mock<ILogger<SaveChatTranscriptFunction>> _mockLogger = null!;
    private Mock<BlobServiceClient> _mockBlobServiceClient = null!;
    private Mock<BlobContainerClient> _mockContainerClient = null!;
    private Mock<BlobClient> _mockBlobClient = null!;
    private SaveChatTranscriptFunction _function = null!;

    [TestInitialize]
    public void Setup()
    {
        _mockLogger = new Mock<ILogger<SaveChatTranscriptFunction>>();
        _mockBlobServiceClient = new Mock<BlobServiceClient>();
        _mockContainerClient = new Mock<BlobContainerClient>();
        _mockBlobClient = new Mock<BlobClient>();

        _mockBlobServiceClient
            .Setup(x => x.GetBlobContainerClient(It.IsAny<string>()))
            .Returns(_mockContainerClient.Object);

        _mockContainerClient
            .Setup(x => x.GetBlobClient(It.IsAny<string>()))
            .Returns(_mockBlobClient.Object);

        _function = new SaveChatTranscriptFunction(
            _mockLogger.Object,
            _mockBlobServiceClient.Object);
    }

    #region Constructor Tests

    [TestMethod]
    [ExpectedException(typeof(ArgumentNullException))]
    public void Constructor_WithNullLogger_ThrowsArgumentNullException()
    {
        // Act
        _ = new SaveChatTranscriptFunction(null!, _mockBlobServiceClient.Object);
    }

    [TestMethod]
    [ExpectedException(typeof(ArgumentNullException))]
    public void Constructor_WithNullBlobServiceClient_ThrowsArgumentNullException()
    {
        // Act
        _ = new SaveChatTranscriptFunction(_mockLogger.Object, null!);
    }

    #endregion

    #region Validation Tests

    [TestMethod]
    public async Task Run_WithMissingUserId_ReturnsBadRequest()
    {
        // Arrange
        var requestData = new SaveChatTranscriptRequest
        {
            TranscriptData = new ChatTranscriptData
            {
                UserId = "", // Missing
                SessionId = "session-123",
                Messages = new List<ChatMessageData>()
            }
        };

        var request = CreateMockHttpRequest(requestData);

        // Act
        var response = await _function.Run(request.Object);

        // Assert
        Assert.AreEqual(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [TestMethod]
    public async Task Run_WithMissingSessionId_ReturnsBadRequest()
    {
        // Arrange
        var requestData = new SaveChatTranscriptRequest
        {
            TranscriptData = new ChatTranscriptData
            {
                UserId = "user-123",
                SessionId = "", // Missing
                Messages = new List<ChatMessageData>()
            }
        };

        var request = CreateMockHttpRequest(requestData);

        // Act
        var response = await _function.Run(request.Object);

        // Assert
        Assert.AreEqual(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [TestMethod]
    public async Task Run_WithInvalidMessageRole_ReturnsBadRequest()
    {
        // Arrange
        var requestData = new SaveChatTranscriptRequest
        {
            TranscriptData = new ChatTranscriptData
            {
                UserId = "user-123",
                SessionId = "session-123",
                Messages = new List<ChatMessageData>
                {
                    new ChatMessageData
                    {
                        Id = "msg-1",
                        Role = "invalid_role", // Invalid
                        Content = "Test message",
                        Timestamp = DateTime.UtcNow.ToString("O")
                    }
                }
            }
        };

        var request = CreateMockHttpRequest(requestData);

        // Act
        var response = await _function.Run(request.Object);

        // Assert
        Assert.AreEqual(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [TestMethod]
    public async Task Run_WithMissingMessageContent_ReturnsBadRequest()
    {
        // Arrange
        var requestData = new SaveChatTranscriptRequest
        {
            TranscriptData = new ChatTranscriptData
            {
                UserId = "user-123",
                SessionId = "session-123",
                Messages = new List<ChatMessageData>
                {
                    new ChatMessageData
                    {
                        Id = "msg-1",
                        Role = "user",
                        Content = "", // Missing
                        Timestamp = DateTime.UtcNow.ToString("O")
                    }
                }
            }
        };

        var request = CreateMockHttpRequest(requestData);

        // Act
        var response = await _function.Run(request.Object);

        // Assert
        Assert.AreEqual(HttpStatusCode.BadRequest, response.StatusCode);
    }

    #endregion

    #region Success Tests

    [TestMethod]
    public async Task Run_WithValidNewTranscript_SavesSuccessfully()
    {
        // Arrange
        var requestData = new SaveChatTranscriptRequest
        {
            TranscriptData = new ChatTranscriptData
            {
                UserId = "user-123",
                SessionId = "session-456",
                Messages = new List<ChatMessageData>
                {
                    new ChatMessageData
                    {
                        Id = "msg-1",
                        Role = "user",
                        Content = "Hello",
                        Timestamp = DateTime.UtcNow.ToString("O")
                    }
                }
            }
        };

        var request = CreateMockHttpRequest(requestData);

        // Setup blob not existing (new transcript)
        _mockBlobClient.Setup(x => x.ExistsAsync(default)).ReturnsAsync(Azure.Response.FromValue(false, null!));
        _mockBlobClient.Setup(x => x.UploadAsync(
            It.IsAny<BinaryData>(),
            It.IsAny<BlobUploadOptions>(),
            default)).ReturnsAsync(Mock.Of<Azure.Response<BlobContentInfo>>());

        // Act
        var response = await _function.Run(request.Object);

        // Assert
        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);
        _mockBlobClient.Verify(x => x.UploadAsync(
            It.IsAny<BinaryData>(),
            It.IsAny<BlobUploadOptions>(),
            default), Times.Once);
    }

    [TestMethod]
    public async Task Run_WithValidMessages_UsesCorrectBlobPath()
    {
        // Arrange
        var userId = "user-123";
        var sessionId = "session-456";
        var requestData = new SaveChatTranscriptRequest
        {
            TranscriptData = new ChatTranscriptData
            {
                UserId = userId,
                SessionId = sessionId,
                Messages = new List<ChatMessageData>
                {
                    new ChatMessageData
                    {
                        Id = "msg-1",
                        Role = "user",
                        Content = "Hello",
                        Timestamp = DateTime.UtcNow.ToString("O")
                    }
                }
            }
        };

        var request = CreateMockHttpRequest(requestData);
        string? capturedBlobName = null;

        _mockContainerClient
            .Setup(x => x.GetBlobClient(It.IsAny<string>()))
            .Callback<string>(blobName => capturedBlobName = blobName)
            .Returns(_mockBlobClient.Object);

        _mockBlobClient.Setup(x => x.ExistsAsync(default)).ReturnsAsync(Azure.Response.FromValue(false, null!));
        _mockBlobClient.Setup(x => x.UploadAsync(
            It.IsAny<BinaryData>(),
            It.IsAny<BlobUploadOptions>(),
            default)).ReturnsAsync(Mock.Of<Azure.Response<BlobContentInfo>>());

        // Act
        await _function.Run(request.Object);

        // Assert
        Assert.IsNotNull(capturedBlobName);
        Assert.IsTrue(capturedBlobName.Contains(userId));
        Assert.IsTrue(capturedBlobName.Contains(sessionId));
        Assert.IsTrue(capturedBlobName.StartsWith("users/"));
        Assert.IsTrue(capturedBlobName.Contains("/conversations/"));
        Assert.IsTrue(capturedBlobName.EndsWith(".json"));
    }

    [TestMethod]
    public async Task Run_WithCustomContainerName_UsesCustomContainer()
    {
        // Arrange
        var customContainerName = "my-custom-transcripts";
        var requestData = new SaveChatTranscriptRequest
        {
            ContainerName = customContainerName,
            TranscriptData = new ChatTranscriptData
            {
                UserId = "user-123",
                SessionId = "session-456",
                Messages = new List<ChatMessageData>
                {
                    new ChatMessageData
                    {
                        Id = "msg-1",
                        Role = "user",
                        Content = "Hello",
                        Timestamp = DateTime.UtcNow.ToString("O")
                    }
                }
            }
        };

        var request = CreateMockHttpRequest(requestData);
        string? capturedContainerName = null;

        _mockBlobServiceClient
            .Setup(x => x.GetBlobContainerClient(It.IsAny<string>()))
            .Callback<string>(name => capturedContainerName = name)
            .Returns(_mockContainerClient.Object);

        _mockBlobClient.Setup(x => x.ExistsAsync(default)).ReturnsAsync(Azure.Response.FromValue(false, null!));
        _mockBlobClient.Setup(x => x.UploadAsync(
            It.IsAny<BinaryData>(),
            It.IsAny<BlobUploadOptions>(),
            default)).ReturnsAsync(Mock.Of<Azure.Response<BlobContentInfo>>());

        // Act
        await _function.Run(request.Object);

        // Assert
        Assert.AreEqual(customContainerName, capturedContainerName);
    }

    #endregion

    #region Merge Tests

    [TestMethod]
    public async Task Run_WithExistingTranscript_MergesMessages()
    {
        // Arrange
        var existingTranscript = new ChatTranscriptData
        {
            UserId = "user-123",
            SessionId = "session-456",
            CreatedAt = DateTime.UtcNow.AddHours(-1).ToString("O"),
            Messages = new List<ChatMessageData>
            {
                new ChatMessageData
                {
                    Id = "msg-1",
                    Role = "user",
                    Content = "First message",
                    Timestamp = DateTime.UtcNow.AddHours(-1).ToString("O")
                }
            }
        };

        var newTranscript = new ChatTranscriptData
        {
            UserId = "user-123",
            SessionId = "session-456",
            Messages = new List<ChatMessageData>
            {
                new ChatMessageData
                {
                    Id = "msg-2",
                    Role = "assistant",
                    Content = "Second message",
                    Timestamp = DateTime.UtcNow.ToString("O")
                }
            }
        };

        var requestData = new SaveChatTranscriptRequest
        {
            TranscriptData = newTranscript
        };

        var request = CreateMockHttpRequest(requestData);

        // Setup blob existing with old transcript
        var existingJson = JsonSerializer.Serialize(existingTranscript);
        var existingContent = BinaryData.FromString(existingJson);

        _mockBlobClient.Setup(x => x.ExistsAsync(default)).ReturnsAsync(Azure.Response.FromValue(true, null!));
        _mockBlobClient.Setup(x => x.DownloadContentAsync(default))
            .ReturnsAsync(Azure.Response.FromValue(
                BlobsModelFactory.BlobDownloadResult(content: existingContent),
                null!));
        _mockBlobClient.Setup(x => x.DeleteAsync(It.IsAny<DeleteSnapshotsOption>(), It.IsAny<BlobRequestConditions>(), default))
            .ReturnsAsync(Mock.Of<Azure.Response>());
        _mockBlobClient.Setup(x => x.UploadAsync(
            It.IsAny<BinaryData>(),
            It.IsAny<BlobUploadOptions>(),
            default)).ReturnsAsync(Mock.Of<Azure.Response<BlobContentInfo>>());

        BinaryData? capturedData = null;
        _mockBlobClient.Setup(x => x.UploadAsync(
            It.IsAny<BinaryData>(),
            It.IsAny<BlobUploadOptions>(),
            default))
            .Callback<BinaryData, BlobUploadOptions, CancellationToken>((data, opts, ct) => capturedData = data)
            .ReturnsAsync(Mock.Of<Azure.Response<BlobContentInfo>>());

        // Act
        await _function.Run(request.Object);

        // Assert
        Assert.IsNotNull(capturedData);
        var savedTranscript = JsonSerializer.Deserialize<ChatTranscriptData>(capturedData.ToString());
        Assert.IsNotNull(savedTranscript);
        Assert.AreEqual(2, savedTranscript.Messages.Count);
        Assert.IsTrue(savedTranscript.Messages.Any(m => m.Id == "msg-1"));
        Assert.IsTrue(savedTranscript.Messages.Any(m => m.Id == "msg-2"));
    }

    #endregion

    #region Error Handling Tests

    [TestMethod]
    public async Task Run_WithInvalidJson_ReturnsBadRequest()
    {
        // Arrange
        var request = new Mock<HttpRequestData>(MockBehavior.Loose, Mock.Of<FunctionContext>());
        var requestStream = new MemoryStream(Encoding.UTF8.GetBytes("invalid json"));
        request.Setup(r => r.Body).Returns(requestStream);

        var responseStream = new MemoryStream();
        var response = new Mock<HttpResponseData>(MockBehavior.Loose, Mock.Of<FunctionContext>());
        response.SetupProperty(r => r.StatusCode, HttpStatusCode.BadRequest);
        response.Setup(r => r.Body).Returns(responseStream);
        response.Setup(r => r.Headers).Returns(new HttpHeadersCollection());

        request.Setup(r => r.CreateResponse()).Returns(response.Object);

        // Act
        var result = await _function.Run(request.Object);

        // Assert
        Assert.AreEqual(HttpStatusCode.BadRequest, result.StatusCode);
    }

    [TestMethod]
    public async Task Run_WithBlobStorageException_ReturnsInternalServerError()
    {
        // Arrange
        var requestData = new SaveChatTranscriptRequest
        {
            TranscriptData = new ChatTranscriptData
            {
                UserId = "user-123",
                SessionId = "session-456",
                Messages = new List<ChatMessageData>
                {
                    new ChatMessageData
                    {
                        Id = "msg-1",
                        Role = "user",
                        Content = "Hello",
                        Timestamp = DateTime.UtcNow.ToString("O")
                    }
                }
            }
        };

        var request = CreateMockHttpRequest(requestData);

        // Setup blob operation to throw exception
        _mockBlobClient.Setup(x => x.ExistsAsync(default))
            .ThrowsAsync(new InvalidOperationException("Blob storage error"));

        // Act
        var response = await _function.Run(request.Object);

        // Assert
        Assert.AreEqual(HttpStatusCode.InternalServerError, response.StatusCode);
        _mockLogger.Verify(
            x => x.Log(
                LogLevel.Error,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, t) => v.ToString()!.Contains("Error saving chat transcript")),
                It.IsAny<Exception>(),
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);
    }

    #endregion

    #region Helper Methods

    private Mock<HttpRequestData> CreateMockHttpRequest(SaveChatTranscriptRequest requestData)
    {
        var json = JsonSerializer.Serialize(requestData);
        var requestStream = new MemoryStream(Encoding.UTF8.GetBytes(json));

        var request = new Mock<HttpRequestData>(MockBehavior.Loose, Mock.Of<FunctionContext>());
        request.Setup(r => r.Body).Returns(requestStream);

        var responseStream = new MemoryStream();
        var response = new Mock<HttpResponseData>(MockBehavior.Loose, Mock.Of<FunctionContext>());
        response.SetupProperty(r => r.StatusCode, HttpStatusCode.OK);
        response.Setup(r => r.Body).Returns(responseStream);
        response.Setup(r => r.Headers).Returns(new HttpHeadersCollection());

        request.Setup(r => r.CreateResponse()).Returns(response.Object);

        return request;
    }

    #endregion
}
