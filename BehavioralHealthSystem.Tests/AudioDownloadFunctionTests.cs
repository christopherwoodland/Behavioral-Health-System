using Azure;
using Azure.Core.Serialization;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using BehavioralHealthSystem.Functions.Functions;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;
using System.Net;

namespace BehavioralHealthSystem.Tests;

/// <summary>
/// Unit tests for AudioDownloadFunction
/// </summary>
[TestClass]
public class AudioDownloadFunctionTests
{
    private Mock<ILogger<AudioDownloadFunction>> _mockLogger = null!;
    private Mock<BlobServiceClient> _mockBlobServiceClient = null!;
    private Mock<BlobContainerClient> _mockContainerClient = null!;
    private Mock<BlobClient> _mockBlobClient = null!;
    private AudioDownloadFunction _function = null!;

    [TestInitialize]
    public void Setup()
    {
        _mockLogger = new Mock<ILogger<AudioDownloadFunction>>();
        _mockBlobServiceClient = new Mock<BlobServiceClient>();
        _mockContainerClient = new Mock<BlobContainerClient>();
        _mockBlobClient = new Mock<BlobClient>();

        _mockBlobServiceClient
            .Setup(x => x.Uri)
            .Returns(new Uri("https://storageaccount.blob.core.windows.net"));

        _mockBlobServiceClient
            .Setup(x => x.GetBlobContainerClient(It.IsAny<string>()))
            .Returns(_mockContainerClient.Object);

        _mockContainerClient
            .Setup(x => x.GetBlobClient(It.IsAny<string>()))
            .Returns(_mockBlobClient.Object);

        _function = new AudioDownloadFunction(
            _mockLogger.Object,
            _mockBlobServiceClient.Object);
    }

    #region Constructor Tests

    [TestMethod]
    public void Constructor_ValidArgs_CreatesInstance()
    {
        var function = new AudioDownloadFunction(
            _mockLogger.Object,
            _mockBlobServiceClient.Object);
        Assert.IsNotNull(function);
    }

    [TestMethod]
    [ExpectedException(typeof(ArgumentNullException))]
    public void Constructor_NullLogger_ThrowsArgumentNullException()
    {
        new AudioDownloadFunction(null!, _mockBlobServiceClient.Object);
    }

    [TestMethod]
    [ExpectedException(typeof(ArgumentNullException))]
    public void Constructor_NullBlobServiceClient_ThrowsArgumentNullException()
    {
        new AudioDownloadFunction(_mockLogger.Object, null!);
    }

    #endregion

    #region Missing URL Parameter Tests

