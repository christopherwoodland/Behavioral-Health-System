using Microsoft.VisualStudio.TestTools.UnitTesting;
using BehavioralHealthSystem.Models;

namespace BehavioralHealthSystem.Tests
{
    [TestClass]
    public class InitiateRequestTests
    {
        [TestMethod]
        public void InitiateRequest_Constructor_Succeeds()
        {
            var model = new InitiateRequest();
            Assert.IsNotNull(model);
        }
    }
}
