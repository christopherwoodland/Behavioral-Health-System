using Microsoft.VisualStudio.TestTools.UnitTesting;
using BehavioralHealthSystem.Models;

namespace BehavioralHealthSystem.Tests
{
    [TestClass]
    public class UserMetadataTests
    {
        [TestMethod]
        public void UserMetadata_Constructor_Succeeds()
        {
            var model = new UserMetadata();
            Assert.IsNotNull(model);
        }
    }
}
