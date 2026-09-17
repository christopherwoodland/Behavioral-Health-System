using Azure;
using Azure.Core.Serialization;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using System.IO;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using BehavioralHealthSystem.Agents.Interfaces;
using BehavioralHealthSystem.Agents.Models;
using BehavioralHealthSystem.Functions.Functions;
using BehavioralHealthSystem.Functions.Services;
using BehavioralHealthSystem.Models;
using BehavioralHealthSystem.Services.Interfaces;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.DurableTask;
using Microsoft.DurableTask.Client;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;

namespace BehavioralHealthSystem.Tests;

[TestClass]
public class AudioJobFunctionsTests
{
    private Mock<BlobServiceClient> _blobServiceClient = null!;
    private Mock<BlobContainerClient> _containerClient = null!;
    private Mock<BlobClient> _blobClient = null!;
    private Mock<IApiKeyValidationService> _apiKeyValidation = null!;
    private Mock<DurableTaskClient> _durableClient = null!;
    private AudioJobFunctions _function = null!;

    [TestInitialize]
    public void Setup()
    {
        _blobServiceClient = new Mock<BlobServiceClient>();
        _containerClient = new Mock<BlobContainerClient>();
        _blobClient = new Mock<BlobClient>();
        _apiKeyValidation = new Mock<IApiKeyValidationService>();
        _durableClient = new Mock<DurableTaskClient>("test");

        _blobServiceClient
            .Setup(client => client.GetBlobContainerClient("audio-uploads"))
            .Returns(_containerClient.Object);
        _containerClient
            .Setup(client => client.GetBlobClient(It.IsAny<string>()))
            .Returns(_blobClient.Object);
        _blobClient
            .SetupGet(client => client.Uri)
            .Returns(new Uri("https://storage.example/audio-uploads/users/user-1/recording.wav"));
        _containerClient
            .Setup(client => client.CreateIfNotExistsAsync(
                It.IsAny<PublicAccessType>(),
                It.IsAny<IDictionary<string, string>>(),
                It.IsAny<BlobContainerEncryptionScopeOptions>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync((Response<BlobContainerInfo>)null!);
        _blobClient
            .Setup(client => client.DeleteIfExistsAsync(
                It.IsAny<DeleteSnapshotsOption>(),
                It.IsAny<BlobRequestConditions>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync((Response<bool>)null!);

        _function = new AudioJobFunctions(
            _blobServiceClient.Object,
            _apiKeyValidation.Object,
            Mock.Of<ILogger<AudioJobFunctions>>(),
            new ConfigurationBuilder().Build());
    }

    [TestMethod]
    public async Task StartAudioProcessingJob_Unauthorized_ReturnsUnauthorizedWithoutStorageAccess()
    {
        _apiKeyValidation
            .Setup(service => service.ValidateRequestAsync(It.IsAny<HttpRequestData>()))
            .ReturnsAsync(new TokenValidationResult { IsValid = false });
        var request = CreateRequest(
            "http://localhost/api/audio-jobs?userId=user-1&sessionId=session-1&fileName=recording.wav",
            new byte[] { 1, 2, 3 });

        var response = await _function.StartAudioProcessingJob(request, _durableClient.Object);

        Assert.AreEqual(HttpStatusCode.Unauthorized, response.StatusCode);
        _blobServiceClient.Verify(
            client => client.GetBlobContainerClient(It.IsAny<string>()),
            Times.Never);
    }

    [TestMethod]
    public async Task StartAudioProcessingJob_UnsupportedExtension_ReturnsBadRequest()
    {
        AuthorizeRequests();
        var request = CreateRequest(
            "http://localhost/api/audio-jobs?userId=user-1&sessionId=session-1&fileName=recording.txt",
            new byte[] { 1, 2, 3 });

        var response = await _function.StartAudioProcessingJob(request, _durableClient.Object);

        Assert.AreEqual(HttpStatusCode.BadRequest, response.StatusCode);
        _blobServiceClient.Verify(
            client => client.GetBlobContainerClient(It.IsAny<string>()),
            Times.Never);
    }

    [TestMethod]
    public async Task StartAudioProcessingJob_ValidAudio_UploadsAndSchedulesIdentifierOnlyInput()
    {
        AuthorizeRequests();
        var uploadedAudio = Array.Empty<byte>();
        var audio = new byte[] { 82, 73, 70, 70, 1, 2, 3, 4 };
        AudioProcessingJobInput? scheduledInput = null;
        StartOrchestrationOptions? scheduledOptions = null;
        BlobUploadOptions? capturedUploadOptions = null;

        _blobClient
            .Setup(client => client.UploadAsync(
                It.IsAny<Stream>(),
                It.IsAny<BlobUploadOptions>(),
                It.IsAny<CancellationToken>()))
            .Returns(async (Stream content, BlobUploadOptions options, CancellationToken cancellationToken) =>
            {
                capturedUploadOptions = options;
                using var buffer = new MemoryStream();
                await content.CopyToAsync(buffer, cancellationToken);
                uploadedAudio = buffer.ToArray();
                return (Response<BlobContentInfo>)null!;
            });
        _durableClient
            .Setup(client => client.ScheduleNewOrchestrationInstanceAsync(
                It.IsAny<TaskName>(),
                It.IsAny<object>(),
                It.IsAny<StartOrchestrationOptions>(),
                It.IsAny<CancellationToken>()))
            .Callback((TaskName _, object input, StartOrchestrationOptions options, CancellationToken _) =>
            {
                scheduledInput = (AudioProcessingJobInput)input;
                scheduledOptions = options;
            })
            .ReturnsAsync(() => scheduledOptions!.InstanceId!);

        var request = CreateRequest(
            "http://localhost/api/audio-jobs?userId=user-1&sessionId=session-1&fileName=recording.wav",
            audio,
            ("Idempotency-Key", "recording-1"),
            ("X-BHS-Client-Source", "mico-avatar"));

        var response = await _function.StartAudioProcessingJob(request, _durableClient.Object);

        Assert.AreEqual(HttpStatusCode.Accepted, response.StatusCode);
        CollectionAssert.AreEqual(audio, uploadedAudio);
        Assert.IsNotNull(scheduledInput);
        Assert.IsNotNull(scheduledOptions);
        Assert.AreEqual(scheduledOptions.InstanceId, scheduledInput.JobId);
        Assert.AreEqual("user-1", scheduledInput.UserId);
        Assert.AreEqual("session-1", scheduledInput.SessionId);
        Assert.AreEqual("mico-avatar", scheduledInput.ClientSource);
        Assert.IsFalse(string.IsNullOrWhiteSpace(scheduledInput.OwnerIdHash));
        StringAssert.EndsWith(scheduledInput.FileName, ".wav");
        Assert.AreEqual(ETag.All, capturedUploadOptions?.Conditions?.IfNoneMatch);
        Assert.IsFalse(typeof(AudioProcessingJobInput).GetProperties()
            .Any(property => property.PropertyType == typeof(byte[])));

        _containerClient.Verify(
            client => client.GetBlobClient(
                It.Is<string>(name => name == $"users/user-1/{scheduledInput.FileName}")),
            Times.Once);
    }

    [TestMethod]
    public async Task StartAudioProcessingJob_IdempotentBlobAlreadyExists_ReusesBlobAndSchedules()
    {
        AuthorizeRequests();
        _blobClient
            .Setup(client => client.UploadAsync(
                It.IsAny<Stream>(),
                It.IsAny<BlobUploadOptions>(),
                It.IsAny<CancellationToken>()))
            .ThrowsAsync(new RequestFailedException(
                (int)HttpStatusCode.PreconditionFailed,
                "Blob already exists"));
        _durableClient
            .Setup(client => client.ScheduleNewOrchestrationInstanceAsync(
                It.IsAny<TaskName>(),
                It.IsAny<object>(),
                It.IsAny<StartOrchestrationOptions>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync("audio-replayed");
        var request = CreateRequest(
            "http://localhost/api/audio-jobs?userId=user-1&sessionId=session-1&fileName=recording.wav",
            new byte[] { 1, 2, 3 },
            ("Idempotency-Key", "recording-1"));

        var response = await _function.StartAudioProcessingJob(request, _durableClient.Object);

        Assert.AreEqual(HttpStatusCode.Accepted, response.StatusCode);
        var responseJson = await ReadResponseBodyAsync(response);
        Assert.IsTrue(responseJson.RootElement.GetProperty("replayed").GetBoolean());
        _durableClient.Verify(
            client => client.ScheduleNewOrchestrationInstanceAsync(
                It.IsAny<TaskName>(),
                It.IsAny<object>(),
                It.IsAny<StartOrchestrationOptions>(),
                It.IsAny<CancellationToken>()),
            Times.Once);
        _blobClient.Verify(
            client => client.DeleteIfExistsAsync(
                It.IsAny<DeleteSnapshotsOption>(),
                It.IsAny<BlobRequestConditions>(),
                It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [TestMethod]
    public async Task StartAudioProcessingJob_StreamingBodyExceedsLimit_ReturnsPayloadTooLarge()
    {
        AuthorizeRequests();
        var function = new AudioJobFunctions(
            _blobServiceClient.Object,
            _apiKeyValidation.Object,
            Mock.Of<ILogger<AudioJobFunctions>>(),
            new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["AUDIO_JOB_MAX_UPLOAD_BYTES"] = "4"
                })
                .Build());
        _blobClient
            .Setup(client => client.UploadAsync(
                It.IsAny<Stream>(),
                It.IsAny<BlobUploadOptions>(),
                It.IsAny<CancellationToken>()))
            .Returns(async (Stream content, BlobUploadOptions _, CancellationToken cancellationToken) =>
            {
                using var buffer = new MemoryStream();
                await content.CopyToAsync(buffer, cancellationToken);
                return (Response<BlobContentInfo>)null!;
            });
        var request = CreateRequestWithoutContentLength(
            "http://localhost/api/audio-jobs?userId=user-1&sessionId=session-1&fileName=recording.wav",
            new byte[] { 1, 2, 3, 4, 5 });

        var response = await function.StartAudioProcessingJob(request, _durableClient.Object);

        Assert.AreEqual(HttpStatusCode.RequestEntityTooLarge, response.StatusCode);
        _blobClient.Verify(
            client => client.DeleteIfExistsAsync(
                It.IsAny<DeleteSnapshotsOption>(),
                It.IsAny<BlobRequestConditions>(),
                It.IsAny<CancellationToken>()),
            Times.Never);
        _durableClient.Verify(
            client => client.ScheduleNewOrchestrationInstanceAsync(
                It.IsAny<TaskName>(),
                It.IsAny<object>(),
                It.IsAny<StartOrchestrationOptions>(),
                It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [TestMethod]
    public async Task GetAudioProcessingJobResult_Pending_ReturnsAccepted()
    {
        AuthorizeRequests();
        const string jobId = "audio-pending";
        SetupDurableMetadata(CreateMetadata(
            jobId,
            nameof(AudioProcessingJobOrchestrator),
            OrchestrationRuntimeStatus.Pending,
            new AudioProcessingJobInput
            {
                JobId = jobId,
                UserId = "user-1",
                SessionId = "session-1",
                FileName = "stored.wav",
                OwnerIdHash = CreateOwnerIdHash("api-key-user")
            },
            null));
        var request = CreateRequest($"http://localhost/api/audio-jobs/{jobId}/result", Array.Empty<byte>());

        var response = await _function.GetAudioProcessingJobResult(
            request,
            _durableClient.Object,
            jobId);

        Assert.AreEqual(HttpStatusCode.Accepted, response.StatusCode);
        Assert.AreEqual("3", response.Headers.GetValues("Retry-After").Single());
        var responseJson = await ReadResponseBodyAsync(response);
        Assert.AreEqual("queued", responseJson.RootElement.GetProperty("status").GetString());
    }

    [TestMethod]
    public async Task GetAudioProcessingJobResult_Completed_ReturnsPrediction()
    {
        AuthorizeRequests();
        const string jobId = "audio-completed";
        var result = new AudioProcessingResult
        {
            Success = true,
            UserId = "user-1",
            SessionId = "session-1",
            PredictionResponse = new PredictionResponse
            {
                PredictedScore = "2.5",
                PredictedScoreDepression = "2",
                PredictedScoreAnxiety = "3"
            }
        };
        SetupDurableMetadata(CreateMetadata(
            jobId,
            nameof(AudioProcessingJobOrchestrator),
            OrchestrationRuntimeStatus.Completed,
            new AudioProcessingJobInput
            {
                JobId = jobId,
                UserId = "user-1",
                SessionId = "session-1",
                FileName = "stored.wav",
                OwnerIdHash = CreateOwnerIdHash("api-key-user")
            },
            result));
        var request = CreateRequest($"http://localhost/api/audio-jobs/{jobId}/result", Array.Empty<byte>());

        var response = await _function.GetAudioProcessingJobResult(
            request,
            _durableClient.Object,
            jobId);

        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);
        var responseJson = await ReadResponseBodyAsync(response);
        Assert.AreEqual("succeeded", responseJson.RootElement.GetProperty("status").GetString());
        Assert.AreEqual(
            "2.5",
            responseJson.RootElement
                .GetProperty("result")
                .GetProperty("predictionResponse")
                .GetProperty("predicted_score")
                .GetString());
    }

    [TestMethod]
    public async Task GetAudioProcessingJobResult_PipelineFailed_DoesNotExposeInternalError()
    {
        AuthorizeRequests();
        const string jobId = "audio-failed";
        SetupDurableMetadata(CreateMetadata(
            jobId,
            nameof(AudioProcessingJobOrchestrator),
            OrchestrationRuntimeStatus.Completed,
            new AudioProcessingJobInput
            {
                JobId = jobId,
                UserId = "user-1",
                SessionId = "session-1",
                FileName = "stored.wav",
                OwnerIdHash = CreateOwnerIdHash("api-key-user")
            },
            new AudioProcessingResult
            {
                Success = false,
                FailedStep = "predict",
                Error = "Secret upstream response and credential details"
            }));
        var request = CreateRequest($"http://localhost/api/audio-jobs/{jobId}/result", Array.Empty<byte>());

        var response = await _function.GetAudioProcessingJobResult(
            request,
            _durableClient.Object,
            jobId);

        Assert.AreEqual(HttpStatusCode.UnprocessableEntity, response.StatusCode);
        var responseJson = await ReadResponseBodyAsync(response);
        var body = responseJson.RootElement.GetRawText();
        StringAssert.Contains(body, "predict");
        Assert.IsFalse(body.Contains("Secret upstream", StringComparison.Ordinal));
    }

    [TestMethod]
    public async Task GetAudioProcessingJobStatus_DifferentAuthenticatedOwner_ReturnsNotFound()
    {
        AuthorizeRequests("caller-2");
        const string jobId = "audio-private";
        SetupDurableMetadata(CreateMetadata(
            jobId,
            nameof(AudioProcessingJobOrchestrator),
            OrchestrationRuntimeStatus.Running,
            new AudioProcessingJobInput
            {
                JobId = jobId,
                UserId = "user-1",
                SessionId = "session-1",
                FileName = "stored.wav",
                OwnerIdHash = CreateOwnerIdHash("caller-1")
            },
            new { }));
        var request = CreateRequest($"http://localhost/api/audio-jobs/{jobId}", Array.Empty<byte>());

        var response = await _function.GetAudioProcessingJobStatus(
            request,
            _durableClient.Object,
            jobId);

        Assert.AreEqual(HttpStatusCode.NotFound, response.StatusCode);
    }

    [TestMethod]
    public async Task GetAudioProcessingJobResult_Unauthorized_DoesNotAccessDurableState()
    {
        _apiKeyValidation
            .Setup(service => service.ValidateRequestAsync(It.IsAny<HttpRequestData>()))
            .ReturnsAsync(new TokenValidationResult { IsValid = false });
        const string jobId = "audio-private";
        var request = CreateRequest($"http://localhost/api/audio-jobs/{jobId}/result", Array.Empty<byte>());

        var response = await _function.GetAudioProcessingJobResult(
            request,
            _durableClient.Object,
            jobId);

        Assert.AreEqual(HttpStatusCode.Unauthorized, response.StatusCode);
        _durableClient.Verify(
            client => client.GetInstanceAsync(
                It.IsAny<string>(),
                It.IsAny<bool>(),
                It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [TestMethod]
    public async Task GetAudioProcessingJobStatus_NonAudioOrchestration_ReturnsNotFound()
    {
        AuthorizeRequests();
        const string jobId = "assessment-job";
        SetupDurableMetadata(CreateMetadata(
            jobId,
            "ExtendedAssessmentOrchestrator",
            OrchestrationRuntimeStatus.Completed,
            new { sessionId = "session-1" },
            new { privateAssessment = true }));
        var request = CreateRequest($"http://localhost/api/audio-jobs/{jobId}", Array.Empty<byte>());

        var response = await _function.GetAudioProcessingJobStatus(
            request,
            _durableClient.Object,
            jobId);

        Assert.AreEqual(HttpStatusCode.NotFound, response.StatusCode);
    }

    [TestMethod]
    public async Task ProcessAudioJobActivity_DelegatesToExistingPipeline()
    {
        var pipeline = new Mock<IAudioProcessingOrchestrator>();
        var expected = new AudioProcessingResult { Success = true };
        pipeline
            .Setup(service => service.ProcessAudioAsync(
                "user-1",
                "session-1",
                "stored.wav",
                null,
                null,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(expected);
        var activity = new ProcessAudioJobActivity(
            pipeline.Object,
            Mock.Of<ILogger<ProcessAudioJobActivity>>());

        var result = await activity.Run(new AudioProcessingJobInput
        {
            JobId = "audio-job-1",
            UserId = "user-1",
            SessionId = "session-1",
            FileName = "stored.wav",
            OwnerIdHash = CreateOwnerIdHash("api-key-user")
        });

        Assert.AreSame(expected, result);
        pipeline.VerifyAll();
    }

    [TestMethod]
    public async Task PersistAudioJobResultActivity_Success_UpsertsMicoSessionAndPreservesExistingData()
    {
        var existing = new SessionData
        {
            SessionId = "session-1",
            UserId = "user-1",
            Transcription = "Existing transcript",
            CreatedAt = "2026-01-01T00:00:00.0000000Z"
        };
        SessionData? saved = null;
        var storage = new Mock<ISessionStorageService>();
        storage.Setup(service => service.GetSessionDataAsync("session-1", It.IsAny<CancellationToken>()))
            .ReturnsAsync(existing);
        storage.Setup(service => service.SaveSessionDataAsync(It.IsAny<SessionData>(), It.IsAny<CancellationToken>()))
            .Callback((SessionData session, CancellationToken _) => saved = session)
            .ReturnsAsync(true);
        var activity = new PersistAudioJobResultActivity(
            storage.Object,
            Mock.Of<ILogger<PersistAudioJobResultActivity>>());

        await activity.Run(new PersistAudioJobResultInput
        {
            Job = new AudioProcessingJobInput
            {
                JobId = "audio-job-1",
                UserId = "user-1",
                SessionId = "session-1",
                FileName = "stored.wav",
                BlobUrl = "https://storage.example/audio-uploads/users/user-1/stored.wav",
                ClientSource = "mico-avatar",
                OwnerIdHash = CreateOwnerIdHash("api-key-user"),
                Age = 35,
                WeightKg = 70
            },
            Result = new AudioProcessingResult
            {
                Success = true,
                UserId = "user-1",
                SessionId = "session-1",
                OriginalFileName = "recording.wav",
                SourceBlobPath = "users/user-1/stored.wav",
                Provider = "local-dam",
                StartedAtUtc = DateTime.UtcNow.AddSeconds(-2),
                CompletedAtUtc = DateTime.UtcNow,
                PredictionResponse = new PredictionResponse
                {
                    PredictedScoreDepression = "0.42",
                    PredictedScoreAnxiety = "0.73",
                    Status = "succeeded",
                    Provider = "local-dam"
                }
            }
        });

        Assert.IsNotNull(saved);
        Assert.AreEqual("session-1", saved.SessionId);
        Assert.AreEqual("user-1", saved.UserId);
        Assert.AreEqual("Existing transcript", saved.Transcription);
        Assert.AreEqual("succeeded", saved.Status);
        Assert.AreEqual("audio-job-1", saved.AnalysisResults?.JobId);
        Assert.AreEqual("mico-avatar", saved.AnalysisResults?.Source);
        Assert.AreEqual(0.42, saved.AnalysisResults?.DepressionScore);
        Assert.AreEqual(0.73, saved.AnalysisResults?.AnxietyScore);
        Assert.AreEqual("0.42", saved.Prediction?.PredictedScoreDepression);
        Assert.AreEqual(35, saved.UserMetadata?.Age);
        Assert.AreEqual(154, saved.UserMetadata?.Weight);
        storage.Verify(service => service.SaveSessionDataAsync(
            It.Is<SessionData>(session => session.SessionId == "session-1"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [TestMethod]
    public async Task PersistAudioJobResultActivity_Failure_CreatesAdminVisibleFailedSession()
    {
        SessionData? saved = null;
        var storage = new Mock<ISessionStorageService>();
        storage.Setup(service => service.GetSessionDataAsync("session-2", It.IsAny<CancellationToken>()))
            .ReturnsAsync((SessionData?)null);
        storage.Setup(service => service.SaveSessionDataAsync(It.IsAny<SessionData>(), It.IsAny<CancellationToken>()))
            .Callback((SessionData session, CancellationToken _) => saved = session)
            .ReturnsAsync(true);
        var activity = new PersistAudioJobResultActivity(
            storage.Object,
            Mock.Of<ILogger<PersistAudioJobResultActivity>>());

        await activity.Run(new PersistAudioJobResultInput
        {
            Job = new AudioProcessingJobInput
            {
                JobId = "audio-job-2",
                UserId = "user-2",
                SessionId = "session-2",
                FileName = "stored.webm",
                ClientSource = "mico-avatar",
                OwnerIdHash = CreateOwnerIdHash("api-key-user")
            },
            Result = new AudioProcessingResult
            {
                Success = false,
                UserId = "user-2",
                SessionId = "session-2",
                Error = "Prediction unavailable",
                FailedStep = "predict",
                CompletedAtUtc = DateTime.UtcNow
            }
        });

        Assert.IsNotNull(saved);
        Assert.AreEqual("failed", saved.Status);
        Assert.AreEqual("audio-job-2", saved.AnalysisResults?.JobId);
        Assert.AreEqual("mico-avatar", saved.AnalysisResults?.Source);
        Assert.AreEqual("Prediction unavailable", saved.AnalysisResults?.Error);
        Assert.AreEqual("predict", saved.AnalysisResults?.FailedStep);
    }

    private void AuthorizeRequests(string userId = "api-key-user")
    {
        _apiKeyValidation
            .Setup(service => service.ValidateRequestAsync(It.IsAny<HttpRequestData>()))
            .ReturnsAsync(new TokenValidationResult { IsValid = true, UserId = userId });
    }

    private static string CreateOwnerIdHash(string userId)
    {
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(userId)))
            .ToLowerInvariant();
    }

    private void SetupDurableMetadata(OrchestrationMetadata metadata)
    {
        _durableClient
            .Setup(client => client.GetInstanceAsync(
                metadata.InstanceId,
                true,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(metadata);
    }

    private static OrchestrationMetadata CreateMetadata(
        string jobId,
        string orchestrationName,
        OrchestrationRuntimeStatus runtimeStatus,
        object input,
        object output)
    {
        var metadata = new OrchestrationMetadata(orchestrationName, jobId);
        SetMetadataProperty(metadata, nameof(OrchestrationMetadata.RuntimeStatus), runtimeStatus);
        SetMetadataProperty(metadata, nameof(OrchestrationMetadata.CreatedAt), DateTimeOffset.UtcNow.AddMinutes(-1));
        SetMetadataProperty(metadata, nameof(OrchestrationMetadata.LastUpdatedAt), DateTimeOffset.UtcNow);
        SetMetadataProperty(
            metadata,
            nameof(OrchestrationMetadata.SerializedInput),
            JsonSerializer.Serialize(input, JsonSerializerOptionsFactory.Default));
        SetMetadataProperty(
            metadata,
            nameof(OrchestrationMetadata.SerializedOutput),
            JsonSerializer.Serialize(output, JsonSerializerOptionsFactory.Default));
        return metadata;
    }

    private static void SetMetadataProperty<T>(OrchestrationMetadata metadata, string propertyName, T value)
    {
        var field = typeof(OrchestrationMetadata).GetField(
            $"<{propertyName}>k__BackingField",
            BindingFlags.Instance | BindingFlags.NonPublic);
        Assert.IsNotNull(field, $"Durable metadata backing field '{propertyName}' was not found.");
        field.SetValue(metadata, value);
    }

    private static async Task<JsonDocument> ReadResponseBodyAsync(HttpResponseData response)
    {
        response.Body.Position = 0;
        return await JsonDocument.ParseAsync(response.Body);
    }

    private static HttpRequestData CreateRequest(
        string url,
        byte[] body,
        params (string Name, string Value)[] headers)
    {
        return CreateRequest(url, body, includeContentLength: true, headers);
    }

    private static HttpRequestData CreateRequestWithoutContentLength(string url, byte[] body)
    {
        return CreateRequest(url, body, includeContentLength: false, Array.Empty<(string, string)>());
    }

    private static HttpRequestData CreateRequest(
        string url,
        byte[] body,
        bool includeContentLength,
        params (string Name, string Value)[] headers)
    {
        var services = new ServiceCollection();
        services.AddOptions<WorkerOptions>()
            .Configure(options => options.Serializer = new JsonObjectSerializer());
        var serviceProvider = services.BuildServiceProvider();

        var context = new Mock<FunctionContext>();
        context.SetupGet(value => value.InstanceServices).Returns(serviceProvider);
        context.SetupGet(value => value.CancellationToken).Returns(CancellationToken.None);

        var requestHeaders = new HttpHeadersCollection();
        if (includeContentLength)
        {
            requestHeaders.Add("Content-Length", body.Length.ToString());
        }
        foreach (var (name, value) in headers)
        {
            requestHeaders.Add(name, value);
        }

        var request = new Mock<HttpRequestData>(MockBehavior.Loose, context.Object);
        request.SetupGet(value => value.Url).Returns(new Uri(url));
        request.SetupGet(value => value.Body).Returns(new MemoryStream(body));
        request.SetupGet(value => value.Headers).Returns(requestHeaders);
        request.Setup(value => value.CreateResponse())
            .Returns(() => CreateResponse(context.Object));
        return request.Object;
    }

    private static HttpResponseData CreateResponse(FunctionContext context)
    {
        var response = new Mock<HttpResponseData>(MockBehavior.Loose, context);
        response.SetupProperty(value => value.StatusCode, HttpStatusCode.OK);
        response.SetupGet(value => value.Headers).Returns(new HttpHeadersCollection());
        response.SetupGet(value => value.Body).Returns(new MemoryStream());
        return response.Object;
    }
}
