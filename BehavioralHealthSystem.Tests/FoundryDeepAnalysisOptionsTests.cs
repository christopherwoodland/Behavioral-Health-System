namespace BehavioralHealthSystem.Tests;

[TestClass]
public class FoundryDeepAnalysisOptionsTests
{
    [TestMethod]
    public void Constructor_InitializesSafeDefaults()
    {
        var options = new FoundryDeepAnalysisOptions();

        Assert.IsFalse(options.Enabled);
        Assert.AreEqual(string.Empty, options.ProjectEndpoint);
        Assert.AreEqual(string.Empty, options.AgentName);
        Assert.AreEqual(string.Empty, options.AgentVersion);
        Assert.AreEqual(300, options.TimeoutSeconds);
        Assert.IsTrue(options.UseDirectCompletionFallback);
        Assert.AreEqual("FoundryDeepAnalysis", FoundryDeepAnalysisOptions.SectionName);
    }
}