    [TestMethod]
    public async Task DownloadAudio_MissingUrlParam_ReturnsBadRequest()
    {
        // Arrange - no url query parameter
        var request = CreateMockHttpRequest("http://localhost/api/audio/download");

        // Act
        var response = await _function.DownloadAudioAsync(request.Object);

        // Assert
        Assert.AreEqual(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [TestMethod]
    public async Task DownloadAudio_EmptyUrlParam_ReturnsBadRequest()
    {
        // Arrange - empty url query parameter
        var request = CreateMockHttpRequest("http://localhost/api/audio/download?url=");

        // Act
        var response = await _function.DownloadAudioAsync(request.Object);

        // Assert
        Assert.AreEqual(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [TestMethod]
    public async Task DownloadAudio_WhitespaceUrlParam_ReturnsBadRequest()
    {
        // Arrange
        var request = CreateMockHttpRequest("http://localhost/api/audio/download?url=%20%20");

        // Act
        var response = await _function.DownloadAudioAsync(request.Object);

        // Assert
        Assert.AreEqual(HttpStatusCode.BadRequest, response.StatusCode);
    }

    #endregion

    #region SSRF Protection Tests

    [TestMethod]
    public async Task DownloadAudio_DifferentStorageHost_ReturnsForbidden()
    {
        // Arrange - URL pointing to a different storage account
        var blobUrl = Uri.EscapeDataString(
            "https://malicious.blob.core.windows.net/audio-uploads/users/user1/session-123.wav");
        var request = CreateMockHttpRequest(
            $"http://localhost/api/audio/download?url={blobUrl}");

        // Act
        var response = await _function.DownloadAudioAsync(request.Object);

        // Assert
        Assert.AreEqual(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [TestMethod]
    public async Task DownloadAudio_ExternalHost_ReturnsForbidden()
    {
        // Arrange - URL pointing to an external host
        var blobUrl = Uri.EscapeDataString("https://evil.com/sensitive-data");
        var request = CreateMockHttpRequest(
            $"http://localhost/api/audio/download?url={blobUrl}");

        // Act
        var response = await _function.DownloadAudioAsync(request.Object);

        // Assert
        Assert.AreEqual(HttpStatusCode.Forbidden, response.StatusCode);
    }

    #endregion

    #region Invalid URL Format Tests

    [TestMethod]
    public async Task DownloadAudio_InvalidBlobUrl_ReturnsBadRequest()
    {
        // Arrange - not a valid URI
        var request = CreateMockHttpRequest(
            "http://localhost/api/audio/download?url=not-a-valid-url");

        // Act
        var response = await _function.DownloadAudioAsync(request.Object);

        // Assert
        Assert.AreEqual(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [TestMethod]
    public async Task DownloadAudio_UrlWithNoPath_ReturnsBadRequest()
    {
        // Arrange - URL with no container/blob path segments
        var blobUrl = Uri.EscapeDataString("https://storageaccount.blob.core.windows.net/");
        var request = CreateMockHttpRequest(
            $"http://localhost/api/audio/download?url={blobUrl}");

        // Act
        var response = await _function.DownloadAudioAsync(request.Object);

        // Assert
        Assert.AreEqual(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [TestMethod]
    public async Task DownloadAudio_UrlWithOnlyContainer_ReturnsBadRequest()
    {
        // Arrange - URL with only container, no blob name
        var blobUrl = Uri.EscapeDataString("https://storageaccount.blob.core.windows.net/container");
        var request = CreateMockHttpRequest(
            $"http://localhost/api/audio/download?url={blobUrl}");

        // Act
        var response = await _function.DownloadAudioAsync(request.Object);

        // Assert
        Assert.AreEqual(HttpStatusCode.BadRequest, response.StatusCode);
    }

    #endregion

    #region Blob Not Found Tests

    [TestMethod]
    public async Task DownloadAudio_BlobDoesNotExist_ReturnsNotFound()
    {
        // Arrange
        var blobUrl = Uri.EscapeDataString(
            "https://storageaccount.blob.core.windows.net/audio-uploads/users/user1/session-123.wav");
        var request = CreateMockHttpRequest(
            $"http://localhost/api/audio/download?url={blobUrl}");

        var existsResponse = Response.FromValue(false, Mock.Of<Response>());
        _mockBlobClient
            .Setup(x => x.ExistsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(existsResponse);

        // Act
        var response = await _function.DownloadAudioAsync(request.Object);

        // Assert
        Assert.AreEqual(HttpStatusCode.NotFound, response.StatusCode);
    }

    [TestMethod]
    public async Task DownloadAudio_AzureRequestFailed404_ReturnsNotFound()
    {
        // Arrange
        var blobUrl = Uri.EscapeDataString(
            "https://storageaccount.blob.core.windows.net/audio-uploads/users/user1/session-123.wav");
        var request = CreateMockHttpRequest(
            $"http://localhost/api/audio/download?url={blobUrl}");

        var existsResponse = Response.FromValue(true, Mock.Of<Response>());
        _mockBlobClient
            .Setup(x => x.ExistsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(existsResponse);

        _mockBlobClient
            .Setup(x => x.DownloadContentAsync())
            .ThrowsAsync(new RequestFailedException(404, "Blob not found"));

        // Act
        var response = await _function.DownloadAudioAsync(request.Object);

        // Assert
        Assert.AreEqual(HttpStatusCode.NotFound, response.StatusCode);
    }

    #endregion

    #region Success Tests

    [TestMethod]
    public async Task DownloadAudio_ValidBlobUrl_ReturnsOkWithContent()
    {
        // Arrange
        var blobUrl = Uri.EscapeDataString(
            "https://storageaccount.blob.core.windows.net/audio-uploads/users/user1/session-123.wav");
        var request = CreateMockHttpRequest(
            $"http://localhost/api/audio/download?url={blobUrl}");

        var fakeAudioData = new byte[] { 0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00 }; // RIFF header stub

        var existsResponse = Response.FromValue(true, Mock.Of<Response>());
        _mockBlobClient
            .Setup(x => x.ExistsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(existsResponse);

        var blobDownloadResult = BlobsModelFactory.BlobDownloadResult(
            content: BinaryData.FromBytes(fakeAudioData),
            details: BlobsModelFactory.BlobDownloadDetails(contentType: "audio/wav"));

        var downloadResponse = Response.FromValue(blobDownloadResult, Mock.Of<Response>());
        _mockBlobClient
            .Setup(x => x.DownloadContentAsync())
            .ReturnsAsync(downloadResponse);

        // Act
        var response = await _function.DownloadAudioAsync(request.Object);

        // Assert
        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);
    }

    [TestMethod]
    public async Task DownloadAudio_ValidBlobUrl_CorrectContainerAndBlobUsed()
    {
        // Arrange
        var blobUrl = Uri.EscapeDataString(
            "https://storageaccount.blob.core.windows.net/audio-uploads/users/user1/session-123.wav");
        var request = CreateMockHttpRequest(
            $"http://localhost/api/audio/download?url={blobUrl}");

        var fakeAudioData = new byte[] { 0x01, 0x02, 0x03 };

        var existsResponse = Response.FromValue(true, Mock.Of<Response>());
        _mockBlobClient
            .Setup(x => x.ExistsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(existsResponse);

        var blobDownloadResult = BlobsModelFactory.BlobDownloadResult(
            content: BinaryData.FromBytes(fakeAudioData),
            details: BlobsModelFactory.BlobDownloadDetails(contentType: "audio/wav"));

        var downloadResponse = Response.FromValue(blobDownloadResult, Mock.Of<Response>());
        _mockBlobClient
            .Setup(x => x.DownloadContentAsync())
            .ReturnsAsync(downloadResponse);

        // Act
        await _function.DownloadAudioAsync(request.Object);

        // Assert - verify correct container was requested
        _mockBlobServiceClient.Verify(
            x => x.GetBlobContainerClient("audio-uploads"), Times.Once);

        // Assert - verify correct blob path was requested
        _mockContainerClient.Verify(
            x => x.GetBlobClient("users/user1/session-123.wav"), Times.Once);
    }

    #endregion

    #region Error Handling Tests

    [TestMethod]
    public async Task DownloadAudio_GeneralException_ReturnsInternalServerError()
    {
        // Arrange
        var blobUrl = Uri.EscapeDataString(
            "https://storageaccount.blob.core.windows.net/audio-uploads/users/user1/session-123.wav");
        var request = CreateMockHttpRequest(
            $"http://localhost/api/audio/download?url={blobUrl}");

        var existsResponse = Response.FromValue(true, Mock.Of<Response>());
        _mockBlobClient
            .Setup(x => x.ExistsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(existsResponse);

        _mockBlobClient
            .Setup(x => x.DownloadContentAsync())
            .ThrowsAsync(new InvalidOperationException("Unexpected error"));

        // Act
        var response = await _function.DownloadAudioAsync(request.Object);

        // Assert
        Assert.AreEqual(HttpStatusCode.InternalServerError, response.StatusCode);
    }

    [TestMethod]
    public async Task DownloadAudio_AzureRequestFailed403_ReturnsInternalServerError()
    {
        // Arrange - non-404 Azure error should be treated as internal error
        var blobUrl = Uri.EscapeDataString(
            "https://storageaccount.blob.core.windows.net/audio-uploads/users/user1/session-123.wav");
        var request = CreateMockHttpRequest(
            $"http://localhost/api/audio/download?url={blobUrl}");

        var existsResponse = Response.FromValue(true, Mock.Of<Response>());
        _mockBlobClient
            .Setup(x => x.ExistsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(existsResponse);

        _mockBlobClient
            .Setup(x => x.DownloadContentAsync())
            .ThrowsAsync(new RequestFailedException(403, "Forbidden"));

        // Act
        var response = await _function.DownloadAudioAsync(request.Object);

        // Assert
        Assert.AreEqual(HttpStatusCode.InternalServerError, response.StatusCode);
    }

    #endregion

    #region URL Parsing Tests

    [TestMethod]
    public async Task DownloadAudio_NestedBlobPath_ParsesCorrectly()
    {
        // Arrange - deeply nested blob path
        var blobUrl = Uri.EscapeDataString(
            "https://storageaccount.blob.core.windows.net/audio-uploads/users/user1/subfolder/deep/session-123.wav");
        var request = CreateMockHttpRequest(
            $"http://localhost/api/audio/download?url={blobUrl}");

        var fakeAudioData = new byte[] { 0x01, 0x02 };

        var existsResponse = Response.FromValue(true, Mock.Of<Response>());
        _mockBlobClient
            .Setup(x => x.ExistsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(existsResponse);

        var blobDownloadResult = BlobsModelFactory.BlobDownloadResult(
            content: BinaryData.FromBytes(fakeAudioData),
            details: BlobsModelFactory.BlobDownloadDetails(contentType: "audio/wav"));

        var downloadResponse = Response.FromValue(blobDownloadResult, Mock.Of<Response>());
        _mockBlobClient
            .Setup(x => x.DownloadContentAsync())
            .ReturnsAsync(downloadResponse);

        // Act
        await _function.DownloadAudioAsync(request.Object);

        // Assert - nested path should be preserved as blob name
        _mockBlobServiceClient.Verify(
            x => x.GetBlobContainerClient("audio-uploads"), Times.Once);
        _mockContainerClient.Verify(
            x => x.GetBlobClient("users/user1/subfolder/deep/session-123.wav"), Times.Once);
    }

    #endregion

    #region Helper Methods

    private Mock<HttpRequestData> CreateMockHttpRequest(string urlString)
    {
        var services = new ServiceCollection();
        services.AddOptions<WorkerOptions>()
            .Configure(o => o.Serializer = new JsonObjectSerializer());
        var serviceProvider = services.BuildServiceProvider();

        var mockContext = new Mock<FunctionContext>();
        mockContext.Setup(c => c.InstanceServices).Returns(serviceProvider);
        var context = mockContext.Object;

        var request = new Mock<HttpRequestData>(MockBehavior.Loose, context);
        request.Setup(r => r.Url).Returns(new Uri(urlString));

        request.Setup(r => r.CreateResponse()).Returns(() => CreateMockResponse(context));

        return request;
    }

    private static HttpResponseData CreateMockResponse(FunctionContext context)
    {
        var responseStream = new MemoryStream();
        var response = new Mock<HttpResponseData>(MockBehavior.Loose, context);
        response.SetupProperty(r => r.StatusCode, HttpStatusCode.OK);
        response.Setup(r => r.Body).Returns(responseStream);
        response.Setup(r => r.Headers).Returns(new HttpHeadersCollection());
        return response.Object;
    }

    #endregion
}
