using BehavioralHealthSystem.Configuration;

namespace BehavioralHealthSystem.Tests;

[TestClass]
public class AzureOpenAIOptionsTests
{
    [TestMethod]
    public void Constructor_InitializesWithDefaultValues()
    {
        // Act
        var options = new AzureOpenAIOptions();

        // Assert
        Assert.AreEqual(string.Empty, options.Endpoint);
        Assert.AreEqual(string.Empty, options.ApiKey);
        Assert.AreEqual(string.Empty, options.DeploymentName);
        Assert.AreEqual("2024-02-01", options.ApiVersion);
        Assert.AreEqual(1500, options.MaxTokens);
        Assert.AreEqual(0.3, options.Temperature);
        Assert.IsFalse(options.Enabled);
    }

    [TestMethod]
    public void SectionName_HasCorrectValue()
    {
        // Assert
        Assert.AreEqual("AzureOpenAI", AzureOpenAIOptions.SectionName);
    }

    [TestMethod]
    public void Properties_CanBeSetAndRetrieved()
    {
        // Arrange
        var expectedEndpoint = "https://test.openai.azure.com/";
        var expectedApiKey = "test-api-key-123";
        var expectedDeploymentName = "gpt-4";
        var expectedApiVersion = "2024-03-01";
        var expectedMaxTokens = 2000;
        var expectedTemperature = 0.7;
        var expectedEnabled = true;

        // Act
        var options = new AzureOpenAIOptions
        {
            Endpoint = expectedEndpoint,
            ApiKey = expectedApiKey,
            DeploymentName = expectedDeploymentName,
            ApiVersion = expectedApiVersion,
            MaxTokens = expectedMaxTokens,
            Temperature = expectedTemperature,
            Enabled = expectedEnabled
        };

        // Assert
        Assert.AreEqual(expectedEndpoint, options.Endpoint);
        Assert.AreEqual(expectedApiKey, options.ApiKey);
        Assert.AreEqual(expectedDeploymentName, options.DeploymentName);
        Assert.AreEqual(expectedApiVersion, options.ApiVersion);
        Assert.AreEqual(expectedMaxTokens, options.MaxTokens);
        Assert.AreEqual(expectedTemperature, options.Temperature);
        Assert.AreEqual(expectedEnabled, options.Enabled);
    }

    [TestMethod]
    public void Endpoint_AcceptsValidUrls()
    {
        // Arrange
        var options = new AzureOpenAIOptions();
        var validUrls = new[]
        {
            "https://test.openai.azure.com/",
            "https://myresource.openai.azure.com",
            "https://eastus.api.cognitive.microsoft.com/",
            ""
        };

        // Act & Assert
        foreach (var url in validUrls)
        {
            options.Endpoint = url;
            Assert.AreEqual(url, options.Endpoint);
        }
    }

    [TestMethod]
    public void ApiKey_AcceptsValidKeys()
    {
        // Arrange
        var options = new AzureOpenAIOptions();
        var validKeys = new[]
        {
            "abc123def456",
            "AZURE_OPENAI_API_KEY_12345",
            "",
            "very-long-api-key-with-many-characters-and-symbols-!@#$%^&*()"
        };

        // Act & Assert
        foreach (var key in validKeys)
        {
            options.ApiKey = key;
            Assert.AreEqual(key, options.ApiKey);
        }
    }

    [TestMethod]
    public void DeploymentName_AcceptsValidNames()
    {
        // Arrange
        var options = new AzureOpenAIOptions();
        var validNames = new[]
        {
            "gpt-4",
            "gpt-35-turbo",
            "text-davinci-003",
            "my-custom-deployment",
            ""
        };

        // Act & Assert
        foreach (var name in validNames)
        {
            options.DeploymentName = name;
            Assert.AreEqual(name, options.DeploymentName);
        }
    }

