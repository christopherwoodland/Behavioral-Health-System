using Moq;
using Microsoft.Extensions.Logging;
using BehavioralHealthSystem.Functions.Functions;

namespace BehavioralHealthSystem.Tests;

[TestClass]
public class SaveSmartBandDataFunctionTests
{
    private SaveSmartBandDataFunction _function = null!;
    private Mock<ILogger<SaveSmartBandDataFunction>> _mockLogger = null!;
    private const string TestConnectionString = "UseDevelopmentStorage=true";

    [TestInitialize]
    public void Setup()
    {
        _mockLogger = new Mock<ILogger<SaveSmartBandDataFunction>>();

        // Set the required environment variable for testing
        Environment.SetEnvironmentVariable("AzureWebJobsStorage", TestConnectionString);

        _function = new SaveSmartBandDataFunction(_mockLogger.Object);
    }

    [TestCleanup]
    public void Cleanup()
    {
        // Clean up environment variable
        Environment.SetEnvironmentVariable("AzureWebJobsStorage", null);
    }

    [TestMethod]
    public void Constructor_WithValidParameters_InitializesSuccessfully()
    {
        // Arrange & Act
        var function = new SaveSmartBandDataFunction(_mockLogger.Object);

        // Assert
        Assert.IsNotNull(function);
    }

    [TestMethod]
    public void Constructor_WithNullLogger_ThrowsArgumentNullException()
    {
        // Act & Assert
        Assert.ThrowsException<ArgumentNullException>(() =>
            new SaveSmartBandDataFunction(null!));
    }

    [TestMethod]
    public void Constructor_WithMissingConnectionString_ThrowsInvalidOperationException()
    {
        // Arrange
        Environment.SetEnvironmentVariable("AzureWebJobsStorage", null);

        // Act & Assert
        Assert.ThrowsException<InvalidOperationException>(() =>
            new SaveSmartBandDataFunction(_mockLogger.Object));
    }

    [TestMethod]
    public void Constructor_WithEmptyConnectionString_ThrowsInvalidOperationException()
    {
        // Arrange
        Environment.SetEnvironmentVariable("AzureWebJobsStorage", "");

        // Act & Assert
        Assert.ThrowsException<InvalidOperationException>(() =>
            new SaveSmartBandDataFunction(_mockLogger.Object));
    }

    [TestMethod]
    public void Constructor_VerifyLoggerInjected()
    {
        // Arrange
        Environment.SetEnvironmentVariable("AzureWebJobsStorage", TestConnectionString);

        // Act
        var function = new SaveSmartBandDataFunction(_mockLogger.Object);

        // Assert - Constructor completes successfully with logger dependency
        Assert.IsNotNull(function);

        // Verify logger was accepted (no exceptions thrown)
        _mockLogger.VerifyNoOtherCalls();

        // Cleanup
        Environment.SetEnvironmentVariable("AzureWebJobsStorage", null);
    }
}
