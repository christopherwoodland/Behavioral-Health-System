using Moq;
using Microsoft.Extensions.Logging;
using BehavioralHealthSystem.Helpers.Services.Interfaces;

namespace BehavioralHealthSystem.Tests;

[TestClass]
public class ExtendedRiskAssessmentFunctionsTests
{
    private ExtendedRiskAssessmentFunctions _functions = null!;
    private Mock<ILogger<ExtendedRiskAssessmentFunctions>> _mockLogger = null!;
    private Mock<IRiskAssessmentService> _mockRiskAssessmentService = null!;
    private Mock<ISessionStorageService> _mockSessionStorageService = null!;
    private Mock<IExtendedAssessmentJobService> _mockJobService = null!;

    [TestInitialize]
    public void Setup()
    {
        _mockLogger = new Mock<ILogger<ExtendedRiskAssessmentFunctions>>();
        _mockRiskAssessmentService = new Mock<IRiskAssessmentService>();
        _mockSessionStorageService = new Mock<ISessionStorageService>();
        _mockJobService = new Mock<IExtendedAssessmentJobService>();

        _functions = new ExtendedRiskAssessmentFunctions(
            _mockLogger.Object,
            _mockRiskAssessmentService.Object,
            _mockSessionStorageService.Object,
            _mockJobService.Object);
    }

    [TestMethod]
    public void Constructor_WithValidParameters_InitializesSuccessfully()
    {
        // Act & Assert - Constructor should not throw
        var functions = new ExtendedRiskAssessmentFunctions(
            _mockLogger.Object,
            _mockRiskAssessmentService.Object,
            _mockSessionStorageService.Object,
            _mockJobService.Object);

        Assert.IsNotNull(functions);
    }

    [TestMethod]
    public void Constructor_WithNullLogger_ThrowsArgumentNullException()
    {
        // Act & Assert
        Assert.ThrowsException<ArgumentNullException>(() =>
            new ExtendedRiskAssessmentFunctions(
                null!,
                _mockRiskAssessmentService.Object,
                _mockSessionStorageService.Object,
                _mockJobService.Object));
    }

    [TestMethod]
    public void Constructor_WithNullRiskAssessmentService_ThrowsArgumentNullException()
    {
        // Act & Assert
        Assert.ThrowsException<ArgumentNullException>(() =>
            new ExtendedRiskAssessmentFunctions(
                _mockLogger.Object,
                null!,
                _mockSessionStorageService.Object,
                _mockJobService.Object));
    }

    [TestMethod]
    public void Constructor_WithNullSessionStorageService_ThrowsArgumentNullException()
    {
        // Act & Assert
        Assert.ThrowsException<ArgumentNullException>(() =>
            new ExtendedRiskAssessmentFunctions(
                _mockLogger.Object,
                _mockRiskAssessmentService.Object,
                null!,
                _mockJobService.Object));
    }

    [TestMethod]
    public void Constructor_WithNullJobService_ThrowsArgumentNullException()
    {
        // Act & Assert
        Assert.ThrowsException<ArgumentNullException>(() =>
            new ExtendedRiskAssessmentFunctions(
                _mockLogger.Object,
                _mockRiskAssessmentService.Object,
                _mockSessionStorageService.Object,
                null!));
    }

    [TestMethod]
    public void Constructor_WithAllNullParameters_ThrowsArgumentNullException()
    {
        // Act & Assert
        Assert.ThrowsException<ArgumentNullException>(() =>
            new ExtendedRiskAssessmentFunctions(null!, null!, null!, null!));
    }

    [TestMethod]
    public void Constructor_VerifyAllDependenciesInjected()
    {
        // Arrange & Act
        var functions = new ExtendedRiskAssessmentFunctions(
            _mockLogger.Object,
            _mockRiskAssessmentService.Object,
            _mockSessionStorageService.Object,
            _mockJobService.Object);

        // Assert - Constructor completes successfully with all dependencies
        Assert.IsNotNull(functions);

        // Verify dependencies were accepted (no exceptions thrown)
        _mockLogger.VerifyNoOtherCalls();
        _mockRiskAssessmentService.VerifyNoOtherCalls();
        _mockSessionStorageService.VerifyNoOtherCalls();
        _mockJobService.VerifyNoOtherCalls();
    }
}
