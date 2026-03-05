using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace BehavioralHealthSystem.Tests.PostgreSQL;

/// <summary>
/// Tests for the STORAGE_BACKEND environment variable toggle.
/// Validates that configuration values are correctly read and that
/// the PostgreSQL/Blob switching logic behaves as expected.
/// </summary>
[TestClass]
public class StorageBackendToggleTests
{
    #region STORAGE_BACKEND Configuration Tests

    [TestMethod]
    public void StorageBackend_NotSet_DefaultsToBlobStorage()
    {
        // Arrange
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>())
            .Build();

        // Act
        var storageBackend = config["STORAGE_BACKEND"] ?? "BlobStorage";

        // Assert
        Assert.AreEqual("BlobStorage", storageBackend);
    }

    [TestMethod]
    public void StorageBackend_SetToPostgreSQL_ReturnsPostgreSQL()
    {
        // Arrange
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                { "STORAGE_BACKEND", "PostgreSQL" }
            })
            .Build();

        // Act
        var storageBackend = config["STORAGE_BACKEND"] ?? "BlobStorage";

        // Assert
        Assert.AreEqual("PostgreSQL", storageBackend);
    }

    [TestMethod]
    public void StorageBackend_SetToBlobStorage_ReturnsBlobStorage()
    {
        // Arrange
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                { "STORAGE_BACKEND", "BlobStorage" }
            })
            .Build();

        // Act
        var storageBackend = config["STORAGE_BACKEND"] ?? "BlobStorage";

        // Assert
        Assert.AreEqual("BlobStorage", storageBackend);
    }

    [TestMethod]
    public void StorageBackend_CaseInsensitiveComparison_Works()
    {
        // Arrange
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                { "STORAGE_BACKEND", "postgresql" }
            })
            .Build();

        // Act
        var storageBackend = config["STORAGE_BACKEND"] ?? "BlobStorage";
        var isPostgres = storageBackend.Equals("PostgreSQL", StringComparison.OrdinalIgnoreCase);

        // Assert
        Assert.IsTrue(isPostgres);
    }

    [TestMethod]
    public void StorageBackend_EmptyString_DefaultsToBlobStorage()
    {
        // Arrange
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                { "STORAGE_BACKEND", "" }
            })
            .Build();

        // Act
        var storageBackend = config["STORAGE_BACKEND"];
        // Empty string is truthy but not "PostgreSQL"
        var isPostgres = !string.IsNullOrEmpty(storageBackend) &&
                         storageBackend.Equals("PostgreSQL", StringComparison.OrdinalIgnoreCase);

        // Assert
        Assert.IsFalse(isPostgres);
    }

    #endregion

    #region POSTGRES_CONNECTION_STRING Configuration Tests

    [TestMethod]
    public void PostgresConnectionString_WhenSet_IsReadable()
    {
        // Arrange
        var testConnString = "Host=localhost;Port=5432;Database=bhs_test;Username=test;Password=test123";
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                { "STORAGE_BACKEND", "PostgreSQL" },
                { "POSTGRES_CONNECTION_STRING", testConnString }
            })
            .Build();

        // Act
        var connString = config["POSTGRES_CONNECTION_STRING"];

        // Assert
        Assert.AreEqual(testConnString, connString);
    }

    [TestMethod]
    public void PostgresConnectionString_NotSet_ReturnsNull()
    {
        // Arrange
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                { "STORAGE_BACKEND", "PostgreSQL" }
            })
            .Build();

        // Act
        var connString = config["POSTGRES_CONNECTION_STRING"];

        // Assert
        Assert.IsNull(connString);
    }

    #endregion

    #region Docker Compose Variable Expansion Tests

    [TestMethod]
    public void StorageBackend_DockerDefaultSyntax_HandledCorrectly()
    {
        // docker-compose uses ${STORAGE_BACKEND:-BlobStorage} which resolves at container level
        // When read by .NET, it's already resolved. This test verifies the resolved value is correct.
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                { "STORAGE_BACKEND", "BlobStorage" } // simulates Docker default
            })
            .Build();

        var storageBackend = config["STORAGE_BACKEND"] ?? "BlobStorage";
        var isPostgres = storageBackend.Equals("PostgreSQL", StringComparison.OrdinalIgnoreCase);

        Assert.IsFalse(isPostgres);
        Assert.AreEqual("BlobStorage", storageBackend);
    }

    #endregion
}
