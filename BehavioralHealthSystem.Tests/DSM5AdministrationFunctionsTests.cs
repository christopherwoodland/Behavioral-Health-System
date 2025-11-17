using Moq;
using Microsoft.Extensions.Logging;

namespace BehavioralHealthSystem.Tests;

[TestClass]
public class DSM5AdministrationFunctionsTests
{
    private DSM5AdministrationFunctions _functions = null!;
    private Mock<ILogger<DSM5AdministrationFunctions>> _mockLogger = null!;
    private Mock<IDSM5DataService> _mockDSM5DataService = null!;

    [TestInitialize]
    public void Setup()
    {
        _mockLogger = new Mock<ILogger<DSM5AdministrationFunctions>>();
        _mockDSM5DataService = new Mock<IDSM5DataService>();

        _functions = new DSM5AdministrationFunctions(
            _mockLogger.Object,
            _mockDSM5DataService.Object);
    }

    [TestMethod]
    public void Constructor_WithValidParameters_InitializesSuccessfully()
    {
        // Act & Assert - Constructor should not throw
        var functions = new DSM5AdministrationFunctions(
            _mockLogger.Object,
            _mockDSM5DataService.Object);

        Assert.IsNotNull(functions);
    }

    [TestMethod]
    public void Constructor_WithNullLogger_ThrowsArgumentNullException()
    {
        // Act & Assert
        Assert.ThrowsException<ArgumentNullException>(() =>
            new DSM5AdministrationFunctions(null!, _mockDSM5DataService.Object));
    }

    [TestMethod]
    public void Constructor_WithNullDSM5DataService_ThrowsArgumentNullException()
    {
        // Act & Assert
        Assert.ThrowsException<ArgumentNullException>(() =>
            new DSM5AdministrationFunctions(_mockLogger.Object, null!));
    }

    [TestMethod]
    public void Constructor_WithAllNullParameters_ThrowsArgumentNullException()
    {
        // Act & Assert
        Assert.ThrowsException<ArgumentNullException>(() =>
            new DSM5AdministrationFunctions(null!, null!));
    }

    [TestMethod]
    public void Constructor_VerifyServicesInjected()
    {
        // Arrange & Act
        var functions = new DSM5AdministrationFunctions(
            _mockLogger.Object,
            _mockDSM5DataService.Object);

        // Assert - Constructor completes successfully with all dependencies
        Assert.IsNotNull(functions);

        // Verify dependencies were accepted (no exceptions thrown)
        _mockLogger.VerifyNoOtherCalls();
        _mockDSM5DataService.VerifyNoOtherCalls();
    }
}