    [TestMethod]
    public void ApiVersion_AcceptsValidVersions()
    {
        // Arrange
        var options = new AzureOpenAIOptions();
        var validVersions = new[]
        {
            "2024-02-01",
            "2023-12-01-preview",
            "2023-05-15",
            "2024-03-01"
        };

        // Act & Assert
        foreach (var version in validVersions)
        {
            options.ApiVersion = version;
            Assert.AreEqual(version, options.ApiVersion);
        }
    }

    [TestMethod]
    public void MaxTokens_AcceptsValidValues()
    {
        // Arrange
        var options = new AzureOpenAIOptions();
        var validTokenCounts = new[] { 1, 100, 1500, 4000, 8000, 16000 };

        // Act & Assert
        foreach (var tokenCount in validTokenCounts)
        {
            options.MaxTokens = tokenCount;
            Assert.AreEqual(tokenCount, options.MaxTokens);
        }
    }

    [TestMethod]
    public void MaxTokens_AcceptsZeroAndNegativeValues()
    {
        // Arrange
        var options = new AzureOpenAIOptions();

        // Act & Assert
        options.MaxTokens = 0;
        Assert.AreEqual(0, options.MaxTokens);

        options.MaxTokens = -1;
        Assert.AreEqual(-1, options.MaxTokens);
    }

    [TestMethod]
    public void Temperature_AcceptsValidRange()
    {
        // Arrange
        var options = new AzureOpenAIOptions();
        var validTemperatures = new[] { 0.0, 0.1, 0.3, 0.5, 0.7, 1.0, 1.5, 2.0 };

        // Act & Assert
        foreach (var temperature in validTemperatures)
        {
            options.Temperature = temperature;
            Assert.AreEqual(temperature, options.Temperature);
        }
    }

    [TestMethod]
    public void Temperature_AcceptsExtendedRange()
    {
        // Arrange
        var options = new AzureOpenAIOptions();

        // Act & Assert
        options.Temperature = -0.5;
        Assert.AreEqual(-0.5, options.Temperature);

        options.Temperature = 3.0;
        Assert.AreEqual(3.0, options.Temperature);
    }

    [TestMethod]
    public void Enabled_AcceptsBooleanValues()
    {
        // Arrange
        var options = new AzureOpenAIOptions();

        // Act & Assert
        options.Enabled = true;
        Assert.IsTrue(options.Enabled);

        options.Enabled = false;
        Assert.IsFalse(options.Enabled);
    }

    [TestMethod]
    public void ObjectInitializer_SetsAllProperties()
    {
        // Act
        var options = new AzureOpenAIOptions
        {
            Endpoint = "https://test.openai.azure.com/",
            ApiKey = "test-key",
            DeploymentName = "gpt-4",
            ApiVersion = "2024-03-01",
            MaxTokens = 2000,
            Temperature = 0.8,
            Enabled = true
        };

        // Assert
        Assert.AreEqual("https://test.openai.azure.com/", options.Endpoint);
        Assert.AreEqual("test-key", options.ApiKey);
        Assert.AreEqual("gpt-4", options.DeploymentName);
        Assert.AreEqual("2024-03-01", options.ApiVersion);
        Assert.AreEqual(2000, options.MaxTokens);
        Assert.AreEqual(0.8, options.Temperature);
        Assert.IsTrue(options.Enabled);
    }

    [TestMethod]
    public void PropertyAssignment_IsIndependent()
    {
        // Arrange
        var options1 = new AzureOpenAIOptions();
        var options2 = new AzureOpenAIOptions();

        // Act
        options1.Endpoint = "https://resource1.openai.azure.com/";
        options1.MaxTokens = 1000;
        options1.Enabled = true;

        options2.Endpoint = "https://resource2.openai.azure.com/";
        options2.MaxTokens = 2000;
        options2.Enabled = false;

        // Assert
        Assert.AreEqual("https://resource1.openai.azure.com/", options1.Endpoint);
        Assert.AreEqual(1000, options1.MaxTokens);
        Assert.IsTrue(options1.Enabled);

        Assert.AreEqual("https://resource2.openai.azure.com/", options2.Endpoint);
        Assert.AreEqual(2000, options2.MaxTokens);
        Assert.IsFalse(options2.Enabled);
    }
}