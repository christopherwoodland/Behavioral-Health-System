using BehavioralHealthSystem.Helpers.Models;

namespace BehavioralHealthSystem.Tests;

/// <summary>
/// Unit tests for UserBiometricData model
/// </summary>
[TestClass]
public class UserBiometricDataTests
{
    #region Default Constructor Tests

    [TestMethod]
    public void DefaultConstructor_SetsDefaultValues()
    {
        var data = new UserBiometricData();

        Assert.AreEqual(string.Empty, data.UserId);
        Assert.AreEqual(string.Empty, data.Nickname);
        Assert.IsNull(data.WeightKg);
        Assert.IsNull(data.HeightCm);
        Assert.IsNull(data.Age);
        Assert.IsNull(data.Gender);
        Assert.IsNull(data.Pronoun);
        Assert.IsNull(data.LastResidence);
        Assert.IsNotNull(data.Hobbies);
        Assert.AreEqual(0, data.Hobbies.Count);
        Assert.IsNotNull(data.Likes);
        Assert.IsNotNull(data.Dislikes);
        Assert.IsNull(data.AdditionalInfo);
        Assert.AreEqual("Matron", data.Source);
        Assert.IsNull(data.LastUpdated);
    }

    #endregion

    #region Parameterized Constructor Tests

    [TestMethod]
    public void Constructor_WithValidArgs_SetsProperties()
    {
        var data = new UserBiometricData("user-123", "TestUser");

        Assert.AreEqual("user-123", data.UserId);
        Assert.AreEqual("TestUser", data.Nickname);
        Assert.AreEqual("Matron", data.Source);
    }

    [TestMethod]
    [ExpectedException(typeof(ArgumentNullException))]
    public void Constructor_WithNullUserId_ThrowsArgumentNullException()
    {
        _ = new UserBiometricData(null!, "nickname");
    }

    [TestMethod]
    [ExpectedException(typeof(ArgumentNullException))]
    public void Constructor_WithEmptyUserId_ThrowsArgumentNullException()
    {
        _ = new UserBiometricData("", "nickname");
    }

    [TestMethod]
    [ExpectedException(typeof(ArgumentNullException))]
    public void Constructor_WithWhitespaceUserId_ThrowsArgumentNullException()
    {
        _ = new UserBiometricData("   ", "nickname");
    }

    [TestMethod]
    [ExpectedException(typeof(ArgumentNullException))]
    public void Constructor_WithNullNickname_ThrowsArgumentNullException()
    {
        _ = new UserBiometricData("user-id", null!);
    }

    [TestMethod]
    [ExpectedException(typeof(ArgumentNullException))]
    public void Constructor_WithEmptyNickname_ThrowsArgumentNullException()
    {
        _ = new UserBiometricData("user-id", "");
    }

    #endregion

    #region GetBlobPath Tests

    [TestMethod]
    public void GetBlobPath_ReturnsCorrectPath()
    {
        var data = new UserBiometricData("user-abc", "Test");

        Assert.AreEqual("users/user-abc/biometric.json", data.GetBlobPath());
    }

    [TestMethod]
    public void GetBlobPath_WithDefaultConstructor_ReturnsPathWithEmptyUserId()
    {
        var data = new UserBiometricData { UserId = "custom-user" };

        Assert.AreEqual("users/custom-user/biometric.json", data.GetBlobPath());
    }

    #endregion

    #region MarkAsUpdated Tests

    [TestMethod]
    public void MarkAsUpdated_SetsLastUpdated()
    {
        var data = new UserBiometricData("user-1", "Nick");
        Assert.IsNull(data.LastUpdated);

        data.MarkAsUpdated();

        Assert.IsNotNull(data.LastUpdated);
        Assert.IsTrue(data.LastUpdated.Value <= DateTime.UtcNow);
    }

    [TestMethod]
    public void MarkAsUpdated_CalledMultipleTimes_UpdatesTimestamp()
    {
        var data = new UserBiometricData("user-1", "Nick");
        data.MarkAsUpdated();
        var firstUpdate = data.LastUpdated;

        System.Threading.Thread.Sleep(10);
        data.MarkAsUpdated();

        Assert.IsNotNull(data.LastUpdated);
        Assert.IsTrue(data.LastUpdated >= firstUpdate);
    }

    #endregion

    #region Collection Properties Tests

    [TestMethod]
    public void Hobbies_CanAddItems()
    {
        var data = new UserBiometricData();
        data.Hobbies.Add("Reading");
        data.Hobbies.Add("Swimming");

        Assert.AreEqual(2, data.Hobbies.Count);
        Assert.AreEqual("Reading", data.Hobbies[0]);
    }

    [TestMethod]
    public void Likes_CanAddItems()
    {
        var data = new UserBiometricData();
        data.Likes.Add("Music");

        Assert.AreEqual(1, data.Likes.Count);
    }

    [TestMethod]
    public void Dislikes_CanAddItems()
    {
        var data = new UserBiometricData();
        data.Dislikes.Add("Spiders");

        Assert.AreEqual(1, data.Dislikes.Count);
    }

    #endregion

    #region Nullable Property Tests

    [TestMethod]
    public void NullableProperties_CanBeSetAndCleared()
    {
        var data = new UserBiometricData
        {
            WeightKg = 75.5,
            HeightCm = 180.0,
            Age = 30,
            Gender = "male",
            Pronoun = "he/him"
        };

        Assert.AreEqual(75.5, data.WeightKg);
        Assert.AreEqual(180.0, data.HeightCm);
        Assert.AreEqual(30, data.Age);

        data.WeightKg = null;
        data.HeightCm = null;
        data.Age = null;

        Assert.IsNull(data.WeightKg);
        Assert.IsNull(data.HeightCm);
        Assert.IsNull(data.Age);
    }

    #endregion
}
