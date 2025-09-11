using Microsoft.VisualStudio.TestTools.UnitTesting;
using BehavioralHealthSystem.Models;

namespace BehavioralHealthSystem.Tests
{
    [TestClass]
    public class ApiErrorResponseTests
    {
        [TestMethod]
        public void ApiErrorResponse_Constructor_Succeeds()
        {
            var model = new ApiErrorResponse();
            Assert.IsNotNull(model);
        }
    }
}
