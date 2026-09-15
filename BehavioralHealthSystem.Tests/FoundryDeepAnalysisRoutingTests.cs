using BehavioralHealthSystem.Services;
using Microsoft.Extensions.Options;

namespace BehavioralHealthSystem.Tests;

[TestClass]
public class FoundryDeepAnalysisRoutingTests
{
    [TestMethod]
    public async Task GenerateExtendedRiskAssessmentAsync_UsesFoundryAgentAndAttributesVersion()
    {
        string? capturedInput = null;
        var deepAgent = new Mock<IDeepAnalysisAgentService>();
        deepAgent.SetupGet(service => service.IsEnabled).Returns(true);
        deepAgent.SetupGet(service => service.ModelVersion).Returns("foundry-agent:bhs-deep-analysis@4");
        deepAgent
            .Setup(service => service.GenerateAssessmentAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Callback<string, CancellationToken>((input, _) => capturedInput = input)
            .ReturnsAsync("""
                {
                  "overallRiskLevel": "Moderate",
                  "riskScore": 5,
                  "evidenceSufficiency": "Sufficient",
                  "modelSignalRiskLevel": "Low",
                  "summary": "Synthetic assessment",
                  "keyFactors": ["Reported symptom"],
                  "recommendations": ["Clinical follow-up"],
                  "immediateActions": [],
                  "followUpRecommendations": ["Gather missing history"],
                  "confidenceLevel": 0.6,
                  "isExtended": true,
                  "conditionAssessments": []
                }
                """);

        var dsm5DataService = new Mock<IDSM5DataService>();
        dsm5DataService
            .Setup(service => service.GetConditionDetailsAsync(It.IsAny<string>()))
            .ReturnsAsync((DSM5ConditionData?)null);
        var service = new RiskAssessmentService(
            Mock.Of<ILogger<RiskAssessmentService>>(),
            Options.Create(new AzureOpenAIOptions()),
            Options.Create(new ExtendedAssessmentOpenAIOptions()),
            Options.Create(new FoundryQuickAnalysisOptions()),
            Options.Create(new FoundryDeepAnalysisOptions { Enabled = true }),
            Mock.Of<IQuickAnalysisAgentService>(),
            deepAgent.Object,
            Mock.Of<ISessionStorageService>(),
            dsm5DataService.Object);

        var result = await service.GenerateExtendedRiskAssessmentAsync(new SessionData
        {
            SessionId = "synthetic-session",
            Transcription = "Synthetic reported symptom"
        });

        Assert.IsNotNull(result);
        Assert.AreEqual("Moderate", result.OverallRiskLevel);
        Assert.AreEqual("foundry-agent:bhs-deep-analysis@4", result.ModelVersion);
        Assert.IsTrue(result.IsExtended);
        StringAssert.Contains(capturedInput, "<clinical-data>");
        StringAssert.Contains(capturedInput, "Synthetic reported symptom");
        StringAssert.Contains(capturedInput, "Required JSON Response Format");
        StringAssert.Contains(capturedInput, "never use it alone to raise clinical risk");
        Assert.IsFalse(capturedInput.Contains("licensed mental health professional", StringComparison.OrdinalIgnoreCase));
        deepAgent.Verify(
            agent => agent.GenerateAssessmentAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [TestMethod]
    public async Task GenerateExtendedRiskAssessmentAsync_InsufficientEvidenceReturnsIndeterminateWithoutScore()
    {
        var deepAgent = new Mock<IDeepAnalysisAgentService>();
        deepAgent.SetupGet(service => service.IsEnabled).Returns(true);
        deepAgent.SetupGet(service => service.ModelVersion).Returns("foundry-agent:bhs-deep-analysis@4");
        deepAgent
            .Setup(service => service.GenerateAssessmentAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("""
                {
                  "overallRiskLevel": "High",
                  "riskScore": 7,
                  "evidenceSufficiency": "Insufficient",
                  "modelSignalRiskLevel": "High",
                  "summary": "The DAM alert is unverified and patient-specific safety evidence is absent.",
                  "keyFactors": ["Unverified DAM alert"],
                  "recommendations": ["Clinician review"],
                  "immediateActions": [],
                  "followUpRecommendations": ["Obtain direct safety history"],
                  "confidenceLevel": 0.1,
                  "isExtended": true,
                  "conditionAssessments": []
                }
                """);

        var service = new RiskAssessmentService(
            Mock.Of<ILogger<RiskAssessmentService>>(),
            Options.Create(new AzureOpenAIOptions()),
            Options.Create(new ExtendedAssessmentOpenAIOptions()),
            Options.Create(new FoundryQuickAnalysisOptions()),
            Options.Create(new FoundryDeepAnalysisOptions { Enabled = true }),
            Mock.Of<IQuickAnalysisAgentService>(),
            deepAgent.Object,
            Mock.Of<ISessionStorageService>(),
            Mock.Of<IDSM5DataService>());

        var result = await service.GenerateExtendedRiskAssessmentAsync(new SessionData
        {
            SessionId = "insufficient-evidence-session",
            Transcription = "A fictional third-person narrative."
        });

        Assert.IsNotNull(result);
        Assert.AreEqual("Indeterminate", result.OverallRiskLevel);
        Assert.AreEqual(0, result.RiskScore);
        Assert.AreEqual("Insufficient", result.EvidenceSufficiency);
        Assert.AreEqual("High", result.ModelSignalRiskLevel);
    }
}
