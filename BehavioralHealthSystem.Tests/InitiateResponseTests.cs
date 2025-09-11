using Microsoft.VisualStudio.TestTools.UnitTesting;
using BehavioralHealthSystem.Models;

namespace BehavioralHealthSystem.Tests
{
    [TestClass]
    public class InitiateResponseTests
    {
        [TestMethod]
        public void InitiateResponse_Constructor_Succeeds()
        {
            var model = new InitiateResponse();
            Assert.IsNotNull(model);
        }
    }
}
